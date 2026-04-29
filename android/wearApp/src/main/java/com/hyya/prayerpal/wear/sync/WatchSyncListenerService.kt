package com.hyya.prayerpal.wear.sync

import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.CapabilityInfo
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.hyya.prayerpal.wear.BuildConfig
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

class WatchSyncListenerService : WearableListenerService() {
    companion object {
        private const val TAG = "WearSyncListener"
        /** Cooldown between snapshot requests to avoid spamming (matching Apple Watch 10s cooldown) */
        private const val SNAPSHOT_COOLDOWN_MS = 10_000L
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val lastSnapshotRequestMs = AtomicLong(0L)

    override fun onCreate() {
        super.onCreate()
        requestSnapshot()
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            if (event.type != DataEvent.TYPE_CHANGED) return@forEach
            val path = event.dataItem.uri.path ?: return@forEach
            if (!isSupportedPath(path)) return@forEach
            val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("json") ?: return@forEach
            WatchSyncStore.savePayload(applicationContext, path, json)
            if (BuildConfig.DEBUG) Log.d(TAG, "Data sync saved for path=$path")
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val path = messageEvent.path
        if (!isSupportedPath(path)) return
        val json = messageEvent.data.toString(Charsets.UTF_8)
        WatchSyncStore.savePayload(applicationContext, path, json)
        if (BuildConfig.DEBUG) Log.d(TAG, "Message sync saved for path=$path")
    }

    /**
     * Called when phone capability changes (connects/disconnects).
     * Matches Apple Watch's sessionReachabilityDidChange behaviour:
     * when phone becomes reachable, immediately request a fresh snapshot.
     */
    override fun onCapabilityChanged(capabilityInfo: CapabilityInfo) {
        super.onCapabilityChanged(capabilityInfo)
        if (capabilityInfo.nodes.any { it.isNearby }) {
            if (BuildConfig.DEBUG) Log.d(TAG, "Phone capability changed – nearby node available, requesting snapshot")
            requestSnapshot()
        }
    }

    private fun isSupportedPath(path: String): Boolean {
        return path == WatchSyncPaths.PRAYER || path == WatchSyncPaths.WEATHER || path == WatchSyncPaths.SETTINGS
    }

    private fun requestSnapshot() {
        val now = System.currentTimeMillis()
        val prev = lastSnapshotRequestMs.get()
        if (now - prev < SNAPSHOT_COOLDOWN_MS) {
            if (BuildConfig.DEBUG) Log.d(TAG, "Snapshot request throttled (cooldown)")
            return
        }
        if (!lastSnapshotRequestMs.compareAndSet(prev, now)) {
            if (BuildConfig.DEBUG) Log.d(TAG, "Snapshot request throttled (concurrent)")
            return
        }

        executor.execute {
            try {
                val nodes = Tasks.await(Wearable.getNodeClient(applicationContext).connectedNodes)
                nodes.forEach { node ->
                    Wearable.getMessageClient(applicationContext)
                        .sendMessage(node.id, WatchSyncPaths.REQUEST_SNAPSHOT, ByteArray(0))
                }
                if (BuildConfig.DEBUG) Log.d(TAG, "Requested snapshot from ${nodes.size} nodes")
            } catch (e: Exception) {
                Log.w(TAG, "Snapshot request failed: ${e.message}")
            }
        }
    }
}
