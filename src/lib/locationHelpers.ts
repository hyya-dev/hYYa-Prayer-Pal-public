/**
 * Location helper utilities extracted from usePrayerTimes.ts.
 * Handles city resolution, coordinate validation, and location persistence.
 */

import type { Location } from '@/types/prayerTypes';
import { StorageService } from "@/services/StorageService";
import { createLogger } from '@/utils/logger';

const log = createLogger('[Location]');

// Location storage key for persistence
const LOCATION_STORAGE_KEY = 'prayerpal_detected_location';

// Known city coordinates for distance-based correction (Eastern Province, Saudi Arabia)
const JUBAIL_COORDS = { lat: 27.0174, lng: 49.6225 };
const DAMMAM_COORDS = { lat: 26.3927, lng: 49.9777 };
const KHOBAR_COORDS = { lat: 26.2172, lng: 50.1971 };
const DHAHRAN_COORDS = { lat: 26.2886, lng: 50.114 };
const QATIF_COORDS = { lat: 26.5582, lng: 50.0089 };
const LOCALE_PARITY_TELEMETRY_KEY = 'prayerpal_location_locale_parity_v1';

export function trackLocationLocaleParity(
  latitude: number,
  longitude: number,
  language: string,
  isProximityLabel: boolean,
): void {
  try {
    const lat = Number(latitude.toFixed(3));
    const lng = Number(longitude.toFixed(3));
    const coordKey = `${lat}:${lng}`;

    const raw = StorageService.getItem(LOCALE_PARITY_TELEMETRY_KEY);
    const snapshots = raw ? JSON.parse(raw) as Record<string, { language: string; isProximityLabel: boolean; timestamp: number }> : {};
    const previous = snapshots[coordKey];

    if (previous && previous.language !== language && previous.isProximityLabel !== isProximityLabel) {
      log.warn('[LOCATION-PARITY] Locale changed proximity mode for same coordinates', {
        coordKey,
        previousLanguage: previous.language,
        currentLanguage: language,
        previousProximity: previous.isProximityLabel,
        currentProximity: isProximityLabel,
      });
    }

    snapshots[coordKey] = {
      language,
      isProximityLabel,
      timestamp: Date.now(),
    };
    StorageService.setItem(LOCALE_PARITY_TELEMETRY_KEY, JSON.stringify(snapshots));
  } catch (e) {
    log.warn('[LOCATION-PARITY] Failed to persist locale parity telemetry snapshot', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
  }
}

/**
 * Check if coordinates are closer to Jubail than Dammam; return 'Jubail' if so.
 * Used when API returns "Dammam" but user is in Jubail area.
 */
export function correctCityIfCloserToJubail(
  city: string,
  lat: number,
  lng: number
): string {
  if (city.toLowerCase() !== 'dammam' || lat <= 26.7 || lng >= 49.8) {
    return city;
  }
  const distToJubail = Math.sqrt(Math.pow(lat - JUBAIL_COORDS.lat, 2) + Math.pow(lng - JUBAIL_COORDS.lng, 2));
  const distToDammam = Math.sqrt(Math.pow(lat - DAMMAM_COORDS.lat, 2) + Math.pow(lng - DAMMAM_COORDS.lng, 2));
  return distToJubail < distToDammam ? 'Jubail' : city;
}

/**
 * When reverse geocoding only returns "Eastern Province" (or Ash Sharqiyah), resolve to the
 * nearest major city using coordinates. Avoids showing a region instead of the actual city
 * (e.g. Jubail, Dammam, Khobar). Matches PrayerPal behaviour for Eastern Province.
 * Exported for use in SettingsScreen when a search result only has state/region.
 */
export function resolveEasternProvinceToNearestCity(lat: number, lng: number): string {
  const minLat = 25;
  const maxLat = 28;
  const minLng = 49;
  const maxLng = 51.5;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
    return '';
  }
  const cities = [
    { name: 'Jubail', ...JUBAIL_COORDS },
    { name: 'Dammam', ...DAMMAM_COORDS },
    { name: 'Khobar', ...KHOBAR_COORDS },
    { name: 'Dhahran', ...DHAHRAN_COORDS },
    { name: 'Qatif', ...QATIF_COORDS },
  ];
  let nearest = cities[0];
  let minDist = Math.sqrt(Math.pow(lat - nearest.lat, 2) + Math.pow(lng - nearest.lng, 2));
  for (let i = 1; i < cities.length; i++) {
    const d = Math.sqrt(Math.pow(lat - cities[i].lat, 2) + Math.pow(lng - cities[i].lng, 2));
    if (d < minDist) {
      minDist = d;
      nearest = cities[i];
    }
  }
  return nearest.name;
}

/**
 * Save detected location to localStorage for persistence across app restarts
 * PERFORMANCE FIX: Removed verbose logging
 */
export function saveDetectedLocation(location: Location): void {
  try {
    StorageService.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      displayName: location.displayName,
      country: location.country,
      countryCode: location.countryCode,
      timestamp: Date.now(),
    }));
  } catch (e) {
    log.warn('Failed to persist detected location', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
  }
}

