import { useState, useEffect, useMemo, useRef } from 'react';
import { PrayerTimes, Coordinates, CalculationMethod, Madhab, HighLatitudeRule } from 'adhan';
import i18n from '@/i18n';
import { syncPrayerTimesToWidget } from '@/services/widgetService';
import { applyRegionalPrayerTimeExceptions } from '@/lib/prayerTimeExceptions';
import { findNearestSettlement } from '@/services/citySearchService';
import { reverseGeocode, resolveIanaTimezone } from '@/services/geocodingService';
import { StorageService } from "@/services/StorageService";

import {
  checkGeolocationPermission,
  getPositionWithWatch,
  GeolocationPosition,
  requestGeolocationPermission,
} from '@/services/geolocationService';

// Re-export types from dedicated module for backward compatibility
export type {
  Theme,
  CalculationMethodName,
  Prayer,
  Location,
  PrayerSettings,
  ManualCorrections,
  ExtendedCalculationSettings,
  LocationSource,
  LocationConfidence,
} from '@/types/prayerTypes';

// Import types for local use
import type {
  CalculationMethodName,
  Location,
  PrayerSettings,
  ExtendedCalculationSettings,
  LocationSource,
  Prayer,
  Theme,
  ManualCorrections,
  LocationConfidence,
} from '@/types/prayerTypes';

// Re-export formatTime from dedicated module for backward compatibility
export { formatTime } from '@/lib/formatTime';

// Import and re-export location helpers for backward compatibility
import {
  trackLocationLocaleParity,
  correctCityIfCloserToJubail,
  saveDetectedLocation,
  loadSavedLocation,
  resolveEasternProvinceToNearestCity,
} from '@/lib/locationHelpers';

export { resolveEasternProvinceToNearestCity };

// P0-1: Never compute from a silent "default Makkah" location.
// When no confirmed location exists, keep coordinates invalid and gate prayer times in UI.
const UNCONFIRMED_LOCATION: Location = {
  latitude: Number.NaN,
  longitude: Number.NaN,
  city: '',
};

const DEFAULT_SETTINGS: PrayerSettings = {
  calculationMethod: 'UmmAlQura',
  madhab: 'shafi',
};

