import Foundation
import Capacitor
import AVFoundation
import MediaPlayer
import UIKit

@objc(QuranReaderNativeAudioPlugin)
public class QuranReaderNativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "QuranReaderNativeAudioPlugin"
    public let jsName = "QuranReaderNativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "playOne", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "replaceItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var periodicTimeObserver: Any?
    private var remoteSurahCommandsEnabled = false
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var wasPlayingBeforeInterruption = false

    private static let rewindSeekThresholdSeconds: Double = 3
    private static let lockscreenSkipIntervalSeconds: Double = 15

    /// Underlying value of `MPNowPlayingInfoPropertyPlaybackDuration` (Swift overlay may not expose the constant in all targets).
    private static let nowPlayingPlaybackDurationKey = "playbackDuration"

    private func applySkipByInterval(seconds: Double) -> MPRemoteCommandHandlerStatus {
        guard let p = player else { return .commandFailed }
        let cur = CMTimeGetSeconds(p.currentTime())
        let dur = p.currentItem?.duration.seconds ?? 0
        let targetRaw = cur + seconds
        let target =
            (dur.isFinite && dur > 0)
            ? min(max(0, targetRaw), max(0, dur - 0.25))
            : max(0, targetRaw)
        if !target.isFinite { return .commandFailed }
        p.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        if remoteSurahCommandsEnabled {
            var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = target
            np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
            MPNowPlayingInfoCenter.default().nowPlayingInfo = np
        }
        return .success
    }

    /// Legacy behavior for "previous": restart current surah if not near start, else step to previous surah.
    private func applyRemotePreviousSurahOrRestartSeek() -> MPRemoteCommandHandlerStatus {
        guard let p = player else { return .commandFailed }
        let seconds = CMTimeGetSeconds(p.currentTime())
        if seconds.isFinite && seconds > Self.rewindSeekThresholdSeconds {
            p.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
            if remoteSurahCommandsEnabled {
                var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = 0.0
                np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
                MPNowPlayingInfoCenter.default().nowPlayingInfo = np
            }
            return .success
        }
        notifyListeners("surahStep", data: ["direction": -1])
        return .success
    }

    private func applyRemoteNextSurah() -> MPRemoteCommandHandlerStatus {
        notifyListeners("surahStep", data: ["direction": 1])
        return .success
    }

    private func resolvePlaybackURL(_ raw: String) -> URL? {
        if let u = URL(string: raw), u.scheme != nil {
            return u
        }
        if raw.hasPrefix("file://") {
            let path = String(raw.dropFirst("file://".count))
            if path.hasPrefix("/") {
                return URL(fileURLWithPath: path)
            }
        }
        let allowed = CharacterSet.urlFragmentAllowed
            .union(.urlPathAllowed)
            .union(CharacterSet(charactersIn: "%#"))
        if let encoded = raw.addingPercentEncoding(withAllowedCharacters: allowed) {
            return URL(string: encoded)
        }
        return nil
    }

    /// `UIApplication` remote-control registration must run on the main thread (Main Thread Checker).
    private func performOnMainThread(_ work: () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.sync(execute: work)
        }
    }

    /// Walks the hierarchy for `CAPBridgeViewController` first: WKWebView often sits under a
    /// generic container that returns `false` for `canBecomeFirstResponder`, which prevents
    /// Now Playing / lock-screen routing for Capacitor apps.
    private func viewControllerHostingBridge(from root: UIViewController?) -> UIViewController? {
        guard let root else { return nil }
        if root is CAPBridgeViewController { return root }
        for child in root.children {
            if let found = viewControllerHostingBridge(from: child) { return found }
        }
        if let nav = root as? UINavigationController {
            return viewControllerHostingBridge(from: nav.visibleViewController ?? nav.topViewController)
        }
        if let tab = root as? UITabBarController {
            return viewControllerHostingBridge(from: tab.selectedViewController)
        }
        return nil
    }

    /// Without a first responder in the native view hierarchy, iOS often never surfaces
    /// `MPNowPlayingInfoCenter` on the lock screen for Capacitor/WKWebView apps.
    private func becomeKeyWindowRootFirstResponder() {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window =
            scenes.flatMap(\.windows).first(where: { $0.isKeyWindow })
            ?? scenes.first?.windows.first
        guard let root = window?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        let ordered: [UIViewController] = [
            viewControllerHostingBridge(from: top),
            viewControllerHostingBridge(from: root),
            top,
        ].compactMap { $0 }
        var seen = Set<ObjectIdentifier>()
        for vc in ordered {
            let id = ObjectIdentifier(vc)
            guard !seen.contains(id) else { continue }
            seen.insert(id)
            if vc.canBecomeFirstResponder {
                _ = vc.becomeFirstResponder()
                break
            }
        }
    }

    /// Deferred retries: the web view can reclaim first responder on the next layout pass.
    private func scheduleRemoteControlFirstResponderRetries() {
        let delays: [TimeInterval] = [0.15, 0.45, 1.0]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self, self.remoteSurahCommandsEnabled, self.player != nil else { return }
                self.becomeKeyWindowRootFirstResponder()
            }
        }
    }

    /// Publish rate/duration/elapsed in one pass after playback has actually started (helps LS).
    private func refreshNowPlayingPlaybackStateFromPlayer() {
        guard remoteSurahCommandsEnabled, let p = player else { return }
        let rate = p.rate
        let cur = CMTimeGetSeconds(p.currentTime())
        let dur = p.currentItem?.duration.seconds ?? 0
        var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        np[MPNowPlayingInfoPropertyPlaybackRate] = rate
        if cur.isFinite {
            np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = cur
        }
        if dur.isFinite, dur > 0 {
            np[Self.nowPlayingPlaybackDurationKey] = dur
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = np
    }

    /// Defer one turn so the window/scene is settled after route transitions.
    private func requestFirstResponderForRemoteControlNextRunLoop() {
        DispatchQueue.main.async { [weak self] in
            self?.becomeKeyWindowRootFirstResponder()
        }
    }

    private func clearObservers() {
        if let periodicTimeObserver {
            player?.removeTimeObserver(periodicTimeObserver)
            self.periodicTimeObserver = nil
        }
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        statusObserver?.invalidate()
        statusObserver = nil
    }

    private func attachAudioSessionObserversIfNeeded() {
        if interruptionObserver == nil {
            interruptionObserver = NotificationCenter.default.addObserver(
                forName: AVAudioSession.interruptionNotification,
                object: AVAudioSession.sharedInstance(),
                queue: .main
            ) { [weak self] note in
                guard let self else { return }
                guard let info = note.userInfo else { return }
                let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt ?? 0
                guard let type = AVAudioSession.InterruptionType(rawValue: typeRaw) else { return }
                switch type {
                case .began:
                    let playing = (self.player?.rate ?? 0) != 0
                    self.wasPlayingBeforeInterruption = playing
                    self.player?.pause()
                    if self.remoteSurahCommandsEnabled {
                        MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
                    }
                    self.notifyListeners("paused", data: [:])
                case .ended:
                    let optionsRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
                    guard self.wasPlayingBeforeInterruption else { return }
                    guard options.contains(.shouldResume) else { return }
                    do {
                        try AVAudioSession.sharedInstance().setActive(true)
                    } catch {
                        // Best-effort: if re-activating fails, don't force play.
                        return
                    }
                    self.player?.play()
                    if self.remoteSurahCommandsEnabled {
                        MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
                    }
                    self.notifyListeners("resumed", data: [:])
                @unknown default:
                    break
                }
            }
        }
        if routeChangeObserver == nil {
            routeChangeObserver = NotificationCenter.default.addObserver(
                forName: AVAudioSession.routeChangeNotification,
                object: AVAudioSession.sharedInstance(),
                queue: .main
            ) { [weak self] note in
                guard let self else { return }
                guard let info = note.userInfo else { return }
                let reasonRaw = info[AVAudioSessionRouteChangeReasonKey] as? UInt ?? 0
                guard let reason = AVAudioSession.RouteChangeReason(rawValue: reasonRaw) else { return }
                // If headphones/Bluetooth disconnect, pause to avoid "playing silently" surprises.
                if reason == .oldDeviceUnavailable {
                    self.player?.pause()
                    if self.remoteSurahCommandsEnabled {
                        MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
                    }
                    self.notifyListeners("paused", data: [:])
                }
            }
        }
    }

    private func clearAudioSessionObservers() {
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
            self.interruptionObserver = nil
        }
        if let routeChangeObserver {
            NotificationCenter.default.removeObserver(routeChangeObserver)
            self.routeChangeObserver = nil
        }
        wasPlayingBeforeInterruption = false
    }

    private func attachPeriodicTickObserver(to av: AVPlayer) {
        if let periodicTimeObserver {
            av.removeTimeObserver(periodicTimeObserver)
            self.periodicTimeObserver = nil
        }
        // Verse highlighting reads `currentTime` from this callback. 0.2s keeps
        // the highlight visually flush with audio without flooding the JS bridge.
        let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
        periodicTimeObserver = av.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self, let p = self.player, p === av else { return }
            let cur = CMTimeGetSeconds(time)
            let dur = p.currentItem?.duration.seconds ?? 0
            if self.remoteSurahCommandsEnabled {
                var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                if dur.isFinite, dur > 0 {
                    np[Self.nowPlayingPlaybackDurationKey] = dur
                }
                if cur.isFinite {
                    np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = cur
                }
                np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
                MPNowPlayingInfoCenter.default().nowPlayingInfo = np
            }
            let durOut = (dur.isFinite && dur > 0) ? dur : 0.0
            let curOut = cur.isFinite ? cur : 0.0
            self.notifyListeners("playbackTick", data: [
                "currentTime": curOut,
                "duration": durOut,
            ])
        }
    }

    private func clearRemoteCommandTargets() {
        let cc = MPRemoteCommandCenter.shared()
        cc.playCommand.removeTarget(nil)
        cc.pauseCommand.removeTarget(nil)
        cc.togglePlayPauseCommand.removeTarget(nil)
        cc.previousTrackCommand.removeTarget(nil)
        cc.nextTrackCommand.removeTarget(nil)
        cc.skipForwardCommand.removeTarget(nil)
        cc.skipBackwardCommand.removeTarget(nil)
        cc.changePlaybackPositionCommand.removeTarget(nil)
        if #available(iOS 9.1, *) {
            cc.seekBackwardCommand.removeTarget(nil)
            cc.seekForwardCommand.removeTarget(nil)
        }
        cc.skipForwardCommand.preferredIntervals = []
        cc.skipBackwardCommand.preferredIntervals = []
        cc.changePlaybackPositionCommand.isEnabled = false
        cc.playCommand.isEnabled = false
        cc.pauseCommand.isEnabled = false
        cc.togglePlayPauseCommand.isEnabled = false
        cc.previousTrackCommand.isEnabled = false
        cc.nextTrackCommand.isEnabled = false
        cc.skipForwardCommand.isEnabled = false
        cc.skipBackwardCommand.isEnabled = false
        if #available(iOS 9.1, *) {
            cc.seekBackwardCommand.isEnabled = false
            cc.seekForwardCommand.isEnabled = false
        }
    }

    private func stopInternal() {
        clearObservers()
        clearRemoteCommandTargets()
        remoteSurahCommandsEnabled = false
        wasPlayingBeforeInterruption = false
        player?.pause()
        player = nil
        performOnMainThread {
            UIApplication.shared.endReceivingRemoteControlEvents()
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        performOnMainThread {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            } catch {
                // Best-effort: do not fail teardown on audio-session errors.
            }
        }
    }

    /// Configure the shared session for Quran / library playback. Must run on the main thread.
    /// Callers (`playOne`) invoke this AFTER `stopInternal()`, which already deactivates the session
    /// via `setActive(false, .notifyOthersOnDeactivation)` — so the historical OSStatus -50 guard
    /// (that required `.mixWithOthers` here to match AppDelegate's launch session) no longer applies.
    /// `.mixWithOthers` MUST stay off during normal playback: iOS will not award the lock-screen
    /// Now Playing tile to a session that declares itself a secondary mixer. If another app holds
    /// exclusive audio focus and `setActive(true)` throws `AVAudioSessionErrorCodeCannotInterruptOthers`,
    /// fall back once with `.mixWithOthers` to keep audio playing in degraded mode (no Now Playing tile —
    /// same outcome as before, so no regression for that case).
    private func configurePlaybackAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        var primary: AVAudioSession.CategoryOptions = [.allowAirPlay]
        if #available(iOS 10.0, *) {
            primary.insert(.allowBluetoothA2DP)
        }
        do {
            try session.setCategory(.playback, mode: .default, options: primary)
        } catch {
            try session.setCategory(.playback, mode: .default, options: [])
        }
        do {
            try session.setActive(true)
        } catch {
            try session.setCategory(.playback, mode: .default, options: primary.union([.mixWithOthers]))
            try session.setActive(true)
        }
    }

    @objc func playOne(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = resolvePlaybackURL(urlString) else {
            call.reject("invalid_url", "Missing or invalid url", nil)
            return
        }

        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? ""
        let startFraction = call.getDouble("startFraction", -1)
        // Must be applied *after* stopInternal(): stopInternal() resets this flag for teardown.
        let wantsRemoteSurahCommands = call.getBool("remoteSurahCommands", false)

        stopInternal()
        remoteSurahCommandsEnabled = wantsRemoteSurahCommands

        var sessionError: Error?
        performOnMainThread {
            do {
                // Do not combine `.allowBluetoothHFP` with `.allowBluetoothA2DP` here — that can
                // yield OSStatus -50 on device. `.mixWithOthers` is intentionally NOT applied during
                // playback (would suppress the lock-screen Now Playing tile); see the helper for details.
                try self.configurePlaybackAudioSession()
            } catch {
                sessionError = error
            }
        }
        if let sessionError {
            notifyListeners("error", data: ["message": sessionError.localizedDescription])
            call.reject("audio_session", sessionError.localizedDescription, nil)
            return
        }
        attachAudioSessionObserversIfNeeded()

        // AVPlayer + `MPNowPlayingInfoCenter` / `MPRemoteCommandCenter` must be owned on the main
        // thread; publishing Now Playing off the Capacitor bridge thread prevented the Quran Audio
        // (Library) lock-screen card from appearing. Reader mode intentionally skips Now Playing and
        // remote-command registration so the lock screen stays verse-sync only in-app.
        performOnMainThread {
            if wantsRemoteSurahCommands {
                UIApplication.shared.beginReceivingRemoteControlEvents()
            } else {
                MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
                UIApplication.shared.endReceivingRemoteControlEvents()
            }

            let item = AVPlayerItem(url: url)
            let av = AVPlayer(playerItem: item)
            self.player = av

            if wantsRemoteSurahCommands {
                // Keep playbackRate at 0 until AVPlayer is actually playing; mismatched rate/metadata
                // has prevented the lock-screen Now Playing card on some iOS builds.
                var info: [String: Any] = [
                    MPMediaItemPropertyTitle: title,
                    MPMediaItemPropertyArtist: artist,
                    MPNowPlayingInfoPropertyPlaybackRate: 0.0,
                    MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
                    MPNowPlayingInfoPropertyElapsedPlaybackTime: 0.0,
                    MPMediaItemPropertyMediaType: NSNumber(value: MPMediaType.music.rawValue),
                ]
                if let artworkImage = UIImage(named: "QuranReaderArtwork") {
                    let artwork = MPMediaItemArtwork(boundsSize: artworkImage.size) { _ in artworkImage }
                    info[MPMediaItemPropertyArtwork] = artwork
                }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info

                let commandCenter = MPRemoteCommandCenter.shared()
                commandCenter.changePlaybackPositionCommand.isEnabled = true
                commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
                    guard let self, let p = self.player else { return .commandFailed }
                    guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
                    let dur = p.currentItem?.duration.seconds ?? 0
                    let target =
                        (dur.isFinite && dur > 0)
                        ? min(max(0, e.positionTime), max(0, dur - 0.25))
                        : max(0, e.positionTime)
                    if !target.isFinite { return .commandFailed }
                    p.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
                    var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = target
                    np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = np
                    return .success
                }
                if #available(iOS 9.1, *) {
                    commandCenter.seekBackwardCommand.isEnabled = false
                    commandCenter.seekForwardCommand.isEnabled = false
                }

                commandCenter.skipBackwardCommand.preferredIntervals = []
                commandCenter.skipForwardCommand.preferredIntervals = []
                commandCenter.skipBackwardCommand.isEnabled = false
                commandCenter.skipForwardCommand.isEnabled = false

                commandCenter.previousTrackCommand.isEnabled = true
                commandCenter.nextTrackCommand.isEnabled = true
                commandCenter.previousTrackCommand.addTarget { [weak self] _ in
                    guard let self else { return .commandFailed }
                    return self.applyRemotePreviousSurahOrRestartSeek()
                }
                commandCenter.nextTrackCommand.addTarget { [weak self] _ in
                    guard let self else { return .commandFailed }
                    return self.applyRemoteNextSurah()
                }

                commandCenter.playCommand.isEnabled = true
                commandCenter.pauseCommand.isEnabled = true
                commandCenter.togglePlayPauseCommand.isEnabled = true
                commandCenter.playCommand.addTarget { [weak self] _ in
                    guard let self, let p = self.player else { return .commandFailed }
                    p.play()
                    self.refreshNowPlayingPlaybackStateFromPlayer()
                    self.notifyListeners("resumed", data: [:])
                    return .success
                }
                commandCenter.pauseCommand.addTarget { [weak self] _ in
                    guard let self, let p = self.player else { return .commandFailed }
                    p.pause()
                    self.refreshNowPlayingPlaybackStateFromPlayer()
                    self.notifyListeners("paused", data: [:])
                    return .success
                }
                commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
                    guard let self, let p = self.player else { return .commandFailed }
                    if p.rate == 0 {
                        p.play()
                        self.refreshNowPlayingPlaybackStateFromPlayer()
                        self.notifyListeners("resumed", data: [:])
                        return .success
                    }
                    p.pause()
                    self.refreshNowPlayingPlaybackStateFromPlayer()
                    self.notifyListeners("paused", data: [:])
                    return .success
                }

                self.becomeKeyWindowRootFirstResponder()
                self.requestFirstResponderForRemoteControlNextRunLoop()
                self.scheduleRemoteControlFirstResponderRetries()
            }

            self.endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.notifyListeners("ended", data: [:])
                // Intentionally NOT calling `stopInternal()` here. Tearing down the AVPlayer +
                // deactivating the audio session at item end (a) prevents iOS from re-activating
                // the session for the next surah from the background (auto-advance fails on the
                // lock screen), and (b) leaves a gap during which iOS routes remote commands to
                // another media app (e.g. Apple Music). JS owns the decision: it either calls
                // `replaceItem` to swap items in place (auto-advance) or `stop` to tear down.
            }

            let needsSeek = startFraction >= 0 && startFraction <= 1
            self.statusObserver = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
                guard let self else { return }
                if observed.status == .failed {
                    self.clearObservers()
                    self.player?.pause()
                    self.player = nil
                    self.notifyListeners("error", data: ["message": "avplayer_item_failed"])
                    return
                }
                guard observed.status == .readyToPlay else { return }

                self.statusObserver?.invalidate()
                self.statusObserver = nil

                if needsSeek {
                    let seconds = observed.duration.seconds
                    guard seconds.isFinite, seconds > 0 else {
                        self.player?.play()
                        if let av = self.player {
                            self.attachPeriodicTickObserver(to: av)
                        }
                        if self.remoteSurahCommandsEnabled {
                            self.performOnMainThread {
                                self.refreshNowPlayingPlaybackStateFromPlayer()
                                self.becomeKeyWindowRootFirstResponder()
                                self.requestFirstResponderForRemoteControlNextRunLoop()
                                self.scheduleRemoteControlFirstResponderRetries()
                            }
                        }
                        return
                    }
                    if self.remoteSurahCommandsEnabled {
                        self.performOnMainThread {
                            var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                            np[Self.nowPlayingPlaybackDurationKey] = seconds
                            MPNowPlayingInfoCenter.default().nowPlayingInfo = np
                        }
                    }
                    let target = min(max(0, startFraction * seconds), max(0, seconds - 0.25))
                    self.player?.seek(
                        to: CMTime(seconds: target, preferredTimescale: 600),
                        toleranceBefore: .zero,
                        toleranceAfter: .zero
                    ) { [weak self] _ in
                        guard let self else { return }
                        self.player?.play()
                        if let av = self.player {
                            self.attachPeriodicTickObserver(to: av)
                        }
                        if self.remoteSurahCommandsEnabled {
                            self.performOnMainThread {
                                self.refreshNowPlayingPlaybackStateFromPlayer()
                                self.becomeKeyWindowRootFirstResponder()
                                self.requestFirstResponderForRemoteControlNextRunLoop()
                                self.scheduleRemoteControlFirstResponderRetries()
                            }
                        }
                    }
                } else {
                    let seconds = observed.duration.seconds
                    if self.remoteSurahCommandsEnabled, seconds.isFinite, seconds > 0 {
                        self.performOnMainThread {
                            var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                            np[Self.nowPlayingPlaybackDurationKey] = seconds
                            MPNowPlayingInfoCenter.default().nowPlayingInfo = np
                        }
                    }
                    self.player?.play()
                    if let av = self.player {
                        self.attachPeriodicTickObserver(to: av)
                    }
                    if self.remoteSurahCommandsEnabled {
                        self.performOnMainThread {
                            self.refreshNowPlayingPlaybackStateFromPlayer()
                            self.becomeKeyWindowRootFirstResponder()
                            self.requestFirstResponderForRemoteControlNextRunLoop()
                            self.scheduleRemoteControlFirstResponderRetries()
                        }
                    }
                }
            }
        }

        call.resolve()
    }

    /// Swap the currently-playing item without tearing down the AVPlayer, audio session, or
    /// remote-command targets. Required for inter-surah continuity on the lock screen:
    /// `playOne` deactivates the session via `stopInternal()` first, and iOS frequently denies
    /// the re-activation that would follow when the app is backgrounded — which both kills
    /// auto-advance and lets another app (typically Apple Music) take over the lock-screen
    /// transport. Caller (JS) must invoke `playOne` first to establish a player; if no player
    /// is live this rejects with `no_active_player` so the caller can fall back to `playOne`.
    @objc func replaceItem(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = resolvePlaybackURL(urlString) else {
            call.reject("invalid_url", "Missing or invalid url", nil)
            return
        }
        guard let player = self.player else {
            call.reject("no_active_player", "replaceItem requires an active player; call playOne first", nil)
            return
        }

        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? ""

        performOnMainThread {
            // The previous item's end-of-play observer is scoped to that AVPlayerItem and would
            // never fire for the new one; remove it before attaching to the replacement.
            if let oldEnd = self.endObserver {
                NotificationCenter.default.removeObserver(oldEnd)
                self.endObserver = nil
            }

            let newItem = AVPlayerItem(url: url)
            player.replaceCurrentItem(with: newItem)

            self.endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: newItem,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.notifyListeners("ended", data: [:])
            }

            // Update Now Playing in place. Title/artist change immediately; elapsed/rate reset
            // so the lock-screen scrubber visibly restarts. Duration is repopulated by the
            // periodic time observer (still attached to the same AVPlayer) once the new item
            // reaches `.readyToPlay`.
            if self.remoteSurahCommandsEnabled {
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyTitle] = title
                info[MPMediaItemPropertyArtist] = artist
                info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = 0.0
                info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }

            player.play()
        }

        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        guard let p = player else {
            call.resolve()
            return
        }
        p.pause()
        if remoteSurahCommandsEnabled {
            MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
        }
        notifyListeners("paused", data: [:])
        call.resolve()
    }

    @objc func resume(_ call: CAPPluginCall) {
        guard let p = player else {
            call.resolve()
            return
        }
        p.play()
        if remoteSurahCommandsEnabled {
            refreshNowPlayingPlaybackStateFromPlayer()
            scheduleRemoteControlFirstResponderRetries()
        }
        notifyListeners("resumed", data: [:])
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopInternal()
        call.resolve()
    }

    deinit {
        stopInternal()
        clearAudioSessionObservers()
    }
}
