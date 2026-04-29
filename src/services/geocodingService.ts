import { StorageService } from "@/services/StorageService";
export interface GeocodingAddress {
  city?: string;
  town?: string;
  village?: string;
  locality?: string;
  place?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
}

export interface ReverseGeocodeResult {
  lat: number;
  lon: number;
  display_name?: string;
  address?: GeocodingAddress;
}

export interface ForwardGeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: GeocodingAddress;
  type?: string;
  class?: string;
  importance?: number;
}

const REVERSE_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEZONE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEZONE_FALLBACK_CACHE_TTL_MS = 30 * 60 * 1000;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const CACHE_STORAGE_KEY = 'prayerpal_geocoding_cache_v1';
const MAX_PERSISTED_REVERSE = 120;
const MAX_PERSISTED_SEARCH = 80;
const MAX_PERSISTED_TIMEZONE = 120;

const reverseCache = new Map<string, { value: ReverseGeocodeResult; expires: number }>();
const searchCache = new Map<string, { value: ForwardGeocodeResult[]; expires: number }>();
const timezoneCache = new Map<string, { value: string; expires: number }>();

let lastNominatimCallAt = 0;
let cacheHydrated = false;

type CacheEntry<T> = [string, { value: T; expires: number }];

type PersistedCaches = {
  reverse: Array<CacheEntry<ReverseGeocodeResult>>;
  search: Array<CacheEntry<ForwardGeocodeResult[]>>;
  timezone: Array<CacheEntry<string>>;
};

function warnCacheError(kind: string, error: unknown, extra?: Record<string, unknown>) {
  const errorType = error instanceof Error ? error.name : "unknown";
  console.warn("[GeocodingCache]", kind, { errorType, ...extra });
}

function isBrowserStorageAvailable(): boolean {
  const win = globalThis.window;
  if (!win) return false;

  const storageWithAvailability = StorageService as unknown as {
    isAvailable?: () => boolean;
    isSupported?: () => boolean;
  };

  if (typeof storageWithAvailability.isAvailable === 'function') {
    return storageWithAvailability.isAvailable();
  }

  if (typeof storageWithAvailability.isSupported === 'function') {
    return storageWithAvailability.isSupported();
  }

  try {
    const probeKey = '__pp_storage_probe__';
    win.localStorage.setItem(probeKey, '1');
    win.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function trimEntries<T>(entries: Array<CacheEntry<T>>, maxItems: number): Array<CacheEntry<T>> {
  if (entries.length <= maxItems) {
    return entries;
  }

  const sorted = [...entries].sort((a, b) => a[1].expires - b[1].expires);
  return sorted.slice(sorted.length - maxItems);
}

function persistCaches(): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    const now = Date.now();
    const payload: PersistedCaches = {
      reverse: trimEntries(
        Array.from(reverseCache.entries()).filter(([, item]) => item.expires > now),
        MAX_PERSISTED_REVERSE,
      ),
      search: trimEntries(
        Array.from(searchCache.entries()).filter(([, item]) => item.expires > now),
        MAX_PERSISTED_SEARCH,
      ),
      timezone: trimEntries(
        Array.from(timezoneCache.entries()).filter(([, item]) => item.expires > now),
        MAX_PERSISTED_TIMEZONE,
      ),
    };

    StorageService.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    warnCacheError("persist_failed", error);
  }
}

