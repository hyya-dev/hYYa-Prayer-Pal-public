package com.hyya.prayerpal.open

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

class PrayerAlarmReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "PrayerAlarmReceiver"
        
        private const val CHANNEL_VERSION = "v2"
        private const val CHANNEL_DISCREET = "prayer_discreet_$CHANNEL_VERSION"
        private const val CHANNEL_TAKBIR = "prayer_takbir_$CHANNEL_VERSION"
        private const val CHANNEL_SILENT = "prayer_silent_$CHANNEL_VERSION"
        
        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // Audio attributes: Use USAGE_ALARM to match notification's CATEGORY_ALARM
            // This ensures consistent audio behavior and proper sound routing
            val alarmAudioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            
            val discreetSoundUri = Uri.parse("android.resource://${context.packageName}/raw/rebound")
            val discreetChannelName = context.getString(R.string.channel_discreet_name_short)

            val discreetChannel = NotificationChannel(
                CHANNEL_DISCREET,
                discreetChannelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.channel_discreet_desc)
                setSound(discreetSoundUri, alarmAudioAttributes)
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(discreetChannel)
            
            val takbirSoundUri = Uri.parse("android.resource://${context.packageName}/raw/takbir")
            val takbirChannelName = context.getString(R.string.channel_takbir_name)
            val takbirChannel = NotificationChannel(
                CHANNEL_TAKBIR,
                takbirChannelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.channel_takbir_desc)
                setSound(takbirSoundUri, alarmAudioAttributes)
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(takbirChannel)
            
            // Silent channel: when user turns sound off, notifications use this (no audio)
            val silentChannelName = context.getString(R.string.channel_silent_name)
            val silentChannel = NotificationChannel(
                CHANNEL_SILENT,
                silentChannelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.channel_silent_desc)
                setSound(null, null)
                enableVibration(false)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(silentChannel)
            
            if (BuildConfig.DEBUG) Log.d(TAG, "Notification channels created")
        }
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "com.hyya.prayerpal.open.PRAYER_ALARM") return
        
        // CRITICAL: Ensure notification channels exist before posting any notification
        // Channels may not exist if app was never opened after install/update
        createNotificationChannels(context)
        
        val alarmId = intent.getIntExtra("alarm_id", 0)
        val prayerName = intent.getStringExtra("prayer_name") ?: "prayer"
        val displayName = intent.getStringExtra("display_name") ?: "Prayer"
        val isBefore = intent.getBooleanExtra("is_before", false)
        val minutesBefore = intent.getIntExtra("minutes_before", 0)
        val soundType = intent.getStringExtra("sound_type") ?: "discreet"
        val notificationTitle = intent.getStringExtra("notification_title")
        val notificationBody = intent.getStringExtra("notification_body")
        
        if (BuildConfig.DEBUG) Log.d(TAG, "Alarm received: $displayName (id=$alarmId, isBefore=$isBefore)")
        
        showNotification(context, alarmId, displayName, isBefore, minutesBefore, soundType, notificationTitle, notificationBody)
    }
    
    private fun showNotification(
        context: Context,
        notificationId: Int,
        displayName: String,
        isBefore: Boolean,
        minutesBefore: Int,
        soundType: String,
        notificationTitle: String? = null,
        notificationBody: String? = null
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        val title: String
        val body: String
        val channelId: String
        
        if (isBefore) {
            // Use localized title/body from JS if available, else Android string resource
            title = notificationTitle ?: context.getString(R.string.notification_prayer_soon_title, displayName)
            body = notificationBody ?: context.getString(R.string.notification_prayer_soon_body, displayName, minutesBefore)
            channelId = if (soundType == "silent") CHANNEL_SILENT else CHANNEL_DISCREET
        } else {
            title = notificationTitle ?: context.getString(R.string.notification_prayer_time_title, displayName)
            body = notificationBody ?: context.getString(R.string.notification_prayer_time_body, displayName)
            channelId = when (soundType) {
                "takbir" -> CHANNEL_TAKBIR
                "silent" -> CHANNEL_SILENT
                else -> CHANNEL_DISCREET
            }
        }
        
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_prayer_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        
        try {
            notificationManager.notify(notificationId, notification)
            if (BuildConfig.DEBUG) Log.d(TAG, "Notification shown: $title")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException showing notification: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error showing notification: ${e.message}", e)
        }
    }
}
