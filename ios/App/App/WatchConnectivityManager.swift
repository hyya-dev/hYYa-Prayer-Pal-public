import Foundation
import WatchConnectivity
import os.log

/// Manages WatchConnectivity for sending data from iPhone to Watch
class WatchConnectivityManager: NSObject {
    static let shared = WatchConnectivityManager()
    private static let logger = Logger(subsystem: "com.hyya.prayerpal.open", category: "WatchConnectivity")
    private let appGroup = "group.com.hyya.prayerpal.open"
    private let complicationMinInterval: TimeInterval = 30 * 60
    private let complicationLastValueKey = "watchComplicationLastWeather"
    private let complicationLastSentKey = "watchComplicationLastSentAt"
    
    private var session: WCSession?
    private var pendingPrayerTimes: [String: Any]?
    private var pendingWeather: [String: Any]?
    private var pendingSettings: [String: Any]?
    
    private override init() {
        super.init()
        setupSession()
    }

    private func canTransfer(_ session: WCSession) -> Bool {
        session.activationState == .activated && session.isPaired && session.isWatchAppInstalled
    }

    private func flushPendingContextIfPossible(_ session: WCSession) {
        guard canTransfer(session) else {
            return
        }

        let pendingPrayerTimesSnapshot = pendingPrayerTimes
        let pendingWeatherSnapshot = pendingWeather
        let pendingSettingsSnapshot = pendingSettings

        guard pendingPrayerTimesSnapshot != nil || pendingWeatherSnapshot != nil || pendingSettingsSnapshot != nil else {
            return
        }

        var contextSnapshot = session.applicationContext

        if let prayerTimes = pendingPrayerTimesSnapshot {
            contextSnapshot["prayerTimes"] = prayerTimes
        }

        if let weather = pendingWeatherSnapshot {
            contextSnapshot["weather"] = weather
        }

        if let settings = pendingSettingsSnapshot {
            contextSnapshot["settings"] = settings
        }

        do {
            try session.updateApplicationContext(contextSnapshot)
            if pendingPrayerTimesSnapshot != nil {
                pendingPrayerTimes = nil
            }
            if pendingWeatherSnapshot != nil {
                pendingWeather = nil
            }
            if pendingSettingsSnapshot != nil {
                pendingSettings = nil
            }
            Self.logger.info("Flushed pending watch context")
        } catch {
            Self.logger.error("Failed to flush pending watch context: \(String(describing: error))")
        }
    }

    private func setupSession() {
        guard WCSession.isSupported() else {
            Self.logger.info("WatchConnectivity not supported on this device")
            return
        }
        
        session = WCSession.default
        session?.delegate = self
        session?.activate()
        Self.logger.info("WatchConnectivity session activated")
    }
    
    /// Send prayer times to Watch
    func sendPrayerTimes(_ data: [String: Any]) {
        guard let session = session else {
            return
        }

        guard canTransfer(session) else {
            pendingPrayerTimes = data
            Self.logger.debug("Queued prayer times until WatchConnectivity session is ready")
            return
        }
        
        // If Watch is reachable, send immediately
        if session.isReachable {
            session.sendMessage(["prayerTimes": data], replyHandler: { reply in
                Self.logger.info("Watch replied: \(reply)")
            }, errorHandler: { error in
                Self.logger.error("Failed to send message: \(error.localizedDescription)")
                // Fallback to applicationContext
                do {
                    try session.updateApplicationContext(["prayerTimes": data])
                    Self.logger.info("Prayer times sendMessage fallback -> applicationContext succeeded")
                } catch {
                    Self.logger.error("Prayer times sendMessage fallback -> applicationContext failed: \(error.localizedDescription)")
                    self.pendingPrayerTimes = data
                }
            })
        } else {
            // Use applicationContext for background transfer
            do {
                try session.updateApplicationContext(["prayerTimes": data])
                Self.logger.info("✅ Sent prayer times via applicationContext")
            } catch {
                Self.logger.error("Failed to send prayer times: \(error.localizedDescription)")
            }
        }
    }
    
    /// Send weather to Watch
    func sendWeather(_ temperature: String) {
        guard let session = session else {
            return
        }

        let payload = buildWeatherPayload(temperature)

        guard canTransfer(session) else {
            pendingWeather = payload
            Self.logger.debug("Queued weather until WatchConnectivity session is ready")
            return
        }

        if session.isReachable {
            session.sendMessage(["weather": payload], replyHandler: nil, errorHandler: { error in
                Self.logger.error("sendMessage weather failed: \(error.localizedDescription)")
            })
        }
        
        do {
            var context = session.applicationContext
            context["weather"] = payload
            try session.updateApplicationContext(context)
            Self.logger.info("✅ Sent weather context: \(temperature)")
            sendComplicationUpdateIfAllowed(weatherPayload: payload, session: session)
        } catch {
            Self.logger.error("Failed to send weather: \(error.localizedDescription)")
        }
    }
    
    /// Send settings to Watch
    func sendSettings(_ settings: [String: Any]) {
        guard let session = session else {
            return
        }

        guard canTransfer(session) else {
            pendingSettings = settings
            Self.logger.debug("Queued settings until WatchConnectivity session is ready")
            return
        }
        
        do {
            var context = session.applicationContext
            context["settings"] = settings
            try session.updateApplicationContext(context)
            Self.logger.info("✅ Sent settings")
        } catch {
            Self.logger.error("Failed to send settings: \(error.localizedDescription)")
        }
    }