function hydrateCachesIfNeeded(): void {
  if (cacheHydrated || !isBrowserStorageAvailable()) {
    return;
  }
  cacheHydrated = true;

  try {
    const raw = StorageService.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;

    let parsed: Partial<PersistedCaches>;
    try {
      parsed = JSON.parse(raw) as Partial<PersistedCaches>;
    } catch (error) {
      warnCacheError("hydrate_parse_failed", error);
      // Cache is a single logical namespace; clear only this cache key.
      try {
        StorageService.removeItem(CACHE_STORAGE_KEY);
      } catch (removeError) {
        warnCacheError("hydrate_clear_failed", removeError);
      }
      return;
    }
    const now = Date.now();

    if (parsed.reverse != null && !Array.isArray(parsed.reverse)) {
      warnCacheError("hydrate_invalid_reverse_shape", "invalid_shape");
    } else {
      parsed.reverse?.forEach((entry) => {
        const [key, value] = entry;
        if (key && value && value.expires > now) {
          reverseCache.set(key, value);
        }
      });
    }

    if (parsed.search != null && !Array.isArray(parsed.search)) {
      warnCacheError("hydrate_invalid_search_shape", "invalid_shape");
    } else {
      parsed.search?.forEach((entry) => {
        const [key, value] = entry;
        if (key && value && value.expires > now) {
          searchCache.set(key, value);
        }
      });
    }

    if (parsed.timezone != null && !Array.isArray(parsed.timezone)) {
      warnCacheError("hydrate_invalid_timezone_shape", "invalid_shape");
    } else {
      parsed.timezone?.forEach((entry) => {
        const [key, value] = entry;
        if (key && value && value.expires > now) {
          timezoneCache.set(key, value);
        }
      });
    }
  } catch (error) {
    warnCacheError("hydrate_failed", error);
  }
}

function roundCoord(value: number, places: number = 4): string {
  const factor = Math.pow(10, places);
  return (Math.round(value * factor) / factor).toString();
}

function reverseCacheKey(lat: number, lon: number, language: string): string {
  return `${roundCoord(lat)}:${roundCoord(lon)}:${language}`;
}

function searchCacheKey(query: string, language: string, countryCode?: string): string {
  return `${query.toLowerCase().trim()}:${language}:${countryCode || ''}`;
}

function timezoneCacheKey(lat: number, lon: number): string {
  return `${roundCoord(lat, 2)}:${roundCoord(lon, 2)}`;
}

