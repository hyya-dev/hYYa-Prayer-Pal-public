import UIKit
import Capacitor
import WebKit
import WidgetKit
import os.log

/// Custom ViewController that adds widget sync capability to Capacitor
class PrayerPalViewController: CAPBridgeViewController {
    
    // Use singleton handler to prevent deallocation and connection invalidation
    private static let sharedHandler = WidgetMessageHandler()
    private static var isHandlerRegistered = false
    
    // Use Logger for better console filtering (reduces noise from system messages)
    private static let logger = Logger(subsystem: "com.hyya.prayerpal.open", category: "PrayerPalViewController")
    private var didBecomeActiveObserver: NSObjectProtocol?

    private func describeJavaScriptError(_ error: Error) -> String {
        let nsError = error as NSError
        let message = nsError.userInfo["WKJavaScriptExceptionMessage"] as? String
        let sourceURL = nsError.userInfo["WKJavaScriptExceptionSourceURL"] as? String
        let line = nsError.userInfo["WKJavaScriptExceptionLineNumber"]
        let column = nsError.userInfo["WKJavaScriptExceptionColumnNumber"]

        var details = "\(nsError.localizedDescription) [\(nsError.domain):\(nsError.code)]"
        if let message {
            details += " JSMessage=\(message)"
        }
        if let sourceURL {
            details += " Source=\(sourceURL)"
        }
        if let line {
            details += " Line=\(line)"
        }
        if let column {
            details += " Column=\(column)"
        }
        return details
    }

    private func ppDebugLog(_ items: Any..., separator: String = " ", terminator: String = "\n") {
#if DEBUG
        Swift.print(items.map { String(describing: $0) }.joined(separator: separator), terminator: terminator)
#endif
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        Self.logger.info("PrayerPalViewController loaded")

        didBecomeActiveObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.syncNativeClockFormatToWebView()
            WatchConnectivityManager.shared.syncLastKnownToWatch()
        }
    }

    deinit {
        if let observer = didBecomeActiveObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Capacitor 8 + SPM: local plugins must be registered explicitly (CAP_PLUGIN .m discovery is unreliable).
        bridge?.registerPluginInstance(QuranReaderNativeAudioPlugin())
        // Register handler when Capacitor is ready (most reliable timing)
        // Only register once to prevent connection invalidation
        registerWidgetMessageHandler()
    }
    
    private func registerWidgetMessageHandler() {
        // Use static flag to prevent multiple registrations across instances
        guard !Self.isHandlerRegistered else {
            // Still try to inject JS in case WebView was reloaded
            injectJavaScriptBridge()
            return
        }
        
        guard let webView = self.webView else {
            Self.logger.debug("WebView not available yet, will retry")
            // Retry after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                self?.registerWidgetMessageHandler()
            }
            return
        }
        
        let userContentController = webView.configuration.userContentController
        
        // Use singleton handler - never deallocated, prevents connection invalidation
        // WKUserContentController handles duplicate registrations gracefully
        userContentController.add(
            Self.sharedHandler,
            name: "widgetSync"
        )
        
        Self.isHandlerRegistered = true
        Self.logger.info("Widget message handler 'widgetSync' registered (singleton)")
        
        // Inject JavaScript bridge
        injectJavaScriptBridge()
    }
    
    private func injectJavaScriptBridge() {
        guard let webView = self.webView else { return }
        
        let userContentController = webView.configuration.userContentController
        
        // JavaScript bridge code
        let js = """
        (function() {
            if (window._widgetSyncReady) return;
            window._widgetSyncReady = true;
            
            window.syncWidgetPrayers = function(data) {
                // Handle both new format (12-month data object) and old format (prayers array)
                const isNewFormat = data && typeof data === 'object' && data.prayers && !Array.isArray(data.prayers);
                const dataLength = isNewFormat ? Object.keys(data.prayers || {}).length : (Array.isArray(data) ? data.length : 0);
                console.log('[PrayerPal-JS] syncWidgetPrayers called with', isNewFormat ? '12-month data' : dataLength, isNewFormat ? 'days' : 'prayers');
                try {
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.widgetSync) {
                        console.warn('[PrayerPal-JS] ⚠️ Message handler not available');
                        return Promise.reject(new Error('Message handler not available'));
                    }
                    window.webkit.messageHandlers.widgetSync.postMessage({
                        action: 'savePrayerTimes',
                        data: isNewFormat ? data : { prayers: data }
                    });
                    console.log('[PrayerPal-JS] ✅ Message posted to native');
                    return Promise.resolve({ success: true });
                } catch (e) {
                    console.error('[PrayerPal-JS] ❌ Error:', e);
                    return Promise.reject(e);
                }
            };
            
            console.log('[PrayerPal-JS] ✅ Widget sync bridge ready');
        })();
        """
        
        // Inject immediately and mark as ready
        webView.evaluateJavaScript(js) { result, error in
            if let error = error {
                Self.logger.error("JS injection error: \(self.describeJavaScriptError(error))")
            } else {
                Self.logger.info("Widget sync JS bridge injected")
                // Mark handler as ready in JS
                webView.evaluateJavaScript("window._widgetHandlerReady = true;") { _, _ in }
            }
        }
        
        // Also add as user script to ensure it's available on page reloads
        let scriptExists = userContentController.userScripts.contains { script in
            script.source.contains("window._widgetSyncReady")
        }
        
        if !scriptExists {
            let userScript = WKUserScript(
                source: js,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
            userContentController.addUserScript(userScript)
            Self.logger.info("Widget sync user script added")
        }

        syncNativeClockFormatToWebView()
    }

    private func is24HourSystemFormat() -> Bool {
        let format = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: Locale.current) ?? ""
        return !format.contains("a")
    }

    private func nativeTemperatureUnit() -> String {
        if #available(iOS 16, *) {
            let unit = UnitTemperature(forLocale: .current)
            return unit == .fahrenheit ? "F" : "C"
        } else {
            // Fallback: check region for known Fahrenheit-only regions
            let region = (Locale.current.regionCode ?? "").uppercased()
            let fahrenheitRegions: Set<String> = ["US", "LR", "MM"]
            return fahrenheitRegions.contains(region) ? "F" : "C"
        }
    }

    private func syncNativeClockFormatToWebView() {
        guard let webView = self.webView else { return }

        let uses24Hour = is24HourSystemFormat()
        let format = uses24Hour ? "24" : "12"
        let temperatureUnit = nativeTemperatureUnit()
        let js = """
        (function() {
            try {
                localStorage.setItem('prayerpal-clock-format', '\(format)');
                window.__nativeClockFormat = '\(format)';
                window.__ppNativeTemperatureUnit = '\(temperatureUnit)';
            } catch (e) {
                console.warn('[PrayerPal-JS] Failed to persist native clock format', e);
            }
        })();
        """

        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                Self.logger.error("Failed to sync native clock format to web: \(self.describeJavaScriptError(error))")
            } else {
                Self.logger.info("Native settings synced to web: clock=\(format), temp=\(temperatureUnit)")
            }
        }
    }
    
    // DO NOT remove handler in deinit - this causes connection invalidation
    // The singleton handler will persist and handle messages even if view controller is deallocated
}

