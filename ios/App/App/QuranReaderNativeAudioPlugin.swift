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
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var periodicTimeObserver: Any?
    private var remoteSurahCommandsEnabled = false

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
        var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = target
        np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
        MPNowPlayingInfoCenter.default().nowPlayingInfo = np
        return .success
    }

    /// Legacy behavior for "previous": restart current surah if not near start, else step to previous surah.
    private func applyRemotePreviousSurahOrRestartSeek() -> MPRemoteCommandHandlerStatus {
        guard let p = player else { return .commandFailed }
        let seconds = CMTimeGetSeconds(p.currentTime())
        if seconds.isFinite && seconds > Self.rewindSeekThresholdSeconds {
            p.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
            var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = 0.0
            np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
            MPNowPlayingInfoCenter.default().nowPlayingInfo = np
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
            var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            if dur.isFinite, dur > 0 {
                np[Self.nowPlayingPlaybackDurationKey] = dur
            }
            if cur.isFinite {
                np[MPNowPlayingInfoPropertyElapsedPlaybackTime] = cur
            }
            np[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
            MPNowPlayingInfoCenter.default().nowPlayingInfo = np
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
        player?.pause()
        player = nil
        performOnMainThread {
            UIApplication.shared.endReceivingRemoteControlEvents()
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        if #available(iOS 13.0, *) {
            MPNowPlayingInfoCenter.default().playbackState = .stopped
        }
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            // Best-effort: do not fail teardown on audio-session errors.
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

        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            notifyListeners("error", data: ["message": error.localizedDescription])
            call.reject("audio_session", error.localizedDescription, nil)
            return
        }
        performOnMainThread {
            UIApplication.shared.beginReceivingRemoteControlEvents()
        }

        let item = AVPlayerItem(url: url)
        let av = AVPlayer(playerItem: item)
        player = av

        // Media type influences which controls iOS surfaces on the lock screen.
        // - Reader mode (no remote surah commands): use podcast to bias toward 15s skip buttons.
        // - Quran Audio mode (remote surah commands): use music to bias toward prev/next track buttons.
        let mediaType: MPMediaType = wantsRemoteSurahCommands ? .music : .podcast
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyPlaybackRate: 1.0,
            MPMediaItemPropertyMediaType: NSNumber(value: mediaType.rawValue),
        ]
        if let artworkImage = UIImage(named: "QuranReaderArtwork") {
            let artwork = MPMediaItemArtwork(boundsSize: artworkImage.size) { _ in artworkImage }
            info[MPMediaItemPropertyArtwork] = artwork
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        performOnMainThread {
            let commandCenter = MPRemoteCommandCenter.shared()
            // Enable scrubbing on the lock screen seek bar.
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

            if wantsRemoteSurahCommands {
                // Quran Audio: expose prev/next so the user can move between surahs.
                // Do not expose 15s skip buttons in this mode.
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
            } else {
                // Quran Reader: show 15s skip-back/skip-forward and hide prev/next track controls.
                commandCenter.previousTrackCommand.isEnabled = false
                commandCenter.nextTrackCommand.isEnabled = false

                commandCenter.skipBackwardCommand.preferredIntervals = [NSNumber(value: Self.lockscreenSkipIntervalSeconds)]
                commandCenter.skipBackwardCommand.isEnabled = true
                // Reader lockscreen: disable Forward because it can black out / tear down
                // the player on some device states; keep Rewind + Play/Pause.
                commandCenter.skipForwardCommand.preferredIntervals = []
                commandCenter.skipForwardCommand.isEnabled = false

                commandCenter.skipBackwardCommand.addTarget { [weak self] event in
                    guard let self else { return .commandFailed }
                    let interval =
                        (event.command as? MPSkipIntervalCommand)?.preferredIntervals.first?.doubleValue
                        ?? Self.lockscreenSkipIntervalSeconds
                    return self.applySkipByInterval(seconds: -abs(interval))
                }
            }

            commandCenter.playCommand.isEnabled = true
            commandCenter.pauseCommand.isEnabled = true
            commandCenter.togglePlayPauseCommand.isEnabled = true
            commandCenter.playCommand.addTarget { [weak self] _ in
            guard let self, let p = self.player else { return .commandFailed }
            p.play()
            MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
            if #available(iOS 13.0, *) {
                MPNowPlayingInfoCenter.default().playbackState = .playing
            }
            self.notifyListeners("resumed", data: [:])
            return .success
            }
            commandCenter.pauseCommand.addTarget { [weak self] _ in
            guard let self, let p = self.player else { return .commandFailed }
            p.pause()
            MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            if #available(iOS 13.0, *) {
                MPNowPlayingInfoCenter.default().playbackState = .paused
            }
            self.notifyListeners("paused", data: [:])
            return .success
            }
            commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self, let p = self.player else { return .commandFailed }
            if p.rate == 0 {
                p.play()
                MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
                if #available(iOS 13.0, *) {
                    MPNowPlayingInfoCenter.default().playbackState = .playing
                }
                self.notifyListeners("resumed", data: [:])
                return .success
            }
            p.pause()
            MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            if #available(iOS 13.0, *) {
                MPNowPlayingInfoCenter.default().playbackState = .paused
            }
            self.notifyListeners("paused", data: [:])
            return .success
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.notifyListeners("ended", data: [:])
            self.stopInternal()
        }

        let needsSeek = startFraction >= 0 && startFraction <= 1
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
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
                    return
                }
                var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                np[Self.nowPlayingPlaybackDurationKey] = seconds
                MPNowPlayingInfoCenter.default().nowPlayingInfo = np
                let target = min(max(0, startFraction * seconds), max(0, seconds - 0.25))
                self.player?.seek(
                    to: CMTime(seconds: target, preferredTimescale: 600),
                    toleranceBefore: .zero,
                    toleranceAfter: .zero
                ) { [weak self] _ in
                    guard let self else { return }
                    self.player?.play()
                    if #available(iOS 13.0, *) {
                        MPNowPlayingInfoCenter.default().playbackState = .playing
                    }
                    if let av = self.player {
                        self.attachPeriodicTickObserver(to: av)
                    }
                }
            } else {
                let seconds = observed.duration.seconds
                if seconds.isFinite, seconds > 0 {
                    var np = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    np[Self.nowPlayingPlaybackDurationKey] = seconds
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = np
                }
                self.player?.play()
                if #available(iOS 13.0, *) {
                    MPNowPlayingInfoCenter.default().playbackState = .playing
                }
                if let av = self.player {
                    self.attachPeriodicTickObserver(to: av)
                }
            }
        }

        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        guard let p = player else {
            call.resolve()
            return
        }
        p.pause()
        MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
        notifyListeners("paused", data: [:])
        call.resolve()
    }

    @objc func resume(_ call: CAPPluginCall) {
        guard let p = player else {
            call.resolve()
            return
        }
        p.play()
        MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = p.rate
        notifyListeners("resumed", data: [:])
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopInternal()
        call.resolve()
    }

    deinit {
        stopInternal()
    }
}
