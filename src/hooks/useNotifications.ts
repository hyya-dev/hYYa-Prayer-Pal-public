import { useState, useEffect, useCallback, useRef } from 'react';
import { LocalNotifications, ScheduleOptions, LocalNotificationSchema } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import i18next from 'i18next';
import { PrayerTimes, Coordinates, CalculationMethod, Madhab } from 'adhan';
import { Prayer } from './usePrayerTimes';
import { NotificationSoundType, NotificationSettings } from './useAppSettings';
import { applyRegionalPrayerTimeExceptions, isSaudiRamadanIshaExceptionActive } from '@/lib/prayerTimeExceptions';
import { StorageService } from "@/services/StorageService";
import SystemSettings from '@/plugins/systemSettings';

import {
  scheduleNativeAlarms,
  cancelNativeAlarms,
  saveNativeNotificationSettings,
  NativeAlarm
} from '@/services/widgetService';

// Notification ID ranges to avoid conflicts
const NOTIFICATION_ID_BASE_AT = 1000;
const NOTIFICATION_ID_BASE_BEFORE = 2000;

// Map prayer names to indices for unique IDs
const PRAYER_INDEX: Record<string, number> = {
  fajr: 0,
  shurooq: 1,
  dhuhr: 2,
  asr: 3,
  maghrib: 4,
  isha: 5,
};

// Sound file configuration
// iOS: Files must be in ios/App/App/ (at bundle root) and added to Xcode project Resources
// iOS requires filename WITH extension - UNNotificationSoundName needs the full filename
// NOTE: iOS prefers .caf format for notification sounds (more reliable than .mp3)
// Android: Files must be in android/app/src/main/res/raw/
//
// Sound options:
// - 'discreet' = rebound.caf (iOS Rebound sound) - used for prayer time AND before prayer
// - 'takbir' = takbir.caf - used for prayer time ONLY (before prayer uses discreet)
//
// KNOWN LIMITATION (iOS): Capacitor's LocalNotifications may not resolve custom sounds for
// notifications scheduled far in the future (30+ days) when the app is terminated.
// Workaround: We schedule only 30 days of notifications and refresh on app launch.
const SOUNDS_IOS: Record<NotificationSoundType, string> = {
  discreet: 'rebound.caf',  // rebound.caf in ios/App/App/
  takbir: 'takbir.caf',     // takbir.caf in ios/App/App/
};

// Android: Sound files in res/raw must be referenced WITHOUT extension
const SOUNDS_ANDROID: Record<NotificationSoundType, string> = {
  discreet: 'rebound',
  takbir: 'takbir',
};

// Notification categories for iOS (used for grouping and time-sensitive support)
const NOTIFICATION_CATEGORY_PRAYER = 'PRAYER_TIME';
const NOTIFICATION_CATEGORY_PRE_PRAYER = 'PRE_PRAYER';

// Android notification channel IDs
// IMPORTANT: Once a channel is created, its sound settings are cached by Android.
// To update sound settings without reinstalling, increment the version suffix.
// Version history:
// - v1: Initial (had .mp3 extension bug)
// - v2: Fixed sound references (no extension)
const ANDROID_CHANNEL_VERSION = 'v2';
const ANDROID_CHANNEL_DISCREET = `prayer_discreet_${ANDROID_CHANNEL_VERSION}`;
const ANDROID_CHANNEL_TAKBIR = `prayer_takbir_${ANDROID_CHANNEL_VERSION}`;

// Helper to get sound filename for notification payload
const getSoundFileName = (soundType: NotificationSoundType): string => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return SOUNDS_IOS[soundType];
  }
  return SOUNDS_ANDROID[soundType];
};

// Helper to get Android channel ID based on sound type
const getAndroidChannelId = (soundType: NotificationSoundType): string => {
  return soundType === 'takbir' ? ANDROID_CHANNEL_TAKBIR : ANDROID_CHANNEL_DISCREET;
};

// LocalStorage keys for notification prompt tracking
const NOTIFICATION_PROMPT_KEY = 'prayerpal_notification_prompt_shown';
const NOTIFICATION_PRE_PROMPT_KEY = 'prayerpal_pre_prompt_shown';
const NOTIFICATION_PRE_PROMPT_LATER_KEY = 'prayerpal_pre_prompt_maybe_later';
const NOTIFICATION_POST_PROMPT_KEY = 'prayerpal_post_prompt_shown';
const SCHEDULED_NOTIFICATION_IDS_KEY = 'prayerpal_scheduled_notification_ids_v1';
const NOTIFICATION_DELIVERY_MODE_KEY = 'prayerpal_notification_delivery_mode_v1';
type NotificationDeliveryMode = 'exact' | 'approx' | 'unknown';

