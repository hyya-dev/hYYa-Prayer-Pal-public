import WidgetKit
import SwiftUI
import Foundation

// MARK: - Helper Extensions
extension Locale {
    /// Check if locale uses 24-hour time format
    var uses24HourFormat: Bool {
        let formatter = DateFormatter()
        formatter.locale = self
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        
        // Test with 1:00 PM (13:00 in 24-hour format)
        let testDate = Date(timeIntervalSince1970: 3600 * 13)
        let timeString = formatter.string(from: testDate)
        
        // Check if the formatted string contains "13" (24-hour) or "PM" (12-hour)
        if timeString.contains("13") {
            return true // 24-hour format
        }
        if timeString.contains("PM") || timeString.contains("AM") {
            return false // 12-hour format
        }
        
        // Fallback: Check if hour component is >= 13 (24-hour format)
        // Try to extract hour from the beginning of the string
        let components = timeString.components(separatedBy: ":")
        if let firstComponent = components.first, let hour = Int(firstComponent) {
            return hour >= 13 // If hour >= 13, it's 24-hour format
        }
        
        // Default to 12-hour format if uncertain
        return false
    }
}

extension View {
    /// Custom text shadow modifier for better control
    func textShadow(color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) -> some View {
        self.shadow(color: color, radius: radius, x: x, y: y)
    }
}

// MARK: - Debug Logging Helper (Removed - hardcoded path breaks in production)
// Debug logging removed - use ppDebugLog() statements for Xcode Console instead
// Hardcoded file paths don't work in TestFlight/production builds

