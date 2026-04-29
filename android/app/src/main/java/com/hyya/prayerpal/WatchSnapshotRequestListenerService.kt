package com.hyya.prayerpal.open

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WatchSnapshotRequestListenerService : WearableListenerService() {
    companion object {
        private const val TAG = "WatchSnapshotReq"
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != WatchDataSyncManager.PATH_REQUEST_SNAPSHOT) {
            return
        }

        if (BuildConfig.DEBUG) Log.d(TAG, "Received watch snapshot request")
        WatchDataSyncManager.syncLastKnown(applicationContext)
    }
}