async function throttleNominatim(): Promise<void> {
  const elapsed = Date.now() - lastNominatimCallAt;
  const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimCallAt = Date.now();
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getProxyBase(): string | null {
  const raw = import.meta.env.VITE_GEOCODE_PROXY_URL;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw.replace(/\/$/, '');
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  language: string = 'en',
): Promise<ReverseGeocodeResult | null> {
  hydrateCachesIfNeeded();

  const key = reverseCacheKey(lat, lon, language);
  const cached = reverseCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const proxyBase = getProxyBase();
  const providers: Array<() => Promise<ReverseGeocodeResult | null>> = proxyBase
    ? [
        // P1-11: When proxy is configured, it is the only geocoding source (no cascade).
        async () => {
          const data = await fetchJsonWithTimeout<ReverseGeocodeResult & { error?: string }>(
            `${proxyBase}/reverse?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(language)}`,
            { headers: { Accept: 'application/json' } },
            8000,
          );
          if (data.error) throw new Error(data.error);
          return data;
        },
      ]
    : [
        async () => {
          await throttleNominatim();
          const data = await fetchJsonWithTimeout<ReverseGeocodeResult & { error?: string }>(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': language,
                'User-Agent': 'PrayerPal/1.0',
              },
            },
            8000,
          );
          if (data.error) throw new Error(data.error);
          return data;
        },
        async () => {
          const data = await fetchJsonWithTimeout<{ locality?: string; city?: string; principalSubdivision?: string; countryName?: string; countryCode?: string; latitude?: number; longitude?: number }>(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${encodeURIComponent(language)}`,
            { headers: { Accept: 'application/json' } },
            7000,
          );

          return {
            lat,
            lon,
            display_name: [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean).join(', '),
            address: {
              city: data.city,
              locality: data.locality,
              state: data.principalSubdivision,
              country: data.countryName,
              country_code: data.countryCode?.toLowerCase(),
            },
          };
        },
      ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        reverseCache.set(key, { value: result, expires: Date.now() + REVERSE_CACHE_TTL_MS });
        persistCaches();
        return result;
      }
    } catch {
      // Try next provider
    }
  }

  return null;
}

export async function searchPlaces(
  query: string,
  language: string = 'en',
  countryCode?: string,
): Promise<ForwardGeocodeResult[]> {
  hydrateCachesIfNeeded();

  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const key = searchCacheKey(normalizedQuery, language, countryCode);
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const proxyBase = getProxyBase();
  const providers: Array<() => Promise<ForwardGeocodeResult[]>> = proxyBase
    ? [
        // P1-11: When proxy is configured, it is the only geocoding source (no cascade).
        async () => {
          const countryParam = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : '';
          const url = `${proxyBase}/search?q=${encodeURIComponent(normalizedQuery)}&lang=${encodeURIComponent(language)}${countryParam}`;
          const data = await fetchJsonWithTimeout<ForwardGeocodeResult[]>(
            url,
            { headers: { Accept: 'application/json' } },
            8000,
          );
          return Array.isArray(data) ? data : [];
        },
      ]
    : [
        async () => {
          await throttleNominatim();
          let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery)}&limit=10&addressdetails=1`;
          if (countryCode) {
            url += `&countrycodes=${countryCode.toLowerCase()}`;
          }
          const data = await fetchJsonWithTimeout<ForwardGeocodeResult[]>(
            url,
            {
              headers: {
                'Accept-Language': language,
                'User-Agent': 'PrayerPal/1.0',
              },
            },
            9000,
          );
          return Array.isArray(data) ? data : [];
        },
        async () => {
          const data = await fetchJsonWithTimeout<Array<{ lat: string; lon: string; display_name: string }>>(
            `https://geocode.maps.co/search?q=${encodeURIComponent(normalizedQuery)}`,
            { headers: { Accept: 'application/json' } },
            8000,
          );
          return (Array.isArray(data) ? data : []).slice(0, 10).map((row) => ({
            lat: row.lat,
            lon: row.lon,
            display_name: row.display_name,
            address: undefined,
          }));
        },
      ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result.length > 0) {
        searchCache.set(key, { value: result, expires: Date.now() + SEARCH_CACHE_TTL_MS });
        persistCaches();
        return result;
      }
    } catch {
      // Try next provider
    }
  }

  return [];
}

function timezoneFromDeviceFallback(): string | null {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && typeof resolved === 'string' && resolved.trim().length > 0) {
      return resolved;
    }
  } catch {
    // Ignore.
  }
  return null;
}

export async function resolveIanaTimezone(
  lat: number,
  lon: number,
  opts?: { allowDeviceFallback?: boolean },
): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError('invalid_coordinates');
  }
  hydrateCachesIfNeeded();

  const key = timezoneCacheKey(lat, lon);
  const cached = timezoneCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const providers: Array<() => Promise<string | null>> = [
    async () => {
      const data = await fetchJsonWithTimeout<{ timeZone?: string; currentUtcOffset?: { seconds?: number } }>(
        `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`,
        { headers: { Accept: 'application/json' } },
        7000,
      );
      return data.timeZone || null;
    },
    async () => {
      const data = await fetchJsonWithTimeout<{ timeZone?: { id?: string } }>(
        `https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}`,
        { headers: { Accept: 'application/json' } },
        7000,
      );
      return data.timeZone?.id || null;
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        timezoneCache.set(key, { value: result, expires: Date.now() + TIMEZONE_CACHE_TTL_MS });
        persistCaches();
        return result;
      }
    } catch {
      // try next provider
    }
  }

  // P1-8: Never fall back to computed fixed-offset Etc/GMT zones.
  // Device timezone is only acceptable when the caller explicitly opts in.
  if (opts?.allowDeviceFallback) {
    const fallback = timezoneFromDeviceFallback();
    if (fallback) {
      timezoneCache.set(key, { value: fallback, expires: Date.now() + TIMEZONE_FALLBACK_CACHE_TTL_MS });
      persistCaches();
      return fallback;
    }
  }

  throw new Error('timezone_unavailable');
}
