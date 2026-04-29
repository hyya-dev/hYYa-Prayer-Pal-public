import Foundation

/// Snapshot written by `WatchSessionManager` into the App Group for the widget extension.
struct WatchPrayerSnapshot: Codable {
    var dateKey: String
    var prayers: [PrayerRow]
    var language: String?
    var timeFormat24: Bool?
    var openAppToSync: String?

    struct PrayerRow: Codable {
        var name: String
        var time: String
    }

    static func load() -> WatchPrayerSnapshot? {
        guard let defaults = UserDefaults(suiteName: WatchPrayerWidgetConstants.appGroupId),
              let data = defaults.data(forKey: WatchPrayerWidgetConstants.snapshotKey),
              let snap = try? JSONDecoder().decode(WatchPrayerSnapshot.self, from: data) else {
            return nil
        }
        return snap
    }
}

enum WatchPrayerScheduleMath {
    private static func resolveLocale(language: String?) -> Locale {
        guard let language, !language.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return Locale.current
        }

        let code = language.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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

    static func todayKey() -> String {
        let df = DateFormatter()
        df.dateFormat = "MM-dd-yyyy"
        df.locale = Locale(identifier: "en_US_POSIX")
        return df.string(from: Date())
    }

    static func parseTime(_ timeStr: String, on day: Date, language: String?) -> Date? {
        let calendar = Calendar.current
        let preferredLocale = resolveLocale(language: language)

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

        var components = calendar.dateComponents([.year, .month, .day], from: day)
        let parsedComponents = calendar.dateComponents([.hour, .minute], from: parsed)
        components.hour = parsedComponents.hour
        components.minute = parsedComponents.minute
        return calendar.date(from: components)
    }

    static func formatTime(_ timeStr: String, timeFormat24: Bool?, language: String?, on day: Date) -> String {
        guard let date = parseTime(timeStr, on: day, language: language) else { return timeStr }
        return formatClock(from: date, timeFormat24: timeFormat24, language: language)
    }

    static func formatClock(from date: Date, timeFormat24: Bool?, language: String?) -> String {
        let locale = resolveLocale(language: language)
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .none

        if let force24 = timeFormat24 {
            let template = force24 ? "HH:mm" : "h:mm a"
            formatter.dateFormat = DateFormatter.dateFormat(fromTemplate: template, options: 0, locale: locale)
                ?? (force24 ? "HH:mm" : "h:mm a")
        } else {
            formatter.timeStyle = .short
        }

        return formatter.string(from: date)
    }

    /// Wall-clock times for one prayer “day” are stored as `HH:mm` without a date. Isha (and rarely others) can fall
    /// after local midnight while still belonging to the same schedule row set — bump forward so instants are strictly increasing.
    static func resolvedPrayerInstants(rows: [WatchPrayerSnapshot.PrayerRow], language: String?, anchorStartOfDay: Date) -> [Date]? {
        guard !rows.isEmpty else { return nil }
        let calendar = Calendar.current
        var instants: [Date] = []
        instants.reserveCapacity(rows.count)
        for row in rows {
            guard let naive = parseTime(row.time, on: anchorStartOfDay, language: language) else { return nil }
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

    /// Next prayer at or after `moment` (inclusive at the scheduled minute). WidgetKit timeline entries use prayer
    /// instants as `entry.date`; strict `>` would skip that prayer and show the following one until the next transition.
    static func nextPrayer(after moment: Date, rows: [WatchPrayerSnapshot.PrayerRow], language: String?, anchorStartOfDay: Date) -> WatchPrayerSnapshot.PrayerRow? {
        nextPrayerWithInstant(after: moment, rows: rows, language: language, anchorStartOfDay: anchorStartOfDay)?.row
    }

    static func nextPrayerWithInstant(after moment: Date, rows: [WatchPrayerSnapshot.PrayerRow], language: String?, anchorStartOfDay: Date) -> (row: WatchPrayerSnapshot.PrayerRow, instant: Date)? {
        guard let instants = resolvedPrayerInstants(rows: rows, language: language, anchorStartOfDay: anchorStartOfDay),
              instants.count == rows.count else { return nil }
        for (row, instant) in zip(rows, instants) where instant >= moment {
            return (row, instant)
        }
        guard let first = rows.first, var firstInstant = instants.first else { return nil }
        let calendar = Calendar.current
        while firstInstant < moment {
            guard let bumped = calendar.date(byAdding: .day, value: 1, to: firstInstant) else { return nil }
            firstInstant = bumped
        }
        return (first, firstInstant)
    }

    static func timelineTransitions(anchorStartOfDay: Date, rows: [WatchPrayerSnapshot.PrayerRow], language: String?) -> [Date] {
        var dates: [Date] = [anchorStartOfDay]
        if let instants = resolvedPrayerInstants(rows: rows, language: language, anchorStartOfDay: anchorStartOfDay) {
            dates.append(contentsOf: instants)
        }
        return dates.sorted()
    }
}
