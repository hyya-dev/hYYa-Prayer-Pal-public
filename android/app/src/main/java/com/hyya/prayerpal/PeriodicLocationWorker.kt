package com.hyya.prayerpal.open

import android.content.Context
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

class PeriodicLocationWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    companion object {
        private const val TAG = "PeriodicLocationWorker"
        private const val WORK_NAME = "periodic_location_check"
        
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            
            val workRequest = PeriodicWorkRequestBuilder<PeriodicLocationWorker>(
                60, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setInitialDelay(60, TimeUnit.MINUTES)
                .build()
            
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    workRequest
                )
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Periodic location check scheduled (every 60 minutes)")
        }
        
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            if (BuildConfig.DEBUG) Log.d(TAG, "Periodic location check cancelled")
        }
    }
    
    override suspend fun doWork(): Result {
        if (BuildConfig.DEBUG) Log.d(TAG, "Periodic location check running")
        
        try {
            val prefs = applicationContext.getSharedPreferences(
                LocationRefreshWorker.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            
            prefs.edit()
                .putBoolean(LocationRefreshWorker.NEEDS_REFRESH_KEY, true)
                .putLong(LocationRefreshWorker.LAST_REFRESH_KEY, System.currentTimeMillis())
                .apply()
            
            PrayerWidgetProvider.updateAllWidgets(applicationContext)
            PrayerAlarmScheduler.rescheduleAllAlarmsFromStorage(applicationContext)
            WatchDataSyncManager.syncLastKnown(applicationContext)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Periodic check complete - location refresh flag set")
            
            return Result.success()
            
        } catch (e: Exception) {
            Log.e(TAG, "Periodic location check failed: ${e.message}", e)
            return Result.retry()
        }
    }
}