// MARK: - Locale-specific AM/PM markers
// Many iOS locales fall back to English "AM"/"PM". This map provides correct
// CLDR day-period markers as a post-processing fallback.
private let ampmLocaleMap: [String: (am: String, pm: String)] = [
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
    "te":  ("AM",    "PM"),  // Telugu CLDR uses AM/PM
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
private func localizeAmPm(_ formatted: String, langCode: String) -> String {
    guard let entry = ampmLocaleMap[langCode] else { return formatted }
    if formatted.contains("AM") {
        return formatted.replacingOccurrences(of: "AM", with: entry.am)
    }
    if formatted.contains("PM") {
        return formatted.replacingOccurrences(of: "PM", with: entry.pm)
    }
    return formatted
}

private func lockScreenAppNameLines(_ appName: String) -> [String] {
    let words = appName
        .split(whereSeparator: { $0.isWhitespace })
        .map(String.init)
        .filter { !$0.isEmpty }

    if words.isEmpty {
        return [" ", " ", " "]
    }
    if words.count == 1 {
        return [words[0], " ", " "]
    }
    if words.count == 2 {
        return [words[0], words[1], " "]
    }
    if words.count == 3 {
        return words
    }

    return [words[0], words[1], words.dropFirst(2).joined(separator: " ")]
}

// MARK: - 1. Data Model
struct Prayer: Codable, Identifiable {
    var id: String { name }
    let name: String
    let time: String
}

// MARK: - 2. Data Manager
struct WidgetData: Codable {
    let prayers: [String: [Prayer]]  // Date string -> prayers array
    // Legacy field (deprecated): older app versions wrote syncTimestamp inside the payload.
    let syncTimestamp: Int64?
    let location: LocationData?
    let settings: WidgetSettings?
    // Legacy fields (kept for backward compatibility)
    let calculationMethod: String?
    let madhab: String?
}

struct LocationData: Codable {
    let latitude: Double
    let longitude: Double
    let city: String
    let country: String?
}

struct WidgetSettings: Codable {
    let timeFormat24: Bool?
    let temperatureUnit: String?
    let language: String?
    let strings: WidgetLocalizedStrings?
    let prayerNames: [String: String]?
}

struct WidgetLocalizedStrings: Codable {
    let appName: String
    let welcome: String
    let openAppToSync: String
    let waitingForPhone: String
}

struct DataManager {
    static let appGroup = "group.com.hyya.prayerpal"
    static let dataKey = "savedPrayers"
    static let phaseAKey = "savedPrayersPhaseA"
    static let phaseBKey = "savedPrayersPhaseB"
    static let weatherKey = "savedWeather"
    static let weatherTimeKey = "savedWeatherTime"
    static let prayersUpdatedAtKey = "savedPrayersUpdatedAt"
    static let prayerStaleSeconds: TimeInterval = 30 * 24 * 60 * 60  // 30 days
    
    /// Load cached weather temperature from App Group
    /// Temperature is pushed by the app when opened
    static func loadWeather() -> String? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else { return nil }
        let weather = sharedDefaults.string(forKey: weatherKey) ?? sharedDefaults.string(forKey: "cachedWeather")
        guard let weather, !weather.isEmpty else { return nil }
        // Per UX requirement: do not show weather age suffix (e.g. "· 5h", "· 5d") on widgets.
        return weather
    }

    private static func formatAgeSuffix(seconds: TimeInterval) -> String {
        if seconds < 0 { return "" }
        let minutes = Int(seconds / 60)
        if minutes < 30 { return "" }
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        return "\(days)d"
    }

    static func loadLocalizedStrings() -> WidgetLocalizedStrings {
        // Primary source of truth: localized strings pushed from the app (Settings UI Language).
        // Fallback: bundled widget localizations (fresh install / before first sync).
        if let sharedDefaults = UserDefaults(suiteName: appGroup),
           let data = sharedDefaults.data(forKey: "localizedStrings"),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            let appName = dict["appName"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let welcome = dict["welcome"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let openAppToSync = dict["openAppToSync"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let waitingForPhone = dict["waitingForPhone"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !appName.isEmpty, !welcome.isEmpty, !openAppToSync.isEmpty, !waitingForPhone.isEmpty {
                return WidgetLocalizedStrings(
                    appName: appName,
                    welcome: welcome,
                    openAppToSync: openAppToSync,
                    waitingForPhone: waitingForPhone
                )
            }
        }

        return WidgetLocalizedStrings(
            appName: String(localized: "appName"),
            welcome: String(localized: "welcome"),
            openAppToSync: String(localized: "openAppToSync"),
            waitingForPhone: String(localized: "waitingForPhone")
        )
    }

    private static func resolveAppLocale() -> Locale {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup),
              let rawLanguage = sharedDefaults.string(forKey: "language")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawLanguage.isEmpty else {
            return Locale.current
        }

        let code = rawLanguage.lowercased()
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

    private static func preferredTimeFormat24() -> Bool? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup),
              sharedDefaults.object(forKey: "timeFormat24") != nil else {
            return nil
        }
        return sharedDefaults.bool(forKey: "timeFormat24")
    }

    static func formatTimeForDisplay(_ time: String) -> String {
        guard let parsed = parseTimeToDate(time) else { return time }

        let locale = resolveAppLocale()
        let output = DateFormatter()
        output.locale = locale
        output.dateStyle = .none

        let is24 = preferredTimeFormat24()
        if let force24 = is24 {
            let template = force24 ? "HH:mm" : "h:mm a"
            output.dateFormat = DateFormatter.dateFormat(fromTemplate: template, options: 0, locale: locale)
                ?? (force24 ? "HH:mm" : "h:mm a")
        } else {
            output.timeStyle = .short
        }

        var result = output.string(from: parsed)

        // Post-process: replace English AM/PM with locale-specific markers when
        // the platform's ICU didn't localize them (common on some iOS versions).
        if is24 != true {
            let langCode = {
                let raw = (UserDefaults(suiteName: appGroup)?.string(forKey: "language") ?? "en")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .replacingOccurrences(of: "_", with: "-")
                    .lowercased()
                let primary = raw.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: true).first.map(String.init)
                return (primary?.isEmpty == false ? primary! : "en")
            }()
            if langCode != "en" {
                result = localizeAmPm(result, langCode: langCode)
            }
        }

        return result
    }
    
    /// Load prayer data - App provides 365 days of pre-calculated times
    /// Widget does NOT calculate - just displays what the app sent
    static func loadPrayers() -> (prayers: [Prayer], isExpired: Bool) {
        ppDebugLog("[Widget] DataManager: Loading prayer data from App Group")
        
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            ppDebugLog("[Widget] DataManager: ❌ Could not access App Group")
            return ([], false)
        }
        
        // Prefer Phase B (30d), fall back to Phase A (24h), then legacy key.
        let data: Data? =
            sharedDefaults.data(forKey: phaseBKey)
            ?? sharedDefaults.data(forKey: phaseAKey)
            ?? sharedDefaults.data(forKey: dataKey)

        guard let data else {
            ppDebugLog("[Widget] DataManager: ❌ No data found")
            return ([], false)
        }
        
        // Decode prayer data from app
        if let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) {
            ppDebugLog("[Widget] DataManager: ✅ Loaded \(widgetData.prayers.count) days of data")
            
            // Check staleness: data older than 30 days
            let updatedAt: TimeInterval? = {
                if let sharedDefaults = UserDefaults(suiteName: appGroup) {
                    let v = sharedDefaults.double(forKey: prayersUpdatedAtKey)
                    if v > 0 { return v }
                }
                if let legacy = widgetData.syncTimestamp, legacy > 0 {
                    return TimeInterval(legacy) / 1000.0
                }
                return nil
            }()
            let ageInSeconds = updatedAt.map { Date().timeIntervalSince(Date(timeIntervalSince1970: $0)) } ?? 0
            let isExpired = ageInSeconds > prayerStaleSeconds
            
            if isExpired {
                ppDebugLog("[Widget] DataManager: ⚠️ Data stale (age: \(Int(ageInSeconds / 86400)) days)")
                return ([], true)
            }
            
            // Get current day's prayers (handles Isha+30min transition)
            let currentDayPrayers = getCurrentDayPrayers(from: widgetData.prayers)
            return (currentDayPrayers, false)
        }
        
        // Try old format for backward compatibility
        if let oldPrayers = try? JSONDecoder().decode([Prayer].self, from: data) {
            ppDebugLog("[Widget] DataManager: ✅ Loaded old format: \(oldPrayers.count) prayers")
            return (oldPrayers, false)
        }
        
        ppDebugLog("[Widget] DataManager: ❌ Failed to decode data")
        return ([], false)
    }
    
    /// Determine current day's prayers based on Isha + 30 min rule
    /// If current time > (today's Isha + 30 min), use tomorrow's prayers
    static func getCurrentDayPrayers(from prayersByDate: [String: [Prayer]]) -> [Prayer] {
        let calendar = Calendar.current
        let now = Date()
        let dateFormatter = DateFormatter()
        // Match JavaScript format: "MM-dd-yyyy" (e.g., "01-09-2026")
        dateFormatter.dateFormat = "MM-dd-yyyy"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        
        // Get today's date key
        let todayKey = dateFormatter.string(from: now)
        
        guard let todayPrayers = prayersByDate[todayKey] else {
            ppDebugLog("[Widget] DataManager: No prayers found for today (\(todayKey))")
            // Try to find closest date
            if let firstKey = prayersByDate.keys.sorted().first {
                return prayersByDate[firstKey] ?? []
            }
            return []
        }
        
        // Use last prayer of the day (Isha) to handle localization safely
        guard let ishaPrayer = todayPrayers.last else {
            ppDebugLog("[Widget] DataManager: No prayers found for today")
            return todayPrayers
        }

        guard let ishaTime = parseTimeToDate(ishaPrayer.time) else {
            ppDebugLog("[Widget] DataManager: Failed to parse Isha time")
            return todayPrayers
        }
        
        // Add 30 minutes to Isha time
        guard let ishaPlus30 = calendar.date(byAdding: .minute, value: 30, to: ishaTime) else {
            return todayPrayers
        }
        
        // If current time > Isha + 30 min, use tomorrow's prayers
        if now > ishaPlus30 {
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
            let tomorrowKey = dateFormatter.string(from: tomorrow)
            
            if let tomorrowPrayers = prayersByDate[tomorrowKey] {
                ppDebugLog("[Widget] DataManager: Using tomorrow's prayers (after Isha + 30 min)")
                return tomorrowPrayers
            } else {
                ppDebugLog("[Widget] DataManager: Tomorrow's prayers not found, using today's")
            }
        }
        
        return todayPrayers
    }
    
    /// Load all prayer data (for timeline scheduling - 14 days from app)
    static func loadAllPrayerData() -> [String: [Prayer]]? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            return nil
        }
        
        let data: Data? =
            sharedDefaults.data(forKey: phaseBKey)
            ?? sharedDefaults.data(forKey: phaseAKey)
            ?? sharedDefaults.data(forKey: dataKey)

        guard let data else { return nil }
        
        if let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) {
            return widgetData.prayers
        }
        
        return nil
    }
    
    /// Load prayers (backward compatibility - returns empty if using new format)
    static func loadPrayersOld() -> [Prayer] {
        let (prayers, _) = loadPrayers()
        return prayers
    }
    
    /// Parse time string into Date for today
    /// Supports multiple formats:
    /// - "5:05 AM" or "6:34 PM" (12-hour format)
    /// - "17:08" or "05:05" (24-hour format)
    /// - "5:05:00 AM" or "17:08:00" (with seconds)
    static func parseTimeToDate(_ timeStr: String) -> Date? {
        let calendar = Calendar.current
        let normalizedTime = timeStr.trimmingCharacters(in: .whitespacesAndNewlines)
        let appLocale = resolveAppLocale()
        
        // CRITICAL FIX: Parse time string directly to avoid timezone issues with DateFormatter
        // Extract hour and minute from string like "14:46" or "2:46 PM"
        var hour: Int? = nil
        var minute: Int? = nil
        var isPM = false
        
        // Try to parse 24-hour format first (e.g., "14:46", "17:08")
        if let colonIndex = normalizedTime.firstIndex(of: ":") {
            let hourStr = String(normalizedTime[..<colonIndex])
            let afterColon = String(normalizedTime[normalizedTime.index(after: colonIndex)...])
            
            // Check for AM/PM
            let upperAfterColon = afterColon.uppercased()
            if upperAfterColon.contains("AM") || upperAfterColon.contains("PM") {
                isPM = upperAfterColon.contains("PM")
                // Extract minute before AM/PM
                let minutePart = afterColon.components(separatedBy: CharacterSet.letters).first ?? ""
                hour = Int(hourStr)
                minute = Int(minutePart)
                
                // Convert 12-hour to 24-hour
                if let h = hour, minute != nil {
                    if isPM && h != 12 {
                        hour = h + 12
                    } else if !isPM && h == 12 {
                        hour = 0
                    }
                }
            } else {
                // 24-hour format - extract minute (may have seconds)
                let minutePart = afterColon.components(separatedBy: CharacterSet.decimalDigits.inverted).first ?? afterColon
                hour = Int(hourStr)
                minute = Int(minutePart)
            }
        }
        
        // If direct parsing failed, fallback to DateFormatter
        guard let h = hour, let m = minute else {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = calendar.timeZone  // CRITICAL: Use same timezone as calendar
            
            let formats = [
                "h:mm a", "h:mm:ss a", "HH:mm", "HH:mm:ss", "H:mm", "H:mm:ss"
            ]
            
            var parsedTime: Date? = nil
            let candidateLocales = [appLocale, Locale.current, Locale(identifier: "en_US_POSIX")]

            for locale in candidateLocales {
                formatter.locale = locale
                for format in formats {
                    formatter.dateFormat = format
                    if let time = formatter.date(from: normalizedTime) {
                        parsedTime = time
                        break
                    }
                }
                if parsedTime != nil {
                    break
                }
            }
            
            guard let time = parsedTime else {
                ppDebugLog("[Widget] parseTimeToDate: Failed to parse '\(normalizedTime)'")
                return nil
            }
            
            // Extract components from parsed time
            let now = Date()
            let todayComponents = calendar.dateComponents([.year, .month, .day], from: now)
            let timeComponents = calendar.dateComponents([.hour, .minute], from: time)
            
            var combined = DateComponents()
            combined.year = todayComponents.year
            combined.month = todayComponents.month
            combined.day = todayComponents.day
            combined.hour = timeComponents.hour
            combined.minute = timeComponents.minute
            
            return calendar.date(from: combined)
        }
        
        // Direct parsing succeeded - combine with today's date
        let now = Date()
        let todayComponents = calendar.dateComponents([.year, .month, .day], from: now)
        
        var combined = DateComponents()
        combined.year = todayComponents.year
        combined.month = todayComponents.month
        combined.day = todayComponents.day
        combined.hour = h
        combined.minute = m
        
        return calendar.date(from: combined)
    }
    
    // Fix 3: Refresh Rate - strict deterministic calculation
    static func getNextPrayer(from prayers: [Prayer], relativeTo referenceDate: Date = Date()) -> (name: String, time: String) {
        guard !prayers.isEmpty else { return ("--", "--") }
        
        // Find the first prayer that is still in the future relative to the reference date
        for prayer in prayers {
            if let prayerDate = parseTimeToDate(prayer.time) {
                if prayerDate > referenceDate {
                    return (prayer.name, prayer.time)
                }
            }
        }
        
        // All prayers have passed for today - return first prayer (Fajr for tomorrow)
        if let first = prayers.first {
            return (first.name, first.time)
        }
        
        return ("--", "--")
    }
}

