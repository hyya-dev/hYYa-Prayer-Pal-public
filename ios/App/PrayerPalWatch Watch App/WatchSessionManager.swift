import Combine
import Foundation
import WatchConnectivity
import WidgetKit

// MARK: - Locale-specific AM/PM markers (Watch)
// Many iOS locales fall back to English "AM"/"PM". This map provides correct
// CLDR day-period markers as a post-processing fallback.
private let watchAmpmLocaleMap: [String: (am: String, pm: String)] = [
    "am":  ("ጥዋት",  "ከሰዓት"),
    "ar":  ("ص",     "م"),
    "as":  ("পূৰ্বাহ্ন", "অপৰাহ্ন"),
    "bn":  ("পূর্বাহ্ণ", "অপরাহ্ণ"),
    "bs":  ("prijepodne", "popodne"),
    "bg":  ("пр.об.", "сл.об."),
    "de":  ("vorm.",  "nachm."),
    "dv":  ("މކ",    "މފ"),
    "es":  ("a.\u{00A0}m.", "p.\u{00A0}m."),
    "fa":  ("ق.ظ.",  "ب.ظ."),
    "ha":  ("SF",    "YM"),
    "he":  ("לפנה״צ", "אחה״צ"),
    "ja":  ("午前",   "午後"),
    "km":  ("មុនថ្ងៃត្រង់", "រសៀល"),
    "ko":  ("오전",   "오후"),
    "ku":  ("BN",    "PN"),
    "mr":  ("म.पू.",  "म.उ."),
    "ms":  ("PG",    "PTG"),
    "ne":  ("पूर्वाह्न", "अपराह्न"),
    "nl":  ("a.m.",  "p.m."),
    "om":  ("WD",    "WB"),
    "ps":  ("غ.م.",  "غ.و."),
    "ro":  ("a.m.",  "p.m."),
    "sd":  ("صبح",   "شام"),
    "si":  ("පෙ.ව.",  "ප.ව."),
    "so":  ("GH",    "GD"),
    "sq":  ("p.d.",  "m.d."),
    "sv":  ("fm",    "em"),
    "ta":  ("முற்பகல்", "பிற்பகல்"),
    "tg":  ("пе. чо.", "па. чо."),
    "th":  ("ก่อนเที่ยง", "หลังเที่ยง"),
    "tr":  ("ÖÖ",    "ÖS"),
    "ug":  ("چ.ب",   "چ.ك"),
    "uk":  ("дп",    "пп"),
    "ur":  ("قبل دوپہر", "بعد دوپہر"),
    "uz":  ("TO",    "TK"),
    "vi":  ("SA",    "CH"),
    "yo":  ("Àárọ̀",  "Ọ̀sán"),
    "zh":  ("上午",   "下午"),
]

/// Replace English "AM"/"PM" with locale-correct day-period markers
private func watchLocalizeAmPm(_ formatted: String, langCode: String) -> String {
    guard let entry = watchAmpmLocaleMap[langCode] else { return formatted }
    if formatted.contains("AM") {
        return formatted.replacingOccurrences(of: "AM", with: entry.am)
    }
    if formatted.contains("PM") {
        return formatted.replacingOccurrences(of: "PM", with: entry.pm)
    }
    return formatted
}

