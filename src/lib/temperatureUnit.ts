import { StorageService } from "@/services/StorageService";
/**
 * Shared temperature-unit helpers.
 *
 * On first install the unit is derived from the device locale (Fahrenheit for
 * US / Liberia / Myanmar, Celsius everywhere else).  Once the user manually
 * toggles the unit the choice is persisted to localStorage and always honoured.
 */

const STORAGE_KEY = 'prayerpal-temp-unit';
const STORAGE_SOURCE_KEY = 'prayerpal-temp-unit-source';
const TEMP_UNIT_EVENT = 'prayerpal-temperature-unit-changed';

function isNativePlatform(): boolean {
  try {
    // Avoid importing @capacitor/core here; keep this module lightweight and usable on web/PWA.
    const anyGlobal = globalThis as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    return Boolean(anyGlobal.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __ppNativeTemperatureUnit?: 'C' | 'F';
  }
}

/**
 * Detect the device-default temperature unit from the browser locale.
 * Fahrenheit regions include: US, Bahamas, Belize, Cayman Islands,
 * Palau, Liberia, Myanmar, Micronesia, and Marshall Islands.
 */
export function getDefaultTemperatureUnit(): 'C' | 'F' {
  try {
    const nativeUnit = globalThis.window?.__ppNativeTemperatureUnit;
    if (nativeUnit === 'C' || nativeUnit === 'F') return nativeUnit;

    const locale =
      navigator.languages?.find(Boolean) ||
      navigator.language ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      'en-US';

    const fahrenheitRegions = new Set([
      'US',
      'BS',
      'BZ',
      'KY',
      'PW',
      'LR',
      'MM',
      'FM',
      'MH',
    ]);

    const localeWithoutUnicode = locale.split('-u-')[0];
    let region = localeWithoutUnicode.split('-')[1]?.toUpperCase();

    if (!region && typeof Intl.Locale === 'function') {
      const intlLocale = new Intl.Locale(localeWithoutUnicode);
      region = intlLocale.region;
    }

    if (region && fahrenheitRegions.has(region.toUpperCase())) return 'F';

    return 'C';
  } catch {
    return 'C';
  }
}

export function setTemperatureUnit(unit: 'C' | 'F', source: 'auto' | 'user' = 'user'): void {
  try {
    StorageService.setItem(STORAGE_KEY, unit);
    StorageService.setItem(STORAGE_SOURCE_KEY, source);
  } catch {
    // localStorage may be unavailable in some contexts
  }

  if (globalThis.window !== undefined) {
    globalThis.window.dispatchEvent(
      new CustomEvent(TEMP_UNIT_EVENT, {
        detail: { unit, source },
      }),
    );
  }
}

export function applyNativeTemperatureUnit(unit: 'C' | 'F'): void {
  if (unit !== 'C' && unit !== 'F') return;
  if (globalThis.window === undefined) return;

  globalThis.window.__ppNativeTemperatureUnit = unit;

  try {
    const source = StorageService.getItem(STORAGE_SOURCE_KEY);
    if (source !== 'user') {
      setTemperatureUnit(unit, 'auto');
    }
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function onTemperatureUnitChanged(
  listener: (payload: { unit: 'C' | 'F'; source: 'auto' | 'user' }) => void,
): () => void {
  if (globalThis.window === undefined) {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ unit: 'C' | 'F'; source: 'auto' | 'user' }>;
    const payload = customEvent.detail;
    if (!payload) return;
    if (payload.unit !== 'C' && payload.unit !== 'F') return;
    if (payload.source !== 'auto' && payload.source !== 'user') return;
    listener(payload);
  };

  globalThis.window.addEventListener(TEMP_UNIT_EVENT, handler);
  return () => {
    globalThis.window.removeEventListener(TEMP_UNIT_EVENT, handler);
  };
}

/**
 * Return the effective temperature unit.
 *
 * 1. If the user has previously saved a preference → use it.
 * 2. Otherwise → detect from device locale and persist it so every
 *    consumer (widgets, watch, weather page) stays consistent.
 */
export function getTemperatureUnit(): 'C' | 'F' {
  try {
    const saved = StorageService.getItem(STORAGE_KEY);
    const source = StorageService.getItem(STORAGE_SOURCE_KEY);
    if ((saved === 'C' || saved === 'F') && source === 'user') return saved;
  } catch {
    // localStorage unavailable (e.g. private browsing) – fall through to auto-detect
  }

  // Native platforms: if the OS temperature unit hasn't been injected/applied yet,
  // return a best-effort unit for immediate UI rendering, but DON'T persist it.
  // We only persist once native unit arrives (via applyNativeTemperatureUnit),
  // ensuring the first stored default matches the device's preference.
  if (isNativePlatform()) {
    const nativeUnit = globalThis.window?.__ppNativeTemperatureUnit;
    if (nativeUnit !== 'C' && nativeUnit !== 'F') {
      return getDefaultTemperatureUnit();
    }
  }

  // Auto-detect from current device defaults.
  // This also repairs legacy values from older builds where auto-detected
  // values were persisted without source metadata.
  const detected = getDefaultTemperatureUnit();
  setTemperatureUnit(detected, 'auto');
  return detected;
}