// MARK: - 3. Timeline Entry
struct PrayerPalEntry: TimelineEntry {
    let date: Date
    let nextName: String
    let nextTime: String
    let allPrayers: [Prayer]
    let temperature: String? // Added temperature
    let isDataAvailable: Bool
    let isPreviewMode: Bool
    let isExpired: Bool
    let localizedStrings: WidgetLocalizedStrings
    
    init(date: Date, nextName: String, nextTime: String, allPrayers: [Prayer], temperature: String? = nil, isDataAvailable: Bool, isPreviewMode: Bool, isExpired: Bool = false, localizedStrings: WidgetLocalizedStrings) {
        self.date = date
        self.nextName = nextName
        self.nextTime = nextTime
        self.allPrayers = allPrayers
        self.temperature = temperature
        self.isDataAvailable = isDataAvailable
        self.isPreviewMode = isPreviewMode
        self.isExpired = isExpired
        self.localizedStrings = localizedStrings
    }
}

// MARK: - 4. The View
struct PrayerPalWidgetEntryView: View {
    var entry: PrayerPalEntry
    @Environment(\.widgetFamily) var family
    
    // Design colors matching the WidgetPreviewMedium.png exactly
    let navyBlue = Color(red: 0.17, green: 0.24, blue: 0.36)  // #2C3E5C - for times and main text
    let goldenAmber = Color(red: 0.79, green: 0.64, blue: 0.15)  // #C9A227 - for prayer names
    let darkBrown = Color(red: 0.30, green: 0.20, blue: 0.10)  // Legacy fallback
    let cardBackground = Color.white.opacity(0.30)  // 30% transparency as requested
    
    var dynamicNextPrayer: (name: String, time: String) {
        // If we have prayers, calculate which one is next based on ENTRY DATE (deterministic)
        if !entry.allPrayers.isEmpty {
            return DataManager.getNextPrayer(from: entry.allPrayers, relativeTo: entry.date)
        }
        // Fallback to entry values (for preview/empty states)
        return (entry.nextName, entry.nextTime)
    }
    
