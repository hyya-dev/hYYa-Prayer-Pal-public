package com.hyya.prayerpal.wear.sync

import android.content.Context
import android.text.format.DateFormat
import com.hyya.prayerpal.wear.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private data class WatchDisplayPrefs(
    val locale: Locale?,
    val timeFormat24: Boolean?,
)

object WatchSyncStore {
    private const val PREFS = "PrayerPalWearSync"
    private const val KEY_PRAYER_JSON = "prayer_json"
    private const val KEY_WEATHER_JSON = "weather_json"
    private const val KEY_SETTINGS_JSON = "settings_json"
    private const val KEY_WEATHER_RECEIVED_AT = "weather_received_at_ms"

    fun savePayload(context: Context, path: String, json: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        when (path) {
            WatchSyncPaths.PRAYER -> prefs.edit().putString(KEY_PRAYER_JSON, json).apply()
            WatchSyncPaths.WEATHER -> prefs.edit()
                .putString(KEY_WEATHER_JSON, json)
                // Local receipt time for SLA scheduling; not part of synced payload.
                .putLong(KEY_WEATHER_RECEIVED_AT, System.currentTimeMillis())
                .apply()
            WatchSyncPaths.SETTINGS -> prefs.edit().putString(KEY_SETTINGS_JSON, json).apply()
        }
    }

    fun getPrayerJson(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PRAYER_JSON, null)

    fun getWeatherJson(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_WEATHER_JSON, null)

