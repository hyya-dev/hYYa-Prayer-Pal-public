package com.hyya.prayerpal.open

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.TypedValue
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.*

/**
 * Prayer Widget Provider - Base class for prayer time widgets
 * Matches the iOS widget functionality and design
 * Package: com.hyya.prayerpal.open
 * 
 * ARCHITECTURE:
 * - App calculates 365 days of prayer times and pushes to widget
 * - App pushes temperature when opened
 * - Widget just displays cached data - NO network calls
 */
abstract class PrayerWidgetProvider : AppWidgetProvider() {
    
    companion object {
        const val TAG = "PrayerWidget"
        const val PREFS_NAME = "PrayerPalWidgetPrefs"
        const val PRAYERS_KEY = "widget_prayers"
        const val PRAYERS_KEY_PHASE_A = "widget_prayers_phaseA"
        const val PRAYERS_KEY_PHASE_B = "widget_prayers_phaseB"
        const val PRAYERS_UPDATED_AT_KEY = "widget_prayers_updated_at"
        const val WEATHER_KEY = "cachedWeather"
        const val WEATHER_TIME_KEY = "cachedWeatherTime"
        
        // Action for manual refresh
        const val ACTION_REFRESH = "com.hyya.prayerpal.open.WIDGET_REFRESH"
        
        // Fallback background color (matches mascot theme)
        const val FALLBACK_BG_COLOR = "#D4C4A8"
        
        // 30-day staleness threshold for prayer data (matches iOS rules)
        const val THIRTY_DAYS_MILLIS = 30L * 24 * 60 * 60 * 1000
        
        /**
         * Get cached weather temperature from SharedPreferences
         * Temperature is pushed by the app when opened
         * Returns null only if no temperature has ever been stored.
         */
        @Suppress("UNUSED_PARAMETER")
        fun getWeatherTemperature(context: Context, compact: Boolean = false): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val temp = prefs.getString(WEATHER_KEY, null)
            if (temp == null) {
                if (BuildConfig.DEBUG) Log.d(TAG, "getWeatherTemperature: no temperature stored")
                return null
            }
            // Per UX requirement: do not show weather age suffix (e.g. "· 5h", "· 5d") on widgets.
            if (BuildConfig.DEBUG) Log.d(TAG, "getWeatherTemperature: $temp")
            return temp
        }
        
        /**
         * Check if prayer data is stale (older than 30 days)
         */
        fun isDataExpired(data: WidgetData): Boolean {
            val updatedAt = data.updatedAtMillis
            if (updatedAt <= 0L) return false
            val ageMillis = System.currentTimeMillis() - updatedAt
            return ageMillis > THIRTY_DAYS_MILLIS
        }
        
        /**
         * Get prayer data from SharedPreferences
         * Returns map of date -> list of prayers, or null if no data
         */
        fun getPrayerData(context: Context): WidgetData? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr =
                prefs.getString(PRAYERS_KEY_PHASE_B, null)
                    ?: prefs.getString(PRAYERS_KEY_PHASE_A, null)
                    ?: prefs.getString(PRAYERS_KEY, null)
            
            if (jsonStr == null) {
                Log.w(TAG, "getPrayerData: No prayer data in SharedPreferences")
                return null
            }
            
