package com.hyya.prayerpal

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Reschedules prayer alarms when exact-alarm permission state changes.
 *
 * Android guidance: listen for AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED
 * and reschedule required alarms when permission becomes available.
 */
class ExactAlarmPermissionReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "ExactAlarmPermReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED) return

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return

        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val canSchedule = alarmManager.canScheduleExactAlarms()
            if (BuildConfig.DEBUG) Log.d(TAG, "Exact alarm permission state changed. canSchedule=$canSchedule")

            // Only reschedule once exact alarms are allowed.
            if (!canSchedule) return

            // Ensure channels exist and restore alarms from stored payload.
            PrayerAlarmReceiver.createNotificationChannels(context)
            PrayerAlarmScheduler.rescheduleAllAlarmsFromStorage(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reschedule after exact-alarm permission change: ${e.message}", e)
        }
    }
}