/// Manages WatchConnectivity on the Watch side to receive data from iPhone
class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()
    
    @Published var prayerTimes: [(name: String, time: String)] = []
    /// Same order as `prayerTimes`; wall times adjusted when a prayer (e.g. Isha) falls after local midnight.
    @Published private(set) var resolvedPrayerInstants: [Date] = []
    @Published var nextPrayerIndex: Int = 0
    @Published var temperature: String = "--°"
    @Published var isWaitingForPhone: Bool = false
    @Published var localizedStrings: WatchLocalizedStrings = .bundled()
    @Published var prayerNameMap: [String: String] = [:]
    
    private var session: WCSession?
    private var lastSnapshotRequestTime: TimeInterval = 0
    private let snapshotRequestCooldown: TimeInterval = 10
    private let preExpiryRefreshOffsetSeconds: TimeInterval = 50 * 60
    private let weatherSLASeconds: TimeInterval = 60 * 60
    // Local receipt time (ms) for refresh scheduling; not synced over the wire.
    private var weatherReceivedAtMs: Int64 = 0
    private var preferredLanguageCode: String?
    private var preferredTimeFormat24: Bool?
    private var preExpiryTimer: Timer?
    private var noWeatherPollAttempts: Int = 0
    private let maxNoWeatherPollAttempts: Int = 8
    private let noWeatherPollBaseSeconds: TimeInterval = 15

    private let watchWidgetAppGroup = "group.com.hyya.prayerpal.open"
    private let watchWidgetSnapshotKey = "watchPrayerWidget.snapshot.v1"
    private let watchWidgetKind = "PrayerPalWatchNextPrayer"
    private let watchPrayerScheduleKey = "watchPrayerSchedule.v1"

    private override init() {
        super.init()
        setupSession()
        hydrateCachedPrayerScheduleIfAvailable()
    }

    private func hydrateCachedPrayerScheduleIfAvailable() {
        guard let defaults = UserDefaults(suiteName: watchWidgetAppGroup),
              let data = defaults.data(forKey: watchPrayerScheduleKey) else {
            return
        }
        do {
            guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let prayers = dict["prayers"] as? [String: [[String: String]]] else {
                return
            }
            // Reuse the same parser path so ordering and next-prayer logic stays consistent.
            parsePrayerData(["prayers": prayers])
        } catch {
            // Best-effort only
        }
    }

    private func persistPrayerSchedule(prayers: [String: [[String: String]]]) {
        guard let defaults = UserDefaults(suiteName: watchWidgetAppGroup) else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: ["prayers": prayers], options: [])
            defaults.set(data, forKey: watchPrayerScheduleKey)
        } catch {
            // Best-effort only
        }
    }
    
    private func setupSession() {
        guard WCSession.isSupported() else {
            ppDebugLog("[Watch] WatchConnectivity not supported")
            return
        }
        
        session = WCSession.default
        session?.delegate = self
        session?.activate()
        ppDebugLog("[Watch] WatchConnectivity session activating...")
    }

    private func requestSnapshotIfPossible() {
        guard let session = session else {
            return
        }

        if !session.isReachable {
            DispatchQueue.main.async {
                self.isWaitingForPhone = true
            }
            return
        }

        let now = Date().timeIntervalSince1970
        if now - lastSnapshotRequestTime < snapshotRequestCooldown {
            return
        }
        lastSnapshotRequestTime = now

        DispatchQueue.main.async {
            self.isWaitingForPhone = true
        }

        session.sendMessage(["action": "requestSnapshot"], replyHandler: { reply in
            DispatchQueue.main.async {
                self.processApplicationContext(reply)
                self.schedulePreExpiryRefreshIfNeeded()
            }
        }, errorHandler: { error in
            ppDebugLog("[Watch] Snapshot request failed: \(error.localizedDescription)")
        })
    }

    private func schedulePreExpiryRefreshIfNeeded() {
        preExpiryTimer?.invalidate()
        preExpiryTimer = nil

        guard weatherReceivedAtMs > 0 else {
            guard noWeatherPollAttempts < maxNoWeatherPollAttempts else {
                return
            }

            let nextDelay = min(120, noWeatherPollBaseSeconds * TimeInterval(noWeatherPollAttempts + 1))
            preExpiryTimer = Timer.scheduledTimer(withTimeInterval: nextDelay, repeats: false) { [weak self] _ in
                guard let self else { return }
                self.noWeatherPollAttempts += 1
                self.requestSnapshotIfPossible()
                self.schedulePreExpiryRefreshIfNeeded()
            }
            return
        }

        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let targetMs = weatherReceivedAtMs + Int64(preExpiryRefreshOffsetSeconds * 1000)
        let delayMs = max(Int64(30_000), targetMs - nowMs)
        let delay = TimeInterval(delayMs) / 1000.0

        preExpiryTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.requestSnapshotIfPossible()
        }
    }
    
    /// Parse prayer times from application context
    private func parsePrayerData(_ data: [String: Any]) {
        ppDebugLog("[Watch] Parsing prayer data: \(data.keys)")
        
        // Extract today's prayers from the data structure
        // Format from iPhone: { prayers: { "MM-dd-yyyy": [{ name, time }] }, location }
        if let prayers = data["prayers"] as? [String: [[String: String]]] {
            // Persist full schedule so watch can keep working offline across days.
            persistPrayerSchedule(prayers: prayers)

            // Find today's date key
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "MM-dd-yyyy"
            dateFormatter.locale = Locale(identifier: "en_US_POSIX")
            let todayKey = dateFormatter.string(from: Date())
            
            if let todayPrayers = prayers[todayKey] {
                var parsed: [(String, String)] = []
                for prayer in todayPrayers {
                    if let name = prayer["name"], let time = prayer["time"] {
                        // Store canonical time for scheduling/comparison;
                        // formatTimeForDisplay is called at render boundaries only.
                        parsed.append((name, time))
                    }
                }

                let apply = { [self] in
                    self.prayerTimes = parsed
                    self.calculateNextPrayer()
                    self.isWaitingForPhone = false
                    self.persistComplicationSnapshot(prayers: parsed, dateKey: todayKey)
                    ppDebugLog("[Watch] ✅ Updated prayer times: \(parsed.count) prayers")
                }
                if Thread.isMainThread {
                    apply()
                } else {
                    DispatchQueue.main.async(execute: apply)
                }
            } else {
                ppDebugLog("[Watch] No prayers found for today: \(todayKey)")
                let clear = { [self] in
                    self.prayerTimes = []
                    self.resolvedPrayerInstants = []
                    self.clearComplicationSnapshot()
                }
                if Thread.isMainThread {
                    clear()
                } else {
                    DispatchQueue.main.async(execute: clear)
                }
            }
        }
    }
    
    /// Calculate which prayer is next based on current time
    private func calculateNextPrayer() {
        let now = Date()
        let anchor = Calendar.current.startOfDay(for: now)
        guard let instants = monotonicResolvedInstants(times: prayerTimes.map { $0.1 }, anchorStartOfDay: anchor),
              instants.count == prayerTimes.count else {
            resolvedPrayerInstants = []
            nextPrayerIndex = 0
            return
        }
        resolvedPrayerInstants = instants

        for (index, instant) in instants.enumerated() where instant > now {
            nextPrayerIndex = index
            return
        }

        // All prayers passed, next is Fajr tomorrow
        nextPrayerIndex = 0
    }

    private func monotonicResolvedInstants(times: [String], anchorStartOfDay: Date) -> [Date]? {
        let calendar = Calendar.current
        var instants: [Date] = []
        instants.reserveCapacity(times.count)
        for timeStr in times {
            guard let naive = parseTime(timeStr, anchorStartOfDay: anchorStartOfDay) else { return nil }
            instants.append(naive)
        }
        for i in 1..<instants.count {
            while instants[i] <= instants[i - 1] {
                guard let bumped = calendar.date(byAdding: .day, value: 1, to: instants[i]) else { return nil }
                instants[i] = bumped
            }
        }
        return instants
    }

    /// Parse time string onto the schedule anchor day (start of local civil day for this snapshot).
    private func parseTime(_ timeStr: String, anchorStartOfDay: Date) -> Date? {
        let calendar = Calendar.current
        let preferredLocale = resolvePreferredLocale()

        let shortFormatter = DateFormatter()
        shortFormatter.locale = preferredLocale
        shortFormatter.dateStyle = .none
        shortFormatter.timeStyle = .short

        let currentShortFormatter = DateFormatter()
        currentShortFormatter.locale = Locale.current
        currentShortFormatter.dateStyle = .none
        currentShortFormatter.timeStyle = .short

        let posixFormatter = DateFormatter()
        posixFormatter.locale = Locale(identifier: "en_US_POSIX")
        posixFormatter.dateStyle = .none
        posixFormatter.timeStyle = .none

        let fallbackFormats = ["H:mm", "HH:mm", "h:mm a", "h:mm:ss a", "HH:mm:ss", "H:mm:ss"]

        let parsed: Date? = shortFormatter.date(from: timeStr)
            ?? currentShortFormatter.date(from: timeStr)
            ?? {
            for format in fallbackFormats {
                shortFormatter.dateFormat = format
                if let value = shortFormatter.date(from: timeStr) {
                    return value
                }

                posixFormatter.dateFormat = format
                if let value = posixFormatter.date(from: timeStr) {
                    return value
                }
            }
            return nil
        }()

        guard let parsed else { return nil }

        var components = calendar.dateComponents([.year, .month, .day], from: anchorStartOfDay)
        let parsedComponents = calendar.dateComponents([.hour, .minute], from: parsed)
        components.hour = parsedComponents.hour
        components.minute = parsedComponents.minute
        return calendar.date(from: components)
    }

    func formatTimeForDisplay(at index: Int) -> String {
        guard index >= 0, index < resolvedPrayerInstants.count else {
            if index >= 0, index < prayerTimes.count {
                let anchor = Calendar.current.startOfDay(for: Date())
                if let d = parseTime(prayerTimes[index].time, anchorStartOfDay: anchor) {
                    return formatTimeForDisplay(prayerInstant: d)
                }
                return prayerTimes[index].time
            }
            return "--:--"
        }
        return formatTimeForDisplay(prayerInstant: resolvedPrayerInstants[index])
    }

    private func formatTimeForDisplay(prayerInstant parsed: Date) -> String {
        let locale = resolvePreferredLocale()
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .none

        let is24 = preferredTimeFormat24
        if let force24 = is24 {
            let template = force24 ? "HH:mm" : "h:mm a"
            formatter.dateFormat = DateFormatter.dateFormat(fromTemplate: template, options: 0, locale: locale)
                ?? (force24 ? "HH:mm" : "h:mm a")
        } else {
            formatter.timeStyle = .short
        }

        var result = formatter.string(from: parsed)

        // Post-process: replace English AM/PM with locale-specific markers
        if is24 != true {
            let langCode = {
                let raw = (preferredLanguageCode ?? "en")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .replacingOccurrences(of: "_", with: "-")
                    .lowercased()
                let primary = raw.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: true).first.map(String.init)
                return (primary?.isEmpty == false ? primary! : "en")
            }()
            if langCode != "en", watchAmpmLocaleMap[langCode] != nil {
                result = watchLocalizeAmPm(result, langCode: langCode)
            }
        }

        return result
    }

    private func resolvePreferredLocale() -> Locale {
        guard let language = preferredLanguageCode?.trimmingCharacters(in: .whitespacesAndNewlines),
              !language.isEmpty else {
            return Locale.current
        }

        let code = language.lowercased()
        let languageTag: String
        switch code {
        case "zh":
            languageTag = "zh-CN"
        case "prs":
            languageTag = "fa-AF"
        case "tl":
            languageTag = "fil"
        default:
            languageTag = code.replacingOccurrences(of: "_", with: "-")
        }

        return Locale(identifier: languageTag)
    }
}