            return try {
                val json = JSONObject(jsonStr)
                val prayersJson = json.optJSONObject("prayers")
                
                if (prayersJson == null) {
                    Log.e(TAG, "getPrayerData: prayers object is null in JSON")
                    return null
                }
                
                val settingsJson = json.optJSONObject("settings")
                val settings = settingsJson?.let {
                    WidgetSettings(
                        timeFormat24 = if (it.has("timeFormat24")) it.optBoolean("timeFormat24") else null,
                        language = it.optString("language", "").ifBlank { null }
                    )
                }
                val updatedAtMillis = prefs.getLong(PRAYERS_UPDATED_AT_KEY, 0L)
                
                val prayers = mutableMapOf<String, List<Prayer>>()
                val keys = prayersJson.keys()
                while (keys.hasNext()) {
                    val dateKey = keys.next()
                    val prayerArray = prayersJson.getJSONArray(dateKey)
                    val prayerList = mutableListOf<Prayer>()
                    for (i in 0 until prayerArray.length()) {
                        val prayerObj = prayerArray.getJSONObject(i)
                        prayerList.add(Prayer(
                            name = prayerObj.getString("name"),
                            time = prayerObj.getString("time")
                        ))
                    }
                    prayers[dateKey] = prayerList
                }
                
                if (BuildConfig.DEBUG) Log.d(TAG, "getPrayerData: Loaded ${prayers.size} days of prayer data")
                WidgetData(prayers, updatedAtMillis, settings)
            } catch (e: Exception) {
                Log.e(TAG, "getPrayerData: Error parsing prayer data: ${e.message}", e)
                null
            }
        }
        
        /**
         * Get current day's prayers based on Isha + 30 min rule
         * After Isha + 30 min, show tomorrow's prayers
         */
        fun getCurrentDayPrayers(data: WidgetData): List<Prayer> {
            val dateFormat = SimpleDateFormat("MM-dd-yyyy", Locale.US)
            val now = Date()
            val todayKey = dateFormat.format(now)
            
            val todayPrayers = data.prayers[todayKey] ?: run {
                // Try to find closest date
                return data.prayers.values.firstOrNull() ?: emptyList()
            }
            
            // Find Isha prayer time
            val ishaPrayer = todayPrayers.find { 
                it.name.lowercase().contains("isha") || it.name.contains("عشاء")
            } ?: return todayPrayers
            
            val preferredLocale = resolveAppLocale(data.settings?.language)
            val ishaTime = parseTimeToDate(ishaPrayer.time, preferredLocale) ?: return todayPrayers
            
            // Add 30 minutes to Isha
            val calendar = Calendar.getInstance()
            calendar.time = ishaTime
            calendar.add(Calendar.MINUTE, 30)
            val ishaPlus30 = calendar.time
            
            // If current time > Isha + 30 min, use tomorrow's prayers
            if (now.after(ishaPlus30)) {
                val tomorrowCal = Calendar.getInstance()
                tomorrowCal.add(Calendar.DAY_OF_YEAR, 1)
                val tomorrowKey = dateFormat.format(tomorrowCal.time)
                
                return data.prayers[tomorrowKey] ?: todayPrayers
            }
            
            return todayPrayers
        }
        
        /**
         * Get the NEXT upcoming prayer based on current time
         */
        fun getNextPrayer(prayers: List<Prayer>, settings: WidgetSettings? = null): Prayer? {
            if (prayers.isEmpty()) return null
            
            val now = Date()
            
            val preferredLocale = resolveAppLocale(settings?.language)

            // Find the first prayer that is still in the future
            for (prayer in prayers) {
                val prayerDate = parseTimeToDate(prayer.time, preferredLocale) ?: continue
                if (prayerDate.after(now)) {
                    return prayer
                }
            }
            
            // All prayers have passed - return first prayer (Fajr for tomorrow)
            return prayers.firstOrNull()
        }
        
        /**
         * Parse time string into Date for today
         * Supports: "5:05 AM", "17:08", etc.
         */
        private fun parseTimeToDate(timeStr: String, preferredLocale: Locale? = null): Date? {
            val calendar = Calendar.getInstance()

            try {
                val normalized = timeStr.trim()

                // Fast path: canonical 24-hour payload format "HH:mm"
                val parts = normalized.split(":")
                if (parts.size >= 2 && parts[0].trim().all { it.isDigit() }) {
                    val hour = parts[0].trim().toIntOrNull()
                    val minute = parts[1].trim().take(2).toIntOrNull()
                    if (hour != null && minute != null && hour in 0..23 && minute in 0..59) {
                        calendar.set(Calendar.HOUR_OF_DAY, hour)
                        calendar.set(Calendar.MINUTE, minute)
                        calendar.set(Calendar.SECOND, 0)
                        return calendar.time
                    }
                }

                val candidateLocales = listOfNotNull(preferredLocale, Locale.getDefault(), Locale.US, Locale.UK).distinct()
                val candidatePatterns = listOf("h:mm a", "h:mm:ss a", "H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss")

                for (locale in candidateLocales) {
                    for (pattern in candidatePatterns) {
                        val format = SimpleDateFormat(pattern, locale)
                        format.isLenient = false
                        val parsed = try {
                            format.parse(normalized)
                        } catch (_: ParseException) {
                            null
                        } catch (_: IllegalArgumentException) {
                            null
                        } catch (_: RuntimeException) {
                            null
                        } ?: continue

                        val parsedCalendar = Calendar.getInstance().apply { time = parsed }
                        calendar.set(Calendar.HOUR_OF_DAY, parsedCalendar.get(Calendar.HOUR_OF_DAY))
                        calendar.set(Calendar.MINUTE, parsedCalendar.get(Calendar.MINUTE))
                        calendar.set(Calendar.SECOND, 0)
                        return calendar.time
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing time '$timeStr': ${e.message}")
            }
            
            return null
        }
        
        /**
         * Format time based on device's locale preference (12-hour vs 24-hour)
         * Matches iOS formatTimeForDevice function behavior
         */
        fun formatTimeForDevice(context: Context, time: String, settings: WidgetSettings? = null): String {
            try {
                val locale = resolveAppLocale(settings?.language)
                val parsed = parseTimeToDate(time, locale) ?: return time
                val is24 = settings?.timeFormat24
                val outputFormat = when (is24) {
                    true -> {
                        val pattern = android.text.format.DateFormat.getBestDateTimePattern(locale ?: Locale.getDefault(), "HH:mm")
                        SimpleDateFormat(pattern, locale ?: Locale.getDefault())
                    }
                    false -> {
                        val pattern = android.text.format.DateFormat.getBestDateTimePattern(locale ?: Locale.getDefault(), "h:mm a")
                        SimpleDateFormat(pattern, locale ?: Locale.getDefault())
                    }
                    else -> android.text.format.DateFormat.getTimeFormat(context)
                }
                var result = outputFormat.format(parsed)

                // Post-process: replace English AM/PM with locale-specific markers
                if (is24 != true) {
                    val langCode = settings?.language?.trim()?.lowercase(Locale.ROOT) ?: ""
                    if (langCode.isNotEmpty() && langCode != "en") {
                        result = localizeAmPm(result, langCode)
                    }
                }

                return result
            } catch (e: Exception) {
                Log.e(TAG, "Error formatting time '$time': ${e.message}")
                return time
            }
        }

        /**
         * Locale-specific AM/PM markers.
         * Many Android devices fall back to English "AM"/"PM" for locales that
         * have their own day-period markers in CLDR. This map provides correct
         * replacements as a post-processing fallback.
         */
        private val AMPM_LOCALE_MAP: Map<String, Pair<String, String>> = mapOf(
            "am"  to ("ጥዋት" to "ከሰዓት"),
            "ar"  to ("ص" to "م"),
            "as"  to ("পূৰ্বাহ্ন" to "অপৰাহ্ন"),
            "bn"  to ("পূর্বাহ্ণ" to "অপরাহ্ণ"),
            "bs"  to ("prijepodne" to "popodne"),
            "bg"  to ("пр.об." to "сл.об."),
            "de"  to ("vorm." to "nachm."),
            "dv"  to ("މކ" to "މފ"),
            "es"  to ("a.\u00A0m." to "p.\u00A0m."),
            "fa"  to ("ق.ظ." to "ب.ظ."),
            "ha"  to ("SF" to "YM"),
            "he"  to ("לפנה״צ" to "אחה״צ"),
            "ja"  to ("午前" to "午後"),
            "km"  to ("មុនថ្ងៃត្រង់" to "រសៀល"),
            "ko"  to ("오전" to "오후"),
            "ku"  to ("BN" to "PN"),
            "mr"  to ("म.पू." to "म.उ."),
            "ms"  to ("PG" to "PTG"),
            "ne"  to ("पूर्वाह्न" to "अपराह्न"),
            "nl"  to ("a.m." to "p.m."),
            "om"  to ("WD" to "WB"),
            "ps"  to ("غ.م." to "غ.و."),
            "ro"  to ("a.m." to "p.m."),
            "sd"  to ("صبح" to "شام"),
            "si"  to ("පෙ.ව." to "ප.ව."),
            "so"  to ("GH" to "GD"),
            "sq"  to ("p.d." to "m.d."),
            "sv"  to ("fm" to "em"),
            "ta"  to ("முற்பகல்" to "பிற்பகல்"),
            "tg"  to ("пе. чо." to "па. чо."),
            "th"  to ("ก่อนเที่ยง" to "หลังเที่ยง"),
            "tr"  to ("ÖÖ" to "ÖS"),
            "ug"  to ("چ.ب" to "چ.ك"),
            "uk"  to ("дп" to "пп"),
            "ur"  to ("قبل دوپہر" to "بعد دوپہر"),
            "uz"  to ("TO" to "TK"),
            "vi"  to ("SA" to "CH"),
            "yo"  to ("Àárọ̀" to "Ọ̀sán"),
            "zh"  to ("上午" to "下午"),
        )

        /** Replace English "AM"/"PM" with locale-correct day-period markers */
        private fun localizeAmPm(formatted: String, langCode: String): String {
            val entry = AMPM_LOCALE_MAP[langCode] ?: return formatted
            val regex = Regex("(am|pm)", RegexOption.IGNORE_CASE)

            return regex.replace(formatted) { match ->
                val replacement = if (match.value.equals("am", ignoreCase = true)) {
                    entry.first
                } else {
                    entry.second
                }

                when {
                    match.value.all { it.isUpperCase() } -> replacement.uppercase(Locale.ROOT)
                    match.value.all { it.isLowerCase() } -> replacement.lowercase(Locale.ROOT)
                    else -> replacement
                }
            }
        }

        private fun resolveAppLocale(language: String?): Locale? {
            val code = language?.trim()?.lowercase(Locale.ROOT) ?: return null
            if (code.isEmpty()) return null

            val languageTag = when (code) {
                "zh" -> "zh-CN"
                "prs" -> "fa-AF"
                "tl" -> "fil"
                else -> code.replace('_', '-')
            }

            val locale = Locale.forLanguageTag(languageTag)
            return if (locale.language.isNullOrBlank()) null else locale
        }
        
        /**
         * Trigger update for all prayer widgets
         */
        fun updateAllWidgets(context: Context) {
            val intent = Intent(context, PrayerWidgetSmall::class.java)
            intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, PrayerWidgetSmall::class.java))
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
            
            val intentMedium = Intent(context, PrayerWidgetMedium::class.java)
            intentMedium.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val idsMedium = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, PrayerWidgetMedium::class.java))
            intentMedium.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, idsMedium)
            context.sendBroadcast(intentMedium)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Triggered update for ${ids.size} small and ${idsMedium.size} medium widgets")
        }
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        
        when (intent.action) {
            ACTION_REFRESH -> {
                if (BuildConfig.DEBUG) Log.d(TAG, "Received refresh action")
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val componentName = ComponentName(context, this::class.java)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
                onUpdate(context, appWidgetManager, appWidgetIds)
            }
            Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> {
                // Device was unlocked - force refresh widgets
                if (BuildConfig.DEBUG) Log.d(TAG, "Screen on/User present - refreshing widgets")
                updateAllWidgets(context)
            }
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                if (BuildConfig.DEBUG) Log.d(TAG, "Time or timezone changed - refreshing widgets")
                updateAllWidgets(context)
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        if (BuildConfig.DEBUG) Log.d(TAG, "Widget options changed for id=$appWidgetId, refreshing layout")
        onUpdate(context, appWidgetManager, intArrayOf(appWidgetId))
    }
    
    /**
     * Called when the first widget instance is created
     * Force an immediate update to ensure widget shows data
     */
    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        if (BuildConfig.DEBUG) Log.d(TAG, "Widget enabled - triggering immediate update")
        updateAllWidgets(context)
    }
    
    /**
     * Called when the widget is restored from backup
     * Force an immediate update to refresh data
     */
    override fun onRestored(context: Context, oldWidgetIds: IntArray, newWidgetIds: IntArray) {
        super.onRestored(context, oldWidgetIds, newWidgetIds)
        if (BuildConfig.DEBUG) Log.d(TAG, "Widget restored - triggering immediate update")
        updateAllWidgets(context)
    }
    
    /**
     * Create pending intent to open the app when widget is tapped
     */
    protected fun createOpenAppIntent(context: Context): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    protected fun getWidgetScale(
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        baseWidthDp: Int,
        baseHeightDp: Int,
        minScale: Float,
        maxScale: Float
    ): Float {
        return try {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, baseWidthDp)
            val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, baseHeightDp)

            val widthScale = widthDp.toFloat() / baseWidthDp.toFloat()
            val heightScale = heightDp.toFloat() / baseHeightDp.toFloat()
            val rawScale = minOf(widthScale, heightScale)
            rawScale.coerceIn(minScale, maxScale)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to calculate widget scale for id=$appWidgetId: ${e.message}")
            1.0f
        }
    }

    protected fun setFixedTextSize(
        context: Context,
        views: RemoteViews,
        viewId: Int,
        baseSp: Float,
        scale: Float
    ) {
        val density = context.resources.displayMetrics.density
        val px = baseSp * scale * density
        views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_PX, px)
    }
}