/**
 * Load previously detected location from localStorage
 * PERFORMANCE FIX: Extended TTL from 24 hours to 7 days for non-travelers
 * Returns null if no saved location or if it's older than 7 days
 */
export function loadSavedLocation(): Location | null {
  try {
    const saved = StorageService.getItem(LOCATION_STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    const age = Date.now() - (parsed.timestamp || 0);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days (extended from 24 hours)

    // If saved location is too old, don't use it
    if (age > maxAge) {
      return null;
    }

    const scrubbedCity = parsed.city === 'Current Location' || parsed.city === 'موقعي الحالي' ? '' : parsed.city;
    const scrubbedDisplayName = parsed.displayName === 'Current Location' || parsed.displayName === 'موقعي الحالي' ? '' : parsed.displayName;

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      city: scrubbedCity || '',
      displayName: scrubbedDisplayName,
      country: parsed.country,
      countryCode: parsed.countryCode,
    };
  } catch (e) {
    log.warn('Failed to read saved location', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
    return null;
  }
}

/**
 * Validate that coordinates match the expected country/region
 * Returns true if coordinates are plausible for the given country
 */
export function validateLocationCoordinates(
  lat: number,
  lng: number,
  country?: string
): boolean {
  // Basic coordinate range validation
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  // If we have country info, validate coordinates match country's approximate location
  if (country) {
    const countryLower = country.toLowerCase();
    const coordRange = (() => {
      if (lat >= 16 && lat <= 32 && lng >= 34 && lng <= 55) return 'saudi_arabia_range';
      if (lat >= 24 && lat <= 71 && lng >= -179 && lng <= -66) return 'united_states_range';
      return 'other_range';
    })();

    // Saudi Arabia: approximately 16-32°N, 34-55°E
    if (countryLower.includes('saudi') || countryLower === 'sa') {
      if (lat < 16 || lat > 32 || lng < 34 || lng > 55) {
        log.warn('[LOCATION-DEBUG] Coordinates mismatch for Saudi Arabia', { coordRange });
        return false;
      }
    }

    // United States: approximately 24-71°N, -179-(-66)°W
    if (countryLower.includes('united states') || countryLower === 'us' || countryLower === 'usa') {
      if (lat < 24 || lat > 71 || lng > -66 || lng < -179) {
        log.warn('[LOCATION-DEBUG] Coordinates mismatch for United States', { coordRange });
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate that city name matches coordinates (basic sanity check)
 * Returns true if city name doesn't contradict coordinates
 */
export function validateCityNameForCoordinates(
  city: string,
  lat: number,
  lng: number,
  _country?: string
): boolean {
  const cityLower = city.toLowerCase();

  // Known Saudi cities - check if coordinates are in Saudi Arabia range
  const saudiCities = ['jubail', 'riyadh', 'dammam', 'khobar', 'jeddah', 'mecca', 'medina', 'diriyah'];
  const isSaudiCity = saudiCities.some(c => cityLower.includes(c));

  if (isSaudiCity) {
    // Saudi Arabia: approximately 16-32°N, 34-55°E
    if (lat < 16 || lat > 32 || lng < 34 || lng > 55) {
      log.warn('[LOCATION-DEBUG] City name mismatch: Saudi city outside Saudi coordinate range', {
        city,
      });
      return false;
    }
  }

  // Known US cities - check if coordinates are in US range
  const usCities = ['san francisco', 'new york', 'los angeles', 'chicago', 'houston'];
  const isUSCity = usCities.some(c => cityLower.includes(c));

  if (isUSCity) {
    // United States: approximately 24-71°N, -179-(-66)°W
    if (lat < 24 || lat > 71 || lng > -66 || lng < -179) {
      log.warn('[LOCATION-DEBUG] City name mismatch: US city outside US coordinate range', {
        city,
      });
      return false;
    }
  }

  // CRITICAL: If coordinates are clearly in Saudi Arabia but city name is a US city, reject it
  if (lat >= 16 && lat <= 32 && lng >= 34 && lng <= 55) {
    // Coordinates are in Saudi Arabia
    if (isUSCity) {
      log.error('[LOCATION-DEBUG] CRITICAL: Saudi Arabia coordinate range conflicts with US city name', {
        city,
      });
      return false;
    }
  }

  // CRITICAL: If coordinates are clearly in US but city name is a Saudi city, reject it
  if (lat >= 24 && lat <= 71 && lng >= -179 && lng <= -66) {
    // Coordinates are in US
    if (isSaudiCity) {
      log.error('[LOCATION-DEBUG] CRITICAL: US coordinate range conflicts with Saudi city name', {
        city,
      });
      return false;
    }
  }

  return true;
}

/**
 * Verify IP geolocation result using reverse geocoding
 * This helps catch cases where IP geolocation returns wrong city names
 * PERFORMANCE FIX: Removed verbose logging
 */
// (Intentionally no IP-based geolocation fallback; rely on OS location, cached last-known, and manual entry.)
