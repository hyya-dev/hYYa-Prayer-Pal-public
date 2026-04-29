import { useEffect, useCallback, useRef, useMemo } from 'react';
import type { Prayer, Location } from '@/hooks/usePrayerTimes';
import type { NotificationSettings } from '@/hooks/useAppSettings';
import type { NotificationPermissionStatus } from '@/hooks/useNotifications';

interface UseNotificationSchedulingProps {
    prayerTimes: Prayer[];
    appSettings: {
        notifications: NotificationSettings;
        calculation: {
            method: string;
            madhab: 'shafi' | 'hanafi';
        };
        language: string;
    };
    location: Location;
    locationTimeZone?: string | null;
    permission: NotificationPermissionStatus;
    scheduleAllNotifications: (
        prayerTimes: Prayer[],
        notifications: NotificationSettings,
        location?: Location,
        method?: string,
        madhab?: 'shafi' | 'hanafi'
    ) => Promise<void>;
}

export function useNotificationScheduling({
    prayerTimes,
    appSettings,
    location,
    locationTimeZone,
    permission,
    scheduleAllNotifications,
}: UseNotificationSchedulingProps) {

    // CRITICAL FIX: Memoize notification settings to prevent infinite re-scheduling loops
    // Include language in the key so notifications re-schedule when UI language changes
    const notificationSettingsKey = useMemo(() => JSON.stringify(appSettings.notifications) + '|' + appSettings.language, [appSettings.notifications, appSettings.language]);
    const stableNotificationSettings = useMemo(() => appSettings.notifications, [appSettings.notifications]);

    // Use a scheduling lock to prevent concurrent scheduling calls
    const schedulingRef = useRef(false);
    const lastScheduleTimeRef = useRef(0);
    const lastScheduledPrayerKeyRef = useRef('');

    const debouncedSchedule = useCallback(async () => {
        const now = Date.now();
        // Prevent scheduling more than once per 3 seconds
        if (schedulingRef.current || (now - lastScheduleTimeRef.current < 3000)) {
            return;
        }

        // Create a key based on prayer times rounded to nearest minute
        const roundedPrayerKey = prayerTimes.map(p => {
            const rounded = Math.floor(p.time.getTime() / 60000);
            return `${p.name}:${rounded}`;
        }).join('|');

        // Include timezone signature so DST/zone changes force a reschedule pass.
        const timezoneSignature = `${locationTimeZone ?? 'device'}:${new Date().getTimezoneOffset()}`;
        const roundedKey = `${roundedPrayerKey}|${notificationSettingsKey}|${timezoneSignature}`;

        if (roundedKey === lastScheduledPrayerKeyRef.current) {
            return;
        }

        schedulingRef.current = true;
        lastScheduleTimeRef.current = now;
        lastScheduledPrayerKeyRef.current = roundedKey;

        try {
            await scheduleAllNotifications(
                prayerTimes,
                stableNotificationSettings,
                location,
                appSettings.calculation.method,
                appSettings.calculation.madhab as 'shafi' | 'hanafi'
            );
        } finally {
            schedulingRef.current = false;
        }
    }, [
        prayerTimes,
        stableNotificationSettings,
        scheduleAllNotifications,
        location,
        appSettings.calculation.method,
        appSettings.calculation.madhab,
        notificationSettingsKey,
        locationTimeZone,
    ]);

    // Schedule when permission changes to granted
    const prevPermissionRef = useRef(permission);
    useEffect(() => {
        const permissionChanged = prevPermissionRef.current !== permission;
        prevPermissionRef.current = permission;

        if (permissionChanged && permission === 'granted' && appSettings.notifications.masterEnabled && prayerTimes.length > 0) {
            console.log('[Scheduling] Permission granted, scheduling immediately');
            setTimeout(() => {
                debouncedSchedule();
            }, 100);
        }
    }, [permission, appSettings.notifications.masterEnabled, prayerTimes.length, debouncedSchedule]);

    // Schedule when enabled and dependencies change
    useEffect(() => {
        if (permission === 'granted' && appSettings.notifications.masterEnabled && prayerTimes.length > 0) {
            debouncedSchedule();
        }
    }, [permission, appSettings.notifications.masterEnabled, prayerTimes.length, notificationSettingsKey, debouncedSchedule]);

    // Reschedule on visibility change (foreground)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && permission === 'granted' && appSettings.notifications.masterEnabled && prayerTimes.length > 0) {
                debouncedSchedule();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [permission, appSettings.notifications.masterEnabled, prayerTimes.length, debouncedSchedule]);

    // Daily rescheduling at midnight
    const dailyRescheduleSetup = useRef(false);
    useEffect(() => {
        if (permission !== 'granted' || !appSettings.notifications.masterEnabled || prayerTimes.length === 0) return;
        if (dailyRescheduleSetup.current) return;

        dailyRescheduleSetup.current = true;

        const scheduleDailyReschedule = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0); // Midnight

            const msUntilMidnight = tomorrow.getTime() - now.getTime();

            const timeoutId = setTimeout(() => {
                console.log('[Scheduling] Daily reschedule triggered');
                debouncedSchedule();
                scheduleDailyReschedule();
            }, msUntilMidnight);

            return () => clearTimeout(timeoutId);
        };

        const cleanup = scheduleDailyReschedule();
        return cleanup;
    }, [permission, appSettings.notifications.masterEnabled, prayerTimes.length, debouncedSchedule]);

    return { debouncedSchedule };
}
