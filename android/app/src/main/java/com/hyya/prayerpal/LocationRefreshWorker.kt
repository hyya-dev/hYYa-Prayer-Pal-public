package com.hyya.prayerpal.open

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class LocationRefreshWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    companion object {
        private const val TAG = "LocationRefreshWorker"
        const val PREFS_NAME = "PrayerPalLocationPrefs"
        const val NEEDS_REFRESH_KEY = "needs_location_refresh"
        const val LAST_REFRESH_KEY = "last_location_refresh_time"
        const val NETWORK_CHANGED_KEY = "network_changed_since_last_check"
    }
    
    override suspend fun doWork(): Result {
        if (BuildConfig.DEBUG) Log.d(TAG, "Location refresh work started")
        
        try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(NEEDS_REFRESH_KEY, true)
                .putBoolean(NETWORK_CHANGED_KEY, true)
                .putLong(LAST_REFRESH_KEY, System.currentTimeMillis())
                .apply()
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Location refresh flag set - will refresh on next app open")
            
            PrayerWidgetProvider.updateAllWidgets(applicationContext)
            WatchDataSyncManager.syncLastKnown(applicationContext)
            
            return Result.success()
            
        } catch (e: Exception) {
            Log.e(TAG, "Location refresh work failed: ${e.message}", e)
            return Result.failure()
        }
    }
}