    var body: some View {
        if #available(iOS 17.0, *) {
            // iOS 17+: Check rendering mode for Liquid Glass / tinted theme
            RenderingModeAwareView(entry: entry, family: family, darkBrown: darkBrown, cardBackground: cardBackground)
        } else {
            // iOS 16 and earlier: Use standard content
            standardContent
        }
    }
    
    // Standard content for iOS 16 and earlier (no accented mode detection)
    @ViewBuilder
    var standardContent: some View {
        // Lock Screen widgets don't use preview images or backgrounds (iOS 16+)
        if #available(iOS 16.0, *), isLockScreenWidget {
            liveWidgetContent
        } else if entry.isPreviewMode {
            // GALLERY: Show static preview image (with text baked in)
            previewImageContent
        } else if entry.isExpired {
            // EXPIRED: Show "Open App to Sync" prompt
            expiredStateContent
        } else if entry.isDataAvailable {
            // LIVE: Show background + dynamic prayer cards
            liveWidgetContent
        } else {
            // EMPTY: Show background + welcome message
            emptyStateContent
        }
    }
    
    // Helper to check if this is a Lock Screen widget family
    private var isLockScreenWidget: Bool {
        if #available(iOS 16.0, *) {
            return family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
        }
        return false
    }
    
    // MARK: - A. Gallery Preview (Static Image)
    @ViewBuilder
    var previewImageContent: some View {
        switch family {
        case .systemSmall:
            Image("WidgetPreviewSmall")
                .resizable()
                .scaledToFill()
                .clipped()
        case .systemMedium:
            Image("WidgetPreviewMedium")
                .resizable()
                .scaledToFill()
                .clipped()
        default:
            Image("WidgetPreviewSmall")
                .resizable()
                .scaledToFill()
                .clipped()
        }
    }
    
    // MARK: - B. Live Widget Content (Dynamic)
    @ViewBuilder
    var liveWidgetContent: some View {
        if #available(iOS 16.0, *) {
            switch family {
            case .systemSmall:
                smallWidgetLive
            case .systemMedium:
                mediumWidgetLive
            case .accessoryCircular:
                lockScreenCircularWidget
            case .accessoryRectangular:
                lockScreenRectangularWidget
            case .accessoryInline:
                lockScreenInlineWidget
            default:
                smallWidgetLive
            }
        } else {
            // iOS 15 and earlier - only support home screen widgets
            switch family {
            case .systemSmall:
                smallWidgetLive
            case .systemMedium:
                mediumWidgetLive
            default:
                smallWidgetLive
            }
        }
    }
    
    // MARK: - Small Widget (Live) - Widget Editor v1.2
    // Text color matches Android (#A27323); crisp shadow for legibility
    private static let smallWidgetTextColor = Color(red: 0.635, green: 0.451, blue: 0.137)
    private static let smallWidgetShadowColor = Color(red: 0.227, green: 0.133, blue: 0.027)
    
    var smallWidgetLive: some View {
        let textColor = Self.smallWidgetTextColor
        let shadowColor = Self.smallWidgetShadowColor
        
        return GeometryReader { geometry in
            let baseScale: CGFloat = 0.9
            let widgetScale = min(1.0, geometry.size.width / 170.0)
            let scale = baseScale * widgetScale
            let cardHeight = geometry.size.height * 0.13
            let nameWidth = geometry.size.width * 0.38
            let timeWidth = geometry.size.width * 0.35
            let tempWidth = geometry.size.width * 0.22
            let rightInset: CGFloat = 10
            let tempRightInset: CGFloat = 24  // Push temperature left so C aligns under 0
            
            ZStack {
                Image("WidgetBackgroundSmall")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                
                // Next Prayer row: row width (width - rightInset) so time ends at same x as temp (C under 0)
                HStack(spacing: 9 * scale) {
                    Text(dynamicNextPrayer.name.uppercased())
                        .font(.system(size: 26 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: nameWidth, alignment: .leading)
                    Text(formatTimeForDevice(dynamicNextPrayer.time))
                        .font(.system(size: 28 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: timeWidth, alignment: .trailing)
                }
                .environment(\.layoutDirection, .leftToRight)
                .frame(width: geometry.size.width - rightInset, height: cardHeight)
                .position(x: (geometry.size.width - rightInset) / 2, y: geometry.size.height * 0.15)
                
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 28 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: tempWidth, alignment: .trailing)
                        .position(x: geometry.size.width - tempRightInset - tempWidth / 2, y: geometry.size.height * 0.86)
                }
            }
        }
    }
    
    // MARK: - Medium Widget (Live) - Widget Editor v1.2
    // Original visuals: white text with strong shadow
    var mediumWidgetLive: some View {
        let textColor = Color.white
        let shadowColor = Color(red: 0.05, green: 0.12, blue: 0.24)
        
        return GeometryReader { geometry in
            // Scale factor: 1.0 for 360pt+ width widgets, scales down proportionally
            // 90% of original size as base (0.9 multiplier)
            let baseScale: CGFloat = 0.9
            let leftWidth = geometry.size.width / 2
            let widgetScale = min(1.0, leftWidth / 170.0)
            let scale = baseScale * widgetScale
            let cardHeight = geometry.size.height * 0.13
            let nameWidth = leftWidth * 0.38
            let timeWidth = leftWidth * 0.35
            let rightInset: CGFloat = 10
            let tempWidth = leftWidth * 0.34
            let minTempWidth: CGFloat = 96 * scale
            // Right list container bounds (matches HTML preview: 20px left/top/right, 100px bottom)
            let listLeft: CGFloat = 20
            let listTop: CGFloat = 44
            let listRight: CGFloat = 20
            let listBottom: CGFloat = 72
            let listWidth = leftWidth - listLeft - listRight
            let listHeight = geometry.size.height - listTop - listBottom
            let listTextSize = min(30 * scale, max(15 * scale, (listHeight * 0.95) / 6))
            let baseGap = max(0, (listHeight - (listTextSize * 6)) / 5)
            let rowGap = max(baseGap, 3 * scale)
            let tableContentHeight = (listTextSize * 6) + (rowGap * 5)
            let listTopPadding = max(0, listHeight - tableContentHeight)
            
            ZStack {
                // Background image
                Image("WidgetBackgroundMedium")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                
                HStack(spacing: 0) {
                    // Left half: Next prayer row (small widget setup)
                    ZStack {
                        HStack(spacing: 9 * scale) {
                            Text(dynamicNextPrayer.name.uppercased())
                                .font(.system(size: 26 * scale, weight: .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.3)
                                .allowsTightening(true)
                                .foregroundColor(textColor)
                                .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                                .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                                .frame(width: nameWidth, alignment: .leading)
                            Text(formatTimeForDevice(dynamicNextPrayer.time))
                                .font(.system(size: 28 * scale, weight: .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.2)
                                .foregroundColor(textColor)
                                .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                                .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                                .frame(width: timeWidth, alignment: .trailing)
                        }
                        .environment(\.layoutDirection, .leftToRight)
                        .frame(width: leftWidth - rightInset, height: cardHeight)
                        .position(x: (leftWidth - rightInset) / 2, y: geometry.size.height * 0.15 + 12)
                    }
                    .frame(width: leftWidth, height: geometry.size.height)
                    
                    // Right half: Prayer list (matches HTML preview layout)
                    ZStack {
                        VStack(spacing: 0) {
                            ForEach(0..<6, id: \.self) { index in
                                HStack {
                                    Text(getPrayerName(at: index).uppercased())
                                        .font(.system(size: listTextSize, weight: .bold))
                                        .minimumScaleFactor(0.7)
                                        .lineLimit(1)
                                        .foregroundColor(textColor)
                                        .shadow(color: shadowColor.opacity(0.58), radius: 0.6, x: 0.6, y: 0.6)
                                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1, y: 1)
                                    Spacer()
                                    Text(formatTimeForDevice(getPrayerTime(at: index)))
                                        .font(.system(size: listTextSize, weight: .bold))
                                        .minimumScaleFactor(0.7)
                                        .lineLimit(1)
                                        .foregroundColor(textColor)
                                        .shadow(color: shadowColor.opacity(0.58), radius: 0.6, x: 0.6, y: 0.6)
                                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1, y: 1)
                                }
                                .frame(height: listTextSize)
                                if index < 5 {
                                    Spacer()
                                        .frame(height: rowGap)
                                }
                            }
                        }
                        .padding(.top, listTopPadding)
                        .environment(\.layoutDirection, .leftToRight)
                        .frame(width: listWidth, height: listHeight)
                        .position(x: listLeft + listWidth / 2, y: listTop + listHeight / 2)
                    }
                    .frame(width: leftWidth, height: geometry.size.height)
                }
                
                // Temperature centered at bottom (small widget size)
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 18 * scale, weight: .bold))
                        .minimumScaleFactor(0.55)
                        .lineLimit(1)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                        .frame(width: max(tempWidth, minTempWidth), alignment: .center)
                        .position(x: geometry.size.width * 0.75, y: geometry.size.height * 0.86 + 6)
                }
            }
        }
    }
    
    // Helper: Get prayer name at index (safe)
    func getPrayerName(at index: Int) -> String {
        guard index < entry.allPrayers.count else { return "--" }
        return entry.allPrayers[index].name
    }
    
    // Helper: Get prayer time at index (safe)
    func getPrayerTime(at index: Int) -> String {
        guard index < entry.allPrayers.count else { return "--" }
        return entry.allPrayers[index].time
    }
    
    // Helper: Format time based on device's locale preference (12-hour vs 24-hour)
    func formatTimeForDevice(_ time: String) -> String {
        DataManager.formatTimeForDisplay(time)
    }
    
    // Helper: Convert any time format to 12-hour with AM/PM (legacy - kept for backward compatibility)
    func formatTime12Hour(_ time: String) -> String {
        return formatTimeForDevice(time) // Now uses device preference
    }
    
    // MARK: - C. Expired State (Data stale)
    var expiredStateContent: some View {
        // Same as empty state - shows "Open App to Sync"
        emptyStateContent
    }
    
    // MARK: - Lock Screen Widgets (iOS 16+)
    
    // Helper to get lock screen data
    private var lockScreenData: (name: String, time: String, progress: Double, hasData: Bool) {
        guard entry.isDataAvailable && !entry.allPrayers.isEmpty else {
            return ("--", "--", 0, false)
        }
        let next = DataManager.getNextPrayer(from: entry.allPrayers)
        var progress: Double = 0.5
        if let prayerDate = DataManager.parseTimeToDate(next.time) {
            let hoursUntil = prayerDate.timeIntervalSince(Date()) / 3600.0
            progress = max(0.0, min(1.0, hoursUntil / 24.0))
        }
        return (next.name, next.time, progress, true)
    }
    
    // Circular widget - shows next prayer time in a gauge/circular format with app branding
    @available(iOS 16.0, *)
    @ViewBuilder
    var lockScreenCircularWidget: some View {
        let data = lockScreenData
        if data.hasData {
            Gauge(value: data.progress) {
                // Show prayer abbreviation at top
                Text(data.name.prefix(3).uppercased())
                    .font(.system(size: 8, weight: .bold))
            } currentValueLabel: {
                // Show time in center
                Text(formatTimeForDevice(data.time))
                    .font(.system(size: 12, weight: .bold))
                    .minimumScaleFactor(0.7)
            } minimumValueLabel: {
                // Empty for clean look
                Text("")
            } maximumValueLabel: {
                // Empty for clean look
                Text("")
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            Gauge(value: 0) {
                Text("PP+")
                    .font(.system(size: 8, weight: .bold))
            }
            .gaugeStyle(.accessoryCircular)
        }
    }
    
    // Rectangular widget - shows next prayer name, time, app branding, and temperature
    @available(iOS 16.0, *)
    @ViewBuilder
    var lockScreenRectangularWidget: some View {
        let data = lockScreenData
        if data.hasData {
            HStack(alignment: .center, spacing: 4) {
                VStack(alignment: .center, spacing: 2) {
                    Text(data.name.uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Text(formatTimeForDevice(data.time))
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .allowsTightening(true)
                        .monospacedDigit()
                        .opacity(0.9)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .layoutPriority(1)
                // App branding between prayer info and temperature
                VStack(spacing: 0) {
                    ForEach(Array(lockScreenAppNameLines(entry.localizedStrings.appName).enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(size: 8, weight: .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .frame(width: 50)
                .multilineTextAlignment(.center)
                .opacity(0.6)
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 12, weight: .medium))
                        .opacity(0.8)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                        .allowsTightening(true)
                        .monospacedDigit()
                        .frame(width: 34, alignment: .trailing)
                }
            }
            .padding(.horizontal, 2)
        } else {
            Text(entry.localizedStrings.openAppToSync)
                .font(.system(size: 12, weight: .medium))
                .opacity(0.7)
        }
    }
    
    // Inline widget - compact one-line format with app branding
    @available(iOS 16.0, *)
    @ViewBuilder
    var lockScreenInlineWidget: some View {
        let data = lockScreenData
        if data.hasData {
            HStack(spacing: 4) {
                Text(entry.localizedStrings.appName)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("•")
                Text("\(data.name): \(formatTimeForDevice(data.time))")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .allowsTightening(true)
                    .layoutPriority(1)
            }
        } else {
            HStack(spacing: 4) {
                Text(entry.localizedStrings.appName)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("• \(entry.localizedStrings.openAppToSync)")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .allowsTightening(true)
                    .layoutPriority(1)
            }
        }
    }
    
    // MARK: - D. Empty State (Fresh Install)
    var emptyStateContent: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                if family == .systemMedium {
                    Image("WidgetBackgroundMedium")
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                } else {
                    Image("WidgetBackgroundSmall")
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                }
                
                // Welcome message - positioned based on widget size
                VStack(spacing: 6) {
                    Text(entry.localizedStrings.welcome)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(darkBrown)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(
                            Capsule()
                                .fill(cardBackground)  // 30% transparency
                                .shadow(color: .black.opacity(0.12), radius: 6, x: 0, y: 3)
                        )
                    
                    Text(entry.localizedStrings.openAppToSync)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(darkBrown)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 11)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(cardBackground)  // 30% transparency
                                .shadow(color: .black.opacity(0.10), radius: 5, x: 0, y: 2)
                        )
                }
                .frame(maxWidth: .infinity, alignment: family == .systemMedium ? .trailing : .center)
                .padding(.trailing, family == .systemMedium ? 32 : 0)
            }
        }
    }
}