    /// Reconcile watch state from shared cache when app becomes active.
    /// This keeps watch data aligned even when weather value does not change.
    func syncLastKnownToWatch() {
        guard let session = session else {
            return
        }

        guard canTransfer(session) else {
            return
        }

        var context = session.applicationContext
        let prayers = loadTodayPrayers()
        if !prayers.isEmpty {
            context["prayerTimes"] = [
                "prayers": prayers
            ]
        }

        if let weather = loadWeatherPayload() {
            context["weather"] = weather
        }

        if let settings = loadSettingsPayload() {
            context["settings"] = settings
        }

        do {
            try session.updateApplicationContext(context)
            Self.logger.info("Synced last-known context to Watch")
        } catch {
            Self.logger.error("Failed to sync last-known watch context: \(error.localizedDescription)")
        }
    }
}

extension WatchConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            Self.logger.error("Activation failed: \(error.localizedDescription)")
        } else {
            Self.logger.info("Session activated: \(activationState.rawValue), Watch reachable: \(session.isReachable), Installed: \(session.isWatchAppInstalled)")
            flushPendingContextIfPossible(session)
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        Self.logger.info("Session became inactive")
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        Self.logger.info("Session deactivated, reactivating...")
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        guard let action = message["action"] as? String, action == "requestSnapshot" else {
            replyHandler(["status": "ignored"])
            return
        }

        let payload = buildWatchSnapshotPayload()
        replyHandler(payload)
    }

    private func buildWatchSnapshotPayload() -> [String: Any] {
        var payload: [String: Any] = [:]

        let prayers = loadTodayPrayers()
        payload["prayerTimes"] = [
            "prayers": prayers
        ]

        if let weatherPayload = loadWeatherPayload() {
            payload["weather"] = weatherPayload
        }

        if let settings = loadSettingsPayload() {
            payload["settings"] = settings
        }

        return payload
    }

    private func loadSettingsPayload() -> [String: Any]? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            return nil
        }

        var settings: [String: Any] = [:]

        if sharedDefaults.object(forKey: "timeFormat24") != nil {
            settings["timeFormat24"] = sharedDefaults.bool(forKey: "timeFormat24")
        }

        if let temperatureUnit = sharedDefaults.string(forKey: "temperatureUnit") {
            settings["temperatureUnit"] = temperatureUnit
        }

        if let language = sharedDefaults.string(forKey: "language") {
            settings["language"] = language
        }

        if let stringsData = sharedDefaults.data(forKey: "localizedStrings"),
           let strings = try? JSONSerialization.jsonObject(with: stringsData) as? [String: String] {
            settings["strings"] = strings
        }

        if let prayerNamesData = sharedDefaults.data(forKey: "localizedPrayerNames"),
           let prayerNames = try? JSONSerialization.jsonObject(with: prayerNamesData) as? [String: String] {
            settings["prayerNames"] = prayerNames
        }

        return settings.isEmpty ? nil : settings
    }

    private func loadTodayPrayers() -> [String: [[String: String]]] {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup),
              let data = sharedDefaults.data(forKey: "savedPrayers"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let prayersByDate = json["prayers"] as? [String: [[String: String]]] else {
            return [:]
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MM-dd-yyyy"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        let todayKey = dateFormatter.string(from: Date())

        if let todayPrayers = prayersByDate[todayKey] {
            return [todayKey: todayPrayers]
        }

        return [:]
    }

    private func buildWeatherPayload(_ temperature: String) -> [String: Any] {
        let payload: [String: Any] = [
            "value": temperature,
            // Freshness is computed on-device (Watch/Wear) using local receipt time.
            "freshness": "unknown",
        ]
        return payload
    }

    private func loadWeatherPayload() -> [String: Any]? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            return nil
        }

        guard let weather = sharedDefaults.string(forKey: "savedWeather") else {
            return nil
        }
        return buildWeatherPayload(weather)
    }

    private func sendComplicationUpdateIfAllowed(weatherPayload: [String: Any], session: WCSession) {
        guard session.isComplicationEnabled else {
            return
        }

        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            return
        }

        let now = Date().timeIntervalSince1970
        let lastValue = sharedDefaults.string(forKey: complicationLastValueKey)
        let lastSentAt = sharedDefaults.double(forKey: complicationLastSentKey)
        let currentValue = weatherPayload["value"] as? String

        let changed = lastValue != currentValue
        let intervalElapsed = (now - lastSentAt) >= complicationMinInterval
        if !changed && !intervalElapsed {
            return
        }

        let remaining = session.remainingComplicationUserInfoTransfers
        guard remaining > 0 else {
            Self.logger.debug("Complication transfer skipped (daily budget exhausted)")
            return
        }

        session.transferCurrentComplicationUserInfo(["weather": weatherPayload])
        if let currentValue {
            sharedDefaults.set(currentValue, forKey: complicationLastValueKey)
        }
        sharedDefaults.set(now, forKey: complicationLastSentKey)
    }
}
