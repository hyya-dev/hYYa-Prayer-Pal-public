import SwiftUI

/// Layout configuration for Apple Watch screens
/// Base design: SE 40mm (324x394) - scales up to larger watches
struct LayoutConfig {
    // Screen dimensions for scaling
    static let baseWidth: CGFloat = 324
    static let baseHeight: CGFloat = 394
    
    // Get scale factor based on current screen size
    static var scaleFactor: CGFloat {
        let screenWidth = WKInterfaceDevice.current().screenBounds.width
        return screenWidth / baseWidth
    }
    
    // Prayer Screen - Temperature
    struct Temperature {
        static var top: CGFloat { 132 * scaleFactor }
        static var right: CGFloat { 190 * scaleFactor }
        static var width: CGFloat { 110 * scaleFactor }
        static var height: CGFloat { 34 * scaleFactor }
        static var fontSize: CGFloat { 24 * scaleFactor }
    }
    
    // Prayer Screen - Prayer Times
    struct PrayerTimes {
        static var top: CGFloat { 178 * scaleFactor }
        static var gap: CGFloat { 2 * scaleFactor }
        static var fontSize: CGFloat { 24 * scaleFactor } // Increased from 16 to 24 (1.5x)
    }
    
    // Counter Screen - Counter Number
    struct Counter {
        static var top: CGFloat { 137 * scaleFactor }
        static var fontSize: CGFloat { 63 * scaleFactor }
    }
    
    // Counter Screen - Buttons
    struct Buttons {
        static var top: CGFloat { 257 * scaleFactor }
        static var size: CGFloat { 74 * scaleFactor }
        static var resetSize: CGFloat { 50 * scaleFactor }
        static var gap: CGFloat { 30 * scaleFactor }
    }
}
