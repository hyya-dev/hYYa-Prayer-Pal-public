package com.hyya.prayerpal

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.ExistingWorkPolicy
import java.util.concurrent.TimeUnit

/**
 * NetworkChangeReceiver - Detects when the device connects to WiFi to trigger location refresh.
 * Uses modern NetworkCallback for API 24+ and legacy BroadcastReceiver as fallback.
 */
class NetworkChangeReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "NetworkChangeReceiver"
        private const val WORK_NAME = "location_refresh_on_network_change"
        
        private var isCallbackRegistered = false
        private var networkCallback: ConnectivityManager.NetworkCallback? = null
        
        /**
         * Register for network changes using the modern ConnectivityManager.NetworkCallback.
         * Recommended for API 24+.
         */
        fun registerNetworkCallback(context: Context) {
            if (isCallbackRegistered) return
            
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return
            
            val networkRequest = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .build()
            
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    if (BuildConfig.DEBUG) Log.d(TAG, "WiFi connected (Callback) - scheduling location refresh")
                    scheduleLocationRefresh(context)
                }
                
                override fun onLost(network: Network) {
                    if (BuildConfig.DEBUG) Log.d(TAG, "WiFi disconnected (Callback)")
                }
            }
            
            try {
                connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
                isCallbackRegistered = true
                if (BuildConfig.DEBUG) Log.d(TAG, "Network callback registered successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register network callback: ${e.message}")
            }
        }
        
        /**
         * Unregister the network callback to prevent leaks.
         */
        fun unregisterNetworkCallback(context: Context) {
            if (!isCallbackRegistered || networkCallback == null) return
            
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return
            
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback!!)
                isCallbackRegistered = false
                networkCallback = null
                if (BuildConfig.DEBUG) Log.d(TAG, "Network callback unregistered")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to unregister network callback: ${e.message}")
            }
        }
        
        /**
         * Schedules a WorkManager job to refresh location.
         * Using a delay ensures the network is fully stabilized.
         */
        private fun scheduleLocationRefresh(context: Context) {
            try {
                val workRequest = OneTimeWorkRequestBuilder<LocationRefreshWorker>()
                    .setInitialDelay(5, TimeUnit.SECONDS)
                    .build()
                
                WorkManager.getInstance(context)
                    .enqueueUniqueWork(
                        WORK_NAME,
                        ExistingWorkPolicy.REPLACE,
                        workRequest
                    )
                
                if (BuildConfig.DEBUG) Log.d(TAG, "Location refresh work scheduled")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to schedule location refresh: ${e.message}")
            }
        }
    }
    
    /**
     * Handles legacy CONNECTIVITY_ACTION broadcast.
     * Only processes if on a version where NetworkCallback might not be reliable
     * or if explicitly sent by the system.
     */
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ConnectivityManager.CONNECTIVITY_ACTION) {
            // On API 24+, we prefer NetworkCallback which is registered in MainActivity
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isCallbackRegistered) {
                if (BuildConfig.DEBUG) Log.d(TAG, "Connectivity change received but handled by callback")
                return
            }

            if (BuildConfig.DEBUG) Log.d(TAG, "Connectivity changed (legacy broadcast)")

            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return

            // For API 23+, use modern Network API
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val activeNetwork = connectivityManager.activeNetwork
                val capabilities = activeNetwork?.let { connectivityManager.getNetworkCapabilities(it) }
                
                if (capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true) {
                    if (BuildConfig.DEBUG) Log.d(TAG, "WiFi is now active - scheduling location refresh")
                    scheduleLocationRefresh(context)
                }
            } else {
                // For API < 23, use deprecated method as fallback
                @Suppress("DEPRECATION")
                val networkInfo = connectivityManager.activeNetworkInfo
                if (networkInfo?.isConnected == true && networkInfo.type == ConnectivityManager.TYPE_WIFI) {
                    if (BuildConfig.DEBUG) Log.d(TAG, "WiFi is now active (legacy) - scheduling location refresh")
                    scheduleLocationRefresh(context)
                }
            }
        }
    }
}
