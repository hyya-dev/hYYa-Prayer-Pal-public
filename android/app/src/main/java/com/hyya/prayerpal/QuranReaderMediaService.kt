package com.hyya.prayerpal.open

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ResultReceiver
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Foreground playback for Holy Quran reader native audio (Tier C): MediaPlayer + MediaSession +
 * ongoing notification so decoding continues reliably when the app is backgrounded.
 */
class QuranReaderMediaService : Service() {

    companion object {
        const val ACTION_PLAY = "com.hyya.prayerpal.open.quran.READER_PLAY"
        const val ACTION_PAUSE = "com.hyya.prayerpal.open.quran.READER_PAUSE"
        const val ACTION_RESUME = "com.hyya.prayerpal.open.quran.READER_RESUME"
        const val ACTION_STOP = "com.hyya.prayerpal.open.quran.READER_STOP"

        const val EXTRA_URL = "url"
        const val EXTRA_START_FRACTION = "startFraction"
        const val EXTRA_RESULT_RECEIVER = "resultReceiver"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_REMOTE_SURAH_COMMANDS = "remoteSurahCommands"
        /** When true, stop originated from JS/plugin — do not emit system-abort to the WebView. */
        const val EXTRA_FROM_PLUGIN = "fromPlugin"

        const val RESULT_PREPARED = 10
        const val RESULT_PREPARE_FAILED = 11
        const val RESULT_ENDED = 1
        const val RESULT_ERROR = 2

        // v2: One UI can suppress LOW-importance lock-screen media for some devices;
        // bumping the channel id ensures updated importance/lock-screen behavior applies
        // even if users already had v1 created with device-specific overrides.
        private const val CHANNEL_ID = "quran_reader_playback_v2"
        private const val NOTIFICATION_ID = 71041
        private const val TAG = "QuranReaderMediaSvc"

        /** Cadence for the JS playback-tick stream that drives verse highlighting. */
        private const val TICK_INTERVAL_MS: Long = 200
        private const val SEEK_INTERVAL_MS: Int = 15_000
    }

    private var mediaPlayer: MediaPlayer? = null
    private var resultReceiver: ResultReceiver? = null
    private var mediaSession: MediaSessionCompat? = null
    private var artworkBitmap: Bitmap? = null
    private var activeSessionId = 0L
    private var pendingTitle: String = ""
    private var pendingArtist: String = ""
    @Volatile private var isForeground = false
    private var remoteSurahCommandsEnabled: Boolean = false

    // Periodic playback-position poll. AVPlayer offers addPeriodicTimeObserver out of the
    // box; MediaPlayer does not, so we emulate it with a Handler tick. 200 ms keeps the
    // verse highlighter visually in lockstep with audio without flooding the JS bridge.
    private val tickHandler = Handler(Looper.getMainLooper())
    private val tickRunnable = object : Runnable {
        override fun run() {
            val mp = mediaPlayer
            if (mp == null) {
                return
            }
            try {
                if (mp.isPlaying) {
                    val curMs = mp.currentPosition
                    val durMs = mp.duration
                    QuranReaderNativeAudioPlugin.notifyPlaybackTick(
                        curMs / 1000.0,
                        if (durMs > 0) durMs / 1000.0 else 0.0,
                    )
                }
            } catch (_: Exception) {
                // MediaPlayer in transient state; skip this tick.
            }
            tickHandler.postDelayed(this, TICK_INTERVAL_MS)
        }
    }

    private fun startPlaybackTicks() {
        tickHandler.removeCallbacks(tickRunnable)
        tickHandler.post(tickRunnable)
    }

