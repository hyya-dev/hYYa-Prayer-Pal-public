//
//  PrayerPalWidgetControl.swift
//  PrayerPalWidget
//
//  Created by Hassaan Abdeen on 1/7/26.
//
//  NOTE: Control Widgets require iOS 18.0+
//  This file is excluded from compilation on earlier iOS versions.

import SwiftUI
import WidgetKit

#if canImport(AppIntents)
import AppIntents
#endif

// Control Widgets are only available in iOS 18.0+
@available(iOS 18.0, *)
struct PrayerPalWidgetControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: "com.hyya.prayerpal.PrayerPalWidget",
            provider: Provider()
        ) { value in
            ControlWidgetToggle(
                "startTimer",
                isOn: value,
                action: StartTimerIntent()
            ) { isRunning in
                Label(isRunning ? String(localized: "toggleEnabled") : String(localized: "off"), systemImage: "timer")
            }
        }
        .displayName("timer")
        .description("startATimer")
    }
}

@available(iOS 18.0, *)
extension PrayerPalWidgetControl {
    struct Provider: ControlValueProvider {
        var previewValue: Bool {
            false
        }

        func currentValue() async throws -> Bool {
            let isRunning = true
            return isRunning
        }
    }
}

@available(iOS 18.0, *)
struct StartTimerIntent: SetValueIntent {
    static let title: LocalizedStringResource = "startATimer"

    @Parameter(title: "timerRunning")
    var value: Bool

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