// Data classes
data class Prayer(val name: String, val time: String)
data class WidgetSettings(val timeFormat24: Boolean?, val language: String?)
data class WidgetData(val prayers: Map<String, List<Prayer>>, val updatedAtMillis: Long, val settings: WidgetSettings?)

/**
 * Small Prayer Widget - Shows next prayer name and time
 * Uses cached data - NO network calls
 */
class PrayerWidgetSmall : PrayerWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        if (BuildConfig.DEBUG) Log.d(TAG, "Small widget onUpdate called for ${appWidgetIds.size} widgets")
        
        for (appWidgetId in appWidgetIds) {
            updateSmallWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    private fun updateSmallWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        
        try {
            val views = RemoteViews(context.packageName, R.layout.widget_prayer_small)

            val scale = getWidgetScale(
                appWidgetManager = appWidgetManager,
                appWidgetId = appWidgetId,
                baseWidthDp = 110,
                baseHeightDp = 110,
                minScale = 0.85f,
                maxScale = 1.0f
            )

            setFixedTextSize(context, views, R.id.next_prayer_name, 22f, scale)
            setFixedTextSize(context, views, R.id.next_prayer_name_shadow, 22f, scale)
            setFixedTextSize(context, views, R.id.next_prayer_time, 22f, scale)
            setFixedTextSize(context, views, R.id.next_prayer_time_shadow, 22f, scale)
            setFixedTextSize(context, views, R.id.temperature_text, 22f, scale)
            setFixedTextSize(context, views, R.id.temperature_text_shadow, 22f, scale)
            
            // Force LTR layout direction so RTL locales use same layout as LTR
            views.setInt(R.id.widget_background, "setLayoutDirection", View.LAYOUT_DIRECTION_LTR)
            
            // Explicitly set the background image (required for RemoteViews)
            views.setImageViewResource(R.id.widget_background, R.drawable.widget_background_small)
            
            // Set click listener to open app
            views.setOnClickPendingIntent(R.id.widget_background, createOpenAppIntent(context))
            
            // Get prayer data and cached temperature
            val data = getPrayerData(context)
            val temperature = getWeatherTemperature(context, compact = true)
            
            
            // Check if data is missing or stale (30 days)
            val isExpired = data != null && isDataExpired(data)
            
            if (data == null || data.prayers.isEmpty() || isExpired) {
                // Show empty state - prompt user to open app
                views.setViewVisibility(R.id.prayer_card, View.GONE)
                views.setViewVisibility(R.id.empty_state, View.VISIBLE)
                views.setViewVisibility(R.id.temperature_container, View.GONE)
                if (BuildConfig.DEBUG) Log.d(TAG, "Small widget: No data or stale (>30 days), showing empty state")
            } else {
                // Show prayer data
                views.setViewVisibility(R.id.prayer_card, View.VISIBLE)
                views.setViewVisibility(R.id.empty_state, View.GONE)
                
                val todayPrayers = getCurrentDayPrayers(data)
                val nextPrayer = getNextPrayer(todayPrayers, data.settings)
                
                if (nextPrayer != null) {
                    // Uppercase prayer name and format time to match iOS
                    views.setTextViewText(R.id.next_prayer_name, nextPrayer.name.uppercase())
                    views.setTextViewText(R.id.next_prayer_name_shadow, nextPrayer.name.uppercase())
                    views.setTextViewText(R.id.next_prayer_time, formatTimeForDevice(context, nextPrayer.time, data.settings))
                    views.setTextViewText(R.id.next_prayer_time_shadow, formatTimeForDevice(context, nextPrayer.time, data.settings))
                    if (BuildConfig.DEBUG) Log.d(TAG, "Small widget: Showing ${nextPrayer.name} at ${nextPrayer.time}")
                } else {
                    views.setTextViewText(R.id.next_prayer_name, "--")
                    views.setTextViewText(R.id.next_prayer_name_shadow, "--")
                    views.setTextViewText(R.id.next_prayer_time, "--")
                    views.setTextViewText(R.id.next_prayer_time_shadow, "--")
                }
                
                // Show temperature if available
                if (temperature != null) {
                    views.setTextViewText(R.id.temperature_text, temperature)
                    views.setTextViewText(R.id.temperature_text_shadow, temperature)
                    views.setViewVisibility(R.id.temperature_container, View.VISIBLE)
                    if (BuildConfig.DEBUG) Log.d(TAG, "Small widget: Showing temperature $temperature")
                } else {
                    views.setViewVisibility(R.id.temperature_container, View.GONE)
                }
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating small widget $appWidgetId: ${e.message}", e)
            // Attempt to show a minimal fallback view
            try {
                val fallbackViews = RemoteViews(context.packageName, R.layout.widget_prayer_small)
                fallbackViews.setImageViewResource(R.id.widget_background, R.drawable.widget_background_small)
                fallbackViews.setViewVisibility(R.id.empty_state, View.VISIBLE)
                fallbackViews.setViewVisibility(R.id.prayer_card, View.GONE)
                fallbackViews.setViewVisibility(R.id.temperature_container, View.GONE)
                appWidgetManager.updateAppWidget(appWidgetId, fallbackViews)
            } catch (fallbackError: Exception) {
                Log.e(TAG, "Fallback also failed: ${fallbackError.message}")
            }
        }
    }
}

