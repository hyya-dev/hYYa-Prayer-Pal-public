import SwiftUI

@main
struct PrayerPalWatchApp: App {
    // Initialize WatchConnectivity early
    init() {
        _ = WatchSessionManager.shared
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