const readScheduledNotificationIds = (): number[] => {
  try {
    const raw = StorageService.getItem(SCHEDULED_NOTIFICATION_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => Number(value))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
};

const writeScheduledNotificationIds = (ids: number[]) => {
  try {
    if (ids.length === 0) {
      StorageService.removeItem(SCHEDULED_NOTIFICATION_IDS_KEY);
      return;
    }

    const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a - b);
    StorageService.setItem(SCHEDULED_NOTIFICATION_IDS_KEY, JSON.stringify(uniqueSorted));
  } catch {
    // Ignore storage errors
  }
};

// Check if exact alarms can be scheduled (Android 12+)
// On Android 12+, SCHEDULE_EXACT_ALARM requires user permission via system settings
const checkExactAlarmPermission = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return true;

  try {
    const result = await SystemSettings.checkExactAlarmPermission();
    return Boolean(result?.success && result.granted);
  } catch (error) {
    console.warn('[Notifications] Could not check exact alarm permission:', error);
    return false;
  }
};

// Open Android battery optimization settings
// Samsung One UI is aggressive at killing background apps
const openBatteryOptimizationSettings = () => {
  if (Capacitor.getPlatform() !== 'android') return;

  // This requires a native plugin to open settings directly
  // For now, we'll log the instruction
  console.log('[Notifications] Samsung/Android users should disable battery optimization for hYYa Prayer Pal');
  console.log('[Notifications] Go to Settings > Apps > hYYa Prayer Pal > Battery > Unrestricted');
};

// Create Android notification channels (must be done before scheduling notifications)
const createAndroidChannels = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    // Create channel for discreet (rebound) sound
    await LocalNotifications.createChannel({
      id: ANDROID_CHANNEL_DISCREET,
      name: 'Prayer Times (Discreet)',
      description: 'Prayer time notifications with discreet sound',
      importance: 4, // HIGH - makes sound and shows heads-up
      visibility: 1, // PUBLIC
      sound: 'rebound', // Without extension for Android
      vibration: true,
    });

    // Create channel for takbir sound
    await LocalNotifications.createChannel({
      id: ANDROID_CHANNEL_TAKBIR,
      name: 'Prayer Times (Takbir)',
      description: 'Prayer time notifications with takbir sound',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      sound: 'takbir', // Without extension for Android
      vibration: true,
    });

    console.log('[Notifications] Android channels created successfully');
  } catch (error) {
    console.error('[Notifications] Failed to create Android channels:', error);
  }
};

export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt';