/**
 * Medium Prayer Widget - Shows all 6 prayer times
 */
class PrayerWidgetMedium : PrayerWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        if (BuildConfig.DEBUG) Log.d(TAG, "Medium widget onUpdate called for ${appWidgetIds.size} widgets")
        
        for (appWidgetId in appWidgetIds) {
            updateMediumWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    private fun updateMediumWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        
        try {
            val views = RemoteViews(context.packageName, R.layout.widget_prayer_medium)

            val scale = getWidgetScale(
                appWidgetManager = appWidgetManager,
                appWidgetId = appWidgetId,
                baseWidthDp = 250,
                baseHeightDp = 110,
                minScale = 0.85f,
                maxScale = 1.0f
            )
            val mediumScale = scale.coerceAtLeast(1.0f)

            setFixedTextSize(context, views, R.id.next_prayer_name, 22f, mediumScale)
            setFixedTextSize(context, views, R.id.next_prayer_name_shadow, 22f, mediumScale)
            setFixedTextSize(context, views, R.id.next_prayer_time, 22f, mediumScale)
            setFixedTextSize(context, views, R.id.next_prayer_time_shadow, 22f, mediumScale)

            val prayerNameIds = listOf(
                R.id.prayer_name_1,
                R.id.prayer_name_2,
                R.id.prayer_name_3,
                R.id.prayer_name_4,
                R.id.prayer_name_5,
                R.id.prayer_name_6
            )
            val prayerTimeIds = listOf(
                R.id.prayer_time_1,
                R.id.prayer_time_2,
                R.id.prayer_time_3,
                R.id.prayer_time_4,
                R.id.prayer_time_5,
                R.id.prayer_time_6
            )

            prayerNameIds.forEach { setFixedTextSize(context, views, it, 25f, mediumScale) }
            prayerTimeIds.forEach { setFixedTextSize(context, views, it, 25f, mediumScale) }
            setFixedTextSize(context, views, R.id.temperature_text, 22f, mediumScale)
            setFixedTextSize(context, views, R.id.temperature_text_shadow, 22f, mediumScale)
            
            // Force LTR layout direction so RTL locales use same layout as LTR
            views.setInt(R.id.widget_background, "setLayoutDirection", View.LAYOUT_DIRECTION_LTR)
            
            // Background is set via android:background in XML to avoid Binder transaction size issues
            
            // Set click listener to open app
            views.setOnClickPendingIntent(R.id.widget_background, createOpenAppIntent(context))
            
            // Get prayer data and cached temperature
            val data = getPrayerData(context)
            val temperature = getWeatherTemperature(context, compact = true)
            
            
            // Check if data is missing or stale (30 days)
            val isExpired = data != null && isDataExpired(data)
            
            if (data == null || data.prayers.isEmpty() || isExpired) {
                // Show empty state - prompt user to open app
                views.setViewVisibility(R.id.next_prayer_row, View.GONE)
                views.setViewVisibility(R.id.prayer_list_card, View.GONE)
                views.setViewVisibility(R.id.temperature_container, View.GONE)
                views.setViewVisibility(R.id.empty_state, View.VISIBLE)
                if (BuildConfig.DEBUG) Log.d(TAG, "Medium widget: No data or stale (>30 days), showing empty state")
            } else {
                // Show prayer data
                views.setViewVisibility(R.id.next_prayer_row, View.VISIBLE)
                views.setViewVisibility(R.id.prayer_list_card, View.VISIBLE)
                views.setViewVisibility(R.id.empty_state, View.GONE)
                
                val todayPrayers = getCurrentDayPrayers(data)
                val nextPrayer = getNextPrayer(todayPrayers, data.settings)
                
                // Update next prayer row at top (iOS style)
                if (nextPrayer != null) {
                    views.setTextViewText(R.id.next_prayer_name, nextPrayer.name.uppercase())
                    views.setTextViewText(R.id.next_prayer_name_shadow, nextPrayer.name.uppercase())
                    views.setTextViewText(R.id.next_prayer_time, formatTimeForDevice(context, nextPrayer.time, data.settings))
                    views.setTextViewText(R.id.next_prayer_time_shadow, formatTimeForDevice(context, nextPrayer.time, data.settings))
                } else {
                    views.setTextViewText(R.id.next_prayer_name, "--")
                    views.setTextViewText(R.id.next_prayer_name_shadow, "--")
                    views.setTextViewText(R.id.next_prayer_time, "--")
                    views.setTextViewText(R.id.next_prayer_time_shadow, "--")
                }
                
                // Update each prayer row (up to 6 prayers)
                val prayerViews = listOf(
                    Pair(R.id.prayer_name_1, R.id.prayer_time_1),
                    Pair(R.id.prayer_name_2, R.id.prayer_time_2),
                    Pair(R.id.prayer_name_3, R.id.prayer_time_3),
                    Pair(R.id.prayer_name_4, R.id.prayer_time_4),
                    Pair(R.id.prayer_name_5, R.id.prayer_time_5),
                    Pair(R.id.prayer_name_6, R.id.prayer_time_6)
                )
                
                for (i in prayerViews.indices) {
                    if (i < todayPrayers.size) {
                        // Uppercase prayer names to match iOS
                        views.setTextViewText(prayerViews[i].first, todayPrayers[i].name.uppercase())
                        views.setTextViewText(prayerViews[i].second, formatTimeForDevice(context, todayPrayers[i].time, data.settings))
                    } else {
                        views.setTextViewText(prayerViews[i].first, "--")
                        views.setTextViewText(prayerViews[i].second, "--")
                    }
                }
                
                // Show temperature if available
                if (temperature != null) {
                    views.setTextViewText(R.id.temperature_text, temperature)
                    views.setTextViewText(R.id.temperature_text_shadow, temperature)
                    views.setViewVisibility(R.id.temperature_container, View.VISIBLE)
                    if (BuildConfig.DEBUG) Log.d(TAG, "Medium widget: Showing temperature $temperature")
                } else {
                    views.setViewVisibility(R.id.temperature_container, View.GONE)
                }
                
                if (BuildConfig.DEBUG) Log.d(TAG, "Medium widget: Showing ${todayPrayers.size} prayers, next: ${nextPrayer?.name}")
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating medium widget $appWidgetId: ${e.message}", e)
            // Attempt to show a minimal fallback view
            try {
                val fallbackViews = RemoteViews(context.packageName, R.layout.widget_prayer_medium)
                // Background is set via android:background in XML
                fallbackViews.setViewVisibility(R.id.empty_state, View.VISIBLE)
                fallbackViews.setViewVisibility(R.id.next_prayer_row, View.GONE)
                fallbackViews.setViewVisibility(R.id.prayer_list_card, View.GONE)
                fallbackViews.setViewVisibility(R.id.temperature_container, View.GONE)
                appWidgetManager.updateAppWidget(appWidgetId, fallbackViews)
            } catch (fallbackError: Exception) {
                Log.e(TAG, "Fallback also failed: ${fallbackError.message}")
            }
        }
    }
}
