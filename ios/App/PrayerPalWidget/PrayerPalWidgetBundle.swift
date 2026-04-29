//
//  PrayerPalWidgetBundle.swift
//  PrayerPalWidget
//
//  Created by Hassaan Abdeen on 1/7/26.
//

import WidgetKit
import SwiftUI

@main
struct PrayerPalWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrayerPalWidget()
        // PrayerPalWidgetControl requires iOS 18+
        if #available(iOS 16.2, *) {
            PrayerPalWidgetLiveActivity()
        }
    }
}
