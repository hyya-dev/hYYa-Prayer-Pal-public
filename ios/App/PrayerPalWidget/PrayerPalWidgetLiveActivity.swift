//
//  PrayerPalWidgetLiveActivity.swift
//  PrayerPalWidget
//
//  Created by Hassaan Abdeen on 1/7/26.
//

import WidgetKit
import SwiftUI

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
struct PrayerPalWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic state that changes over time
        var endTime: Date
        var nextPrayerName: String
        var remainingSeconds: Int
    }
    
    // Static data that doesn't change
    var prayerName: String
}

@available(iOS 16.2, *)
struct PrayerPalWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrayerPalWidgetAttributes.self) { context in
            // Lock Screen/Banner UI
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "moon.stars.fill")
                        .foregroundColor(.cyan)
                    Text(String(format: String(localized: "nextPrayer"), context.state.nextPrayerName))
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    Text(context.state.endTime, style: .timer)
                        .font(.monospacedDigit(.title2)())
                        .foregroundColor(.cyan)
                }
                
                // Progress Bar
                ProgressView(timerInterval: Date()...context.state.endTime, countsDown: true) { 
                    Text("timeRemaining")
                }
                .tint(.cyan)
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.1, green: 0.1, blue: 0.18)) // #1a1a2e matching app theme
            .activitySystemActionForegroundColor(Color.cyan)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.nextPrayerName, systemImage: "moon.stars.fill")
                        .foregroundColor(.cyan)
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.endTime, style: .timer)
                        .foregroundColor(.cyan)
                        .font(.monospacedDigit(.callout)())
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Progress bar in expanded view
                     ProgressView(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .tint(.cyan)
                        .padding(.horizontal)
                }
            } compactLeading: {
                Image(systemName: "moon.stars.fill")
                    .foregroundColor(.cyan)
            } compactTrailing: {
                Text(context.state.endTime, style: .timer)
                    .foregroundColor(.cyan)
                    .font(.monospacedDigit(.caption)())
                    .frame(width: 50)
            } minimal: {
                Image(systemName: "moon.stars.fill")
                    .foregroundColor(.cyan)
            }
            .widgetURL(URL(string: "prayerpal://home"))
            .keylineTint(Color.cyan)
        }
    }
}

// Preview using standard SwiftUI preview
@available(iOS 16.2, *)
struct PrayerPalWidgetLiveActivity_Previews: PreviewProvider {
    static let attributes = PrayerPalWidgetAttributes(prayerName: "Asr")
    static let contentState = PrayerPalWidgetAttributes.ContentState(endTime: Date().addingTimeInterval(60 * 60), nextPrayerName: "Asr", remainingSeconds: 3600)

    static var previews: some View {
        attributes
            .previewContext(contentState, viewKind: .dynamicIsland(.compact))
            .previewDisplayName("Island Compact")
        
        attributes
            .previewContext(contentState, viewKind: .dynamicIsland(.expanded))
            .previewDisplayName("Island Expanded")
        
        attributes
            .previewContext(contentState, viewKind: .content)
            .previewDisplayName("Lock Screen")
    }
}

#endif
