import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
    fetchAndSyncTemperature,
    getWeatherSyncMeta,
    WEATHER_PREEMPTIVE_REFRESH_MS,
} from '@/services/widgetService';
import { Language } from '@/hooks/useAppSettings';

interface UseWeatherSyncProps {
    location: { latitude: number; longitude: number };
    language: Language;
}

export function useWeatherSync({ location, language: _language }: UseWeatherSyncProps) {
    // WIDGET FIX: Sync weather to widget on foreground and periodically
    const lastWeatherSyncRef = useRef<number>(0);
    const lastVisibilitySyncRef = useRef<number>(0);
    const preExpiryTimerRef = useRef<number | null>(null);
    const metadataRetryCountRef = useRef<number>(0);
    const isMountedRef = useRef<boolean>(false);

    useEffect(() => {
        // Only sync on native platforms
        if (!Capacitor.isNativePlatform() || !location.latitude || !location.longitude) return;
        isMountedRef.current = true;

        // Helper to fetch and sync weather
        const syncWeather = async () => {
            if (!isMountedRef.current) return;
            const now = Date.now();
            // Debounce: don't sync more than once per 5 minutes (Weather tab also pushes on fresh fetch).
            if (now - lastWeatherSyncRef.current < 5 * 60 * 1000) return;
            lastWeatherSyncRef.current = now;

            try {
                // Validate coordinates are numeric and within valid ranges
                const lat = Math.min(90, Math.max(-90, Number(location.latitude)));
                const lon = Math.min(180, Math.max(-180, Number(location.longitude)));
                if (!isFinite(lat) || !isFinite(lon)) {
                  console.warn('[WeatherSync] Invalid coordinates detected, skipping weather fetch');
                  return;
                }

                await fetchAndSyncTemperature(lat, lon);
                metadataRetryCountRef.current = 0;
            } catch (error) {
                // Silent fail - weather sync is non-critical
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[WeatherSync] Failed to sync weather:', msg, error);
            }
        };

        const schedulePreExpirySync = () => {
            if (preExpiryTimerRef.current !== null) {
                window.clearTimeout(preExpiryTimerRef.current);
                preExpiryTimerRef.current = null;
            }

            const { ageMs } = getWeatherSyncMeta();
            const waitMs = Number.isFinite(ageMs)
                ? Math.max(30 * 1000, WEATHER_PREEMPTIVE_REFRESH_MS - ageMs)
                : Math.min(5 * 60 * 1000, (metadataRetryCountRef.current + 1) * 15 * 1000);

            if (!Number.isFinite(ageMs)) {
                metadataRetryCountRef.current += 1;
            } else {
                metadataRetryCountRef.current = 0;
            }

            preExpiryTimerRef.current = window.setTimeout(() => {
                if (!isMountedRef.current) return;
                void syncWeather();
                schedulePreExpirySync();
            }, waitMs);
        };

        // Sync on mount
        void syncWeather();
        schedulePreExpirySync();

        // Sync on foreground
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                if (now - lastVisibilitySyncRef.current < 30 * 1000) return;
                lastVisibilitySyncRef.current = now;
                void syncWeather();
                schedulePreExpirySync();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMountedRef.current = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (preExpiryTimerRef.current !== null) {
                window.clearTimeout(preExpiryTimerRef.current);
            }
        };
    }, [location.latitude, location.longitude]);
}
