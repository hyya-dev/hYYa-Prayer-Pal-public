package com.hyya.prayerpal.open;

import android.os.Bundle;
import android.util.Log;
import android.content.Context;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        applySavedAppLanguage();

        // Register the WidgetBridge plugin for prayer widget data sync
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(QuranReaderNativeAudioPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // Create notification channels (required for Android 8+)
        PrayerAlarmReceiver.Companion.createNotificationChannels(this);
        
        // Register network callback for WiFi change detection
        NetworkChangeReceiver.Companion.registerNetworkCallback(this);
        
        // Schedule periodic location check (every 60 minutes)
        PeriodicLocationWorker.Companion.schedule(this);

        // Schedule periodic weather refresh (best-effort; does not affect prayers)
        PeriodicWeatherWorker.Companion.schedule(this);
        
        if (BuildConfig.DEBUG) Log.d(TAG, "Prayer alarm system initialized");
    }

    private void applySavedAppLanguage() {
        try {
            Context context = getApplicationContext();
            String savedLanguage = context
                .getSharedPreferences(WidgetBridgePlugin.NATIVE_SETTINGS_PREFS, Context.MODE_PRIVATE)
                .getString(WidgetBridgePlugin.KEY_APP_LANGUAGE, "");

            if (savedLanguage != null && !savedLanguage.trim().isEmpty()) {
                LocaleListCompat locales = LocaleListCompat.forLanguageTags(savedLanguage.trim());
                AppCompatDelegate.setApplicationLocales(locales);
                if (BuildConfig.DEBUG) Log.d(TAG, "Applied saved app locale: " + savedLanguage);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to apply saved app locale: " + e.getMessage());
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        
        // Force refresh widgets when user opens the app
        try {
            if (BuildConfig.DEBUG) Log.d(TAG, "onResume: Refreshing all widgets");
            PrayerWidgetProvider.Companion.updateAllWidgets(this);
        } catch (Exception e) {
            Log.e(TAG, "Error refreshing widgets on resume: " + e.getMessage());
        }
    }
}
