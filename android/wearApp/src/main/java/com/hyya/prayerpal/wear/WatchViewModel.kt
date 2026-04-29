package com.hyya.prayerpal.wear

import android.app.Application
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.Wearable
import com.hyya.prayerpal.wear.sync.WatchSyncStore
import com.hyya.prayerpal.wear.sync.WatchSyncPaths
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors
import kotlin.math.min

data class WatchPrayerEntry(
    val key: String,
    val label: String,
    val time: String,
)

data class WatchUiState(
    val temperature: String = "--°",
    val prayerEntries: List<WatchPrayerEntry> = emptyList(),
    val nextPrayerKey: String = "",
    val isWaitingForPhone: Boolean = false,
    val waitingText: String = "Waiting for phone...",
    val appTitle: String = "hYYa Prayer Pal",
)

class WatchViewModel(application: Application) : AndroidViewModel(application) {
    companion object {
        private const val TAG = "WatchViewModel"

        /** Weather data considered stale after 60 minutes (matching Apple Watch) */
        private const val WEATHER_SLA_MS = 60L * 60 * 1000

        /** Schedule a pre-expiry refresh 50 minutes after weather timestamp (matching Apple Watch) */
        private const val PRE_EXPIRY_OFFSET_MS = 50L * 60 * 1000

        /** Base interval for no-weather exponential backoff (matching Apple Watch 15s) */
        private const val NO_WEATHER_BASE_MS = 15_000L

        /** Max interval cap for no-weather backoff (matching Apple Watch 120s) */
        private const val NO_WEATHER_MAX_MS = 120_000L

        /** Max attempts for no-weather polling before giving up (matching Apple Watch 8) */
        private const val NO_WEATHER_MAX_ATTEMPTS = 8

        /** Minimum cooldown between snapshot requests (matching Apple Watch 10s) */
        private const val SNAPSHOT_COOLDOWN_MS = 10_000L
    }

    private val prefs: SharedPreferences =
        application.getSharedPreferences("PrayerPalWearSync", Application.MODE_PRIVATE)

    private val _uiState = MutableStateFlow(WatchUiState())
    val uiState: StateFlow<WatchUiState> = _uiState
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    @Volatile private var lastSnapshotRequestMs = 0L
    private var noWeatherAttempts = 0
    private var preExpiryRunnable: Runnable? = null
    private var noWeatherRunnable: Runnable? = null
    private var noWeatherCheckRunnable: Runnable? = null

