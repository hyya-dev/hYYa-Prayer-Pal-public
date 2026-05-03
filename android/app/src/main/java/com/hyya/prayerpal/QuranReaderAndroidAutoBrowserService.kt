package com.hyya.prayerpal.open

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
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
 * Cars media guidelines require an initialized [PlaybackStateCompat] and [MediaMetadataCompat]
 * on this service’s session (same token Auto binds to); otherwise Now Playing can stick on
 * “Getting your selection…”. When playback cannot run on the head unit, we follow
 * [Android for Cars — errors](https://developer.android.com/training/cars/media/errors)
 * ([`STATE_ERROR`][PlaybackStateCompat.STATE_ERROR] + user-facing message).
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

        /**
         * Required for Android Auto / AAOS transport surfaces per
         * [Enable playback controls](https://developer.android.com/training/cars/media/enable-playback).
         */
        private val REQUIRED_CAR_ACTIONS: Long =
            PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
    }

    private var mediaSession: MediaSessionCompat? = null

    private fun applyBrowseRootMetadata() {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, getString(R.string.app_name))
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, getString(R.string.android_auto_open_app_subtitle))
                .build(),
        )
    }

    private fun applyQuranAudioItemMetadata() {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, getString(R.string.android_auto_open_app_title))
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, getString(R.string.android_auto_open_app_subtitle))
                .build(),
        )
    }

    private fun setStoppedCarPlaybackStateOnly() {
        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(PlaybackStateCompat.STATE_STOPPED, 0L, 0f)
                .setActions(REQUIRED_CAR_ACTIONS)
                .build(),
        )
    }

    /** Initial / idle: [PlaybackStateCompat.STATE_STOPPED] — do not auto-play on connect (cars media). */
    private fun syncSessionStoppedIdle() {
        applyBrowseRootMetadata()
        setStoppedCarPlaybackStateOnly()
    }

    /** In-car stream is not used; user must finish setup on the phone ([cars/media/errors](https://developer.android.com/training/cars/media/errors)). */
    private fun syncSessionPhoneRequiredError() {
        applyQuranAudioItemMetadata()
        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(PlaybackStateCompat.STATE_ERROR, 0L, 0f)
                .setErrorMessage(
                    PlaybackStateCompat.ERROR_CODE_UNKNOWN_ERROR,
                    getString(R.string.android_auto_error_playback_on_phone),
                )
                .setActions(REQUIRED_CAR_ACTIONS)
                .build(),
        )
    }

    private fun launchMainFromAuto() {
        val launch =
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        try {
            startActivity(launch)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch MainActivity from Android Auto", e)
        }
    }

    override fun onCreate() {
        super.onCreate()
        mediaSession =
            MediaSessionCompat(this, "PrayerPalAndroidAuto").apply {
                setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
                )
                setCallback(
                    object : MediaSessionCompat.Callback() {
                        override fun onPrepareFromMediaId(mediaId: String?, extras: Bundle?) {
                            if (mediaId != MEDIA_ID_OPEN_APP_QURAN_AUDIO) {
                                return
                            }
                            applyQuranAudioItemMetadata()
                            setStoppedCarPlaybackStateOnly()
                        }

                        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
                            if (mediaId != MEDIA_ID_OPEN_APP_QURAN_AUDIO) {
                                return
                            }
                            applyQuranAudioItemMetadata()
                            launchMainFromAuto()
                            syncSessionPhoneRequiredError()
                        }

                        override fun onPlay() {
                            launchMainFromAuto()
                            syncSessionPhoneRequiredError()
                        }

                        override fun onPlayFromSearch(query: String?, extras: Bundle?) {
                            syncSessionStoppedIdle()
                        }

                        override fun onStop() {
                            syncSessionStoppedIdle()
                        }
                    },
                )
                isActive = true
            }
        syncSessionStoppedIdle()
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