    private fun stopPlaybackTicks() {
        tickHandler.removeCallbacks(tickRunnable)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onDestroy() {
        releaseAll(sendEnded = false, fromPlugin = true)
        super.onDestroy()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        when (intent.action) {
            ACTION_PLAY -> handlePlay(intent)
            ACTION_PAUSE -> handlePauseFromPlugin()
            ACTION_RESUME -> handleResumeFromPlugin()
            ACTION_STOP ->
                handleStop(
                    intent.getBooleanExtra(EXTRA_FROM_PLUGIN, /* assume user/system if missing */ false),
                )
            else -> handleStop(fromPlugin = true)
        }
        return START_NOT_STICKY
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.channel_quran_reader_media_name),
            // DEFAULT is still non-intrusive (no heads-up) but is reliably eligible
            // for lock-screen display on Samsung One UI.
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = getString(R.string.channel_quran_reader_media_desc)
            setShowBadge(false)
        }
        nm.createNotificationChannel(ch)
    }

    private fun mainPendingIntent(): PendingIntent {
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        } ?: Intent(this, MainActivity::class.java)
        val mut = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(this, 0, launch, mut)
    }

    private fun servicePendingIntent(action: String, requestCode: Int): PendingIntent {
        val i = Intent(this, QuranReaderMediaService::class.java).apply { this.action = action }
        val mut = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getService(this, requestCode, i, mut)
    }

    /** Stop from notification / MediaSession (not from Capacitor); JS should treat like full stop. */
    private fun userStopServicePendingIntent(): PendingIntent {
        val i = Intent(this, QuranReaderMediaService::class.java).apply {
            action = ACTION_STOP
            putExtra(EXTRA_FROM_PLUGIN, false)
        }
        val mut = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getService(this, 71043, i, mut)
    }

    /**
     * Pause/Resume tap from the lock-screen notification action button. Both
     * intents go through the same service pipeline (`handlePauseFromPlugin` /
     * `handleResumeFromPlugin`) which already mirrors the resulting state back
     * to JS via the plugin's listeners — no separate JS path required.
     */
    private fun playPauseAction(playing: Boolean): NotificationCompat.Action {
        return if (playing) {
            NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_pause,
                getString(R.string.quran_reader_notification_pause),
                servicePendingIntent(ACTION_PAUSE, 71044),
            ).build()
        } else {
            NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_play,
                getString(R.string.quran_reader_notification_play),
                servicePendingIntent(ACTION_RESUME, 71045),
            ).build()
        }
    }

    private fun loadArtworkBitmap(): Bitmap? {
        val cached = artworkBitmap
        if (cached != null && !cached.isRecycled) return cached
        return try {
            val bmp = BitmapFactory.decodeResource(resources, R.drawable.quran_reader_artwork)
            artworkBitmap = bmp
            bmp
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.w(TAG, "artwork decode failed: ${e.message}")
            null
        }
    }

    private fun buildNotification(playing: Boolean): Notification {
        val stopAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_close_clear_cancel,
            getString(R.string.quran_reader_notification_stop),
            userStopServicePendingIntent(),
        ).build()

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_prayer_notification)
            .setContentTitle(
                pendingTitle.ifBlank { getString(R.string.quran_reader_notification_title) },
            )
            .setContentText(pendingArtist.ifBlank { "" })
            .setContentIntent(mainPendingIntent())
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            // Ask the system to surface the foreground service immediately when started.
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            // Always ongoing while the foreground service is alive: a non-ongoing
            // media notification is dismissable by Samsung's lock-screen swipe and
            // some skins de-prioritise non-ongoing entries on the lock-screen tile.
            // The user still has an explicit Stop action below.
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Action order matters: index 0 = play/pause (primary), index 1 = stop.
            // `setShowActionsInCompactView(0, 1)` below tells MediaStyle to surface
            // both as buttons on the lock-screen tile / Output Switcher panel.
            .addAction(playPauseAction(playing))
            .addAction(stopAction)

        loadArtworkBitmap()?.let { builder.setLargeIcon(it) }

        val token = mediaSession?.sessionToken
        if (token != null) {
            builder.setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(token)
                    .setShowActionsInCompactView(0, 1),
            )
        }
        return builder.build()
    }

    private fun startAsForeground(playing: Boolean) {
        val n = buildNotification(playing)
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            } else {
                0
            }
            ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type)
            isForeground = true
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed", e)
            QuranReaderNativeAudioPlugin.notifyNativeAudioError(
                "startForeground: ${e.javaClass.simpleName}: ${e.message}",
            )
        }
    }

    private fun updateForeground(playing: Boolean) {
        if (!isForeground) {
            startAsForeground(playing)
            return
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(playing))
    }

    private fun stopForegroundCompat() {
        if (!isForeground) return
        stopForeground(STOP_FOREGROUND_REMOVE)
        isForeground = false
    }

    private fun handlePlay(intent: Intent) {
        activeSessionId++
        val mySession = activeSessionId

        val url = intent.getStringExtra(EXTRA_URL) ?: run {
            sendPrepareFailed("missing_url")
            stopSelfIfIdle()
            return
        }
        val startFraction = intent.getDoubleExtra(EXTRA_START_FRACTION, -1.0)
        pendingTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        pendingArtist = intent.getStringExtra(EXTRA_ARTIST) ?: ""
        remoteSurahCommandsEnabled = intent.getBooleanExtra(EXTRA_REMOTE_SURAH_COMMANDS, false)
        resultReceiver = intent.getParcelableExtraCompat(EXTRA_RESULT_RECEIVER)

        releasePlayerOnly()
        initOrResetSession()

        startAsForeground(playing = true)

        try {
            val mp = MediaPlayer()
            mediaPlayer = mp
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            mp.setDataSource(applicationContext, Uri.parse(url))
            mp.setOnPreparedListener { player ->
                if (mySession != activeSessionId) return@setOnPreparedListener
                try {
                    if (startFraction in 0.0..1.0) {
                        val d = player.duration
                        if (d > 0) {
                            val pos = (startFraction * d).toInt().coerceIn(0, (d - 250).coerceAtLeast(0))
                            player.seekTo(pos)
                        }
                    }
                    player.start()
                    // Replace the -1 placeholder DURATION with the real value so
                    // Samsung's lock-screen tile can render the progress bar.
                    val durMs = player.duration
                    if (durMs > 0) {
                        val art = loadArtworkBitmap()
                        val metaBuilder = MediaMetadataCompat.Builder()
                            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, pendingTitle)
                            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, pendingArtist)
                            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durMs.toLong())
                        if (art != null) {
                            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art)
                            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, art)
                        }
                        mediaSession?.setMetadata(metaBuilder.build())
                    }
                    updateSessionPlaying(true)
                    updateForeground(playing = true)
                    startPlaybackTicks()
                    resultReceiver?.send(RESULT_PREPARED, null)
                } catch (e: Exception) {
                    sendPrepareFailed(e.message ?: "prepare")
                    releaseAll(sendEnded = false, fromPlugin = true)
                }
            }
            mp.setOnCompletionListener {
                if (mySession != activeSessionId) return@setOnCompletionListener
                stopPlaybackTicks()
                resultReceiver?.send(RESULT_ENDED, null)
                releaseAll(sendEnded = false, fromPlugin = true)
            }
            mp.setOnErrorListener { _, what, extra ->
                if (mySession != activeSessionId) return@setOnErrorListener true
                stopPlaybackTicks()
                val msg = "what=$what extra=$extra"
                resultReceiver?.send(RESULT_ERROR, Bundle().apply { putString("message", msg) })
                releaseAll(sendEnded = false, fromPlugin = true)
                true
            }
            mp.prepareAsync()
        } catch (e: Exception) {
            Log.e(TAG, "handlePlay failed", e)
            sendPrepareFailed(e.message ?: "play")
            releaseAll(sendEnded = false, fromPlugin = true)
        }
    }

    private fun sendPrepareFailed(message: String) {
        resultReceiver?.send(
            RESULT_PREPARE_FAILED,
            Bundle().apply { putString("message", message) },
        )
    }

    private fun handleStop(fromPlugin: Boolean) {
        releaseAll(sendEnded = false, fromPlugin = fromPlugin)
    }

    /** JS asked us to pause. Do not notify JS of the state change (JS already knows). */
    private fun handlePauseFromPlugin() {
        val mp = mediaPlayer ?: return
        try {
            if (mp.isPlaying) {
                mp.pause()
            }
            stopPlaybackTicks()
            updateSessionPlaying(false)
            updateForeground(playing = false)
        } catch (e: Exception) {
            Log.w(TAG, "pause: ${e.message}", e)
            QuranReaderNativeAudioPlugin.notifyNativeAudioError("pause: ${e.message ?: "unknown"}")
        }
    }

    /** JS asked us to resume. Do not notify JS of the state change (JS already knows). */
    private fun handleResumeFromPlugin() {
        val mp = mediaPlayer ?: return
        try {
            mp.start()
            updateSessionPlaying(true)
            updateForeground(playing = true)
            startPlaybackTicks()
        } catch (e: Exception) {
            Log.w(TAG, "resume: ${e.message}", e)
            QuranReaderNativeAudioPlugin.notifyNativeAudioError("resume: ${e.message ?: "unknown"}")
        }
    }

    private fun handleRemotePreviousSurahOrRestartSeek() {
        val mp = mediaPlayer ?: return
        val pos = mp.currentPosition
        if (pos > 3000) {
            mp.seekTo(0)
            updateSessionPlaying(true)
        } else {
            QuranReaderNativeAudioPlugin.notifySurahStep(-1)
        }
    }

    private fun handleRemoteNextSurah() {
        QuranReaderNativeAudioPlugin.notifySurahStep(1)
    }

    private fun seekBy(deltaMs: Int) {
        val mp = mediaPlayer ?: return
        try {
            val dur = mp.duration
            val cur = mp.currentPosition
            val target =
                if (dur > 0) {
                    (cur + deltaMs).coerceIn(0, (dur - 250).coerceAtLeast(0))
                } else {
                    (cur + deltaMs).coerceAtLeast(0)
                }
            mp.seekTo(target)
            updateSessionPlaying(mp.isPlaying)
        } catch (_: Exception) {
            // Ignore transient MediaPlayer state.
        }
    }

    private fun releasePlayerOnly() {
        try {
            mediaPlayer?.setOnCompletionListener(null)
            mediaPlayer?.setOnPreparedListener(null)
            mediaPlayer?.setOnErrorListener(null)
            mediaPlayer?.reset()
            mediaPlayer?.release()
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.w(TAG, "releasePlayerOnly: ${e.message}")
        } finally {
            mediaPlayer = null
        }
    }

    private fun initOrResetSession() {
        try {
            if (mediaSession == null) {
                mediaSession = MediaSessionCompat(this, "QuranReader").apply {
                    setFlags(
                        MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
                    )
                    setCallback(
                        object : MediaSessionCompat.Callback() {
                            override fun onPlay() {
                                try {
                                    mediaPlayer?.start()
                                    updateSessionPlaying(true)
                                    updateForeground(playing = true)
                                    startPlaybackTicks()
                                    QuranReaderNativeAudioPlugin.notifyResumed()
                                } catch (_: Exception) {
                                }
                            }

                            override fun onPause() {
                                try {
                                    mediaPlayer?.pause()
                                    stopPlaybackTicks()
                                    updateSessionPlaying(false)
                                    updateForeground(playing = false)
                                    QuranReaderNativeAudioPlugin.notifyPaused()
                                } catch (_: Exception) {
                                }
                            }

                            override fun onSkipToPrevious() {
                                if (remoteSurahCommandsEnabled) {
                                    handleRemotePreviousSurahOrRestartSeek()
                                } else {
                                    seekBy(-SEEK_INTERVAL_MS)
                                }
                            }

                            override fun onSkipToNext() {
                                if (remoteSurahCommandsEnabled) {
                                    handleRemoteNextSurah()
                                } else {
                                    seekBy(SEEK_INTERVAL_MS)
                                }
                            }

                            override fun onRewind() {
                                seekBy(-SEEK_INTERVAL_MS)
                            }

                            override fun onFastForward() {
                                seekBy(SEEK_INTERVAL_MS)
                            }

                            override fun onSeekTo(pos: Long) {
                                val mp = mediaPlayer ?: return
                                try {
                                    val dur = mp.duration
                                    val target =
                                        if (dur > 0) {
                                            pos.toInt().coerceIn(0, (dur - 250).coerceAtLeast(0))
                                        } else {
                                            pos.toInt().coerceAtLeast(0)
                                        }
                                    mp.seekTo(target)
                                    updateSessionPlaying(mp.isPlaying)
                                    updateForeground(playing = mp.isPlaying)
                                } catch (_: Exception) {
                                    // Ignore transient MediaPlayer state.
                                }
                            }

                            override fun onStop() {
                                handleStop(fromPlugin = false)
                            }
                        },
                    )
                }
            }
            mediaSession?.isActive = true
            val art = loadArtworkBitmap()
            val metaBuilder = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, pendingTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, pendingArtist)
                // Samsung One UI 7 (Android 15) hides the lock-screen Now Playing
                // tile for sessions whose metadata has no DURATION key. -1L is the
                // standard "unknown / live" placeholder; we overwrite it with the
                // real duration in the OnPreparedListener below.
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1L)
            if (art != null) {
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art)
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, art)
            }
            mediaSession?.setMetadata(metaBuilder.build())
            // Initial playback state must NOT be STATE_STOPPED — that's a terminal
            // state, and Samsung One UI / some other Android skins refuse to render
            // a lock-screen tile for a STOPPED session, so the tile never appears
            // even after the session later transitions to STATE_PLAYING. We start
            // in BUFFERING (the canonical "preparing to play" state) so the tile
            // is registered immediately, then flip to PLAYING in OnPreparedListener.
            mediaSession?.setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_BUFFERING, 0L, 1f)
                    .setActions(
                        PlaybackStateCompat.ACTION_PLAY or
                            PlaybackStateCompat.ACTION_PAUSE or
                            PlaybackStateCompat.ACTION_STOP,
                    )
                    .build(),
            )
        } catch (e: Exception) {
            Log.w(TAG, "initOrResetSession: ${e.message}", e)
            QuranReaderNativeAudioPlugin.notifyNativeAudioError(
                "initOrResetSession: ${e.javaClass.simpleName}: ${e.message}",
            )
        }
    }

    private fun updateSessionPlaying(playing: Boolean) {
        val mp = mediaPlayer
        val positionMs = mp?.currentPosition?.toLong() ?: 0L
        val state =
            when {
                playing && mp?.isPlaying == true -> PlaybackStateCompat.STATE_PLAYING
                mp != null -> PlaybackStateCompat.STATE_PAUSED
                else -> PlaybackStateCompat.STATE_STOPPED
            }
        var actions =
            PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE
        // Rewind / fast-forward map to ±15s seek. Quran Audio (Library) also exposes
        // skip-to-previous/next when `remoteSurahCommands` is true (surah navigation).
        if (mp != null) {
            actions =
                actions or
                    PlaybackStateCompat.ACTION_REWIND or
                    PlaybackStateCompat.ACTION_FAST_FORWARD or
                    PlaybackStateCompat.ACTION_SEEK_TO
            if (remoteSurahCommandsEnabled) {
                actions =
                    actions or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            }
        }
        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(state, positionMs, 1f)
                .setActions(actions)
                .build(),
        )
    }

    private fun releaseAll(sendEnded: Boolean, fromPlugin: Boolean) {
        if (sendEnded) {
            resultReceiver?.send(RESULT_ENDED, null)
        }
        stopPlaybackTicks()
        releasePlayerOnly()
        try {
            mediaSession?.setCallback(null)
            mediaSession?.isActive = false
            mediaSession?.release()
        } catch (_: Exception) {
        } finally {
            mediaSession = null
        }
        resultReceiver = null
        stopForegroundCompat()
        stopSelf()
        if (!fromPlugin) {
            QuranReaderNativeAudioPlugin.notifySystemPlaybackAborted()
        }
    }

    private fun stopSelfIfIdle() {
        if (mediaPlayer == null) {
            stopForegroundCompat()
            stopSelf()
        }
    }
}

@Suppress("DEPRECATION")
private fun Intent.getParcelableExtraCompat(key: String): ResultReceiver? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(key, ResultReceiver::class.java)
    } else {
        getParcelableExtra(key)
    }
