package com.hyya.prayerpal.open

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Tier-C native decode for Holy Quran reader audio (sequential clips; JS drives the queue).
 * Playback runs in [QuranReaderMediaService] (foreground + MediaSession) for reliable background decode.
 */
@CapacitorPlugin(name = "QuranReaderNativeAudio")
class QuranReaderNativeAudioPlugin : Plugin() {

    companion object {
        private const val TAG = "QuranReaderNativeAudio"

        @Volatile private var instance: QuranReaderNativeAudioPlugin? = null

        @JvmStatic
        fun notifySystemPlaybackAborted() {
            val inst = instance ?: return
            Handler(Looper.getMainLooper()).post {
                inst.notifyListeners("aborted", JSObject())
            }
        }

        /** Lock-screen / headset: previous/next surah (handled in WebView). */
        @JvmStatic
        fun notifySurahStep(direction: Int) {
            val inst = instance ?: return
            Handler(Looper.getMainLooper()).post {
                inst.notifyListeners("surahStep", JSObject().put("direction", direction))
            }
        }

        /** Lock-screen / headset paused the playback; mirror state back to JS. */
        @JvmStatic
        fun notifyPaused() {
            val inst = instance ?: return
            Handler(Looper.getMainLooper()).post {
                inst.notifyListeners("paused", JSObject())
            }
        }

        /** Lock-screen / headset resumed the playback; mirror state back to JS. */
        @JvmStatic
        fun notifyResumed() {
            val inst = instance ?: return
            Handler(Looper.getMainLooper()).post {
                inst.notifyListeners("resumed", JSObject())
            }
        }

        /**
         * Periodic playback position update from the foreground media service.
         * Mirrors the iOS `addPeriodicTimeObserver` callback so the JS reader
         * can advance per-verse highlighting on Android.
         */
        @JvmStatic
        fun notifyPlaybackTick(currentTimeSeconds: Double, durationSeconds: Double) {
            val inst = instance ?: return
            Handler(Looper.getMainLooper()).post {
                inst.notifyListeners(
                    "playbackTick",
                    JSObject()
                        .put("currentTime", currentTimeSeconds)
                        .put("duration", durationSeconds),
                )
            }
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    override fun handleOnDestroy() {
        if (instance === this) {
            instance = null
        }
        super.handleOnDestroy()
    }

    @PluginMethod
    fun playOne(call: PluginCall) {
        val url = call.getString("url") ?: run {
            call.reject("invalid_url", "Missing url")
            return
        }
        val startFraction: Double =
            if (call.data.has("startFraction")) {
                call.getDouble("startFraction") ?: -1.0
            } else {
                -1.0
            }
        val title = call.getString("title") ?: ""
        val artist = call.getString("artist") ?: ""
        val remoteSurahCommands = call.getBoolean("remoteSurahCommands", false) ?: false

        val ctx = context ?: activity?.applicationContext ?: run {
            call.reject("no_context", "No context")
            return
        }

        val receiver =
            object : ResultReceiver(Handler(Looper.getMainLooper())) {
                override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
                    when (resultCode) {
                        QuranReaderMediaService.RESULT_PREPARED -> call.resolve()
                        QuranReaderMediaService.RESULT_PREPARE_FAILED -> {
                            val msg = resultData?.getString("message") ?: "prepare"
                            notifyListeners("error", JSObject().put("message", msg))
                            call.reject("play", msg)
                        }
                        QuranReaderMediaService.RESULT_ENDED ->
                            notifyListeners("ended", JSObject())
                        QuranReaderMediaService.RESULT_ERROR -> {
                            val msg = resultData?.getString("message") ?: "error"
                            notifyListeners("error", JSObject().put("message", msg))
                        }
                    }
                }
            }

        try {
            val i = Intent(ctx, QuranReaderMediaService::class.java).apply {
                action = QuranReaderMediaService.ACTION_PLAY
                putExtra(QuranReaderMediaService.EXTRA_URL, url)
                putExtra(QuranReaderMediaService.EXTRA_START_FRACTION, startFraction)
                putExtra(QuranReaderMediaService.EXTRA_TITLE, title)
                putExtra(QuranReaderMediaService.EXTRA_ARTIST, artist)
                putExtra(QuranReaderMediaService.EXTRA_REMOTE_SURAH_COMMANDS, remoteSurahCommands)
                putExtra(QuranReaderMediaService.EXTRA_RESULT_RECEIVER, receiver)
            }
            ContextCompat.startForegroundService(ctx, i)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "playOne start service failed", e)
            notifyListeners("error", JSObject().put("message", e.message ?: "playOne"))
            call.reject("playOne", e.message, e)
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        sendServiceAction(QuranReaderMediaService.ACTION_PAUSE, call)
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        sendServiceAction(QuranReaderMediaService.ACTION_RESUME, call)
    }

    private fun sendServiceAction(action: String, call: PluginCall) {
        val ctx = context ?: activity?.applicationContext
        if (ctx != null) {
            val i = Intent(ctx, QuranReaderMediaService::class.java).apply { this.action = action }
            try {
                ctx.startService(i)
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) Log.w(TAG, "$action service: ${e.message}")
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val ctx = context ?: activity?.applicationContext
        if (ctx != null) {
            val i = Intent(ctx, QuranReaderMediaService::class.java).apply {
                action = QuranReaderMediaService.ACTION_STOP
                putExtra(QuranReaderMediaService.EXTRA_FROM_PLUGIN, true)
            }
            try {
                ctx.startService(i)
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) Log.w(TAG, "stop service: ${e.message}")
            }
        }
        call.resolve()
    }
}
