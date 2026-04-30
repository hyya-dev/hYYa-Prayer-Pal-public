package com.hyya.prayerpal.open

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat

/**
 * Phase 5d — Android Auto **browse** entry point.
 *
 * Playback + lock-screen transport stay in [QuranReaderMediaService] (foreground +
 * MediaSession). AA still needs a [MediaBrowserServiceCompat] so the app can appear
 * in the Auto launcher with a minimal tree; selecting the item opens the phone app
 * (Library → Quran Audio is one tap from home).
 *
 * Full in-car reciter/surah browsing would require mirroring JS URL + state logic here
 * or a shared native catalog — intentionally out of scope for this surgical phase.
 */
class QuranReaderAndroidAutoBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "QuranReaderAA"
        private const val MEDIA_ROOT_ID = "__root__"
        /** Opens [MainActivity] (user continues in Library → Quran Audio). */
        const val MEDIA_ID_OPEN_APP_QURAN_AUDIO = "open_app_quran_audio"

        /** Keep tight: any package here is trusted to call [onGetRoot] for this app’s media browser. */
        private val ALLOWED_CLIENT_PACKAGES: Set<String> = setOf(
            "com.google.android.gms",
            "com.google.android.gms.car",
            "com.google.android.projection.gearhead",
            "com.google.android.gms.car.media",
            "com.hyya.prayerpal.open",
        )
    }

    private var mediaSession: MediaSessionCompat? = null

    override fun onCreate() {
        super.onCreate()
        mediaSession =
            MediaSessionCompat(this, "PrayerPalAndroidAuto").apply {
                setCallback(
                    object : MediaSessionCompat.Callback() {
                        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
                            if (mediaId == MEDIA_ID_OPEN_APP_QURAN_AUDIO) {
                                val launch =
                                    Intent(this@QuranReaderAndroidAutoBrowserService, MainActivity::class.java).apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                    }
                                try {
                                    startActivity(launch)
                                } catch (e: Exception) {
                                    Log.e(TAG, "Failed to launch MainActivity from Android Auto", e)
                                }
                            }
                        }
                    },
                )
                isActive = true
            }
        sessionToken = mediaSession!!.sessionToken
    }

    override fun onDestroy() {
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
        } catch (_: Exception) {
        } finally {
            mediaSession = null
        }
        super.onDestroy()
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?,
    ): BrowserRoot? {
        if (clientPackageName !in ALLOWED_CLIENT_PACKAGES) {
            Log.w(TAG, "onGetRoot rejected for package=$clientPackageName uid=$clientUid")
            return null
        }
        return BrowserRoot(MEDIA_ROOT_ID, null)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<List<MediaBrowserCompat.MediaItem>>,
    ) {
        if (parentId != MEDIA_ROOT_ID) {
            result.sendResult(emptyList())
            return
        }
        val desc =
            MediaDescriptionCompat.Builder()
                .setMediaId(MEDIA_ID_OPEN_APP_QURAN_AUDIO)
                .setTitle(getString(R.string.android_auto_open_app_title))
                .setSubtitle(getString(R.string.android_auto_open_app_subtitle))
                .build()
        val item =
            MediaBrowserCompat.MediaItem(
                desc,
                MediaBrowserCompat.MediaItem.FLAG_PLAYABLE,
            )
        result.sendResult(listOf(item))
    }
}
