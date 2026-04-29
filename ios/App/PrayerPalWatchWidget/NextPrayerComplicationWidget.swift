import SwiftUI
import WidgetKit

// MARK: - Timeline

struct NextPrayerEntry: TimelineEntry {
    let date: Date
    let nextName: String
    let nextTimeDisplay: String
    let isStale: Bool
    let statusLine: String?
}

struct NextPrayerTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPrayerEntry {
        NextPrayerEntry(
            date: Date(),
            nextName: "Dhuhr",
            nextTimeDisplay: "12:30",
            isStale: false,
            statusLine: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPrayerEntry) -> Void) {
        completion(makeEntry(for: Date(), calendar: .current))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPrayerEntry>) -> Void) {
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        guard let snapshot = WatchPrayerSnapshot.load(),
              snapshot.dateKey == WatchPrayerScheduleMath.todayKey(),
              !snapshot.prayers.isEmpty,
              let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            let entry = NextPrayerEntry(
                date: now,
                nextName: "—",
                nextTimeDisplay: "",
                isStale: true,
                statusLine: String(localized: "openAppToSync")
            )
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(3600))))
            return
        }

        let transitions = WatchPrayerScheduleMath.timelineTransitions(anchorStartOfDay: startOfDay, rows: snapshot.prayers, language: snapshot.language)
        var entries: [NextPrayerEntry] = []

        for t in transitions where t <= endOfDay {
            guard let next = WatchPrayerScheduleMath.nextPrayerWithInstant(after: t, rows: snapshot.prayers, language: snapshot.language, anchorStartOfDay: startOfDay) else {
                continue
            }
            let display = WatchPrayerScheduleMath.formatClock(from: next.instant, timeFormat24: snapshot.timeFormat24, language: snapshot.language)
            entries.append(
                NextPrayerEntry(
                    date: t,
                    nextName: next.row.name,
                    nextTimeDisplay: display,
                    isStale: false,
                    statusLine: nil
                )
            )
        }

        if entries.isEmpty {
            let fallback = makeEntry(for: now, calendar: calendar)
            completion(Timeline(entries: [fallback], policy: .after(endOfDay)))
            return
        }

        // WidgetKit renders the most recent entry whose date is <= now. If we drop past entries,
        // the system can display a future entry (e.g. Isha) during the Maghrib→Isha window,
        // which then makes the widget appear "two prayers ahead" (Isha entry showing Fajr).
        let lastPastOrNow = entries.last(where: { $0.date <= now })
        let future = entries.filter { $0.date > now }
        let stitched = ([lastPastOrNow].compactMap { $0 } + future)
        completion(Timeline(entries: stitched.isEmpty ? [makeEntry(for: now, calendar: calendar)] : stitched, policy: .after(endOfDay)))
    }

    private func makeEntry(for date: Date, calendar: Calendar) -> NextPrayerEntry {
        let anchor = calendar.startOfDay(for: date)
        guard let snapshot = WatchPrayerSnapshot.load(),
              snapshot.dateKey == WatchPrayerScheduleMath.todayKey(),
              !snapshot.prayers.isEmpty,
              let next = WatchPrayerScheduleMath.nextPrayerWithInstant(after: date, rows: snapshot.prayers, language: snapshot.language, anchorStartOfDay: anchor) else {
            return NextPrayerEntry(
                date: date,
                nextName: "—",
                nextTimeDisplay: "",
                isStale: true,
                statusLine: String(localized: "openAppToSync")
            )
        }
        let display = WatchPrayerScheduleMath.formatClock(from: next.instant, timeFormat24: snapshot.timeFormat24, language: snapshot.language)
        return NextPrayerEntry(
            date: date,
            nextName: next.row.name,
            nextTimeDisplay: display,
            isStale: false,
            statusLine: nil
        )
    }
}

// MARK: - Views

struct NextPrayerWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family

    var entry: NextPrayerEntry

    var body: some View {
        familyContent
            .containerBackground(for: .widget) {
                AccessoryWidgetBackground()
            }
    }

    @ViewBuilder
    private var familyContent: some View {
        switch family {
        case .accessoryCircular:
            circular
        case .accessoryRectangular:
            rectangular
        case .accessoryInline:
            inlineText
        case .accessoryCorner:
            corner
        default:
            rectangular
        }
    }

    private var circular: some View {
        VStack(spacing: 2) {
            Text(ComplicationBrand.title)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(PPWatchComplicationTheme.accent)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(entry.nextTimeDisplay.isEmpty ? "—" : entry.nextTimeDisplay)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.65)
                .lineLimit(1)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetAccentable()
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            if entry.isStale {
                Text(ComplicationBrand.title)
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(PPWatchComplicationTheme.accent)
                    .lineLimit(1)
                Text(entry.statusLine ?? "")
                    .font(.caption2.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(.primary)
            } else {
                Text(ComplicationBrand.title)
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(PPWatchComplicationTheme.accent)
                    .lineLimit(1)
                Text(entry.nextTimeDisplay)
                    .font(.caption2.weight(.bold))
                    .lineLimit(1)
                    .foregroundStyle(.primary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetAccentable()
    }

    private var inlineText: some View {
        Group {
            if entry.isStale {
                Text("\(ComplicationBrand.title) — \(entry.statusLine ?? "")")
            } else {
                Text("\(ComplicationBrand.title) \(entry.nextTimeDisplay)")
            }
        }
    }

    /// Corner: time above brand in a fixed `VStack` order on all four slots. Avoids `widgetLabel`, which watchOS
    /// renders in all caps along the curve (so "hYYa" became "HYYA").
    private var corner: some View {
        Group {
            if entry.isStale {
                VStack(spacing: 2) {
                    Text("—")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                    Text(verbatim: String(localized: "Sync"))
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .foregroundStyle(PPWatchComplicationTheme.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                }
            } else {
                VStack(spacing: 2) {
                    Text(entry.nextTimeDisplay.isEmpty ? "—" : entry.nextTimeDisplay)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text(verbatim: ComplicationBrand.title)
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .foregroundStyle(PPWatchComplicationTheme.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                }
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .widgetCurvesContent()
    }
}

struct NextPrayerComplicationWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchPrayerWidgetConstants.widgetKind, provider: NextPrayerTimelineProvider()) { entry in
            NextPrayerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(String(localized: "Next prayer"))
        .description(String(localized: "Next prayer time from your schedule."))
        .supportedFamilies([
            .accessoryCorner,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}