extension WatchSessionManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            ppDebugLog("[Watch] Activation failed: \(error.localizedDescription)")
        } else {
            ppDebugLog("[Watch] ✅ Session activated: \(activationState.rawValue)")
            
            // Load any existing application context
            DispatchQueue.main.async {
                self.processApplicationContext(session.applicationContext)
            }

            // Request fresh snapshot on first open
            if self.prayerTimes.isEmpty {
                self.isWaitingForPhone = true
            }
            requestSnapshotIfPossible()
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        if session.isReachable {
            requestSnapshotIfPossible()
        }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        ppDebugLog("[Watch] Received application context update")
        DispatchQueue.main.async {
            self.processApplicationContext(applicationContext)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        ppDebugLog("[Watch] Received message")
        DispatchQueue.main.async {
            self.processApplicationContext(message)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        ppDebugLog("[Watch] Received message with reply handler")
        DispatchQueue.main.async {
            self.processApplicationContext(message)
        }
        replyHandler(["status": "received"])
    }

    func session(_ session: WCSession, didReceiveComplicationUserInfo complicationUserInfo: [String: Any]) {
        ppDebugLog("[Watch] Complication user info: \(complicationUserInfo.keys)")
        DispatchQueue.main.async {
            self.reloadComplicationTimelines()
        }
    }

    private func processApplicationContext(_ context: [String: Any]) {
        dispatchPrecondition(condition: .onQueue(.main))
        ppDebugLog("[Watch] Processing context with keys: \(context.keys)")

        // Apply prayer payload before settings so `refreshComplicationSnapshotIfNeeded` sees up-to-date rows
        // when language/time-format changes arrive in the same context update.
        if let prayerData = context["prayerTimes"] as? [String: Any] {
            parsePrayerData(prayerData)
        }

        if let settings = context["settings"] as? [String: Any] {
            parseSettings(settings)
        }
        
        // Parse weather
        if let weather = context["weather"] as? String {
            self.temperature = weather
            ppDebugLog("[Watch] ✅ Updated temperature: \(weather)")
            self.isWaitingForPhone = false
            self.weatherReceivedAtMs = Int64(Date().timeIntervalSince1970 * 1000)
            self.noWeatherPollAttempts = 0
            self.schedulePreExpiryRefreshIfNeeded()
        } else if let weather = context["weather"] as? [String: Any] {
            self.temperature = (weather["value"] as? String) ?? self.temperature
            // We intentionally do NOT trust/consume any synced timestamp field.
            self.weatherReceivedAtMs = Int64(Date().timeIntervalSince1970 * 1000)
            self.noWeatherPollAttempts = 0
            ppDebugLog("[Watch] ✅ Updated weather payload")
            self.isWaitingForPhone = false
            self.schedulePreExpiryRefreshIfNeeded()
        }

        if weatherReceivedAtMs > 0 {
            let ageMs = Int64(Date().timeIntervalSince1970 * 1000) - weatherReceivedAtMs
            if ageMs > Int64(weatherSLASeconds * 1000) {
                requestSnapshotIfPossible()
            }
        }
    }

    private func parseSettings(_ settings: [String: Any]) {
        if let language = settings["language"] as? String {
            preferredLanguageCode = language
        }

        if let timeFormat24 = settings["timeFormat24"] as? Bool {
            preferredTimeFormat24 = timeFormat24
        }

        if let strings = settings["strings"] as? [String: String] {
            let appName = strings["appName"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let welcome = strings["welcome"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let openAppToSync = strings["openAppToSync"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let waitingForPhone = strings["waitingForPhone"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !appName.isEmpty, !welcome.isEmpty, !openAppToSync.isEmpty, !waitingForPhone.isEmpty {
                DispatchQueue.main.async {
                    // Source of truth: strings pushed from the iPhone in Settings UI Language.
                    self.localizedStrings = WatchLocalizedStrings(
                        appName: appName,
                        welcome: welcome,
                        openAppToSync: openAppToSync,
                        waitingForPhone: waitingForPhone
                    )
                }
            }
        }

        if let prayerNames = settings["prayerNames"] as? [String: String] {
            DispatchQueue.main.async {
                self.prayerNameMap = prayerNames
            }
        }

        refreshComplicationSnapshotIfNeeded()
    }

    func prayerName(for key: String) -> String {
        let normalized = key.lowercased()
        return prayerNameMap[normalized] ?? key
    }

    private func reloadComplicationTimelines() {
        WidgetCenter.shared.reloadTimelines(ofKind: watchWidgetKind)
    }

    private func clearComplicationSnapshot() {
        guard let defaults = UserDefaults(suiteName: watchWidgetAppGroup) else {
            return
        }
        defaults.removeObject(forKey: watchWidgetSnapshotKey)
        reloadComplicationTimelines()
    }

    private func persistComplicationSnapshot(prayers: [(String, String)], dateKey: String) {
        guard let defaults = UserDefaults(suiteName: watchWidgetAppGroup) else {
            return
        }
        var payload: [String: Any] = [
            "dateKey": dateKey,
            "prayers": prayers.map { ["name": $0.0, "time": $0.1] },
        ]
        if let code = preferredLanguageCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
            payload["language"] = code
        }
        if let tf = preferredTimeFormat24 {
            payload["timeFormat24"] = tf
        }
        payload["openAppToSync"] = localizedStrings.openAppToSync
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
            return
        }
        defaults.set(data, forKey: watchWidgetSnapshotKey)
        reloadComplicationTimelines()
    }

    private func refreshComplicationSnapshotIfNeeded() {
        guard !prayerTimes.isEmpty else {
            return
        }
        let df = DateFormatter()
        df.dateFormat = "MM-dd-yyyy"
        df.locale = Locale(identifier: "en_US_POSIX")
        let key = df.string(from: Date())
        persistComplicationSnapshot(prayers: prayerTimes, dateKey: key)
    }
}

struct WatchLocalizedStrings {
    let appName: String
    let welcome: String
    let openAppToSync: String
    let waitingForPhone: String

    static func bundled() -> WatchLocalizedStrings {
        return WatchLocalizedStrings(
            appName: String(localized: "appName"),
            welcome: String(localized: "welcome"),
            openAppToSync: String(localized: "openAppToSync"),
            waitingForPhone: String(localized: "waitingForPhone")
        )
    }
}