    fun getWeatherReceivedAtMs(context: Context): Long =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_WEATHER_RECEIVED_AT, 0L)

    fun getSettingsJson(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SETTINGS_JSON, null)

    fun getWaitingText(context: Context): String {
        val nativeFallback = context.getString(R.string.watch_open_app)
        val raw = getSettingsJson(context) ?: return nativeFallback
        return try {
            val root = JSONObject(raw)
            val payload = root.optJSONObject("payload") ?: JSONObject()
            val strings = payload.optJSONObject("strings") ?: JSONObject()
            strings.optString("openAppToSync", nativeFallback).ifBlank { nativeFallback }
        } catch (_: Exception) {
            nativeFallback
        }
    }

    fun getLocalizedAppName(context: Context): String {
        val nativeFallback = context.getString(R.string.app_name)
        val raw = getSettingsJson(context) ?: return nativeFallback
        return try {
            val root = JSONObject(raw)
            val payload = root.optJSONObject("payload") ?: JSONObject()
            val strings = payload.optJSONObject("strings") ?: JSONObject()
            strings.optString("appName", nativeFallback).ifBlank { nativeFallback }
        } catch (_: Exception) {
            nativeFallback
        }
    }

    fun getPrayerNames(context: Context): Map<String, String> {
        val defaults = mapOf(
            "fajr" to "Fajr",
            "shurooq" to "Shurooq",
            "dhuhr" to "Dhuhr",
            "asr" to "Asr",
            "maghrib" to "Maghrib",
            "isha" to "Isha",
        )

        val raw = getSettingsJson(context) ?: return defaults
        return try {
            val root = JSONObject(raw)
            val payload = root.optJSONObject("payload") ?: JSONObject()
            val prayerNames = payload.optJSONObject("prayerNames") ?: return defaults
            defaults.mapValues { (key, fallback) ->
                prayerNames.optString(key, fallback).ifBlank { fallback }
            }
        } catch (_: Exception) {
            defaults
        }
    }

    fun formatPrayerTimeForDisplay(context: Context, rawTime: String): String {
        val prefs = getDisplayPrefs(context)
        val parsed = parsePrayerTime(rawTime, prefs.locale) ?: return rawTime
        val is24 = prefs.timeFormat24
        val outputFormat = when (is24) {
            true -> {
                val locale = prefs.locale ?: Locale.getDefault()
                val pattern = DateFormat.getBestDateTimePattern(locale, "HH:mm")
                SimpleDateFormat(pattern, locale)
            }
            false -> {
                val locale = prefs.locale ?: Locale.getDefault()
                val pattern = DateFormat.getBestDateTimePattern(locale, "h:mm a")
                SimpleDateFormat(pattern, locale)
            }
            else -> DateFormat.getTimeFormat(context)
        }
        var result = outputFormat.format(parsed)

        // Post-process: replace English AM/PM with locale-specific markers
        if (is24 != true) {
            val langCode = getLangCode(context)
            if (langCode.isNotEmpty() && langCode != "en") {
                result = localizeAmPm(result, langCode)
            }
        }

        return result
    }

    /** Get current language code from settings */
    private fun getLangCode(context: Context): String {
        val raw = getSettingsJson(context) ?: return ""
        return try {
            val root = JSONObject(raw)
            val payload = root.optJSONObject("payload") ?: JSONObject()
            payload.optString("language", "").trim().lowercase(Locale.ROOT)
        } catch (_: Exception) { "" }
    }

    /**
     * Locale-specific AM/PM markers.
     * Many Android devices fall back to English "AM"/"PM" for locales that have
     * their own day-period markers in CLDR.
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
        val amRegex = Regex("(?i)AM")
        val pmRegex = Regex("(?i)PM")
        if (amRegex.containsMatchIn(formatted)) {
            return amRegex.replace(formatted, entry.first)
        }
        if (pmRegex.containsMatchIn(formatted)) {
            return pmRegex.replace(formatted, entry.second)
        }
        return formatted
    }

    private fun parsePrayerTime(rawTime: String, preferredLocale: Locale? = null): Date? {
        val normalized = rawTime.trim()
        if (normalized.isEmpty()) return null

        val parts = normalized.split(":")
        if (parts.size >= 2 && parts[0].trim().all { it.isDigit() }) {
            val hour = parts[0].trim().toIntOrNull()
            val minute = parts[1].trim().take(2).toIntOrNull()
            if (hour != null && minute != null && hour in 0..23 && minute in 0..59) {
                val calendar = Calendar.getInstance()
                calendar.set(Calendar.HOUR_OF_DAY, hour)
                calendar.set(Calendar.MINUTE, minute)
                calendar.set(Calendar.SECOND, 0)
                return calendar.time
            }
        }

        val locales = listOfNotNull(preferredLocale, Locale.getDefault(), Locale.US, Locale.UK).distinct()
        val patterns = listOf("h:mm a", "h:mm:ss a", "H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss")
        for (locale in locales) {
            for (pattern in patterns) {
                val parser = SimpleDateFormat(pattern, locale)
                parser.isLenient = false
                val parsed = try {
                    parser.parse(normalized)
                } catch (_: java.text.ParseException) {
                    continue
                } ?: continue
                val parsedCalendar = Calendar.getInstance().apply { time = parsed }
                val calendar = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, parsedCalendar.get(Calendar.HOUR_OF_DAY))
                    set(Calendar.MINUTE, parsedCalendar.get(Calendar.MINUTE))
                    set(Calendar.SECOND, 0)
                }
                return calendar.time
            }
        }

        return null
    }

    private fun getDisplayPrefs(context: Context): WatchDisplayPrefs {
        val raw = getSettingsJson(context) ?: return WatchDisplayPrefs(locale = null, timeFormat24 = null)
        return try {
            val root = JSONObject(raw)
            val payload = root.optJSONObject("payload") ?: JSONObject()
            val languageCode = payload.optString("language", "").ifBlank { null }
            val locale = resolveLocale(languageCode)
            val hasTimeFormat24 = payload.has("timeFormat24")
            val timeFormat24 = if (hasTimeFormat24) payload.optBoolean("timeFormat24") else null
            WatchDisplayPrefs(locale = locale, timeFormat24 = timeFormat24)
        } catch (_: Exception) {
            WatchDisplayPrefs(locale = null, timeFormat24 = null)
        }
    }

    private fun resolveLocale(languageCode: String?): Locale? {
        val code = languageCode?.trim()?.lowercase(Locale.ROOT) ?: return null
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
}