    private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        refresh()
    }

    init {
        prefs.registerOnSharedPreferenceChangeListener(listener)
        requestSnapshot()
        refresh()
    }

    override fun onCleared() {
        prefs.unregisterOnSharedPreferenceChangeListener(listener)
        cancelAllTimers()
        super.onCleared()
    }

    private fun refresh() {
        val app = getApplication<Application>()
        val waitingText = WatchSyncStore.getWaitingText(app)
        val appTitle = WatchSyncStore.getLocalizedAppName(app)
        val prayerNameMap = WatchSyncStore.getPrayerNames(app)

        val prayerOrder = listOf("fajr", "shurooq", "dhuhr", "asr", "maghrib", "isha")

        val prayerEntries = mutableListOf<WatchPrayerEntry>()
        var nextPrayerKey = ""

        WatchSyncStore.getPrayerJson(app)?.let { raw ->
            try {
                val root = JSONObject(raw)
                val payload = root.optJSONObject("payload") ?: JSONObject()
                val arr = payload.optJSONArray("entries") ?: JSONArray()
                for (index in 0 until arr.length()) {
                    val item = arr.optJSONObject(index) ?: continue
                    val rawTime = item.optString("time", "--:--")
                    prayerEntries.add(
                        WatchPrayerEntry(
                            key = item.optString("key", ""),
                            label = item.optString("label", ""),
                            time = WatchSyncStore.formatPrayerTimeForDisplay(app, rawTime),
                        )
                    )
                }
                nextPrayerKey = payload.optString("nextPrayerKey", "")
            } catch (_: Exception) {
            }
        }

        val displayPrayerEntries = if (prayerEntries.isEmpty()) {
            prayerOrder.map { key ->
                WatchPrayerEntry(
                    key = key,
                    label = prayerNameMap[key] ?: key,
                    time = "--:--",
                )
            }
        } else {
            prayerEntries
        }

        var temperature = "--°"
        var weatherReceivedAt = 0L
        WatchSyncStore.getWeatherJson(app)?.let { raw ->
            try {
                val root = JSONObject(raw)
                val payload = root.optJSONObject("payload") ?: JSONObject()
                temperature = payload.optString("value", "--°")
            } catch (_: Exception) {
            }
        }
        weatherReceivedAt = WatchSyncStore.getWeatherReceivedAtMs(app)

        val isWaiting = prayerEntries.isEmpty()

        _uiState.value = WatchUiState(
            temperature = temperature,
            prayerEntries = displayPrayerEntries,
            nextPrayerKey = nextPrayerKey,
            isWaitingForPhone = isWaiting,
            waitingText = waitingText,
            appTitle = appTitle,
        )

        // Weather SLA & refresh scheduling (matching Apple Watch behaviour)
        handleWeatherRefreshScheduling(weatherReceivedAt)
    }

    /**
     * Manages weather refresh logic matching Apple Watch's WatchSessionManager:
     * 1. If weather is stale (>60min), request immediate refresh
     * 2. If weather exists, schedule pre-expiry refresh at 50min after timestamp
     * 3. If no weather, use exponential backoff polling
     */
    private fun handleWeatherRefreshScheduling(weatherTimestampMs: Long) {
        cancelAllTimers()

        if (weatherTimestampMs > 0L) {
            // We have weather data — reset no-weather backoff
            noWeatherAttempts = 0

            val ageMs = System.currentTimeMillis() - weatherTimestampMs

            if (ageMs >= WEATHER_SLA_MS) {
                // Weather is stale, request refresh immediately
                if (BuildConfig.DEBUG) Log.d(TAG, "Weather stale (${ageMs / 60000}m old), requesting refresh")
                requestSnapshot()
            } else {
                // Schedule pre-expiry refresh
                val timeUntilPreExpiry = PRE_EXPIRY_OFFSET_MS - ageMs
                if (timeUntilPreExpiry > 0) {
                    if (BuildConfig.DEBUG) Log.d(TAG, "Scheduling pre-expiry refresh in ${timeUntilPreExpiry / 1000}s")
                    preExpiryRunnable = Runnable {
                        if (BuildConfig.DEBUG) Log.d(TAG, "Pre-expiry weather refresh triggered")
                        requestSnapshot()
                    }
                    handler.postDelayed(preExpiryRunnable!!, timeUntilPreExpiry)
                } else {
                    // Already past 50min but under 60min, request refresh now
                    if (BuildConfig.DEBUG) Log.d(TAG, "Weather approaching SLA (${ageMs / 60000}m), requesting refresh")
                    requestSnapshot()
                }
            }
        } else {
            // No weather data yet — start exponential backoff polling
            scheduleNoWeatherBackoff()
        }
    }

    /**
     * Exponential backoff when no weather data is available.
     * Matches Apple Watch: base 15s, max 120s cap, up to 8 attempts.
     */
    private fun scheduleNoWeatherBackoff() {
        if (noWeatherAttempts >= NO_WEATHER_MAX_ATTEMPTS) {
            if (BuildConfig.DEBUG) Log.d(TAG, "No-weather backoff: max attempts reached ($NO_WEATHER_MAX_ATTEMPTS)")
            return
        }

        val delayMs = min(
            NO_WEATHER_BASE_MS * (1L shl noWeatherAttempts.coerceAtMost(6)),
            NO_WEATHER_MAX_MS,
        )
        if (BuildConfig.DEBUG) Log.d(TAG, "No-weather backoff: attempt ${noWeatherAttempts + 1}, delay ${delayMs / 1000}s")

        noWeatherRunnable = Runnable {
            noWeatherAttempts++
            requestSnapshot()
            // Will re-evaluate in refresh() after data arrives (or schedule next backoff)
            noWeatherCheckRunnable = Runnable {
                // If still no weather after this attempt, schedule another
                val currentState = _uiState.value
                if (currentState.temperature == "--°") {
                    scheduleNoWeatherBackoff()
                }
            }
            handler.postDelayed(noWeatherCheckRunnable!!, 3_000L) // Give 3s for response before checking
        }
        handler.postDelayed(noWeatherRunnable!!, delayMs)
    }

    private fun cancelAllTimers() {
        preExpiryRunnable?.let { handler.removeCallbacks(it) }
        preExpiryRunnable = null
        noWeatherRunnable?.let { handler.removeCallbacks(it) }
        noWeatherRunnable = null
        noWeatherCheckRunnable?.let { handler.removeCallbacks(it) }
        noWeatherCheckRunnable = null
    }

    private fun requestSnapshot() {
        val now = System.currentTimeMillis()
        if (now - lastSnapshotRequestMs < SNAPSHOT_COOLDOWN_MS) {
            if (BuildConfig.DEBUG) Log.d(TAG, "Snapshot request throttled (cooldown)")
            return
        }
        lastSnapshotRequestMs = now

        val app = getApplication<Application>()
        executor.execute {
            try {
                val nodes = Tasks.await(Wearable.getNodeClient(app).connectedNodes)
                nodes.forEach { node ->
                    Wearable.getMessageClient(app)
                        .sendMessage(node.id, WatchSyncPaths.REQUEST_SNAPSHOT, ByteArray(0))
                }
                if (BuildConfig.DEBUG) Log.d(TAG, "Requested snapshot from ${nodes.size} nodes")
            } catch (e: Exception) {
                Log.w(TAG, "Snapshot request failed: ${e.message}")
            }
        }
    }
}
