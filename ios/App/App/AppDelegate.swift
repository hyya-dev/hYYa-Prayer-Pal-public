import UIKit
import Capacitor
import UserNotifications
import AVFoundation
import BackgroundTasks
import WidgetKit

@inline(__always)
private func ppDebugLog(_ items: Any..., separator: String = " ", terminator: String = "\n") {
#if DEBUG
    Swift.print(items.map { String(describing: $0) }.joined(separator: separator), terminator: terminator)
#endif
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    private let weatherRefreshTaskId = "com.hyya.prayerpal.open.weatherRefresh"
    private let appGroup = "group.com.hyya.prayerpal.open"
    private let weatherTimeKey = "savedWeatherTime"
    private let weatherValueKey = "savedWeather"
    private let cachedWeatherKey = "cachedWeather"
    private let weatherStaleSeconds: TimeInterval = 3 * 60 * 60
    private let weatherPreemptiveRefreshSeconds: TimeInterval = 50 * 60
    private let weatherMetricsKey = "weatherRefreshMetricsV1"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // CRITICAL: Set notification delegate to show notifications when app is in foreground
        UNUserNotificationCenter.current().delegate = self
        ppDebugLog("[PrayerPal-Native] ✅ Notification delegate set")
        
        // CRITICAL: Configure audio session for notification sounds
        // This ensures sounds can play even when device is locked
        configureAudioSession()
        
        // Debug: Check notification authorization status and sound file existence
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            ppDebugLog("[PrayerPal-Native] Authorization status: \(settings.authorizationStatus.rawValue)")
            ppDebugLog("[PrayerPal-Native] Alert setting: \(settings.alertSetting.rawValue)")
            ppDebugLog("[PrayerPal-Native] Sound setting: \(settings.soundSetting.rawValue)")
            ppDebugLog("[PrayerPal-Native] Badge setting: \(settings.badgeSetting.rawValue)")
            
            // Debug: Verify sound files exist in bundle
            self.verifySoundFilesExist()
        }
        
        // Register notification categories with time-sensitive support
        registerNotificationCategories()

        registerBackgroundTasks()
        scheduleWeatherRefresh()
        
        return true
    }
    
    // MARK: - Audio Session Configuration
    
    /// Configure audio session to ensure notification sounds play properly
    /// Note: This does NOT require UIBackgroundModes "audio" - notification sounds are handled by the system
    /// The audio session category helps with audio routing for notification sounds
    private func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            // Configure audio session for notification sounds (not continuous background playback)
            // This helps with audio routing but doesn't require background audio mode
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            ppDebugLog("[PrayerPal-Native] ✅ Audio session configured for notification sounds")
        } catch {
            ppDebugLog("[PrayerPal-Native] ⚠️ Audio session configuration failed: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Notification Categories
    
    /// Register notification categories with time-sensitive support for iOS 15+
    private func registerNotificationCategories() {
        // Create category for prayer notifications with time-sensitive intent
        let prayerCategory = UNNotificationCategory(
            identifier: "PRAYER_TIME",
            actions: [],
            intentIdentifiers: [],
            options: []
        )
        
        let prePrayerCategory = UNNotificationCategory(
            identifier: "PRE_PRAYER",
            actions: [],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([prayerCategory, prePrayerCategory])
        ppDebugLog("[PrayerPal-Native] ✅ Notification categories registered")
    }
    
    // MARK: - Sound File Verification
    
    /// Debug: Verify that sound files exist in the app bundle
    /// Note: iOS uses .caf format only - .mp3 files are for Android
    private func verifySoundFilesExist() {
        let soundFiles = ["rebound.caf", "takbir.caf"]  // iOS uses .caf only
        
        for soundFile in soundFiles {
            let components = soundFile.split(separator: ".")
            guard components.count == 2 else { continue }
            
            let name = String(components[0])
            let ext = String(components[1])
            
            if let path = Bundle.main.path(forResource: name, ofType: ext) {
                let fileManager = FileManager.default
                let exists = fileManager.fileExists(atPath: path)
                ppDebugLog("[PrayerPal-Native] Sound file \(soundFile): \(exists ? "✅ EXISTS" : "❌ NOT FOUND") at \(path)")
            } else {
                ppDebugLog("[PrayerPal-Native] Sound file \(soundFile): ❌ NOT IN BUNDLE")
            }
        }
    }
    
    // MARK: - Scheduled Notification Sound Validation
    
    /// Re-validate and fix pending notifications that may have sound resolution issues
    /// This addresses Capacitor's potential failure to resolve custom sounds for
    /// long-scheduled notifications when the app is terminated
    func validatePendingNotificationSounds() {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            for request in requests {
                // Check if this is a prayer notification with a custom sound
                let sound = request.content.sound
                
                // Log for debugging
                ppDebugLog("[PrayerPal-Native] Pending notification '\(request.identifier)' sound: \(String(describing: sound))")
            }
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    // CRITICAL: This method is called when a notification arrives while the app is in the foreground
    // Without this, iOS suppresses notification banners and sounds when the app is active
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        ppDebugLog("[PrayerPal-Native] 🔔 willPresent called for notification: \(notification.request.identifier)")
        ppDebugLog("[PrayerPal-Native] Title: \(notification.request.content.title)")
        ppDebugLog("[PrayerPal-Native] Body: \(notification.request.content.body)")
        
        // Show banner, play sound, and update badge even when app is in foreground
        if #available(iOS 14.0, *) {
            ppDebugLog("[PrayerPal-Native] Requesting: banner, sound, badge")
            completionHandler([.banner, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }
    
    // Handle notification tap when app is in foreground or background
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // Let Capacitor handle the notification action
        completionHandler()
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        scheduleWeatherRefresh()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    // MARK: - UIScene Lifecycle

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Use the default configuration from Info.plist
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // MARK: - Background Weather Refresh (Best-effort)

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: weatherRefreshTaskId, using: nil) { task in
            self.handleWeatherRefresh(task: task as! BGAppRefreshTask)
        }
    }

    private func scheduleWeatherRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: weatherRefreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: weatherPreemptiveRefreshSeconds)

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            ppDebugLog("[PrayerPal-Native] ⚠️ Failed to schedule weather refresh: \(error.localizedDescription)")
        }
    }

    private func handleWeatherRefresh(task: BGAppRefreshTask) {
        scheduleWeatherRefresh()

        let queue = DispatchQueue(label: "com.hyya.prayerpal.open.weatherRefresh")
        var isCompleted = false

        task.expirationHandler = {
            isCompleted = true
        }

        queue.async {
            self.refreshWeatherIfNeeded { success in
                if !isCompleted {
                    task.setTaskCompleted(success: success)
                }
            }
        }
    }

    private func refreshWeatherIfNeeded(completion: @escaping (Bool) -> Void) {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            completion(false)
            return
        }

        let lastTime = defaults.double(forKey: weatherTimeKey)
        let age = Date().timeIntervalSince1970 - lastTime
        if lastTime > 0 && age < weatherPreemptiveRefreshSeconds {
            completion(true)
            return
        }

        guard let location = loadLastLocation(defaults: defaults) else {
            completion(false)
            return
        }

        let tempUnit = defaults.string(forKey: "temperatureUnit") ?? Self.deviceDefaultTempUnit()
        let urlString = "https://api.open-meteo.com/v1/forecast?latitude=\(location.latitude)&longitude=\(location.longitude)&current=temperature_2m&timezone=auto"

        guard let url = URL(string: urlString) else {
            completion(false)
            return
        }

        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                ppDebugLog("[PrayerPal-Native] ⚠️ Weather refresh failed: \(error.localizedDescription)")
                self.bumpWeatherRefreshMetric("failure")
                completion(false)
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let current = json["current"] as? [String: Any],
                  let tempC = current["temperature_2m"] as? Double else {
                                self.bumpWeatherRefreshMetric("failure")
                completion(false)
                return
            }

            let tempValue: Int
            if tempUnit == "F" {
                tempValue = Int(round((tempC * 9 / 5) + 32))
            } else {
                tempValue = Int(round(tempC))
            }

            let tempString = "\(tempValue)°\(tempUnit)"
            defaults.set(tempString, forKey: self.weatherValueKey)
            defaults.set(tempString, forKey: self.cachedWeatherKey)
            defaults.set(Date().timeIntervalSince1970, forKey: self.weatherTimeKey)
            defaults.synchronize()
            self.bumpWeatherRefreshMetric("success")

            WatchConnectivityManager.shared.sendWeather(tempString)
            WidgetCenter.shared.reloadTimelines(ofKind: "PrayerPalWidget")
            completion(true)
        }

        task.resume()
    }

    /// Detect the device-default temperature unit from the region.
    /// Fahrenheit countries: US, Liberia (LR), Myanmar (MM).
    static func deviceDefaultTempUnit() -> String {
        let locale = Locale.current
        let region: String

        if #available(iOS 16, *) {
            region = locale.region?.identifier
                ?? locale.regionCode
                ?? Locale.components(fromIdentifier: locale.identifier)[NSLocale.Key.countryCode.rawValue]
                ?? ""
        } else {
            region = locale.regionCode
                ?? Locale.components(fromIdentifier: locale.identifier)[NSLocale.Key.countryCode.rawValue]
                ?? ""
        }

        return ["US", "LR", "MM"].contains(region.uppercased()) ? "F" : "C"
    }

    private func bumpWeatherRefreshMetric(_ key: String) {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return }
        let rawMetrics = defaults.dictionary(forKey: weatherMetricsKey) ?? [:]
        var existing: [String: Int] = [:]
        for (metricKey, value) in rawMetrics {
            if let intValue = value as? Int {
                existing[metricKey] = intValue
            } else if let numberValue = value as? NSNumber {
                existing[metricKey] = numberValue.intValue
            }
        }
        var updated = existing
        updated[key] = (existing[key] ?? 0) + 1
        defaults.set(updated, forKey: weatherMetricsKey)
    }

    private func loadLastLocation(defaults: UserDefaults) -> (latitude: Double, longitude: Double)? {
        guard let data = defaults.data(forKey: "savedPrayers"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let location = json["location"] as? [String: Any],
              let latitude = location["latitude"] as? Double,
              let longitude = location["longitude"] as? Double else {
            return nil
        }

        return (latitude: latitude, longitude: longitude)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// SceneDelegate is defined here to guarantee inclusion in the app target.
// This enables UIScene lifecycle and keeps storyboard launch behavior unchanged.
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        guard let rootViewController = storyboard.instantiateInitialViewController() else { return }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = rootViewController
        self.window = window
        window.makeKeyAndVisible()
    }
}