// MARK: - Widget Message Handler
class WidgetMessageHandler: NSObject, WKScriptMessageHandler {
    private let appGroup = "group.com.hyya.prayerpal.open"
    private let dataKey = "savedPrayers"
    private let dataKeyPhaseA = "savedPrayersPhaseA"
    private let dataKeyPhaseB = "savedPrayersPhaseB"
    private let prayersUpdatedAtKey = "savedPrayersUpdatedAt"
    private let weatherTimeKey = "savedWeatherTime"
    private let weatherReloadValueKey = "widgetLastReloadWeather"
    private let weatherReloadTimeKey = "widgetLastReloadTime"
    private let weatherReloadMinInterval: TimeInterval = 15 * 60
    private static let logger = Logger(subsystem: "com.hyya.prayerpal.open", category: "WidgetMessageHandler")

    private func ppDebugLog(_ items: Any..., separator: String = " ", terminator: String = "\n") {
#if DEBUG
        Swift.print(items.map { String(describing: $0) }.joined(separator: separator), terminator: terminator)
#endif
    }
    
    override init() {
        super.init()
        Self.logger.info("WidgetMessageHandler initialized")
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Validate message handler is still valid
        guard message.name == "widgetSync" else {
            Self.logger.warning("Received message for wrong handler: \(message.name)")
            return
        }
        
        // WKScriptMessageHandler already runs on main thread, no need for async dispatch
        Self.logger.debug("Received message from JavaScript")
        ppDebugLog("[iOS] 📨 Received message from JavaScript (handler: '\(message.name)')")
        
        // Safely extract message body
        guard let body = message.body as? [String: Any] else {
            Self.logger.error("Message body is not a dictionary: \(String(describing: type(of: message.body)))")
            ppDebugLog("[iOS] ❌ Message body is not a dictionary: \(String(describing: type(of: message.body)))")
            return
        }
        
        guard let action = body["action"] as? String else {
            Self.logger.error("No 'action' in message")
            ppDebugLog("[iOS] ❌ No 'action' in message. Body keys: \(body.keys)")
            return
        }
        
        Self.logger.debug("Action: \(action)")
        ppDebugLog("[iOS] ✅ Processing action: '\(action)'")
        
        if action == "savePrayerTimes" {
            savePrayerTimes(body, targetKey: dataKey, alsoWriteLegacyKey: false)
        } else if action == "savePrayerTimesPhaseA" {
            savePrayerTimes(body, targetKey: dataKeyPhaseA, alsoWriteLegacyKey: false)
        } else if action == "savePrayerTimesPhaseB" {
            // Phase B is the primary schedule for widgets; keep legacy key in sync.
            savePrayerTimes(body, targetKey: dataKeyPhaseB, alsoWriteLegacyKey: true)
        } else if action == "saveWeather" {
            saveWeather(body)
        } else if action == "saveSettings" {
            saveSettings(body)
        }
    }
    
