import Foundation
import Capacitor
import ActivityKit

// Duplicate of the Attributes struct to ensure visibility in App Target
// In a real Xcode setup, this should be in a shared file added to both targets.
struct PrayerPalWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endTime: Date
        var nextPrayerName: String
        var remainingSeconds: Int
    }
    var prayerName: String
}

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {
    
    @objc func startActivity(_ call: CAPPluginCall) {
        // Guard against older iOS versions
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }
        
        guard let prayerName = call.getString("prayerName"),
              let nextPrayerName = call.getString("nextPrayerName"),
              let endTimeTimestamp = call.getDouble("endTime") else {
            call.reject("Missing required parameters: prayerName, nextPrayerName, endTime")
            return
        }
        
        // End existing activities first to avoid clutter
        stopAllActivities()
        
        let endTime = Date(timeIntervalSince1970: endTimeTimestamp / 1000) // Expecting ms
        let remaining = Int(endTime.timeIntervalSince(Date()))
        
        let attributes = PrayerPalWidgetAttributes(prayerName: prayerName)
        let contentState = PrayerPalWidgetAttributes.ContentState(
            endTime: endTime,
            nextPrayerName: nextPrayerName,
            remainingSeconds: remaining
        )
        
        do {
            let activity = try Activity<PrayerPalWidgetAttributes>.request(
                attributes: attributes,
                contentState: contentState,
                pushType: nil
            )
            ppDebugLog("[PrayerPal-Native] Live Activity started: \(activity.id)")
            call.resolve(["id": activity.id])
        } catch {
            ppDebugLog("[PrayerPal-Native] Error starting Live Activity: \(error.localizedDescription)")
            call.reject("Failed to start activity: \(error.localizedDescription)")
        }
    }
    
    @objc func stopActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        
        Task {
            for activity in Activity<PrayerPalWidgetAttributes>.activities {
                await activity.end(dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
    
    @objc func updateActivity(_ call: CAPPluginCall) {
         guard #available(iOS 16.1, *) else {
             call.resolve()
             return
         }
        
        guard let endTimeTimestamp = call.getDouble("endTime"),
              let nextPrayerName = call.getString("nextPrayerName") else {
             // If data missing, just ignore
             call.resolve()
             return
         }
        
        let endTime = Date(timeIntervalSince1970: endTimeTimestamp / 1000)
        let remaining = Int(endTime.timeIntervalSince(Date()))
        
        let updatedState = PrayerPalWidgetAttributes.ContentState(
             endTime: endTime,
             nextPrayerName: nextPrayerName,
             remainingSeconds: remaining
         )
        
        Task {
            for activity in Activity<PrayerPalWidgetAttributes>.activities {
                await activity.update(using: updatedState)
            }
            call.resolve()
        }
    }
    
    private func stopAllActivities() {
        guard #available(iOS 16.1, *) else { return }
        Task {
            for activity in Activity<PrayerPalWidgetAttributes>.activities {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }
}
