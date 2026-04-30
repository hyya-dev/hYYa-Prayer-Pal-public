package com.hyya.prayerpal.open

import android.appwidget.AppWidgetManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import android.provider.Settings
import java.util.Locale
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * Capacitor Plugin to sync prayer data to Android widgets
 * Writes data to SharedPreferences that widgets can read
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {
    
    companion object {
        private const val TAG = "WidgetBridge"
        const val NATIVE_SETTINGS_PREFS = "PrayerPalNativeSettings"
        const val KEY_APP_LANGUAGE = "app_language"
        private const val KEY_WIDGET_PRAYERS_UPDATED_AT = "widget_prayers_updated_at"
    }

    private fun normalizeLanguageTag(rawLanguage: String): String {
        return when (rawLanguage.trim().lowercase()) {
            "zh" -> "zh-CN"
            "prs" -> "fa-AF"
            "tl" -> "fil"
            else -> rawLanguage.trim().replace('_', '-')
        }
    }

    private fun applyAppLanguage(ctx: Context, language: String) {
        val normalized = normalizeLanguageTag(language)
        if (normalized.isBlank()) return

        val prefs = ctx.getSharedPreferences(NATIVE_SETTINGS_PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_APP_LANGUAGE, normalized).apply()

        val locales = LocaleListCompat.forLanguageTags(normalized)
        AppCompatDelegate.setApplicationLocales(locales)
        if (BuildConfig.DEBUG) Log.d(TAG, "Applied app language locale: $normalized")
    }
    
    /**
     * Save weather temperature to SharedPreferences
     * Called from JavaScript: WidgetBridge.saveWeather({ temperature: "32°C" })
     */
    @PluginMethod
    fun saveWeather(call: PluginCall) {
        val temperature = call.getString("temperature")
        
        
        if (temperature == null) {
            Log.e(TAG, "saveWeather: No temperature provided")
            call.resolve(mapOf("success" to false).toJSObject())
            return
        }
        
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "saveWeather: Context is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }
            
            // Write to SharedPreferences (same file that widgets read from)
            val prefs = ctx.getSharedPreferences(
                PrayerWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            
            prefs.edit()
                .putString(PrayerWidgetProvider.WEATHER_KEY, temperature)
                .putLong(PrayerWidgetProvider.WEATHER_TIME_KEY, System.currentTimeMillis())
                .apply()
            
            
            if (BuildConfig.DEBUG) Log.d(TAG, "saveWeather: Temperature saved: $temperature")
            
            // Trigger widget updates
            updateAllWidgets(ctx)

            // Sync to Wear OS watch (best effort)
            WatchDataSyncManager.syncWeather(ctx, temperature)
            
            call.resolve(mapOf("success" to true).toJSObject())
            
        } catch (e: Exception) {
            Log.e(TAG, "saveWeather: Error - ${e.message}")
            call.resolve(mapOf("success" to false).toJSObject())
        }
    }
    
    /**
     * Sync prayer data to SharedPreferences and trigger widget update
     * Called from JavaScript: WidgetBridge.syncPrayerData({ data: jsonString })
     */
    @PluginMethod
    fun syncPrayerData(call: PluginCall) {
        val data = call.getString("data")
        
        if (data == null) {
            Log.e(TAG, "syncPrayerData: No data provided")
            call.resolve(mapOf("success" to false).toJSObject())
            return
        }
        
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "syncPrayerData: Context is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }
            
            // Write to SharedPreferences (same file that widgets read from)
            val prefs = ctx.getSharedPreferences(
                PrayerWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            
            // Prefer writing to Phase B/A keys, but keep legacy key in sync for backward compat.
            val phase = try {
                org.json.JSONObject(data).optString("phase", "").trim().uppercase(Locale.ROOT)
            } catch (_: Exception) {
                ""
            }

            val editor = prefs.edit()
            when (phase) {
                "A" -> editor.putString(PrayerWidgetProvider.PRAYERS_KEY_PHASE_A, data)
                "B" -> editor.putString(PrayerWidgetProvider.PRAYERS_KEY_PHASE_B, data)
            }

            if (phase == "B" || phase.isBlank()) {
                editor.putString(PrayerWidgetProvider.PRAYERS_KEY, data)
            }

            // Local write-time marker for widget staleness checks (not part of the synced payload).
            editor.putLong(KEY_WIDGET_PRAYERS_UPDATED_AT, System.currentTimeMillis())

            editor.apply()
            
            if (BuildConfig.DEBUG) Log.d(TAG, "syncPrayerData: Data saved to SharedPreferences (${data.length} bytes)")
            
            // Trigger widget updates
            updateAllWidgets(ctx)

            // Sync to Wear OS watch (best effort). Prefer Phase B when available.
            if (phase == "B" || phase.isBlank()) {
                WatchDataSyncManager.syncPrayerData(ctx, data)
            }
            
            call.resolve(mapOf("success" to true).toJSObject())
            
        } catch (e: Exception) {
            Log.e(TAG, "syncPrayerData: Error - ${e.message}")
            call.resolve(mapOf("success" to false).toJSObject())
        }
    }
    
    /**
     * Schedule native alarms using AlarmManager.setAlarmClock()
     * Called from JavaScript: WidgetBridge.scheduleNativeAlarms({ alarms: jsonString })
     */
    @PluginMethod
    fun scheduleNativeAlarms(call: PluginCall) {
        val alarmsJson = call.getString("alarms")
        
        if (alarmsJson == null) {
            Log.e(TAG, "scheduleNativeAlarms: No alarms data provided")
            call.resolve(mapOf("success" to false, "scheduledCount" to 0).toJSObject())
            return
        }
        
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "scheduleNativeAlarms: Context is null")
                call.resolve(mapOf("success" to false, "scheduledCount" to 0).toJSObject())
                return
            }
            
            val alarms = mutableListOf<PrayerAlarmScheduler.PrayerAlarm>()
            val jsonArray = org.json.JSONArray(alarmsJson)
            
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                alarms.add(PrayerAlarmScheduler.PrayerAlarm(
                    id = obj.getInt("id"),
                    prayerName = obj.getString("prayerName"),
                    displayName = obj.getString("displayName"),
                    timeMillis = obj.getLong("timeMillis"),
                    isBefore = obj.getBoolean("isBefore"),
                    minutesBefore = obj.optInt("minutesBefore", 0),
                    soundType = obj.optString("soundType", "discreet"),
                    notificationTitle = obj.optString("notificationTitle", null),
                    notificationBody = obj.optString("notificationBody", null)
                ))
            }
            
            val scheduledCount = PrayerAlarmScheduler.scheduleAlarms(ctx, alarms)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "scheduleNativeAlarms: Scheduled $scheduledCount alarms")
            call.resolve(mapOf("success" to true, "scheduledCount" to scheduledCount).toJSObject())
            
        } catch (e: Exception) {
            Log.e(TAG, "scheduleNativeAlarms: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false, "scheduledCount" to 0).toJSObject())
        }
    }
    
    /**
     * Cancel all native alarms
     * Called from JavaScript: WidgetBridge.cancelNativeAlarms()
     */
    @PluginMethod
    fun cancelNativeAlarms(call: PluginCall) {
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "cancelNativeAlarms: Context is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }
            
            PrayerAlarmScheduler.cancelAllAlarms(ctx)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "cancelNativeAlarms: All alarms cancelled")
            call.resolve(mapOf("success" to true).toJSObject())
            
        } catch (e: Exception) {
            Log.e(TAG, "cancelNativeAlarms: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false).toJSObject())
        }
    }
    
    /**
     * Share app using native Android Share Intent
     * Called from JavaScript: WidgetBridge.shareApp({ title: string, text: string, url: string })
     */
    @PluginMethod
    fun shareApp(call: PluginCall) {
        val safeContext = getContext() ?: activity?.applicationContext
        if (safeContext == null) {
            Log.e(TAG, "shareApp: No context available")
            call.reject("No context available")
            return
        }
        val title = call.getString("title") ?: safeContext.getString(R.string.app_name)
        val text = call.getString("text") ?: ""
        val url = call.getString("url") ?: ""
        
        try {
            val activity = getActivity() ?: run {
                Log.e(TAG, "shareApp: Activity is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }
            
            // Create share intent with text and URL
            val shareText = if (text.isNotEmpty() && url.isNotEmpty()) {
                "$text $url"
            } else if (url.isNotEmpty()) {
                url
            } else {
                text
            }
            
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, shareText)
            }

            // Do not gate on queryIntentActivities: on Android 11+ it often returns empty
            // without a matching <queries> declaration, even when the share sheet works.
            val chooserIntent = Intent.createChooser(shareIntent, title)
            try {
                activity.startActivity(chooserIntent)
                if (BuildConfig.DEBUG) Log.d(TAG, "shareApp: Share intent launched")
                call.resolve(mapOf("success" to true).toJSObject())
            } catch (e: ActivityNotFoundException) {
                Log.e(TAG, "shareApp: No activity to handle share intent", e)
                call.resolve(mapOf("success" to false, "error" to "No share apps available").toJSObject())
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "shareApp: Error - ${e.message}", e)
            val errorMessage = e.message ?: "Unknown error"
            call.resolve(mapOf("success" to false, "error" to errorMessage).toJSObject())
        }
    }

    /**
     * Get current system 12/24-hour clock preference from Android settings.
     * Called from JavaScript: WidgetBridge.getSystemClockFormat()
     */
    @PluginMethod
    fun getSystemClockFormat(call: PluginCall) {
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "getSystemClockFormat: Context is null")
                call.resolve(mapOf("success" to false, "timeFormat24" to true).toJSObject())
                return
            }

            val is24Hour = android.text.format.DateFormat.is24HourFormat(ctx)
            call.resolve(mapOf("success" to true, "timeFormat24" to is24Hour).toJSObject())
        } catch (e: Exception) {
            Log.e(TAG, "getSystemClockFormat: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false, "timeFormat24" to true).toJSObject())
        }
    }

    /**
     * Get current system temperature unit preference.
     * Called from JavaScript: WidgetBridge.getSystemTemperatureUnit()
     */
    @PluginMethod
    fun getSystemTemperatureUnit(call: PluginCall) {
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "getSystemTemperatureUnit: Context is null")
                call.resolve(mapOf("success" to false, "temperatureUnit" to "C").toJSObject())
                return
            }

            val resolver = ctx.contentResolver
            val candidateKeys = listOf(
                "temperature_unit",
                "temperature_units",
                "weather_temperature_unit",
                "weather_temp_unit",
                "temperature_scale",
                "temp_scale",
                "temp_unit",
                "weather_unit",
                "weather_temperature_scale"
            )

            var resolved: String? = null

            for (key in candidateKeys) {
                val raw = Settings.System.getString(resolver, key)
                    ?: Settings.Global.getString(resolver, key)
                    ?: Settings.Secure.getString(resolver, key)
                if (!raw.isNullOrBlank()) {
                    val normalized = raw.trim().lowercase(Locale.ROOT)
                        .replace("_", "")
                        .replace("-", "")
                        .replace(" ", "")

                    resolved = when {
                        normalized == "f" ||
                            normalized == "fahrenheit" ||
                            normalized == "imperial" ||
                            normalized == "ussystem" ||
                            normalized == "us" ||
                            normalized == "1" -> "F"
                        normalized == "c" ||
                            normalized == "celsius" ||
                            normalized == "centigrade" ||
                            normalized == "metric" ||
                            normalized == "uksystem" ||
                            normalized == "si" ||
                            normalized == "0" -> "C"
                        normalized.contains("fahrenheit") || normalized.contains("imperial") -> "F"
                        normalized.contains("celsius") || normalized.contains("metric") -> "C"
                        else -> null
                    }
                    if (resolved != null) break
                }
            }

            if (resolved == null) {
                val locale = Locale.getDefault()
                val measurementSystem = locale.getUnicodeLocaleType("ms")
                    ?.lowercase(Locale.ROOT)
                resolved = when (measurementSystem) {
                    "ussystem" -> "F"
                    "metric", "uksystem" -> "C"
                    else -> {
                        val fahrenheitCountries = setOf("US", "BS", "BZ", "KY", "PW", "LR", "MM", "FM", "MH")
                        val countryCode = locale.country?.uppercase(Locale.ROOT)
                        if (countryCode != null && fahrenheitCountries.contains(countryCode)) "F" else "C"
                    }
                }
            }

            call.resolve(mapOf("success" to true, "temperatureUnit" to resolved).toJSObject())
        } catch (e: Exception) {
            Log.e(TAG, "getSystemTemperatureUnit: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false, "temperatureUnit" to "C").toJSObject())
        }
    }
    
    /**
     * Save notification settings to SharedPreferences for alarm rescheduling after boot
     * Called from JavaScript: WidgetBridge.saveNotificationSettings({ settings: jsonString })
     */
    @PluginMethod
    fun saveNotificationSettings(call: PluginCall) {
        val settingsJson = call.getString("settings")
        
        if (settingsJson == null) {
            Log.e(TAG, "saveNotificationSettings: No settings provided")
            call.resolve(mapOf("success" to false).toJSObject())
            return
        }
        
        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "saveNotificationSettings: Context is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }
            
            val settings = org.json.JSONObject(settingsJson)
            val prefs = ctx.getSharedPreferences("PrayerPalNotificationPrefs", Context.MODE_PRIVATE)
            val existingPrePrayerMinutes = prefs.getInt("pre_prayer_minutes", 30)
            val prePrayerMinutes = if (settings.has("prePrayerMinutes")) {
                settings.optInt("prePrayerMinutes", existingPrePrayerMinutes)
            } else {
                existingPrePrayerMinutes
            }
            
            prefs.edit()
                .putBoolean("master_enabled", settings.getBoolean("masterEnabled"))
                .putString("sound_type", settings.optString("soundType", "discreet"))
                .putInt("pre_prayer_minutes", prePrayerMinutes)
                .apply()
            
            if (BuildConfig.DEBUG) Log.d(TAG, "saveNotificationSettings: Settings saved")
            call.resolve(mapOf("success" to true).toJSObject())
            
        } catch (e: Exception) {
            Log.e(TAG, "saveNotificationSettings: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false).toJSObject())
        }
    }

    /**
     * Sync display/settings payload to Wear OS app
     * Called from JavaScript: WidgetBridge.syncWatchSettings({ settings: jsonString })
     */
    @PluginMethod
    fun syncWatchSettings(call: PluginCall) {
        val settingsJson = call.getString("settings")

        if (settingsJson == null) {
            Log.e(TAG, "syncWatchSettings: No settings provided")
            call.resolve(mapOf("success" to false).toJSObject())
            return
        }

        try {
            val ctx = getContext() ?: activity?.applicationContext ?: run {
                Log.e(TAG, "syncWatchSettings: Context is null")
                call.resolve(mapOf("success" to false).toJSObject())
                return
            }

            try {
                val settingsObj = org.json.JSONObject(settingsJson)
                val language = settingsObj.optString("language", "").trim()
                if (language.isNotEmpty()) {
                    // Only save language to SharedPrefs for widgets/notifications.
                    // Do NOT call AppCompatDelegate.setApplicationLocales() here
                    // because it recreates the Activity, which destroys the WebView
                    // before localStorage can flush — causing language to revert.
                    // The locale is applied on next onCreate via applySavedAppLanguage().
                    val normalized = normalizeLanguageTag(language)
                    if (normalized.isNotBlank()) {
                        val prefs = ctx.getSharedPreferences(NATIVE_SETTINGS_PREFS, Context.MODE_PRIVATE)
                        prefs.edit().putString(KEY_APP_LANGUAGE, normalized).apply()
                        if (BuildConfig.DEBUG) Log.d(TAG, "syncWatchSettings: Saved app language to prefs: $normalized (locale applied on next restart)")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "syncWatchSettings: Could not parse language from settings: ${e.message}")
            }

            WatchDataSyncManager.syncSettings(ctx, settingsJson)
            call.resolve(mapOf("success" to true).toJSObject())
        } catch (e: Exception) {
            Log.e(TAG, "syncWatchSettings: Error - ${e.message}", e)
            call.resolve(mapOf("success" to false).toJSObject())
        }
    }
    
    /**
     * Trigger update for all prayer widgets
     */
    private fun updateAllWidgets(context: Context) {
        try {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            
            // Update small widgets
            val smallWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, PrayerWidgetSmall::class.java)
            )
            if (smallWidgetIds.isNotEmpty()) {
                val intent = Intent(context, PrayerWidgetSmall::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, smallWidgetIds)
                }
                context.sendBroadcast(intent)
                if (BuildConfig.DEBUG) Log.d(TAG, "Triggered update for ${smallWidgetIds.size} small widgets")
            }
            
            // Update medium widgets
            val mediumWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, PrayerWidgetMedium::class.java)
            )
            if (mediumWidgetIds.isNotEmpty()) {
                val intent = Intent(context, PrayerWidgetMedium::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, mediumWidgetIds)
                }
                context.sendBroadcast(intent)
                if (BuildConfig.DEBUG) Log.d(TAG, "Triggered update for ${mediumWidgetIds.size} medium widgets")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "updateAllWidgets: Error - ${e.message}")
        }
    }
    
    /**
     * Extension function to convert Map to JSObject
     */
    private fun Map<String, Any>.toJSObject(): com.getcapacitor.JSObject {
        val jsObject = com.getcapacitor.JSObject()
        for ((key, value) in this) {
            when (value) {
                is Boolean -> jsObject.put(key, value)
                is Int -> jsObject.put(key, value)
                is Long -> jsObject.put(key, value)
                is Double -> jsObject.put(key, value)
                is String -> jsObject.put(key, value)
                else -> jsObject.put(key, value.toString())
            }
        }
        return jsObject
    }
}
