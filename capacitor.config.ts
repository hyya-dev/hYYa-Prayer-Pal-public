import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hyya.prayerpal.open',
  appName: 'hYYa Prayer Pal (Source)',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      // iOS: Always show notification sound, banner, and badge even when app is in foreground
      // This ensures sound plays in all app states
      presentationOptions: ['badge', 'sound', 'alert'],
      // Android: Default sound (without extension, files in res/raw/)
      sound: 'rebound',
      // Android notification icon (must be white silhouette on transparent background)
      // Located at: android/app/src/main/res/drawable/ic_stat_prayer_notification.xml
      smallIcon: 'ic_stat_prayer_notification',
      // Accent color for notification (amber/gold theme)
      iconColor: '#F59E0B',
    },
  },
};

export default config;