export function useNotifications() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isSupported, setIsSupported] = useState(false);
  const [autoGranted, setAutoGranted] = useState(false); // Signals when permission was auto-granted on first launch
  const [showPrePrompt, setShowPrePrompt] = useState(false); // Controls pre-prompt modal visibility
  const [showPostPrompt, setShowPostPrompt] = useState(false); // Controls post-permission prompt visibility
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';
  const isIOS = platform === 'ios';
  const scheduleChainRef = useRef<Promise<void>>(Promise.resolve());

  // Check if notifications are supported and get current permission
  useEffect(() => {
    const checkSupport = async () => {
      // Native-only app - only check Capacitor permissions
      setIsSupported(true);

      // Create Android notification channels on startup
      // This ensures channels exist with correct sound settings
      await createAndroidChannels();

      const result = await LocalNotifications.checkPermissions();
      console.log('[Notifications] Capacitor permission status:', result.display);
      if (result.display === 'granted') {
        setPermission('granted');
      } else if (result.display === 'denied') {
        setPermission('denied');
      } else {
        setPermission('prompt');
      }
    };

    checkSupport();

    // Listen for notification events (for debugging only in development)
    if (import.meta.env.DEV) {
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('[Notifications] Received:', notification.title);
      });

      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.log('[Notifications] Action:', action.actionId);
      });
    }

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, []);


  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await LocalNotifications.requestPermissions();
      console.log('[Notifications] Permission request result:', result.display);

      if (result.display === 'granted') {
        setPermission('granted');
        return true;
      } else {
        setPermission('denied');
        return false;
      }
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return false;
    }
  }, [isSupported]);

  // Watch for permission changes and show post-prompt when granted
  // This prompts user to enable notifications after they grant system permission
  const prevPermissionRef = useRef(permission);
  useEffect(() => {
    if (!isSupported) return;

    const permissionChanged = prevPermissionRef.current !== permission;
    prevPermissionRef.current = permission;

    // Show post-prompt when permission changes from 'prompt' to 'granted'
    if (permissionChanged && permission === 'granted' && (isIOS || isAndroid)) {
      const hasShownPostPrompt = StorageService.getItem(NOTIFICATION_POST_PROMPT_KEY);
      if (!hasShownPostPrompt) {
        console.log('[Notifications] Permission granted, showing post-prompt to enable notifications');
        // Small delay to ensure UI is ready
        setTimeout(() => {
          setShowPostPrompt(true);
        }, 500);
      }
    }
  }, [permission, isSupported, isIOS, isAndroid]);

  const showEnablePostPrompt = useCallback(() => {
    setShowPostPrompt(true);
  }, []);

  // Auto-prompt for notification permission on first launch using Pre-Prompt strategy
  // IMPORTANT: On Android 13+, notifications are opt-in. We must request permission
  // or prayer alerts will be silently blocked.
  // 
  // PRE-PROMPT STRATEGY:
  // 1. Show custom modal first explaining why notifications are needed
  // 2. If user taps "Enable" -> trigger system dialog
  // 3. If user taps "Maybe Later" -> save the one-shot for later
  useEffect(() => {
    // Only proceed if notifications are supported
    if (!isSupported) {
      return;
    }

    const checkAndShowPrePrompt = async () => {
      // Check if we've already shown the system prompt
      const hasPromptedBefore = StorageService.getItem(NOTIFICATION_PROMPT_KEY);
      const hasShownPrePrompt = StorageService.getItem(NOTIFICATION_PRE_PROMPT_KEY);
      const choseMaybeLater = StorageService.getItem(NOTIFICATION_PRE_PROMPT_LATER_KEY);

      // Update permission state from system
      const result = await LocalNotifications.checkPermissions();
      const currentPermission = result.display === 'granted' ? 'granted' :
        result.display === 'denied' ? 'denied' : 'prompt';
      setPermission(currentPermission);

      // If permission is already granted or denied, nothing to do
      if (currentPermission !== 'prompt') {
        console.log('[Notifications] Permission already', currentPermission);
        return;
      }

      // If user already went through the full flow, don't show again
      if (hasPromptedBefore) {
        console.log('[Notifications] Already prompted with system dialog before');
        return;
      }

      // If user chose "Maybe Later" recently, don't show again immediately
      // (Could add time-based logic here to re-prompt after X days)
      if (choseMaybeLater) {
        console.log('[Notifications] User chose Maybe Later, respecting that choice');
        return;
      }

      // If we've never shown the pre-prompt, wait for location dialog to finish
      if (!hasShownPrePrompt) {
        console.log('[Notifications] First launch - will show pre-prompt after location dialog');

        // Wait for location permission dialog to be dismissed
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Double-check permission hasn't changed
        const recheckResult = await LocalNotifications.checkPermissions();
        if (recheckResult.display !== 'prompt') {
          console.log('[Notifications] Permission changed during wait:', recheckResult.display);
          setPermission(recheckResult.display === 'granted' ? 'granted' : 'denied');
          return;
        }

        // Show the pre-prompt modal or request directly on iOS
        console.log('[Notifications] Showing pre-prompt modal');
        StorageService.setItem(NOTIFICATION_PRE_PROMPT_KEY, 'true');

        // LESSON LEARNED: iOS also needs explicit permission request!
        // iOS shows a nice native dialog, so request directly.
        // Android needs a custom pre-prompt since its dialog is less informative.
        if (isIOS) {
          // iOS: Request permission directly - iOS shows a descriptive native dialog
          console.log('[Notifications] iOS: Requesting permission directly');
          const granted = await requestPermission();
          console.log('[Notifications] iOS permission result:', granted ? 'granted' : 'denied');
          if (granted) {
            setAutoGranted(true);
          }
        } else if (isAndroid) {
          // Android: Request permission directly (single system prompt)
          StorageService.setItem(NOTIFICATION_PROMPT_KEY, 'true');
          const granted = await requestPermission();
          console.log('[Notifications] Android permission result:', granted ? 'granted' : 'denied');
          if (granted) {
            setAutoGranted(true);
          }
        }
      }
    };

    checkAndShowPrePrompt();
  }, [isSupported, isIOS, isAndroid, requestPermission]);

  // Handle pre-prompt "Enable" action
  const handlePrePromptEnable = useCallback(async (): Promise<boolean> => {
    console.log('[Notifications] User chose Enable in pre-prompt');
    StorageService.setItem(NOTIFICATION_PROMPT_KEY, 'true');

    const granted = await requestPermission();
    console.log('[Notifications] System permission result:', granted ? 'granted' : 'denied');

    if (granted) {
      setAutoGranted(true);
    }

    setShowPrePrompt(false);
    return granted;
  }, [requestPermission]);

  // Handle pre-prompt "Maybe Later" action
  const handlePrePromptLater = useCallback(() => {
    console.log('[Notifications] User chose Maybe Later in pre-prompt');
    StorageService.setItem(NOTIFICATION_PRE_PROMPT_LATER_KEY, 'true');
    setShowPrePrompt(false);
    // Note: We do NOT set NOTIFICATION_PROMPT_KEY here, preserving the one-shot system prompt
  }, []);

  // Dismiss pre-prompt (same as Maybe Later)
  const dismissPrePrompt = useCallback(() => {
    setShowPrePrompt(false);
  }, []);

  // Handle post-prompt "Enable" action - user explicitly chooses to enable notifications
  const handlePostPromptEnable = useCallback(() => {
    console.log('[Notifications] User chose to enable notifications in post-prompt');
    StorageService.setItem(NOTIFICATION_POST_PROMPT_KEY, 'true');
    setShowPostPrompt(false);
    // Return true to signal that notifications should be enabled
    // The parent component will handle enabling via updateNotifications
  }, []);

  // Handle post-prompt "Not Now" action
  const handlePostPromptNotNow = useCallback(() => {
    console.log('[Notifications] User chose Not Now in post-prompt');
    StorageService.setItem(NOTIFICATION_POST_PROMPT_KEY, 'true');
    setShowPostPrompt(false);
  }, []);

  // Generate unique notification ID
  // CRITICAL: Use day of year (1-366) instead of day of month to avoid conflicts
  // Also include year to ensure uniqueness across years
  const generateNotificationId = useCallback((prayerName: string, isBefore: boolean, date: Date): number => {
    const prayerIndex = PRAYER_INDEX[prayerName] ?? 0;
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const base = isBefore ? NOTIFICATION_ID_BASE_BEFORE : NOTIFICATION_ID_BASE_AT;
    // Use dayOfYear (1-366) + prayerIndex (0-5) + year offset to ensure uniqueness
    // This prevents conflicts when scheduling multiple days
    return base + (prayerIndex * 400) + dayOfYear;
  }, []);

  // Cancel all scheduled notifications (except test notification ID 9999)
  const cancelAllNotifications = useCallback(async (excludeTest: boolean = true) => {
    try {
      const storedIds = readScheduledNotificationIds();
      const idsToCancel = excludeTest
        ? storedIds
        : Array.from(new Set([...storedIds, 9999]));

      if (idsToCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: idsToCancel.map((id) => ({ id })),
        });
      }

      writeScheduledNotificationIds([]);
    } catch (error) {
      console.error('[Notifications] Error cancelling notifications:', error);
    }
  }, []);

  // Test notification sound
  const testNotificationSound = useCallback(async (soundType: NotificationSoundType = 'discreet') => {
    const isAndroidPlatform = Capacitor.getPlatform() === 'android';

    // Re-check permission directly (state might be stale if user enabled in system settings)
    const currentPermission = await LocalNotifications.checkPermissions();
    console.log('[Notifications] Test sound - current permission:', currentPermission.display);

    if (currentPermission.display !== 'granted') {
      console.log('[Notifications] Permission not granted, requesting...');
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') {
        throw new Error('Notification permission not granted');
      }
      // Update state
      setPermission('granted');
    }

    const soundFileName = getSoundFileName(soundType);
    const channelId = getAndroidChannelId(soundType);
    console.log('[Notifications] Testing sound:', soundType, '→', soundFileName, 'channel:', channelId, 'platform:', Capacitor.getPlatform());

    try {
      let useChannelId: string | undefined = channelId;

      // Ensure Android channels exist before scheduling
      if (isAndroidPlatform) {
        console.log('[Notifications] Ensuring Android channels exist...');

        try {
          await createAndroidChannels();

          // List channels to verify they exist
          const channels = await LocalNotifications.listChannels();
          console.log('[Notifications] Available channels:', JSON.stringify(channels.channels));

          // Check if our channel exists
          const channelExists = channels.channels?.some(ch => ch.id === channelId);
          if (!channelExists) {
            console.warn('[Notifications] ⚠️ Channel not found:', channelId, '- trying without custom channel');
            useChannelId = undefined; // Fall back to default channel
          }
        } catch (channelError) {
          console.error('[Notifications] Channel creation/listing failed:', channelError);
          useChannelId = undefined; // Fall back to default channel
        }
      }

      // Cancel any existing test notification
      await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });

      // Schedule test notification with sound
      // Using 5 seconds delay to ensure Android has time to process
      const scheduleTime = new Date(Date.now() + 5000);

      // Build payload - Android uses channelId, iOS uses categoryId (v2 working Takbir setup)
      const soundLabel = soundType === 'takbir'
        ? i18next.t('settings.notifications.takbir', )
        : i18next.t('settings.notifications.discreetShort', );
      const testPayload: LocalNotificationSchema = {
        id: 9999,
        title: i18next.t('settings.notifications.testSound', ),
        body: soundLabel,
        sound: soundFileName,
        schedule: { at: scheduleTime },
        autoCancel: true,
      };
      
      // Add platform-specific properties
      if (isAndroidPlatform) {
        if (useChannelId) {
          (testPayload as LocalNotificationSchema & { channelId?: string }).channelId = useChannelId;
        }
        // Also add extra properties for better Android compatibility
        (testPayload as LocalNotificationSchema & { smallIcon?: string }).smallIcon = 'ic_stat_prayer_notification';
      } else {
        // v2 working Takbir setup: categoryId; plugin also reads actionTypeId for iOS categoryIdentifier
        (testPayload as LocalNotificationSchema & { categoryId?: string }).categoryId = NOTIFICATION_CATEGORY_PRAYER;
        (testPayload as LocalNotificationSchema & { actionTypeId?: string }).actionTypeId = NOTIFICATION_CATEGORY_PRAYER;
      }

      console.log('[Notifications] Scheduling test notification:', JSON.stringify(testPayload));

      await LocalNotifications.schedule({
        notifications: [testPayload],
      });

      // Verify it was scheduled
      const pending = await LocalNotifications.getPending();
      const testPending = pending.notifications.find(n => n.id === 9999);
      console.log('[Notifications] Test notification scheduled:', testPending ? 'YES' : 'NO', 'pending count:', pending.notifications.length);

      if (!testPending) {
        // Try one more time with a simpler payload (no custom channel)
        console.warn('[Notifications] First attempt failed, trying simpler payload...');

        const simplePayload: LocalNotificationSchema = {
          id: 9999,
          title: i18next.t('settings.notifications.testSound', ),
          body: soundLabel,
          sound: soundFileName,
          schedule: { at: new Date(Date.now() + 3000) },
          autoCancel: true,
        };

        await LocalNotifications.schedule({ notifications: [simplePayload] });

        const retryPending = await LocalNotifications.getPending();
        const retryTest = retryPending.notifications.find(n => n.id === 9999);

        if (!retryTest) {
          throw new Error('Test notification failed to schedule even with simple payload');
        }

        console.log('[Notifications] ✅ Simple test scheduled successfully');
        return;
      }

      console.log('[Notifications] ✅ Test scheduled for:', scheduleTime.toISOString());
    } catch (error) {
      console.error('[Notifications] Test error:', error);
      throw error;
    }
  }, []);

  // Schedule all prayer notifications using Capacitor Local Notifications
  // PERFORMANCE FIX: Reduced from 365 to 30 days - iOS limit is 64 anyway
  // iOS limit: 64 scheduled notifications max, so 30 days is more than enough
  // ANDROID FIX: Use native AlarmManager.setAlarmClock() for reliable notifications
  const scheduleAllNotifications = useCallback(async (
    prayers: Prayer[],
    notificationSettings: NotificationSettings,
    location?: { latitude: number; longitude: number },
    calculationMethod?: string,
    madhab?: 'shafi' | 'hanafi'
  ) => {
    scheduleChainRef.current = scheduleChainRef.current
      .then(async () => {
    // DEBUG: Log incoming settings
    console.log('[Notifications] 📋 scheduleAllNotifications called with:', {
      masterEnabled: notificationSettings.masterEnabled,
      sound: notificationSettings.sound,
      soundType: notificationSettings.soundType,
      prayerCount: prayers.length,
    });

    if (!notificationSettings.masterEnabled) {
      if (import.meta.env.DEV) {
        console.log('[Notifications] Master switch is OFF, cancelling all notifications');
      }
      await cancelAllNotifications();
      // Also cancel native alarms on Android
      if (Capacitor.getPlatform() === 'android') {
        await cancelNativeAlarms();
      }
      return;
    }

    if (permission !== 'granted') {
      if (import.meta.env.DEV) {
        console.log('[Notifications] Permission not granted, skipping scheduling');
      }
      return;
    }

    // Save notification settings to native storage for alarm rescheduling after boot
    if (Capacitor.getPlatform() === 'android') {
      const enabledPrayers = Object.entries(notificationSettings.prayerNotifications)
        .filter(([_, enabled]) => enabled)
        .map(([prayer]) => prayer);

      await saveNativeNotificationSettings({
        masterEnabled: notificationSettings.masterEnabled,
        soundType: notificationSettings.soundType,
        prePrayerMinutes: notificationSettings.prePrayerMinutes,
        enabledPrayers,
      });
    }

    const now = new Date();

    // Cancel existing notifications before scheduling new ones
    await cancelAllNotifications();
    // Also cancel native alarms on Android before scheduling new ones
    if (Capacitor.getPlatform() === 'android') {
      await cancelNativeAlarms();
    }

    const notificationsToSchedule: ScheduleOptions['notifications'] = [];
    const isAndroid = Capacitor.getPlatform() === 'android';

    // Sound configuration (per Audit + user rules):
    // Rule 1: At-prayer (Fajr, Shurooq, Dhuhr, Asr, Maghrib, Isha) = user's choice (discreet or takbir).
    // Rule 2: Minutes-before notices = Discreet only (no Takbir option).
    // When sound is OFF, do not pass any sound (no fallback to Discreet) so notifications are silent.
    const prayerTimeSound = notificationSettings.sound ? getSoundFileName(notificationSettings.soundType) : undefined;
    const beforePrayerSound = notificationSettings.sound ? getSoundFileName('discreet') : undefined;

    // DEBUG: Log sound configuration for troubleshooting
    console.log('[Notifications] 🔊 Sound Config:', {
      platform: Capacitor.getPlatform(),
      soundEnabled: notificationSettings.sound,
      soundType: notificationSettings.soundType,
      prayerTimeSound,
      beforePrayerSound,
      isAndroid,
    });

    // Android channel configuration (channels have pre-configured sounds)
    const prayerTimeChannelId = getAndroidChannelId(notificationSettings.soundType);
    const beforePrayerChannelId = getAndroidChannelId('discreet');

    // PERFORMANCE FIX: Calculate only 30 days of prayer times (iOS limit is 64 notifications)
    // This reduces calculation time from ~500ms to ~40ms
    const DAYS_TO_SCHEDULE = 30;
    const allPrayersByDate: Array<{ date: Date; prayers: Prayer[] }> = [];

    if (location && calculationMethod && madhab) {
      const coords = new Coordinates(location.latitude, location.longitude);
      const methods: Record<string, () => ReturnType<typeof CalculationMethod.MuslimWorldLeague>> = {
        MuslimWorldLeague: CalculationMethod.MuslimWorldLeague,
        Egyptian: CalculationMethod.Egyptian,
        Karachi: CalculationMethod.Karachi,
        UmmAlQura: CalculationMethod.UmmAlQura,
        Dubai: CalculationMethod.Dubai,
        MoonsightingCommittee: CalculationMethod.MoonsightingCommittee,
        NorthAmerica: CalculationMethod.NorthAmerica,
        Kuwait: CalculationMethod.Kuwait,
        Qatar: CalculationMethod.Qatar,
        Singapore: CalculationMethod.Singapore,
        Tehran: CalculationMethod.Tehran,
        Turkey: CalculationMethod.Turkey,
      };

      const params = methods[calculationMethod]();
      params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

      // Calculate 30 days of prayer times (reduced from 365)
      for (let dayOffset = 0; dayOffset < DAYS_TO_SCHEDULE; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(12, 0, 0, 0);

        const times = new PrayerTimes(coords, date, params);
        const adjustedTimes = applyRegionalPrayerTimeExceptions(
          {
            fajr: times.fajr,
            sunrise: times.sunrise,
            dhuhr: times.dhuhr,
            asr: times.asr,
            maghrib: times.maghrib,
            isha: times.isha,
          },
          { date, location },
        );
        const dayPrayers: Prayer[] = [
          { name: 'fajr', displayName: 'Fajr', time: adjustedTimes.fajr },
          { name: 'shurooq', displayName: 'Shurooq', time: adjustedTimes.sunrise },
          { name: 'dhuhr', displayName: 'Dhuhr', time: adjustedTimes.dhuhr },
          { name: 'asr', displayName: 'Asr', time: adjustedTimes.asr },
          { name: 'maghrib', displayName: 'Maghrib', time: adjustedTimes.maghrib },
          { name: 'isha', displayName: 'Isha', time: adjustedTimes.isha },
        ];

        allPrayersByDate.push({ date, prayers: dayPrayers });
      }
    } else {
      // Backward compatibility: use current day's prayers
      allPrayersByDate.push({ date: now, prayers });
    }

    // Schedule notifications for all prayers across all days
    // iOS limit: 64 notifications max, so we prioritize future notifications
    const MAX_NOTIFICATIONS = 64;
    let scheduledCount = 0;

    for (const { prayers: dayPrayers } of allPrayersByDate) {
      if (scheduledCount >= MAX_NOTIFICATIONS) break;

      for (const prayer of dayPrayers) {
        if (scheduledCount >= MAX_NOTIFICATIONS) break;

        const prayerKey = prayer.name as keyof typeof notificationSettings.prayerNotifications;

        // Schedule AT prayer time notification (Rule 1: user's sound choice)
        if (notificationSettings.prayerNotifications[prayerKey] && prayer.time > now) {
          const notificationId = generateNotificationId(prayer.name, false, prayer.time);

          // Use i18n-translated prayer name and notification text
          const lang = i18next.language || 'en';
          const translatedPrayer = i18next.t(`prayers.${prayer.name}`, { lng: lang});

          const payload: LocalNotificationSchema = {
            id: notificationId,
            title: i18next.t('notificationBanner.prayerTimeTitle', { lng: lang, prayer: translatedPrayer}),
            body: i18next.t('notificationBanner.prayerTimeBody', { lng: lang, prayer: translatedPrayer}),
            schedule: { at: new Date(prayer.time.getTime()) },
            // Only set sound when enabled; no fallback so sound-off stays silent (Audit fix)
            ...(prayerTimeSound != null ? { sound: prayerTimeSound } : {}),
            // Android: Use channel with pre-configured sound
            // iOS: categoryId (v2) + actionTypeId (plugin maps to categoryIdentifier)
            ...(isAndroid
              ? { channelId: prayerTimeChannelId }
              : { categoryId: NOTIFICATION_CATEGORY_PRAYER, actionTypeId: NOTIFICATION_CATEGORY_PRAYER }
            ),
            autoCancel: true,
          };

          notificationsToSchedule.push(payload);
          scheduledCount++;
        }

        // Schedule BEFORE prayer notification (Rule 2: minutes-before = Discreet only)
        if (notificationSettings.prePrayerNotifications[prayerKey] && scheduledCount < MAX_NOTIFICATIONS) {
          // In KSA Ramadan, Isha is explicitly fixed to Maghrib + 2h.
          // Suppress the Isha pre-prayer alert to avoid user-facing 90m/120m double alerts.
          if (prayer.name === 'isha' && isSaudiRamadanIshaExceptionActive({ date: prayer.time, location })) {
            continue;
          }

          const preTime = new Date(prayer.time.getTime() - notificationSettings.prePrayerMinutes * 60 * 1000);

          if (preTime > now) {
            const notificationId = generateNotificationId(prayer.name, true, prayer.time);

            // Use i18n-translated prayer name and notification text
            const preLang = i18next.language || 'en';
            const preTranslatedPrayer = i18next.t(`prayers.${prayer.name}`, { lng: preLang});

            const payload: LocalNotificationSchema = {
              id: notificationId,
              title: i18next.t('notificationBanner.prayerSoonTitle', { lng: preLang, prayer: preTranslatedPrayer}),
              body: i18next.t('notificationBanner.prayerSoonBody', { lng: preLang, prayer: preTranslatedPrayer, minutes: notificationSettings.prePrayerMinutes}),
              schedule: { at: preTime },
              // Only set sound when enabled; no fallback (Audit fix). Pre-prayer always Discreet.
              ...(beforePrayerSound != null ? { sound: beforePrayerSound } : {}),
              // Android: Use channel with pre-configured sound
              // iOS: categoryId (v2) + actionTypeId (plugin maps to categoryIdentifier)
              ...(isAndroid
                ? { channelId: beforePrayerChannelId }
                : { categoryId: NOTIFICATION_CATEGORY_PRE_PRAYER, actionTypeId: NOTIFICATION_CATEGORY_PRE_PRAYER }
              ),
              autoCancel: true,
            };

            notificationsToSchedule.push(payload);
            scheduledCount++;
          }
        }
      }
    }

    // Schedule all notifications at once
    if (notificationsToSchedule.length > 0) {
      try {
        // ANDROID: Use native AlarmManager.setAlarmClock() for reliable notifications
        // This survives Doze mode and device reboots (with BootReceiver)
        if (Capacitor.getPlatform() === 'android' && location && calculationMethod && madhab) {
          const exactAllowed = await checkExactAlarmPermission();
          if (!exactAllowed) {
            StorageService.setItem(NOTIFICATION_DELIVERY_MODE_KEY, 'approx');
            await LocalNotifications.schedule({ notifications: notificationsToSchedule });
            writeScheduledNotificationIds(notificationsToSchedule.map((notification) => notification.id));
            console.warn('[Notifications] Exact alarms not permitted; scheduled approximate notifications instead.');
            return;
          }

          // Convert to NativeAlarm format
          const nativeAlarms: NativeAlarm[] = [];

          for (const { prayers: dayPrayers } of allPrayersByDate) {
            for (const prayer of dayPrayers) {
              const prayerKey = prayer.name as keyof typeof notificationSettings.prayerNotifications;

              // AT prayer time notification (Rule 1: user's sound choice; silent when sound off)
              if (notificationSettings.prayerNotifications[prayerKey] && prayer.time > now) {
                const notificationId = generateNotificationId(prayer.name, false, prayer.time);
                // Use i18n for native alarm notification text (same as iOS notifications)
                const nativeLang = i18next.language || 'en';
                const nativeTranslatedPrayer = i18next.t(`prayers.${prayer.name}`, { lng: nativeLang});
                nativeAlarms.push({
                  id: notificationId,
                  prayerName: prayer.name,
                  displayName: nativeTranslatedPrayer,
                  timeMillis: prayer.time.getTime(),
                  isBefore: false,
                  soundType: notificationSettings.sound ? notificationSettings.soundType : 'silent',
                  notificationTitle: i18next.t('notificationBanner.prayerTimeTitle', { lng: nativeLang, prayer: nativeTranslatedPrayer}),
                  notificationBody: i18next.t('notificationBanner.prayerTimeBody', { lng: nativeLang, prayer: nativeTranslatedPrayer}),
                });
              }

              // BEFORE prayer notification (Rule 2: Discreet only; silent when sound off)
              if (notificationSettings.prePrayerNotifications[prayerKey]) {
                // In KSA Ramadan, suppress Isha pre-prayer alert to avoid 90m/120m double alerts.
                if (prayer.name === 'isha' && isSaudiRamadanIshaExceptionActive({ date: prayer.time, location })) {
                  continue;
                }

                const preTime = new Date(prayer.time.getTime() - notificationSettings.prePrayerMinutes * 60 * 1000);
                if (preTime > now) {
                  const notificationId = generateNotificationId(prayer.name, true, prayer.time);
                  // Use i18n for native alarm notification text (same as iOS notifications)
                  const preNativeLang = i18next.language || 'en';
                  const preNativeTranslatedPrayer = i18next.t(`prayers.${prayer.name}`, { lng: preNativeLang});
                  nativeAlarms.push({
                    id: notificationId,
                    prayerName: prayer.name,
                    displayName: preNativeTranslatedPrayer,
                    timeMillis: preTime.getTime(),
                    isBefore: true,
                    minutesBefore: notificationSettings.prePrayerMinutes,
                    soundType: notificationSettings.sound ? 'discreet' : 'silent',
                    notificationTitle: i18next.t('notificationBanner.prayerSoonTitle', { lng: preNativeLang, prayer: preNativeTranslatedPrayer}),
                    notificationBody: i18next.t('notificationBanner.prayerSoonBody', { lng: preNativeLang, prayer: preNativeTranslatedPrayer, minutes: notificationSettings.prePrayerMinutes}),
                  });
                }
              }
            }
          }

          // Limit to 64 alarms (same as iOS limit)
          const limitedAlarms = nativeAlarms.slice(0, 64);
          const scheduledCount = await scheduleNativeAlarms(limitedAlarms);

          if (scheduledCount > 0) {
            StorageService.setItem(NOTIFICATION_DELIVERY_MODE_KEY, 'exact');
          } else {
            StorageService.setItem(NOTIFICATION_DELIVERY_MODE_KEY, 'approx');
            await LocalNotifications.schedule({ notifications: notificationsToSchedule });
            writeScheduledNotificationIds(notificationsToSchedule.map((notification) => notification.id));
            console.warn('[Notifications] Native alarm scheduling failed; downgraded to approximate notifications.');
          }

          if (import.meta.env.DEV) {
            console.log(`[Notifications] ✅ Scheduled ${scheduledCount} native alarms (Android)`);
          }
        } else {
          // iOS or fallback: Use Capacitor Local Notifications
          // DEBUG: Log first notification's sound for troubleshooting
          if (notificationsToSchedule.length > 0) {
            const firstNotif = notificationsToSchedule[0];
            const firstNotifWithActions = firstNotif as typeof firstNotif & {
              categoryId?: string;
              actionTypeId?: string;
            };
            console.log('[Notifications] 🔊 iOS First notification:', {
              id: firstNotif.id,
              title: firstNotif.title,
              sound: firstNotif.sound,
              categoryId: firstNotifWithActions.categoryId,
              actionTypeId: firstNotifWithActions.actionTypeId,
            });
          }

          await LocalNotifications.schedule({ notifications: notificationsToSchedule });
          writeScheduledNotificationIds(notificationsToSchedule.map((notification) => notification.id));
          console.log(`[Notifications] ✅ Scheduled ${notificationsToSchedule.length} iOS notifications`);
        }
      } catch (error) {
        console.error('[Notifications] ❌ Scheduling error:', error);
      }
    }
      })
      .catch((error) => {
        console.error('[Notifications] ❌ schedule chain error:', error);
      });

    await scheduleChainRef.current;
  }, [permission, cancelAllNotifications, generateNotificationId]);

  // Legacy function for backward compatibility (now a no-op on native)
  const scheduleNotification = useCallback(async (
    prayer: Prayer,
    minutesBefore: number = 10,
    playSound: boolean = true,
    soundType: NotificationSoundType = 'discreet'
  ) => {
    console.log('[Notifications] scheduleNotification called - use scheduleAllNotifications instead');
  }, []);

  return {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    isNative,
    isAndroid,
    autoGranted, // Signals when permission was auto-granted on first launch
    // Pre-prompt modal state and handlers
    showPrePrompt,
    handlePrePromptEnable,
    handlePrePromptLater,
    dismissPrePrompt,
    // Post-prompt modal state and handlers (shown after permission is granted)
    showPostPrompt,
    showEnablePostPrompt,
    handlePostPromptEnable,
    handlePostPromptNotNow,
    // Permission and notification functions
    requestPermission,
    scheduleNotification,
    scheduleAllNotifications,
    testNotificationSound,
    cancelAllNotifications,
  };
}
