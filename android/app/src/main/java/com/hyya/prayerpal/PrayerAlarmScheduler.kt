package com.hyya.prayerpal.open

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.util.*

object PrayerAlarmScheduler {
    
    private const val TAG = "PrayerAlarmScheduler"
    private const val PREFS_NAME = "PrayerPalAlarmPrefs"
    private const val SCHEDULED_ALARMS_KEY = "scheduled_alarms"
    private const val ALARM_DATA_KEY = "alarm_data"  // Stores complete alarm data for rescheduling
    
    private const val NOTIFICATION_ID_BASE_AT = 1000
    private const val NOTIFICATION_ID_BASE_BEFORE = 2000
    
    private val PRAYER_INDEX = mapOf(
        "fajr" to 0,
        "shurooq" to 1,
        "dhuhr" to 2,
        "asr" to 3,
        "maghrib" to 4,
        "isha" to 5
    )
    
    data class PrayerAlarm(
        val id: Int,
        val prayerName: String,
        val displayName: String,
        val timeMillis: Long,
        val isBefore: Boolean,
        val minutesBefore: Int = 0,
        val soundType: String = "discreet",
        val notificationTitle: String? = null,
        val notificationBody: String? = null
    )
    
    fun scheduleAlarm(context: Context, alarm: PrayerAlarm): Boolean {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager not available")
            return false
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "Cannot schedule exact alarms - permission not granted")
                return scheduleInexactAlarm(context, alarmManager, alarm)
            }
        }
        
        try {
            val intent = Intent(context, PrayerAlarmReceiver::class.java).apply {
                action = "com.hyya.prayerpal.open.PRAYER_ALARM"
                putExtra("alarm_id", alarm.id)
                putExtra("prayer_name", alarm.prayerName)
                putExtra("display_name", alarm.displayName)
                putExtra("is_before", alarm.isBefore)
                putExtra("minutes_before", alarm.minutesBefore)
                putExtra("sound_type", alarm.soundType)
                alarm.notificationTitle?.let { putExtra("notification_title", it) }
                alarm.notificationBody?.let { putExtra("notification_body", it) }
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarm.id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val showIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val showPendingIntent = PendingIntent.getActivity(
                context,
                alarm.id + 100000,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val alarmClockInfo = AlarmManager.AlarmClockInfo(
                alarm.timeMillis,
                showPendingIntent
            )
            
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Scheduled alarm: ${alarm.displayName} at ${Date(alarm.timeMillis)}")
            return true
            
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException scheduling alarm: ${e.message}")
            return scheduleInexactAlarm(context, alarmManager, alarm)
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm: ${e.message}", e)
            return false
        }
    }
    
    private fun scheduleInexactAlarm(
        context: Context,
        alarmManager: AlarmManager,
        alarm: PrayerAlarm
    ): Boolean {
        return try {
            val intent = Intent(context, PrayerAlarmReceiver::class.java).apply {
                action = "com.hyya.prayerpal.open.PRAYER_ALARM"
                putExtra("alarm_id", alarm.id)
                putExtra("prayer_name", alarm.prayerName)
                putExtra("display_name", alarm.displayName)
                putExtra("is_before", alarm.isBefore)
                putExtra("minutes_before", alarm.minutesBefore)
                putExtra("sound_type", alarm.soundType)
                alarm.notificationTitle?.let { putExtra("notification_title", it) }
                alarm.notificationBody?.let { putExtra("notification_body", it) }
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarm.id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                alarm.timeMillis,
                pendingIntent
            )
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Scheduled inexact alarm: ${alarm.displayName} at ${Date(alarm.timeMillis)}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling inexact alarm: ${e.message}", e)
            false
        }
    }
    
    fun cancelAlarm(context: Context, alarmId: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return
        
        val intent = Intent(context, PrayerAlarmReceiver::class.java).apply {
            action = "com.hyya.prayerpal.open.PRAYER_ALARM"
        }
        
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        alarmManager.cancel(pendingIntent)
        if (BuildConfig.DEBUG) Log.d(TAG, "Cancelled alarm ID: $alarmId")
    }
    
    fun cancelAllAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val scheduledJson = prefs.getString(SCHEDULED_ALARMS_KEY, null)
        
        if (scheduledJson != null) {
            try {
                val json = JSONObject(scheduledJson)
                val alarmIds = json.optJSONArray("alarm_ids")
                
                if (alarmIds != null) {
                    for (i in 0 until alarmIds.length()) {
                        cancelAlarm(context, alarmIds.getInt(i))
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error cancelling alarms: ${e.message}")
            }
        }
        
        // Clear both the alarm IDs and the alarm data
        prefs.edit()
            .remove(SCHEDULED_ALARMS_KEY)
            .remove(ALARM_DATA_KEY)
            .apply()
        if (BuildConfig.DEBUG) Log.d(TAG, "Cancelled all alarms and cleared stored data")
    }
    
    fun scheduleAlarms(context: Context, alarms: List<PrayerAlarm>): Int {
        cancelAllAlarms(context)
        
        val scheduledIds = mutableListOf<Int>()
        val scheduledAlarms = mutableListOf<PrayerAlarm>()
        var successCount = 0
        
        for (alarm in alarms) {
            if (scheduleAlarm(context, alarm)) {
                scheduledIds.add(alarm.id)
                scheduledAlarms.add(alarm)
                successCount++
            }
        }
        
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Store alarm IDs for cancellation
        val idsJson = JSONObject().apply {
            put("alarm_ids", scheduledIds)
            put("scheduled_at", System.currentTimeMillis())
        }
        
        // Store complete alarm data for rescheduling after boot/update
        // This preserves the original UTC timestamps from JavaScript
        val alarmDataArray = org.json.JSONArray()
        for (alarm in scheduledAlarms) {
            val alarmJson = JSONObject().apply {
                put("id", alarm.id)
                put("prayerName", alarm.prayerName)
                put("displayName", alarm.displayName)
                put("timeMillis", alarm.timeMillis)  // Original UTC timestamp!
                put("isBefore", alarm.isBefore)
                put("minutesBefore", alarm.minutesBefore)
                put("soundType", alarm.soundType)
                alarm.notificationTitle?.let { put("notificationTitle", it) }
                alarm.notificationBody?.let { put("notificationBody", it) }
            }
            alarmDataArray.put(alarmJson)
        }
        
        prefs.edit()
            .putString(SCHEDULED_ALARMS_KEY, idsJson.toString())
            .putString(ALARM_DATA_KEY, alarmDataArray.toString())
            .apply()
        
        if (BuildConfig.DEBUG) Log.d(TAG, "Scheduled $successCount/${alarms.size} alarms (stored ${scheduledAlarms.size} for rescheduling)")
        return successCount
    }
    
    fun generateNotificationId(prayerName: String, isBefore: Boolean, date: Date): Int {
        val prayerIndex = PRAYER_INDEX[prayerName.lowercase()] ?: 0
        val calendar = Calendar.getInstance()
        calendar.time = date
        
        val startOfYear = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_YEAR, 1)
        }
        val dayOfYear = ((date.time - startOfYear.timeInMillis) / (1000 * 60 * 60 * 24)).toInt() + 1
        
        val base = if (isBefore) NOTIFICATION_ID_BASE_BEFORE else NOTIFICATION_ID_BASE_AT
        return base + (prayerIndex * 400) + dayOfYear
    }
    
    fun rescheduleAllAlarmsFromStorage(context: Context) {
        if (BuildConfig.DEBUG) Log.d(TAG, "Rescheduling alarms from storage...")
        
        val notificationPrefs = context.getSharedPreferences("PrayerPalNotificationPrefs", Context.MODE_PRIVATE)
        val masterEnabled = notificationPrefs.getBoolean("master_enabled", true)
        
        if (!masterEnabled) {
            if (BuildConfig.DEBUG) Log.d(TAG, "Notifications disabled - not rescheduling")
            return
        }
        
        // FIXED: Use stored alarm data with original UTC timestamps
        // instead of parsing widget time strings which may have formatting bugs
        val alarmPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarmDataJson = alarmPrefs.getString(ALARM_DATA_KEY, null)
        
        if (alarmDataJson != null) {
            // Use the reliable stored alarm data with UTC timestamps
            rescheduleFromAlarmData(context, alarmDataJson)
        } else {
            Log.w(TAG, "No alarm data found; skipping legacy widget-data reschedule to avoid incorrect alarm offsets")
        }
    }
    
    /**
     * Reschedule alarms using stored alarm data with original UTC timestamps
     * This is the reliable path that preserves correct times
     */
    private fun rescheduleFromAlarmData(context: Context, alarmDataJson: String) {
        try {
            val jsonArray = org.json.JSONArray(alarmDataJson)
            val alarms = mutableListOf<PrayerAlarm>()
            val now = System.currentTimeMillis()
            
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val timeMillis = obj.getLong("timeMillis")
                
                // Only reschedule future alarms
                if (timeMillis <= now) continue
                
                alarms.add(PrayerAlarm(
                    id = obj.getInt("id"),
                    prayerName = obj.getString("prayerName"),
                    displayName = obj.getString("displayName"),
                    timeMillis = timeMillis,  // Original UTC timestamp preserved!
                    isBefore = obj.getBoolean("isBefore"),
                    minutesBefore = obj.optInt("minutesBefore", 0),
                    soundType = obj.optString("soundType", "discreet"),
                    notificationTitle = obj.optString("notificationTitle", null),
                    notificationBody = obj.optString("notificationBody", null)
                ))
            }
            
            if (alarms.isNotEmpty()) {
                // Don't call scheduleAlarms() to avoid clearing the stored data
                // Just reschedule each alarm individually
                var successCount = 0
                for (alarm in alarms) {
                    if (scheduleAlarm(context, alarm)) {
                        successCount++
                    }
                }
                if (BuildConfig.DEBUG) Log.d(TAG, "Rescheduled $successCount/${alarms.size} alarms from stored data (UTC timestamps)")
            } else {
                if (BuildConfig.DEBUG) Log.d(TAG, "No future alarms to reschedule")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error rescheduling from alarm data: ${e.message}", e)
        }
    }
    
}