// MARK: - 4b. Rendering Mode Aware View (iOS 17+)
// Separate struct to handle @Environment(\.widgetRenderingMode) which requires iOS 17+
@available(iOS 17.0, *)
struct RenderingModeAwareView: View {
    var entry: PrayerPalEntry
    var family: WidgetFamily
    var darkBrown: Color
    var cardBackground: Color
    
    @Environment(\.widgetRenderingMode) var renderingMode
    
    // Detect special rendering modes (Tinted/Clear)
    var isSpecialMode: Bool {
        renderingMode == .accented || renderingMode == .vibrant
    }
    
    // Fix 3: Refresh Rate - strict deterministic calculation
    var dynamicNextPrayer: (name: String, time: String) {
        if !entry.allPrayers.isEmpty {
            return DataManager.getNextPrayer(from: entry.allPrayers, relativeTo: entry.date)
        }
        return (entry.nextName, entry.nextTime)
    }
    
    // Helper to check if this is a Lock Screen widget family
    private var isLockScreenWidget: Bool {
        if #available(iOS 16.0, *) {
            return family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
        }
        return false
    }
    
    var body: some View {
        // Lock Screen widgets don't use preview images or special modes
        if isLockScreenWidget {
            liveWidgetContent
        } else if entry.isPreviewMode && !isSpecialMode {
            previewImageContent
        } else if entry.isExpired {
            if isSpecialMode {
                specialModeEmptyState
            } else {
                emptyStateContent
            }
        } else if entry.isDataAvailable {
            if isSpecialMode {
                specialModeLiveContent
            } else {
                liveWidgetContent
            }
        } else {
            if isSpecialMode {
                specialModeEmptyState
            } else {
                emptyStateContent
            }
        }
    }
    
    // MARK: - Special Mode Content (Tinted/Clear) - Text-based design
    @ViewBuilder
    var specialModeLiveContent: some View {
        switch family {
        case .systemSmall:
            specialModeSmallWidget
        case .systemMedium:
            specialModeMediumWidget
        default:
            specialModeSmallWidget
        }
    }
    
    var specialModeSmallWidget: some View {
        VStack(spacing: 0) {
            // Main content area - next prayer centered
            VStack(spacing: 4) {
                Text(dynamicNextPrayer.name)
                    .font(.system(size: 18, weight: .bold))
                Text(formatTimeForDeviceIOS17(dynamicNextPrayer.time))
                    .font(.system(size: 32, weight: .heavy))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Temperature (if available)
            if let temp = entry.temperature {
                Text(temp)
                    .font(.system(size: 12, weight: .medium))
                    .opacity(0.8)
                    .padding(.top, 4)
            }
            
            // App name at bottom - distinct footer
            Text(entry.localizedStrings.appName)
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.5)
                .opacity(0.6)
                .padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetAccentable()
    }
    
    var specialModeMediumWidget: some View {
        HStack(spacing: 0) {
            // Left side: Same design as small widget
            VStack(spacing: 0) {
                // Next prayer centered
                VStack(spacing: 4) {
                    Text(dynamicNextPrayer.name)
                        .font(.system(size: 18, weight: .bold))
                    Text(formatTimeForDeviceIOS17(dynamicNextPrayer.time))
                        .font(.system(size: 32, weight: .heavy))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                
                // App name footer
                Text(entry.localizedStrings.appName)
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.5)
                    .opacity(0.6)
                    .padding(.bottom, 10)
            }
            .frame(maxWidth: .infinity)
            
            // Right side: All prayer times + temperature
            VStack(spacing: 5) {
                ForEach(entry.allPrayers) { prayer in
                    HStack {
                        Text(prayer.name)
                            .font(.system(size: 12, weight: .semibold))
                        Spacer()
                        Text(formatTimeForDeviceIOS17(prayer.time))
                            .font(.system(size: 12, weight: .medium))
                            .opacity(0.9)
                    }
                }
                
                // Temperature at bottom of prayer list
                // Temperature at bottom of prayer list
                if let temp = entry.temperature {
                    HStack {
                        Spacer()
                        Text(temp)
                            .font(.system(size: 11, weight: .medium))
                            .opacity(0.8)
                        Spacer()
                    }
                    .padding(.top, 4)
                }
            }
            .frame(width: 140)
            .padding(.trailing, 16)
            .padding(.vertical, 14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetAccentable()
    }
    
    var specialModeEmptyState: some View {
        VStack(spacing: 0) {
            // Centered content
            VStack(spacing: 8) {
                Text(entry.localizedStrings.openAppToSync)
                    .font(.system(size: 14, weight: .bold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .opacity(0.9)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // App name footer
            Text(entry.localizedStrings.appName)
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.5)
                .opacity(0.6)
                .padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetAccentable()
    }
    
    // MARK: - Preview Content
    @ViewBuilder
    var previewImageContent: some View {
        switch family {
        case .systemSmall:
            Image("WidgetPreviewSmall")
                .resizable()
                .scaledToFill()
                .clipped()
        case .systemMedium:
            Image("WidgetPreviewMedium")
                .resizable()
                .scaledToFill()
                .clipped()
        default:
            Image("WidgetPreviewSmall")
                .resizable()
                .scaledToFill()
                .clipped()
        }
    }
    
    // MARK: - Live Content
    @ViewBuilder
    var liveWidgetContent: some View {
        if #available(iOS 16.0, *) {
            switch family {
            case .systemSmall:
                smallWidgetLive
            case .systemMedium:
                mediumWidgetLive
            case .accessoryCircular:
                lockScreenCircularWidget
            case .accessoryRectangular:
                lockScreenRectangularWidget
            case .accessoryInline:
                lockScreenInlineWidget
            default:
                smallWidgetLive
            }
        } else {
            // iOS 15 and earlier - only support home screen widgets
            switch family {
            case .systemSmall:
                smallWidgetLive
            case .systemMedium:
                mediumWidgetLive
            default:
                smallWidgetLive
            }
        }
    }
    
    // MARK: - Lock Screen Widgets (iOS 16+)
    // Duplicated from PrayerPalWidgetEntryView for access in RenderingModeAwareView
    // Note: No @available needed here - already in iOS 17+ context
    
    // Helper to get lock screen data (iOS 17+ version)
    private var lockScreenData: (name: String, time: String, progress: Double, hasData: Bool) {
        guard entry.isDataAvailable && !entry.allPrayers.isEmpty else {
            return ("--", "--", 0, false)
        }
        let next = DataManager.getNextPrayer(from: entry.allPrayers)
        var progress: Double = 0.5
        if let prayerDate = DataManager.parseTimeToDate(next.time) {
            let hoursUntil = prayerDate.timeIntervalSince(Date()) / 3600.0
            progress = max(0.0, min(1.0, hoursUntil / 24.0))
        }
        return (next.name, next.time, progress, true)
    }
    
    // Circular widget - shows next prayer time in a gauge/circular format with app branding
    @ViewBuilder
    var lockScreenCircularWidget: some View {
        let data = lockScreenData
        if data.hasData {
            Gauge(value: data.progress) {
                // Show prayer abbreviation at top
                Text(data.name.prefix(3).uppercased())
                    .font(.system(size: 8, weight: .bold))
            } currentValueLabel: {
                // Show time in center
                Text(formatTimeForDeviceIOS17(data.time))
                    .font(.system(size: 12, weight: .bold))
                    .minimumScaleFactor(0.7)
            } minimumValueLabel: {
                // Empty for clean look
                Text("")
            } maximumValueLabel: {
                // Empty for clean look
                Text("")
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            Gauge(value: 0) {
                Text("PP+")
                    .font(.system(size: 8, weight: .bold))
            }
            .gaugeStyle(.accessoryCircular)
        }
    }
    
    // Rectangular widget - shows next prayer name, time, app branding, and temperature
    @ViewBuilder
    var lockScreenRectangularWidget: some View {
        let data = lockScreenData
        if data.hasData {
            HStack(alignment: .center, spacing: 4) {
                VStack(alignment: .center, spacing: 2) {
                    Text(data.name.uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Text(formatTimeForDeviceIOS17(data.time))
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .allowsTightening(true)
                        .monospacedDigit()
                        .opacity(0.9)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .layoutPriority(1)
                // App branding between prayer info and temperature
                VStack(spacing: 0) {
                    ForEach(Array(lockScreenAppNameLines(entry.localizedStrings.appName).enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(size: 8, weight: .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .frame(width: 50)
                .multilineTextAlignment(.center)
                .opacity(0.6)
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 12, weight: .medium))
                        .opacity(0.8)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                        .allowsTightening(true)
                        .monospacedDigit()
                        .frame(width: 34, alignment: .trailing)
                }
            }
            .padding(.horizontal, 2)
        } else {
            Text(entry.localizedStrings.openAppToSync)
                .font(.system(size: 12, weight: .medium))
                .opacity(0.7)
        }
    }
    
    // Inline widget - compact one-line format with app branding
    @ViewBuilder
    var lockScreenInlineWidget: some View {
        let data = lockScreenData
        if data.hasData {
            HStack(spacing: 4) {
                Text(entry.localizedStrings.appName)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("•")
                Text("\(data.name): \(formatTimeForDeviceIOS17(data.time))")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .allowsTightening(true)
                    .layoutPriority(1)
            }
        } else {
            HStack(spacing: 4) {
                Text(entry.localizedStrings.appName)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("• \(entry.localizedStrings.openAppToSync)")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .allowsTightening(true)
                    .layoutPriority(1)
            }
        }
    }
    
    // Small widget iOS 17+ - Text color white; shadow suited to white text
    var smallWidgetLive: some View {
        let textColor = Color.white
        let shadowColor = Color.black.opacity(0.5)
        
        return GeometryReader { geometry in
            let baseScale: CGFloat = 0.9
            let widgetScale = min(1.0, geometry.size.width / 170.0)
            let scale = baseScale * widgetScale
            let cardHeight = geometry.size.height * 0.13
            let nameWidth = geometry.size.width * 0.38
            let timeWidth = geometry.size.width * 0.35
            let tempWidth = geometry.size.width * 0.22
            let rightInset: CGFloat = 10
            let tempRightInset: CGFloat = 24
            
            ZStack {
                Image("WidgetBackgroundSmall")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                
                HStack(spacing: 9 * scale) {
                    Text(dynamicNextPrayer.name.uppercased())
                        .font(.system(size: 26 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: nameWidth, alignment: .leading)
                    Text(formatTimeForDeviceIOS17(dynamicNextPrayer.time))
                        .font(.system(size: 28 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: timeWidth, alignment: .trailing)
                }
                .environment(\.layoutDirection, .leftToRight)
                .frame(width: geometry.size.width - rightInset, height: cardHeight)
                .position(x: (geometry.size.width - rightInset) / 2, y: geometry.size.height * 0.15)
                
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 28 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.2)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor, radius: 1, x: 1, y: 1)
                        .shadow(color: shadowColor.opacity(0.5), radius: 2, x: 1.5, y: 1.5)
                        .frame(width: tempWidth, alignment: .trailing)
                        .position(x: geometry.size.width - tempRightInset - tempWidth / 2, y: geometry.size.height * 0.86)
                }
            }
        }
    }
    
    // Medium widget iOS 17+ - Widget Editor v1.2
    // All text white, responsive font scaling (90% base, scales down for smaller screens)
    var mediumWidgetLive: some View {
        let textColor = Color.white
        let shadowColor = Color(red: 0.05, green: 0.12, blue: 0.24)
        
        return GeometryReader { geometry in
            // Scale factor: 1.0 for 360pt+ width widgets, scales down proportionally
            // 90% of original size as base (0.9 multiplier)
            let baseScale: CGFloat = 0.9
            let leftWidth = geometry.size.width / 2
            let widgetScale = min(1.0, leftWidth / 170.0)
            let scale = baseScale * widgetScale
            let cardHeight = geometry.size.height * 0.13
            let nameWidth = leftWidth * 0.38
            let timeWidth = leftWidth * 0.35
            let rightInset: CGFloat = 10
            let tempWidth = leftWidth * 0.34
            let minTempWidth: CGFloat = 96 * scale
            // Right list container bounds (matches HTML preview: 20px left/top/right, 100px bottom)
            let listLeft: CGFloat = 20
            let listTop: CGFloat = 44
            let listRight: CGFloat = 20
            let listBottom: CGFloat = 72
            let listWidth = leftWidth - listLeft - listRight
            let listHeight = geometry.size.height - listTop - listBottom
            let listTextSize = min(30 * scale, max(15 * scale, (listHeight * 0.95) / 6))
            let baseGap = max(0, (listHeight - (listTextSize * 6)) / 5)
            let rowGap = max(baseGap, 3 * scale)
            let tableContentHeight = (listTextSize * 6) + (rowGap * 5)
            let listTopPadding = max(0, listHeight - tableContentHeight)
            
            ZStack {
                // Background image
                Image("WidgetBackgroundMedium")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                
                HStack(spacing: 0) {
                    // Left half: Next prayer row (small widget setup)
                    ZStack {
                        HStack(spacing: 9 * scale) {
                            Text(dynamicNextPrayer.name.uppercased())
                                .font(.system(size: 26 * scale, weight: .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.3)
                                .allowsTightening(true)
                                .foregroundColor(textColor)
                                .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                                .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                                .frame(width: nameWidth, alignment: .leading)
                            Text(formatTimeForDeviceIOS17(dynamicNextPrayer.time))
                                .font(.system(size: 28 * scale, weight: .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.2)
                                .foregroundColor(textColor)
                                .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                                .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                                .frame(width: timeWidth, alignment: .trailing)
                        }
                        .environment(\.layoutDirection, .leftToRight)
                        .frame(width: leftWidth - rightInset, height: cardHeight)
                        .position(x: (leftWidth - rightInset) / 2, y: geometry.size.height * 0.15 + 12)
                    }
                    .frame(width: leftWidth, height: geometry.size.height)
                    
                    // Right half: Prayer list (matches HTML preview layout)
                    ZStack {
                        VStack(spacing: 0) {
                            ForEach(0..<6, id: \.self) { index in
                                HStack {
                                    Text(getPrayerNameIOS17(at: index).uppercased())
                                        .font(.system(size: listTextSize, weight: .bold))
                                        .minimumScaleFactor(0.7)
                                        .lineLimit(1)
                                        .foregroundColor(textColor)
                                        .shadow(color: shadowColor.opacity(0.58), radius: 0.6, x: 0.6, y: 0.6)
                                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1, y: 1)
                                    Spacer()
                                    Text(formatTimeForDeviceIOS17(getPrayerTimeIOS17(at: index)))
                                        .font(.system(size: listTextSize, weight: .bold))
                                        .minimumScaleFactor(0.7)
                                        .lineLimit(1)
                                        .foregroundColor(textColor)
                                        .shadow(color: shadowColor.opacity(0.58), radius: 0.6, x: 0.6, y: 0.6)
                                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1, y: 1)
                                }
                                .frame(height: listTextSize)
                                if index < 5 {
                                    Spacer()
                                        .frame(height: rowGap)
                                }
                            }
                        }
                        .padding(.top, listTopPadding)
                        .environment(\.layoutDirection, .leftToRight)
                        .frame(width: listWidth, height: listHeight)
                        .position(x: listLeft + listWidth / 2, y: listTop + listHeight / 2)
                    }
                    .frame(width: leftWidth, height: geometry.size.height)
                }
                
                // Temperature centered at bottom (small widget size)
                if let temp = entry.temperature {
                    Text(temp)
                        .font(.system(size: 18 * scale, weight: .bold))
                        .minimumScaleFactor(0.55)
                        .lineLimit(1)
                        .foregroundColor(textColor)
                        .shadow(color: shadowColor.opacity(0.58), radius: 0.9, x: 0.9, y: 0.9)
                        .shadow(color: shadowColor.opacity(0.28), radius: 1.6, x: 1.2, y: 1.2)
                        .frame(width: max(tempWidth, minTempWidth), alignment: .center)
                        .position(x: geometry.size.width * 0.75, y: geometry.size.height * 0.86 + 6)
                }
            }
        }
    }
    
    func getPrayerNameIOS17(at index: Int) -> String {
        guard index < entry.allPrayers.count else { return "--" }
        return entry.allPrayers[index].name
    }
    
    func getPrayerTimeIOS17(at index: Int) -> String {
        guard index < entry.allPrayers.count else { return "--" }
        return entry.allPrayers[index].time
    }
    
    // Format time based on device's locale preference (12-hour vs 24-hour)
    func formatTimeForDeviceIOS17(_ time: String) -> String {
        DataManager.formatTimeForDisplay(time)
    }
    
    // Convert any time format to 12-hour with AM/PM (legacy - kept for backward compatibility)
    func formatTime12HourIOS17(_ time: String) -> String {
        return formatTimeForDeviceIOS17(time) // Now uses device preference
    }
    
    // MARK: - Empty State Content
    var emptyStateContent: some View {
        GeometryReader { geometry in
            ZStack {
                if family == .systemMedium {
                    Image("WidgetBackgroundMedium")
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                } else {
                    Image("WidgetBackgroundSmall")
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                }
                
                VStack(spacing: 6) {
                    Text(entry.localizedStrings.welcome)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(darkBrown)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(
                            Capsule()
                                .fill(cardBackground)
                                .shadow(color: .black.opacity(0.12), radius: 6, x: 0, y: 3)
                        )
                    
                    Text(entry.localizedStrings.openAppToSync)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(darkBrown)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 11)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(cardBackground)
                                .shadow(color: .black.opacity(0.10), radius: 5, x: 0, y: 2)
                        )
                }
                .frame(maxWidth: .infinity, alignment: family == .systemMedium ? .trailing : .center)
                .padding(.trailing, family == .systemMedium ? 32 : 0)
            }
        }
    }
}

// MARK: - 5. Provider
struct Provider: TimelineProvider {
    
    // Placeholder: Show static preview image in gallery
    func placeholder(in context: Context) -> PrayerPalEntry {
        let localizedStrings = DataManager.loadLocalizedStrings()
        return PrayerPalEntry(
            date: Date(),
            nextName: "",
            nextTime: "",
            allPrayers: [],
            temperature: nil,
            isDataAvailable: false,
            isPreviewMode: true,  // Shows WidgetPreview image
            isExpired: false,
            localizedStrings: localizedStrings
        )
    }
    
    // Snapshot: Gallery ALWAYS shows static preview image, home screen shows real data
    func getSnapshot(in context: Context, completion: @escaping (PrayerPalEntry) -> ()) {
        ppDebugLog("[Widget] getSnapshot called - isPreview: \(context.isPreview)")
        let localizedStrings = DataManager.loadLocalizedStrings()
        
        // GALLERY MODE: Always show static preview images
        if context.isPreview {
            completion(PrayerPalEntry(
                date: Date(),
                nextName: "",
                nextTime: "",
                allPrayers: [],
                temperature: nil,
                isDataAvailable: false,
                isPreviewMode: true,
                isExpired: false,
                localizedStrings: localizedStrings
            ))
            return
        }
        
        // HOME SCREEN MODE: Show real data with cached temperature
        let (prayers, isExpired) = DataManager.loadPrayers()
        let temperature = DataManager.loadWeather()
        
        if prayers.isEmpty || isExpired {
            completion(PrayerPalEntry(
                date: Date(),
                nextName: "",
                nextTime: "",
                allPrayers: [],
                temperature: temperature,
                isDataAvailable: false,
                isPreviewMode: false,
                isExpired: isExpired,
                localizedStrings: localizedStrings
            ))
        } else {
            let next = DataManager.getNextPrayer(from: prayers)
            completion(PrayerPalEntry(
                date: Date(),
                nextName: next.name,
                nextTime: next.time,
                allPrayers: prayers,
                temperature: temperature,
                isDataAvailable: true,
                isPreviewMode: false,
                isExpired: false,
                localizedStrings: localizedStrings
            ))
        }
    }
    
    // Timeline: Uses cached temperature pushed by app.
    // Any age label in `temperature` is embedded at timeline creation via DataManager.loadWeather().
    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerPalEntry>) -> ()) {
        let (prayers, isExpired) = DataManager.loadPrayers()
        let temperature = DataManager.loadWeather()
        let now = Date()
        let calendar = Calendar.current
        let localizedStrings = DataManager.loadLocalizedStrings()
        
        ppDebugLog("[Widget] getTimeline called - prayers: \(prayers.count), temp: \(temperature ?? "nil")")
        
        // Handle empty/expired state
        if prayers.isEmpty || isExpired {
            let entry = PrayerPalEntry(
                date: now,
                nextName: "",
                nextTime: "",
                allPrayers: [],
                temperature: temperature,
                isDataAvailable: false,
                isPreviewMode: false,
                isExpired: isExpired,
                localizedStrings: localizedStrings
            )
            let nextUpdate = calendar.date(byAdding: .hour, value: 1, to: now) ?? now
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
            return
        }
        
        var entries: [PrayerPalEntry] = []
        
        // Create single entry for today with all prayers
        let todayEntry = PrayerPalEntry(
            date: now,
            nextName: "",
            nextTime: "",
            allPrayers: prayers,
            temperature: temperature,
            isDataAvailable: true,
            isPreviewMode: false,
            isExpired: false,
            localizedStrings: localizedStrings
        )
        entries.append(todayEntry)
        
        // Schedule entries at EACH prayer time transition
        for prayer in prayers {
            if let prayerDate = DataManager.parseTimeToDate(prayer.time) {
                if prayerDate > now {
                    let prayerEntry = PrayerPalEntry(
                        date: prayerDate,
                        nextName: "",
                        nextTime: "",
                        allPrayers: prayers,
                        temperature: temperature,
                        isDataAvailable: true,
                        isPreviewMode: false,
                        isExpired: false,
                        localizedStrings: localizedStrings
                    )
                    entries.append(prayerEntry)
                }
            }
        }
        
        // Use last prayer (Isha) to schedule day transition safely across locales
        let ishaTime = prayers.last.flatMap { DataManager.parseTimeToDate($0.time) }
        
        // Schedule day transition at Isha + 30 min
        if let ishaTime = ishaTime {
            let ishaPlus30 = calendar.date(byAdding: .minute, value: 30, to: ishaTime) ?? ishaTime
            
            if ishaPlus30 > now {
                if let prayersByDate = DataManager.loadAllPrayerData() {
                    let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "MM-dd-yyyy"
                    dateFormatter.locale = Locale(identifier: "en_US_POSIX")
                    let tomorrowKey = dateFormatter.string(from: tomorrow)
                    
                    if let tomorrowPrayers = prayersByDate[tomorrowKey] {
                        let dayTransitionEntry = PrayerPalEntry(
                            date: ishaPlus30,
                            nextName: "",
                            nextTime: "",
                            allPrayers: tomorrowPrayers,
                            temperature: temperature,
                            isDataAvailable: true,
                            isPreviewMode: false,
                            isExpired: false,
                            localizedStrings: localizedStrings
                        )
                        entries.append(dayTransitionEntry)
                    }
                }
            }
        }
        
        entries.sort { $0.date < $1.date }
        // Fix 3: Refresh Rate - Compliance with Apple Guidelines
        // Apple limits widgets to 40-70 updates per day (~every 20-30 mins).
        // We schedule a safety refresh every 30 minutes.
        // Primary updates happen via the scheduled timeline entries at exact prayer times.
        let nextSafetyUpdate = calendar.date(byAdding: .minute, value: 30, to: now) ?? now
        let reloadDate = entries.last?.date ?? nextSafetyUpdate
        
        // Use the earlier of (Last Entry Date) or (Safety Update)
        let policyDate = min(reloadDate, nextSafetyUpdate)
        let timeline = Timeline(entries: entries, policy: .after(policyDate))
        completion(timeline)
    }
}

// MARK: - 6. Widget Configuration
// NOTE: @main is in PrayerPalWidgetBundle.swift - do NOT add @main here
struct PrayerPalWidget: Widget {
    let kind: String = "PrayerPalWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                PrayerPalWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        // Brand colors gradient - iOS will use this for tinting in special modes
                        LinearGradient(
                            colors: [
                                Color(red: 0.95, green: 0.85, blue: 0.70),   // Warm beige (top)
                                Color(red: 0.85, green: 0.70, blue: 0.50)    // Warm tan (bottom)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    }
            } else {
                PrayerPalWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName(String(localized: "configName"))
        .description(String(localized: "configDescription"))
        .supportedFamilies(supportedWidgetFamilies)
        .contentMarginsDisabled()
    }
    
    // Computed property to conditionally include Lock Screen widgets (iOS 16+)
    private var supportedWidgetFamilies: [WidgetFamily] {
        var families: [WidgetFamily] = [.systemSmall, .systemMedium]
        
        if #available(iOS 16.0, *) {
            families.append(contentsOf: [.accessoryCircular, .accessoryRectangular, .accessoryInline])
        }
        
        return families
    }
}
