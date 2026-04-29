package com.hyya.prayerpal.open

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == "com.htc.intent.action.QUICKBOOT_POWERON") {
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Device booted or app updated - rescheduling prayer alarms")
            
            try {
                // CRITICAL: Ensure notification channels exist before rescheduling alarms
                // After boot, channels may need to be recreated
                PrayerAlarmReceiver.createNotificationChannels(context)
                
                PrayerAlarmScheduler.rescheduleAllAlarmsFromStorage(context)
                PrayerWidgetProvider.updateAllWidgets(context)
                WatchDataSyncManager.syncLastKnown(context)
                if (BuildConfig.DEBUG) Log.d(TAG, "Successfully rescheduled alarms after boot")
            } catch (e: Exception) {
                Log.e(TAG, "Error rescheduling alarms after boot: ${e.message}", e)
            }
        }
    }
}