    private func saveWeather(_ body: [String: Any]) {
        guard let data = body["data"] as? [String: Any],
              let temperature = data["temperature"] as? String else {
            Self.logger.error("Invalid weather data payload")
            return
        }
        
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            Self.logger.error("Could not access App Group: \(self.appGroup)")
            return
        }
        
        // FIXED: Save to both keys for backward compatibility during transition
        sharedDefaults.set(temperature, forKey: "savedWeather")
        sharedDefaults.set(temperature, forKey: "cachedWeather")  // Also save to old key for compatibility
        let now = Date().timeIntervalSince1970
        sharedDefaults.set(now, forKey: weatherTimeKey)
        sharedDefaults.synchronize()
        Self.logger.info("Saved weather to App Group: \(temperature)")
        
        // Also send to Watch via WatchConnectivity
        WatchConnectivityManager.shared.sendWeather(temperature)

        // Always reload the home-screen widget kind so timelines pick up App Group values.
        // (Skipping reload left the widget showing a stale baked-in temperature while the Weather page showed fresh data.)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: "PrayerPalWidget")
            if shouldReloadWidgetForWeather(temperature: temperature, now: now, defaults: sharedDefaults) {
                WidgetCenter.shared.reloadAllTimelines()
                sharedDefaults.set(temperature, forKey: weatherReloadValueKey)
                sharedDefaults.set(now, forKey: weatherReloadTimeKey)
                sharedDefaults.synchronize()
            }
            Self.logger.info("Widget timeline reload requested after weather update")
        }
    }

    private func shouldReloadWidgetForWeather(temperature: String, now: TimeInterval, defaults: UserDefaults) -> Bool {
        guard let lastValue = defaults.string(forKey: weatherReloadValueKey) else {
            return true
        }
        let lastReloadTime = defaults.double(forKey: weatherReloadTimeKey)
        if lastValue != temperature {
            return true
        }

        return (now - lastReloadTime) >= weatherReloadMinInterval
    }
    
    private func saveSettings(_ body: [String: Any]) {
        guard let data = body["data"] as? [String: Any] else {
            Self.logger.error("Invalid settings data payload")
            return
        }
        
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            Self.logger.error("Could not access App Group: \(self.appGroup)")
            return
        }
        
        // Save time format (24-hour)
        if let timeFormat24 = data["timeFormat24"] as? Bool {
            sharedDefaults.set(timeFormat24, forKey: "timeFormat24")
        }
        
        // Save temperature unit
        if let temperatureUnit = data["temperatureUnit"] as? String {
            sharedDefaults.set(temperatureUnit, forKey: "temperatureUnit")
        }
        
        // Save language
        if let language = data["language"] as? String {
            sharedDefaults.set(language, forKey: "language")
        }

        if let strings = data["strings"] as? [String: String] {
            if let stringsData = try? JSONSerialization.data(withJSONObject: strings, options: []) {
                sharedDefaults.set(stringsData, forKey: "localizedStrings")
            }
        }

        if let prayerNames = data["prayerNames"] as? [String: String] {
            if let prayerNamesData = try? JSONSerialization.data(withJSONObject: prayerNames, options: []) {
                sharedDefaults.set(prayerNamesData, forKey: "localizedPrayerNames")
            }
        }
        
        sharedDefaults.synchronize()
        Self.logger.info("Saved settings to App Group")
        
        // Also send to Watch via WatchConnectivity
        WatchConnectivityManager.shared.sendSettings(data)
        
        // FIXED: Reload widget timeline when settings change (especially temperature unit)
        // This ensures widget displays temperature with correct unit
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
            Self.logger.info("Widget timeline reload requested after settings update")
        }
    }
    
    private func savePrayerTimes(_ body: [String: Any], targetKey: String, alsoWriteLegacyKey: Bool) {
        // Check if new format (12-month data) or old format (single day)
        if let data = body["data"] as? [String: Any] {
            // New format: 12-month data structure
            self.saveMultiDayPrayerData(data, targetKey: targetKey, alsoWriteLegacyKey: alsoWriteLegacyKey)
        } else if let prayersArray = body["prayers"] as? [[String: Any]] {
            // Old format: single day prayers (backward compatibility)
            Self.logger.debug("Processing \(prayersArray.count) prayers (old format)")
            
        var prayers: [[String: String]] = []
        for prayer in prayersArray {
            if let name = prayer["name"] as? String,
               let time = prayer["time"] as? String {
                prayers.append(["name": name, "time": time])
            }
        }
        
        if prayers.isEmpty && prayersArray.isEmpty {
            Self.logger.info("Clearing widget data (empty prayers array)")
        } else if prayers.isEmpty {
            Self.logger.error("No valid prayers extracted from non-empty array")
            return
        }
        
        if #available(iOS 14.0, *) {
            self.savePrayerData(prayers: prayers)
            WidgetCenter.shared.getCurrentConfigurations { result in
                switch result {
                case .success(let configurations):
                    if configurations.isEmpty {
                        Self.logger.debug("WidgetCenter reports no widgets installed (may be inaccurate)")
                    } else {
                        Self.logger.debug("WidgetCenter reports \(configurations.count) widget(s) installed")
                    }
                case .failure(let error):
                    Self.logger.debug("Could not check widget status: \(error.localizedDescription)")
                    }
                }
            }
        } else {
            Self.logger.error("Missing or invalid data structure")
            return
        }
    }
    
    private func saveMultiDayPrayerData(_ data: [String: Any], targetKey: String, alsoWriteLegacyKey: Bool) {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            Self.logger.error("Could not access App Group: \(self.appGroup)")
            ppDebugLog("[iOS] ❌ Could not access App Group: \(self.appGroup)")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
            sharedDefaults.set(jsonData, forKey: targetKey)
            if alsoWriteLegacyKey {
                sharedDefaults.set(jsonData, forKey: dataKey)
            }
            // Local write-time marker for staleness checks (not part of the synced payload).
            sharedDefaults.set(Date().timeIntervalSince1970, forKey: prayersUpdatedAtKey)
            sharedDefaults.synchronize()
            
            if let prayers = data["prayers"] as? [String: Any] {
                Self.logger.info("Saved prayer data: \(prayers.count) days to key '\(targetKey)'")
                ppDebugLog("[iOS] ✅ Saved prayer data: \(prayers.count) days to key '\(targetKey)'")
            } else {
                Self.logger.info("Saved prayer data to App Group")
                ppDebugLog("[iOS] ✅ Saved prayer data to App Group (key: '\(targetKey)')")
            }
            
            // Verify the save
            if let savedData = sharedDefaults.data(forKey: targetKey) {
                Self.logger.debug("Verified: \(savedData.count) bytes saved")
                ppDebugLog("[iOS] ✅ Verified: \(savedData.count) bytes saved to App Group (key: '\(targetKey)')")
                
                // Also verify we can read it back
                if let verifyDict = try? JSONSerialization.jsonObject(with: savedData) as? [String: Any],
                   let verifyPrayers = verifyDict["prayers"] as? [String: Any] {
                    ppDebugLog("[iOS] ✅ Verified: Can read back \(verifyPrayers.count) days of prayer data")
                }
            } else {
                Self.logger.error("❌ Verification failed: Could not read back saved data!")
                ppDebugLog("[iOS] ❌ Verification failed: Could not read back saved data!")
            }
            
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
                Self.logger.info("Widget timeline reload requested")
            }
            
            // Also send to Watch via WatchConnectivity
            WatchConnectivityManager.shared.sendPrayerTimes(data)
        } catch {
            Self.logger.error("Encode error: \(error.localizedDescription)")
            ppDebugLog("[iOS] ❌ Encode error: \(error.localizedDescription)")
        }
    }
    
    private func savePrayerData(prayers: [[String: String]]) {
        // Save to App Group
        guard let sharedDefaults = UserDefaults(suiteName: appGroup) else {
            Self.logger.error("Could not access App Group: \(self.appGroup)")
            return
        }
        
        do {
            let jsonData = try JSONEncoder().encode(prayers)
            sharedDefaults.set(jsonData, forKey: dataKey)
            sharedDefaults.synchronize()
            
            if prayers.isEmpty {
                Self.logger.info("Cleared widget data from App Group")
            } else {
                Self.logger.info("Saved \(prayers.count) prayers to App Group")
            }
            
            // Verify the save
            if let savedData = sharedDefaults.data(forKey: dataKey) {
                Self.logger.debug("Verified: \(savedData.count) bytes saved")
            }
            
            // Reload widget timeline (we know widgets are installed at this point)
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
                Self.logger.info("Widget timeline reload requested")
            }
        } catch {
            Self.logger.error("Encode error: \(error.localizedDescription)")
        }
    }
}