export function getCalculationParams(method: CalculationMethodName, madhab: 'shafi' | 'hanafi') {
  const methods: Record<CalculationMethodName, () => ReturnType<typeof CalculationMethod.MuslimWorldLeague>> = {
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

  const params = methods[method]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

// REMOVED: getTimezoneOffsetFromLongitude()
// The adhan library returns Date objects with correct UTC timestamps.
// Using longitude-based offsets to shift Date objects is incorrect because
// political timezones don't follow longitude boundaries (e.g., Jubail solar
// offset is UTC+3:20 but political timezone is UTC+3). Shifting causes
// the +30 minute bug reported in v3.1.2.

type HighLatitudeRuleValue = typeof HighLatitudeRule[keyof typeof HighLatitudeRule] | undefined;

function mapHighLatitudeModeToRule(
  mode: 'off' | 'auto' | 'middle' | 'seventh' | 'twilight',
  coords: Coordinates,
): HighLatitudeRuleValue | undefined {
  if (mode === 'off') return undefined;
  if (mode === 'middle') return HighLatitudeRule.MiddleOfTheNight;
  if (mode === 'seventh') return HighLatitudeRule.SeventhOfTheNight;
  if (mode === 'twilight') return HighLatitudeRule.TwilightAngle;

  try {
    return HighLatitudeRule.recommended(coords);
  } catch (error) {
    console.warn('[PrayerTimes] HighLatitudeRule.recommended failed; applying safety fallback if applicable.', {
      lat: coords.latitude,
      lon: coords.longitude,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return Math.abs(coords.latitude) >= 48
      ? HighLatitudeRule.SeventhOfTheNight
      : undefined;
  }
}

// REMOVED: getDeviceTimezoneOffset(), getTimezoneOffsetForZone(), adjustForLocationTimezone()
// These functions compared a relative IANA offset against an absolute device offset,
// creating a phantom timezone gap that triggered a spurious +30 minute shift (BUG-1).
// The adhan library already encodes the correct wall-clock time in its Date objects.
// For remote locations, we use Intl.DateTimeFormat with the IANA timezone for DISPLAY only.

export function usePrayerTimes(
  language: string = 'en',
  locationSettings?: {
    autoDetect: boolean;
    manualCity: string;
    manualLatitude: number;
    manualLongitude: number;
  },
  calculationSettings?: ExtendedCalculationSettings,
  refreshKey?: number,
) {
  const t = i18n.getFixedT(language);
  const autoDetectEnabled = locationSettings?.autoDetect !== false;
  const manualCitySetting = locationSettings?.manualCity ?? '';
  const manualLatitudeSetting = locationSettings?.manualLatitude;
  const manualLongitudeSetting = locationSettings?.manualLongitude;
  const hasLocationSettings = locationSettings !== undefined;

  // Initialize location from saved location; otherwise keep it unconfirmed.
  // PERFORMANCE FIX: Removed verbose logging during initialization
  const [location, setLocation] = useState<Location>(() => {
    // Try to load saved location first
    const savedLocation = loadSavedLocation();
    if (savedLocation) {
      return savedLocation;
    }
    return UNCONFIRMED_LOCATION;
  });

  // Use calculation settings from props if provided, otherwise use internal state
  const [internalSettings, setInternalSettings] = useState<PrayerSettings>(() => {
    if (calculationSettings) {
      return {
        calculationMethod: calculationSettings.method,
        madhab: calculationSettings.madhab,
      };
    }
    const saved = StorageService.getItem('prayerSettings');
    try {
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch (error) {
      console.warn('Failed to parse prayer settings from storage, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    const method = calculationSettings?.method;
    const madhab = calculationSettings?.madhab;
    if (!method || !madhab) return;
    setInternalSettings((prev) => {
      const next: PrayerSettings = {
        calculationMethod: method,
        madhab,
      };
      if (
        prev.calculationMethod === next.calculationMethod &&
        prev.madhab === next.madhab
      ) {
        return prev;
      }
      return next;
    });
  }, [calculationSettings?.method, calculationSettings?.madhab]);

  // Use external calculation settings if provided, otherwise use internal
  const settings = useMemo<PrayerSettings>(() => {
    return calculationSettings
      ? { calculationMethod: calculationSettings.method, madhab: calculationSettings.madhab }
      : internalSettings;
  }, [calculationSettings, internalSettings]);
  const [isLocating, setIsLocating] = useState(true);
  const [locationSource, setLocationSource] = useState<LocationSource>('default');
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | undefined>(undefined);
  const [locationTimeZone, setLocationTimeZone] = useState<string | null>(null);
  // Force theme recalculation every minute to update background when prayer times change
  const [currentTime, setCurrentTime] = useState(() => new Date());
  // Force location re-detection on app reopen
  const [forceRelocation, setForceRelocation] = useState(0);

  // Manual refresh trigger (pull-to-refresh on Home)
  useEffect(() => {
    if (refreshKey === undefined) return;
    if (autoDetectEnabled) {
      setForceRelocation((prev) => prev + 1);
      return;
    }
    setCurrentTime(new Date());
  }, [refreshKey, autoDetectEnabled]);

  // Keep prayerSettings in sync with effective calculation choice (single on-device copy for debugging/fallback).
  useEffect(() => {
    StorageService.setItem('prayerSettings', JSON.stringify(internalSettings));
  }, [internalSettings]);

  // CRITICAL: Force location re-detection every time app reopens (for travel detection)
  // This ensures location is updated even if user traveled while app was closed
  // PERFORMANCE FIX: Removed verbose logging
  useEffect(() => {
    let wasHidden = false;

    const handleVisibilityChange = () => {
      // When app comes to foreground after being hidden, force location re-detection
      if (document.visibilityState === 'visible' && wasHidden) {
        // Only force if auto-detect is enabled
        if (autoDetectEnabled) {
          setForceRelocation(prev => prev + 1);
        }
      }
      wasHidden = document.visibilityState === 'hidden';
    };

    // Track initial state
    wasHidden = document.visibilityState === 'hidden';

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoDetectEnabled]);

  // Handle manual location or auto-detect
  // PERFORMANCE FIX: Removed verbose logging
  useEffect(() => {
    // MANUAL LOCATION MODE
    if (hasLocationSettings && !autoDetectEnabled && typeof manualLatitudeSetting === 'number' && typeof manualLongitudeSetting === 'number') {
      const newLatitude = manualLatitudeSetting;
      const newLongitude = manualLongitudeSetting;
      const newCity = manualCitySetting;

      // Only update if coordinates actually changed to prevent unnecessary re-renders
      setLocation(prev => {
        if (prev.latitude === newLatitude && prev.longitude === newLongitude && prev.city === newCity) {
          return prev;
        }
        const newLocation = {
          ...prev,
          latitude: newLatitude,
          longitude: newLongitude,
          city: newCity || prev.city || '',
          displayName: newCity || prev.displayName || prev.city || '',
          country: prev.country, // Preserve country if available
          countryCode: prev.countryCode, // Preserve country code if available
        };
        // Save manual location for persistence
        saveDetectedLocation(newLocation);
        return newLocation;
      });
      setIsLocating(false);
      setLocationSource('manual');
      return;
    }

    // AUTO-DETECT LOCATION MODE
    // P0-1/P0-2: Never silently fall back to IP or a default city for computation.
    setIsLocating(true);

    let isCancelled = false;
    let locationResolved = false;
    let gpsTimeoutId: NodeJS.Timeout | undefined;

    // Helper to set location if not already resolved
    // ANDROID FIX: Only update if coordinates changed significantly OR we don't have a city yet
    const resolveLocation = (newLocation: Location, source: LocationSource, accuracyMeters?: number) => {
      if (isCancelled || locationResolved) return false;
      locationResolved = true;

      // Check if current location already has a specific city name
      // If so, only update if coordinates changed significantly (~500m = 0.005 degrees)
      const SIGNIFICANT_CHANGE = 0.005;
      setLocation(prev => {
        const hasSpecificCity = prev.city &&
          prev.city !== '' &&
          prev.city.toLowerCase() !== 'current location' &&
          prev.city.toLowerCase() !== 'موقعي الحالي' &&
          prev.city !== 'Makkah' &&
          !prev.city.toLowerCase().includes('region') &&
          !prev.city.toLowerCase().includes('province');

        const latChanged = Math.abs(prev.latitude - newLocation.latitude) >= SIGNIFICANT_CHANGE;
        const lngChanged = Math.abs(prev.longitude - newLocation.longitude) >= SIGNIFICANT_CHANGE;
        const significantMove = latChanged || lngChanged;

        // If we have a city and coordinates barely changed, keep current location
        // but still update the source and clear loading state
        if (hasSpecificCity && !significantMove && source === 'gps') {
          // Keep existing location data but proceed with state updates below
          return prev;
        }

        // Use new location
        return newLocation;
      });

      if (source !== 'default') {
        saveDetectedLocation(newLocation);
      }
      setLocationSource(source);
      setLocationAccuracyMeters(accuracyMeters);
      setIsLocating(false);
      return true;
    };

    // Check permission status using native API.
    checkGeolocationPermission().then(async permissionStatus => {
      // First-run / reinstall UX: if auto-detect is enabled and permission is still in "prompt",
      // request it proactively so the user isn't surprised later.
      if (permissionStatus === 'prompt' && !locationResolved) {
        await requestGeolocationPermission().catch(() => {});
      }
      if (permissionStatus === 'denied' && !locationResolved) {
        const savedLocation = loadSavedLocation();
        if (savedLocation) {
          resolveLocation(savedLocation, 'cache');
          return;
        }
        resolveLocation(UNCONFIRMED_LOCATION, 'default');
      }
    }).catch(() => { });

    // LESSON LEARNED: Use native geolocation service to avoid "localhost" dialog on iOS
    // Using watchPosition via getPositionWithWatch is more reliable for fresh installs
    // because it receives location as soon as iOS starts providing updates (event-driven)
    // PERFORMANCE FIX: Removed verbose logging
    const attemptGeolocation = async () => {
      if (isCancelled || locationResolved) return;

      try {
        // Use getPositionWithWatch - more reliable than getCurrentPosition for fresh installs
        // It uses watchPosition internally which handles iOS GPS cold start better
        const position: GeolocationPosition = await getPositionWithWatch(
          { enableHighAccuracy: true },
          15000 // 15 second timeout
        );

        if (isCancelled || locationResolved) return;

        const { latitude, longitude } = position;

        // GPS succeeded - use GPS coordinates (IP was never started in sequential mode)
        resolveLocation({
          latitude,
          longitude,
          city: '',
          country: undefined,
        }, 'gps', position.accuracy);

      } catch (error: unknown) {
        if (isCancelled || locationResolved) return;

        const geoError = error as { code?: number; message?: string };

        // Permission denied (code 1) - try cached location first; otherwise remain unconfirmed.
        if (geoError.code === 1) {
          const savedLocation = loadSavedLocation();
          if (savedLocation && !locationResolved) {
            resolveLocation(savedLocation, 'cache');
          } else if (!locationResolved) {
            resolveLocation(UNCONFIRMED_LOCATION, 'default');
          }
          return;
        }

        // Other errors (timeout, unavailable) - try cached location first; otherwise remain unconfirmed.
        const savedLocation = loadSavedLocation();
        if (savedLocation && !locationResolved) {
          resolveLocation(savedLocation, 'cache');
        } else if (!locationResolved) {
          resolveLocation(UNCONFIRMED_LOCATION, 'default');
        }
      }
    };

    // Start geolocation attempt
    // Note: Native geolocation service handles iOS permission timing internally
    attemptGeolocation();

    // Master timeout - PERFORMANCE FIX: Reduced from 45s to 15s
    // SEQUENTIAL FIX: Try cache first, then IP only as last resort
    const masterTimeoutId = setTimeout(async () => {
      if (!locationResolved && !isCancelled) {
        // First try cached location
        const savedLocation = loadSavedLocation();
        if (savedLocation) {
          resolveLocation(savedLocation, 'cache');
        } else if (!locationResolved) {
          resolveLocation(UNCONFIRMED_LOCATION, 'default');
        }
      }
    }, 15000); // Reduced from 45s to 15s

    return () => {
      isCancelled = true;
      if (typeof gpsTimeoutId !== 'undefined') clearTimeout(gpsTimeoutId);
      clearTimeout(masterTimeoutId);
    };
    // Note: Do not depend on `language` here — changing UI language must not restart GPS or
    // re-fire the native location permission flow (city name re-fetch lives in a separate effect).
  }, [hasLocationSettings, autoDetectEnabled, manualLatitudeSetting, manualLongitudeSetting, manualCitySetting, forceRelocation]);

  // Track last fetched coordinates to prevent unnecessary re-fetches
  // ANDROID FIX: Small GPS fluctuations shouldn't trigger city re-lookup
  const lastFetchedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // When language changes, re-fetch city name so it displays in the new language (e.g. Arabic)
  const lastFetchedLanguageRef = useRef<string | null>(null);
  const locationMetaRef = useRef<{ city?: string; country?: string; countryCode?: string }>({
    city: location.city,
    country: location.country,
    countryCode: location.countryCode,
  });

  useEffect(() => {
    locationMetaRef.current = {
      city: location.city,
      country: location.country,
      countryCode: location.countryCode,
    };
  }, [location.city, location.country, location.countryCode]);

  // Fetch city name when location coordinates change or language changes
  // Skip if using manual location with a city name already set
  useEffect(() => {
    // If manual location is set and has a city name, don't fetch
    if (hasLocationSettings && !autoDetectEnabled && manualCitySetting) {
      return;
    }

    // Don't fetch if we're still locating or if coordinates are invalid
    if (
      isLocating ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      return;
    }

    // ANDROID FIX: Skip city lookup if coordinates haven't changed significantly
    // This prevents city name fluctuation from small GPS variations
    // Threshold: ~500 meters (0.005 degrees)
    // When language changes, always re-fetch so the city name is in the new language (e.g. Arabic).
    const SIGNIFICANT_CHANGE_THRESHOLD = 0.005;
    const languageChanged = lastFetchedLanguageRef.current != null && lastFetchedLanguageRef.current !== language;
    if (lastFetchedCoordsRef.current && !languageChanged) {
      const latDiff = Math.abs(location.latitude - lastFetchedCoordsRef.current.lat);
      const lngDiff = Math.abs(location.longitude - lastFetchedCoordsRef.current.lng);

      // If we already have a specific city name and coordinates barely changed, skip
      const currentCity = locationMetaRef.current.city;
      const hasSpecificCity = currentCity &&
        currentCity !== '' &&
        currentCity.toLowerCase() !== 'current location' &&
        currentCity.toLowerCase() !== 'موقعي الحالي' &&
        !currentCity.toLowerCase().includes('region') &&
        !currentCity.toLowerCase().includes('province');

      if (hasSpecificCity && latDiff < SIGNIFICANT_CHANGE_THRESHOLD && lngDiff < SIGNIFICANT_CHANGE_THRESHOLD) {
        return; // Skip - coordinates didn't change enough to warrant city re-lookup
      }
    }

    // Update last fetched coordinates
    lastFetchedCoordsRef.current = { lat: location.latitude, lng: location.longitude };

    // Helper to check if text contains Arabic script
    const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

    // Flag to track if this effect has been cleaned up (language changed again)
    let isCancelled = false;

    const fetchCityName = async () => {
      try {
        // Preserve the current city name if it's already a specific city (not "Current Location" or generic)
        // This prevents overwriting IP-detected city names with less specific region/state names
        const currentCity = locationMetaRef.current.city;
        const isSpecificCity = currentCity &&
          currentCity !== '' &&
          currentCity.toLowerCase() !== 'current location' &&
          currentCity.toLowerCase() !== 'موقعي الحالي' &&
          !currentCity.toLowerCase().includes('region') &&
          !currentCity.toLowerCase().includes('province') &&
          !currentCity.toLowerCase().includes('state');

        // PERFORMANCE FIX: Optimized retry logic with smarter delays and error handling
        let retryCount = 0;
        const maxRetries = 2;
        let city = currentCity && currentCity.toLowerCase() !== 'current location' && currentCity.toLowerCase() !== 'موقعي الحالي'
          ? currentCity 
          : '';
        let country: string | undefined = locationMetaRef.current.country;
        let countryCode: string | undefined = locationMetaRef.current.countryCode;

        // Helper function to create fetch with timeout
        const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 8000): Promise<Response> => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            throw error;
          }
        };

        while (retryCount <= maxRetries && !isCancelled) {
          try {
            // Use higher zoom level (18) for more precise city detection
            // PERFORMANCE FIX: Add timeout to prevent hanging requests
            const data = await reverseGeocode(location.latitude, location.longitude, language);
            if (isCancelled) return;
            if (!data) throw new Error('Geocoding APIs returned no data');

            // Extract city/town/village from address - prioritize more specific locations
            // Check display_name first for better accuracy (e.g., "Jubail" vs "Dammam")
            let extractedCity = '';

            // First, check if display_name contains a city name (more accurate)
            if (data.display_name) {
              const displayName = data.display_name.toLowerCase();
              // Check for common Saudi cities in Eastern Province (include alternate spellings)
              const cities = ['jubail', 'jubayl', 'al jubayl', 'dammam', 'khobar', 'dhahran', 'qatif', 'ras tanura', 'diriyah', 'riyadh'];
              for (const cityName of cities) {
                if (displayName.includes(cityName)) {
                  // Normalize: "jubayl" / "al jubayl" -> "Jubail"
                  const normalized = cityName === 'jubayl' || cityName === 'al jubayl' ? 'Jubail' : cityName.charAt(0).toUpperCase() + cityName.slice(1);
                  extractedCity = normalized;
                  break;
                }
              }
            }

            // If not found in display_name, use address hierarchy
            // Prioritize city/town/village/locality/place; avoid state/region unless necessary.
            if (extractedCity === '') {
              extractedCity = data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.address?.locality ||
                data.address?.place ||
                data.address?.municipality ||
                data.address?.county ||
                '';

              // Only use state/region as last resort when we have no specific place
              if (extractedCity === '' && !isSpecificCity) {
                const stateOrRegion = data.address?.state || data.address?.region;
                if (stateOrRegion) {
                  // Don't use "Eastern Province" / "Ash Sharqiyah" as city; resolve to nearest city (Jubail, Dammam, etc.)
                  if (/eastern province|ash sharqiyah|eastern region|الشرقية/i.test(stateOrRegion)) {
                    const resolved = resolveEasternProvinceToNearestCity(location.latitude, location.longitude);
                    extractedCity = resolved !== '' ? resolved : stateOrRegion;
                  } else {
                    extractedCity = stateOrRegion;
                  }
                }
              }
            }

            // Special case: Correct Dammam to Jubail if coordinates are closer
            extractedCity = correctCityIfCloserToJubail(extractedCity, location.latitude, location.longitude);

            // Extract country from address
            let extractedCountry = data.address?.country ||
              data.address?.country_code?.toUpperCase() ||
              undefined;
            const extractedCountryCode = data.address?.country_code?.toUpperCase() || undefined;

            // If we got Arabic text but requested a non-Arabic language, fallback to English
            if ((extractedCity !== '' || extractedCountry) && language !== 'ar' && (containsArabic(extractedCity) || (extractedCountry && containsArabic(extractedCountry)))) {
              // PERFORMANCE FIX: Add timeout to fallback fetch
              try {
                const fallbackData = await reverseGeocode(location.latitude, location.longitude, 'en');

                if (isCancelled) return;

                if (fallbackData) {
                  const stateOrRegion = fallbackData.address?.state || fallbackData.address?.region;
                  let fallbackCity = fallbackData.address?.city ||
                    fallbackData.address?.town ||
                    fallbackData.address?.village ||
                    fallbackData.address?.locality ||
                    fallbackData.address?.place ||
                    fallbackData.address?.municipality ||
                    fallbackData.address?.county ||
                    null;
                  if (fallbackCity == null && extractedCity === '' && !isSpecificCity && stateOrRegion) {
                    if (/eastern province|ash sharqiyah|eastern region|الشرقية/i.test(stateOrRegion)) {
                      const resolved = resolveEasternProvinceToNearestCity(location.latitude, location.longitude);
                      fallbackCity = resolved !== '' ? resolved : stateOrRegion;
                    } else {
                      fallbackCity = stateOrRegion;
                    }
                  }
                  fallbackCity = fallbackCity ?? extractedCity;
                  extractedCity = fallbackCity || extractedCity;
                  // Update country from English response if not already set
                  if (!extractedCountry) {
                    extractedCountry = fallbackData.address?.country ||
                      fallbackData.address?.country_code?.toUpperCase() ||
                      undefined;
                  }
                  if (!countryCode) {
                    countryCode = fallbackData.address?.country_code?.toUpperCase() || countryCode;
                  }
                }
              } catch (fallbackError) {
                // If fallback fails, continue with original data
              }
            }

            if (extractedCountryCode) {
              countryCode = extractedCountryCode;
            }

            // Only update city if we got a more specific name, or if we don't have one yet
            // Don't overwrite a specific city name with a less specific region/state name
            if (extractedCity !== '') {
              const isExtractedSpecific = !extractedCity.toLowerCase().includes('region') &&
                !extractedCity.toLowerCase().includes('province') &&
                !extractedCity.toLowerCase().includes('state');

              // Update city only if:
              // 1. We don't have a specific city yet, OR
              // 2. The extracted city is more specific (city/town/village) than current
              if (!isSpecificCity || (isExtractedSpecific && extractedCity !== currentCity)) {
                city = extractedCity;
              } else {
                // Keep the current specific city name
                city = currentCity;
              }
            }

            // Always update country if we got one
            if (extractedCountry) {
              country = extractedCountry;
            }

            // If we got valid location data, break out of retry loop
            if (city !== '' || country) {
              break;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // PERFORMANCE FIX: Don't retry on certain error types
            if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
              // Network/timeout errors - retry with shorter delay
              retryCount++;
              if (retryCount <= maxRetries) {
                // Shorter delays: 300ms, 600ms instead of 1s, 2s
                await new Promise(resolve => setTimeout(resolve, 300 * retryCount));
              }
            } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
              // Network connectivity issues - retry with moderate delay
              retryCount++;
              if (retryCount <= maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
              }
            } else {
              // Other errors - retry with standard delay
              retryCount++;
              if (retryCount <= maxRetries) {
                // Reduced delays: 500ms, 1000ms instead of 1s, 2s
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
              }
            }
          }
        }

        // Update location with extracted city and country
        if (!isCancelled) {
          // Special case: Correct Dammam to Jubail if coordinates are closer
          city = correctCityIfCloserToJubail(city, location.latitude, location.longitude);

          const nearest = await findNearestSettlement(location.latitude, location.longitude, country, countryCode);
          const shouldUseLocalNearestName = language === 'ar';
          const nearestCityName = nearest
            ? (shouldUseLocalNearestName ? (nearest.localName || nearest.name) : nearest.name)
            : null;
          // Only show "Near X, Y km" when geocoding returned no city name (rural/unnamed area).
          // If geocoding already identified a city, the user is within that city — just show the name.
          const isProximityLabel = Boolean(!city && nearest && nearest.distanceKm >= 1.5);
          const nearestLabel = city 
            ? city 
            : (nearest
                 ? (isProximityLabel 
                     ? t('locationConfidence.nearTemplate', { city: nearestCityName, defaultValue: `Near ${nearestCityName}` })
                     : (nearestCityName || ''))
                : (country || t('location.currentLocation', { defaultValue: 'Current Location' })));

          trackLocationLocaleParity(location.latitude, location.longitude, language, isProximityLabel);

          setLocation(prev => {
            const updatedLocation = { ...prev, city, country, countryCode, displayName: nearestLabel };
            // Save the updated location with city name
            saveDetectedLocation(updatedLocation);
            return updatedLocation;
          });
          lastFetchedLanguageRef.current = language;
        }
      } catch (error) {
        if (isCancelled) return;
        // Coordinates are valid but reverse-geocoding failed — show neutral label (no error banner).
        setLocation(prev => {
          const next = {
            ...prev,
            city: '',
            displayName: t('location.currentLocation', { defaultValue: 'Current Location' }),
            country: prev.country || undefined,
          };
          saveDetectedLocation(next);
          return next;
        });
      }
    };

    // Add a small delay to ensure coordinates are stable
    const timeoutId = setTimeout(() => {
      fetchCityName();
    }, 500);

    // Cleanup function - cancel this fetch if language changes before it completes
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [location.latitude, location.longitude, language, hasLocationSettings, autoDetectEnabled, manualCitySetting, isLocating, t]);

  useEffect(() => {
    let active = true;

    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      setLocationTimeZone(null);
      return () => {
        active = false;
      };
    }

    resolveIanaTimezone(location.latitude, location.longitude, { allowDeviceFallback: locationSource === 'gps' })
      .then((zone) => {
        if (active) {
          setLocationTimeZone(zone);
        }
      })
      .catch(() => {
        if (active) {
          setLocationTimeZone(null);
        }
      });

    return () => {
      active = false;
    };
  }, [location.latitude, location.longitude, locationSource]);

  const highLatitudeMode = calculationSettings?.highLatitudeMode || 'auto';
  const locationForCalculations = useMemo(
    () => ({
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      country: location.country,
      countryCode: location.countryCode,
    }),
    [location.latitude, location.longitude, location.city, location.country, location.countryCode],
  );

  // PERFORMANCE FIX: Smart timer that only recalculates at prayer time boundaries
  // Instead of updating every minute, calculate when the next prayer time occurs
  // and set a timeout for that specific time
  useEffect(() => {
    const now = new Date();

    // Find the next prayer time that hasn't passed yet
    // We need to calculate prayer times first to know when to wake up
    const coords = new Coordinates(locationForCalculations.latitude, locationForCalculations.longitude);
    const params = getCalculationParams(settings.calculationMethod, settings.madhab);
    const configuredRule = mapHighLatitudeModeToRule(highLatitudeMode, coords);
    if (configuredRule && (highLatitudeMode !== 'auto' || Math.abs(locationForCalculations.latitude) >= 48)) {
      params.highLatitudeRule = configuredRule;
    }
    const times = new PrayerTimes(coords, now, params);

    const adjustedTimes = applyRegionalPrayerTimeExceptions(
      {
        fajr: times.fajr,
        sunrise: times.sunrise,
        dhuhr: times.dhuhr,
        asr: times.asr,
        maghrib: times.maghrib,
        isha: times.isha,
      },
      { date: now, location: locationForCalculations },
    );

    const allTimes = [
      adjustedTimes.fajr,
      adjustedTimes.sunrise,
      adjustedTimes.dhuhr,
      adjustedTimes.asr,
      adjustedTimes.maghrib,
      adjustedTimes.isha,
    ];

    // Find the next prayer time
    let nextBoundary = allTimes.find(t => t > now);

    // If all prayers passed today, use tomorrow's Fajr (add ~18-24 hours, but cap at 1 hour for safety)
    if (!nextBoundary) {
      // Fallback: check again in 1 hour
      nextBoundary = new Date(now.getTime() + 60 * 60 * 1000);
    }

    // Calculate milliseconds until next boundary (add 1 second buffer)
    const msUntilNextBoundary = Math.max(1000, nextBoundary.getTime() - now.getTime() + 1000);

    // Cap at 1 hour to ensure we don't miss anything due to timezone/DST issues
    const timeout = Math.min(msUntilNextBoundary, 60 * 60 * 1000);

    const timeoutId = setTimeout(() => {
      setCurrentTime(new Date());
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [locationForCalculations, settings.calculationMethod, settings.madhab, currentTime, highLatitudeMode]);

  // Track if we've synced for the current day to avoid excessive syncs
  const lastSyncDateRef = useRef<string>('');

  const prayerTimes = useMemo(() => {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      return [] as Prayer[];
    }
    const coords = new Coordinates(location.latitude, location.longitude);
    const params = getCalculationParams(settings.calculationMethod, settings.madhab);
    const configuredRule = mapHighLatitudeModeToRule(highLatitudeMode, coords);
    if (configuredRule && (highLatitudeMode !== 'auto' || Math.abs(location.latitude) >= 48)) {
      params.highLatitudeRule = configuredRule;
    }
    // Use currentTime to ensure prayer times update when day changes
    const today = currentTime;
    const times = new PrayerTimes(coords, today, params);

    // FIX A (v3.1.3): The adhan library returns Date objects with correct UTC timestamps.
    // Per adhan docs: "format the times for the correct timezone" using Intl.DateTimeFormat.
    // We NEVER shift Date objects — getHours()/getMinutes() already return correct local time
    // when the device timezone matches the location. For remote locations, formatTime() handles
    // display using the IANA timezone via Intl.DateTimeFormat.
    const baseTimes = {
      fajr: new Date(times.fajr.getTime()),
      sunrise: new Date(times.sunrise.getTime()),
      dhuhr: new Date(times.dhuhr.getTime()),
      asr: new Date(times.asr.getTime()),
      maghrib: new Date(times.maghrib.getTime()),
      isha: new Date(times.isha.getTime()),
    };

    // Apply regional prayer time exceptions (e.g., Saudi Ramadan Isha = Maghrib + 2h)
    const exceptionAdjustedTimes = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: today,
      location,
    });

    // Create prayer times array — no timezone shifting needed
    const prayers: Prayer[] = [
      {
        name: 'fajr',
        displayName: 'Fajr',
        time: exceptionAdjustedTimes.fajr,
      },
      {
        name: 'shurooq',
        displayName: 'Shurooq',
        time: exceptionAdjustedTimes.sunrise,
      },
      {
        name: 'dhuhr',
        displayName: 'Dhuhr',
        time: exceptionAdjustedTimes.dhuhr,
      },
      {
        name: 'asr',
        displayName: 'Asr',
        time: exceptionAdjustedTimes.asr,
      },
      {
        name: 'maghrib',
        displayName: 'Maghrib',
        time: exceptionAdjustedTimes.maghrib,
      },
      {
        name: 'isha',
        displayName: 'Isha',
        time: exceptionAdjustedTimes.isha,
      },
    ];

    // Apply manual corrections if they exist
    if (calculationSettings?.manualCorrections) {
      prayers.forEach(prayer => {
        const correction = calculationSettings.manualCorrections![prayer.name as keyof ManualCorrections] || 0;
        if (correction !== 0) {
          prayer.time = new Date(prayer.time.getTime() + correction * 60 * 1000);
        }
      });
    }

    // Apply DST offset if manual mode is enabled
    if (calculationSettings?.daylightSaving === 'manual' && calculationSettings.daylightSavingOffset !== 0) {
      const dstOffsetMs = (calculationSettings.daylightSavingOffset || 0) * 60 * 60 * 1000;
      prayers.forEach(prayer => {
        prayer.time = new Date(prayer.time.getTime() + dstOffsetMs);
      });
    }

    // FIX D (v3.1.3): REMOVED the second applyRegionalPrayerTimeExceptions() call.
    // Previously, exceptions were applied twice — once on raw times (correct) and again
    // AFTER manual corrections, which would overwrite user's manual Isha correction
    // during Saudi Ramadan (resetting it to Maghrib + 2h). Now exceptions are applied
    // once before manual corrections, and manual corrections take final precedence.

    return prayers;
  }, [location, settings, currentTime, calculationSettings, highLatitudeMode]);

  const locationConfidence = useMemo<LocationConfidence>(() => {
    if (locationSource === 'gps') {
      const accuracy = Number.isFinite(locationAccuracyMeters) ? Math.round(locationAccuracyMeters as number) : undefined;
      return {
        source: 'gps',
        accuracyMeters: accuracy,
        label: accuracy && accuracy > 100
          ? t('locationConfidence.gpsWithAccuracy', {
            accuracy,
          })
          : t('location.source.gps', { defaultValue: t('locationConfidence.gps', { defaultValue: 'GPS' }) }),
      };
    }

    if (locationSource === 'ip') {
      return {
        source: 'ip',
        label: t('location.source.network', {
          defaultValue: t('locationConfidence.ipApproximate', { defaultValue: 'Network' }),
        }),
      };
    }

    if (locationSource === 'cache') {
      return {
        source: 'cache',
        label: t('locationConfidence.cached', { defaultValue: 'Cached Location' }),
      };
    }

    if (locationSource === 'manual') {
      return {
        source: 'manual',
        label: t('locationConfidence.manual', { defaultValue: 'Manual Location' }),
      };
    }

    return {
      source: 'default',
      label: t('locationConfidence.default', { defaultValue: 'Location unavailable' }),
    };
  }, [locationSource, locationAccuracyMeters, t]);

  const nextPrayer = useMemo(() => {
    if (!prayerTimes.length) return null;
    const now = currentTime; // Use currentTime to ensure it updates
    for (const prayer of prayerTimes) {
      if (now < prayer.time) {
        return prayer;
      }
    }
    // If all prayers passed, next is tomorrow's Fajr
    return prayerTimes[0];
  }, [prayerTimes, currentTime]);

  const currentTheme = useMemo((): Theme => {
    if (!prayerTimes.length) return 'sunrise';
    const now = currentTime; // Use currentTime state instead of new Date() to force recalculation
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const shurooq = prayerTimes.find(p => p.name === 'shurooq')!;
    const dhuhr = prayerTimes.find(p => p.name === 'dhuhr')!;
    const maghrib = prayerTimes.find(p => p.name === 'maghrib')!;

    const shurooqMinutes = shurooq.time.getHours() * 60 + shurooq.time.getMinutes();
    const dhuhrMinutes = dhuhr.time.getHours() * 60 + dhuhr.time.getMinutes();
    const maghribMinutes = maghrib.time.getHours() * 60 + maghrib.time.getMinutes();

    if (currentMinutes >= shurooqMinutes && currentMinutes < dhuhrMinutes) {
      return 'sunrise';
    } else if (currentMinutes >= dhuhrMinutes && currentMinutes < maghribMinutes) {
      return 'afternoon';
    }
    return 'sunset';
  }, [prayerTimes, currentTime]);

  // Sync prayer times to Widget/Watch when app opens or data changes
  // ARCHITECTURE: widgetService calculates 365 days (with cache check to avoid redundant work)
  // Widgets display pre-calculated data, app pushes temperature updates
  useEffect(() => {
    // Only sync if we have prayer times
    if (!prayerTimes || prayerTimes.length === 0) {
      return;
    }

    // Don't sync if we're still locating
    if (isLocating) {
      return;
    }

    // Don't sync when location is unconfirmed / invalid.
    if (
      locationSource === 'default' ||
      !Number.isFinite(locationForCalculations.latitude) ||
      !Number.isFinite(locationForCalculations.longitude)
    ) {
      return;
    }

    // Sync to widget - widgetService handles cache check internally
    // Only recalculates 365 days if settings changed or cache expired (>1 day)
    // FIX B (v3.1.3): Pass manualCorrections, daylightSavingOffset, and highLatitudeMode
    // so widget times match app times exactly.
    syncPrayerTimesToWidget(
      prayerTimes,
      language,
      locationForCalculations,
      settings.calculationMethod,
      settings.madhab,
      calculationSettings?.manualCorrections,
      calculationSettings?.daylightSaving === 'manual' ? calculationSettings.daylightSavingOffset : 0,
      calculationSettings?.highLatitudeMode,
    ).catch(() => {
      // Widget sync errors are not critical
    });

    // Temperature sync is handled by useWeatherSync hook

  }, [
    prayerTimes,
    locationForCalculations,
    locationSource,
    isLocating,
    language,
    settings.calculationMethod,
    settings.madhab,
    calculationSettings?.manualCorrections,
    calculationSettings?.daylightSaving,
    calculationSettings?.daylightSavingOffset,
    calculationSettings?.highLatitudeMode,
  ]);

  return {
    prayerTimes,
    nextPrayer,
    currentTheme,
    location,
    settings: internalSettings, // Return internal settings for backward compatibility
    setSettings: setInternalSettings, // Allow updating internal settings if needed
    isLocating,
    locationSource, // 'gps' | 'ip' | 'cache' | 'manual' | 'default' - for debugging
    locationConfidence,
    locationTimeZone,
  };
}
