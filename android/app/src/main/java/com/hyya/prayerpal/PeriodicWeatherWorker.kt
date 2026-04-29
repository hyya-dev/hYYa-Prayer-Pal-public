package com.hyya.prayerpal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.android.gms.location.LocationServices
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Best-effort periodic weather refresh for widgets + Wear.
 * Never blocks prayer correctness: if location/network fails, just no-op.
 */
class PeriodicWeatherWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "PeriodicWeatherWorker"
        private const val WORK_NAME = "periodic_weather_refresh"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val workRequest = PeriodicWorkRequestBuilder<PeriodicWeatherWorker>(
                120, TimeUnit.MINUTES,
            )
                .setConstraints(constraints)
                .setInitialDelay(30, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    workRequest,
                )

            if (BuildConfig.DEBUG) Log.d(TAG, "Scheduled periodic weather refresh (every 120 minutes)")
        }
    }

    override suspend fun doWork(): Result {
        try {
            val ctx = applicationContext
            val hasFine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (!hasFine && !hasCoarse) {
                if (BuildConfig.DEBUG) Log.d(TAG, "Skipping weather refresh: no location permission")
                return Result.success()
            }

            val fused = LocationServices.getFusedLocationProviderClient(ctx)
            val loc = try {
                fused.lastLocation
                    .addOnFailureListener { e -> Log.w(TAG, "lastLocation failed: ${e.message}") }
                    .let { task -> com.google.android.gms.tasks.Tasks.await(task) }
            } catch (e: Exception) {
                Log.w(TAG, "Skipping weather refresh: lastLocation unavailable: ${e.message}")
                null
            } ?: return Result.success()

            val lat = loc.latitude
            val lon = loc.longitude

            val tempC = fetchCurrentTemperatureC(lat, lon) ?: return Result.success()
            val tempString = "${tempC}°C"

            val prefs = ctx.getSharedPreferences(PrayerWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(PrayerWidgetProvider.WEATHER_KEY, tempString)
                .putLong(PrayerWidgetProvider.WEATHER_TIME_KEY, System.currentTimeMillis())
                .apply()

            PrayerWidgetProvider.updateAllWidgets(ctx)
            WatchDataSyncManager.syncWeather(ctx, tempString)

            if (BuildConfig.DEBUG) Log.d(TAG, "Weather refreshed: $tempString")
            return Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Weather refresh failed (best-effort): ${e.message}")
            return Result.success()
        }
    }

    private fun fetchCurrentTemperatureC(lat: Double, lon: Double): Int? {
        val url = URL("https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m&temperature_unit=celsius")
        var conn: HttpURLConnection? = null
        return try {
            conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 10_000
                requestMethod = "GET"
            }
            val code = conn.responseCode
            if (code !in 200..299) return null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            val current = json.optJSONObject("current") ?: return null
            val temp = current.optDouble("temperature_2m", Double.NaN)
            if (temp.isNaN()) return null
            temp.toInt()
        } catch (e: Exception) {
            Log.w(TAG, "fetchCurrentTemperatureC failed: ${e.message}")
            null
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }
}

