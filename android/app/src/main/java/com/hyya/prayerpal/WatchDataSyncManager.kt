package com.hyya.prayerpal

import android.content.Context
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

object WatchDataSyncManager {
    private const val TAG = "WatchDataSync"
    private const val VERSION = "1.0"

    private const val PATH_PRAYER = "/prayerpal/prayer"
    private const val PATH_WEATHER = "/prayerpal/weather"
    private const val PATH_SETTINGS = "/prayerpal/settings"
    const val PATH_REQUEST_SNAPSHOT = "/prayerpal/request_snapshot"

    private const val PREFS = "PrayerPalWatchSyncCache"
    private const val KEY_PRAYER_PAYLOAD = "prayer_payload"
    private const val KEY_WEATHER_PAYLOAD = "weather_payload"
    private const val KEY_SETTINGS_PAYLOAD = "settings_payload"

    private val executor = Executors.newSingleThreadExecutor()

    fun syncPrayerData(context: Context, rawPrayerJson: String) {
        val payload = buildPrayerPayload(rawPrayerJson) ?: return
        submit(context, PATH_PRAYER, payload)
    }

    fun syncWeather(context: Context, temperature: String) {
        val root = JSONObject()
            .put("version", VERSION)
            .put("type", "weather")
            .put("nonce", UUID.randomUUID().toString())
            .put("payload", JSONObject()
                .put("value", temperature)
                .put("freshness", "fresh"))
        submit(context, PATH_WEATHER, root.toString())
    }

    fun syncSettings(context: Context, rawSettingsJson: String) {
        val settings = try {
            JSONObject(rawSettingsJson)
        } catch (e: Exception) {
            Log.e(TAG, "Invalid settings payload: ${e.message}")
            return
        }

        val wrapped = JSONObject()
            .put("version", VERSION)
            .put("type", "settings")
            .put("nonce", UUID.randomUUID().toString())
            .put("payload", settings)

        submit(context, PATH_SETTINGS, wrapped.toString())
    }

    fun syncLastKnown(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        var sentAny = false

        prefs.getString(KEY_PRAYER_PAYLOAD, null)?.let {
            submit(context, PATH_PRAYER, it)
            sentAny = true
        }

        prefs.getString(KEY_WEATHER_PAYLOAD, null)?.let {
            submit(context, PATH_WEATHER, it)
            sentAny = true
        }

        prefs.getString(KEY_SETTINGS_PAYLOAD, null)?.let {
            submit(context, PATH_SETTINGS, it)
            sentAny = true
        }

        if (!sentAny) {
            val widgetPrefs = context.getSharedPreferences(PrayerWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val prayersJson =
                widgetPrefs.getString(PrayerWidgetProvider.PRAYERS_KEY_PHASE_B, null)
                    ?: widgetPrefs.getString(PrayerWidgetProvider.PRAYERS_KEY_PHASE_A, null)
                    ?: widgetPrefs.getString(PrayerWidgetProvider.PRAYERS_KEY, null)
            prayersJson?.let {
                syncPrayerData(context, it)
                sentAny = true
            }
            widgetPrefs.getString(PrayerWidgetProvider.WEATHER_KEY, null)?.let {
                syncWeather(context, it)
                sentAny = true
            }
        }

        if (BuildConfig.DEBUG) Log.d(TAG, if (sentAny) "syncLastKnown sent cached payloads" else "syncLastKnown had no payload to send")
    }

    private fun submit(context: Context, path: String, jsonPayload: String) {
        executor.execute {
            try {
                cacheLastPayload(context, path, jsonPayload)

                val request = PutDataMapRequest.create(path).run {
                    dataMap.putString("json", jsonPayload)
                    // Ensure DataItem changes even when JSON is identical, without using timestamps.
                    dataMap.putString("nonce", UUID.randomUUID().toString())
                    asPutDataRequest().setUrgent()
                }

                Wearable.getDataClient(context).putDataItem(request)
                val nodes = Tasks.await(Wearable.getNodeClient(context).connectedNodes)
                nodes.forEach { node ->
                    Wearable.getMessageClient(context).sendMessage(node.id, path, jsonPayload.toByteArray())
                }
                if (BuildConfig.DEBUG) Log.d(TAG, "Synced path=$path to ${nodes.size} nodes")
            } catch (e: Exception) {
                Log.w(TAG, "Sync skipped/failed for path=$path: ${e.message}")
            }
        }
    }

    private fun cacheLastPayload(context: Context, path: String, jsonPayload: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        when (path) {
            PATH_PRAYER -> prefs.edit().putString(KEY_PRAYER_PAYLOAD, jsonPayload).apply()
            PATH_WEATHER -> prefs.edit().putString(KEY_WEATHER_PAYLOAD, jsonPayload).apply()
            PATH_SETTINGS -> prefs.edit().putString(KEY_SETTINGS_PAYLOAD, jsonPayload).apply()
        }
    }

    private fun buildPrayerPayload(rawPrayerJson: String): String? {
        return try {
            val root = JSONObject(rawPrayerJson)
            val prayersByDate = root.optJSONObject("prayers") ?: return null
            val phase = root.optString("phase", "").ifBlank { null }
            val todayKey = SimpleDateFormat("MM-dd-yyyy", Locale.US).format(Date())
            val today = prayersByDate.optJSONArray(todayKey)
                ?: prayersByDate.keys().asSequence().firstOrNull()?.let { prayersByDate.optJSONArray(it) }
                ?: JSONArray()

            val keyByLabel = reversePrayerNameMap(root)
            val orderedKeys = listOf("fajr", "shurooq", "dhuhr", "asr", "maghrib", "isha")

            val entries = JSONArray()
            for (i in 0 until today.length()) {
                val item = today.optJSONObject(i) ?: continue
                val label = item.optString("name", "")
                val time = item.optString("time", "--:--")
                val inferred = keyByLabel[normalize(label)] ?: orderedKeys.getOrNull(i) ?: "fajr"
                entries.put(JSONObject()
                    .put("key", inferred)
                    .put("label", label)
                    .put("time", time))
            }

            val nextKey = computeNextPrayerKey(entries)
            val nextLabel = findLabelForKey(entries, nextKey)

            JSONObject()
                .put("version", VERSION)
                .put("type", "prayer")
                .put("nonce", UUID.randomUUID().toString())
                .put("payload", JSONObject()
                    .put("date", todayKey)
                    .put("entries", entries)
                    .put("nextPrayerKey", nextKey)
                    .put("nextPrayerLabel", nextLabel)
                    // Phase A/B schedule is stored on-watch so it can keep working offline.
                    .put("phase", phase)
                    .put("schedule", JSONObject()
                        .put("prayers", prayersByDate)))
                .toString()
        } catch (e: Exception) {
            Log.e(TAG, "buildPrayerPayload failed: ${e.message}")
            null
        }
    }

    private fun reversePrayerNameMap(root: JSONObject): Map<String, String> {
        val map = mutableMapOf<String, String>()
        val settings = root.optJSONObject("settings") ?: return emptyMap()
        val names = settings.optJSONObject("prayerNames") ?: return emptyMap()
        names.keys().forEach { key ->
            val value = names.optString(key, "")
            if (value.isNotBlank()) {
                map[normalize(value)] = key
            }
        }
        return map
    }

    private fun findLabelForKey(entries: JSONArray, key: String): String {
        for (i in 0 until entries.length()) {
            val item = entries.optJSONObject(i) ?: continue
            if (item.optString("key") == key) {
                return item.optString("label", key)
            }
        }
        return key
    }

    private fun computeNextPrayerKey(entries: JSONArray): String {
        if (entries.length() == 0) return "fajr"

        val now = Date()
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now)

        for (i in 0 until entries.length()) {
            val item = entries.optJSONObject(i) ?: continue
            val time = item.optString("time", "")
            val key = item.optString("key", "fajr")
            val parsed = parsePrayerTime(day, time)
            if (parsed != null && parsed.after(now)) return key
        }

        return entries.optJSONObject(0)?.optString("key", "fajr") ?: "fajr"
    }

    private fun parsePrayerTime(
        day: String,
        timeValue: String,
    ): Date? {
        val normalized = timeValue.trim()
        if (normalized.isEmpty()) return null

        // Canonical 24-hour payload fast path
        val canonical24Hour = Regex("^\\d{1,2}:\\d{1,2}$")
        if (canonical24Hour.matches(normalized)) {
            val parts = normalized.split(":")
            if (parts.size == 2 && parts[0].all { it.isDigit() } && parts[1].all { it.isDigit() }) {
                val hour = parts[0].toIntOrNull()
                val minute = parts[1].take(2).toIntOrNull()
                if (hour != null && minute != null && hour in 0..23 && minute in 0..59) {
                    return parseDayTime(day, hour, minute)
                }
            }
        }

        val locales = listOf(Locale.getDefault(), Locale.US, Locale.UK)
        val patterns = listOf("h:mm a", "h:mm:ss a", "H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss")

        for (locale in locales) {
            for (pattern in patterns) {
                val parser = SimpleDateFormat(pattern, locale)
                parser.isLenient = false
                val parsed = try {
                    parser.parse(normalized)
                } catch (_: Exception) {
                    null
                } ?: continue

                val calendar = Calendar.getInstance().apply { time = parsed }
                val hour = calendar.get(Calendar.HOUR_OF_DAY)
                val minute = calendar.get(Calendar.MINUTE)
                return parseDayTime(day, hour, minute)
            }
        }

        return null
    }

    private fun parseDayTime(day: String, hour: Int, minute: Int): Date? {
        val dayFormat = SimpleDateFormat("yyyy-MM-dd H:mm", Locale.US)
        return try {
            dayFormat.parse("$day $hour:$minute")
        } catch (_: Exception) {
            null
        }
    }

    private fun normalize(label: String): String {
        return label
            .trim()
            .lowercase(Locale.ROOT)
            .replace("ٔ", "")
            .replace("ة", "ه")
            .replace("ى", "ي")
            .replace("à", "a")
            .replace("á", "a")
            .replace("é", "e")
            .replace("ï", "i")
            .replace("ö", "o")
            .replace("ü", "u")
    }
}
