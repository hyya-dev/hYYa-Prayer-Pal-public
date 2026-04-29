import { Capacitor, registerPlugin } from '@capacitor/core';
import i18n from '@/i18n';
import { getTemperatureUnit } from '@/lib/temperatureUnit';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import type { Prayer, Location, CalculationMethodName, ManualCorrections } from '@/hooks/usePrayerTimes';
import { PrayerTimes, Coordinates, CalculationMethod, Madhab, HighLatitudeRule } from 'adhan';
import { applyRegionalPrayerTimeExceptions } from '@/lib/prayerTimeExceptions';
import { StorageService } from "@/services/StorageService";


/**
 * Widget Service - Syncs prayer times and weather to iOS/Android widgets
 * 
 * ARCHITECTURE:
 * - App calculates 365 days of prayer times (once per day or on settings change)
 * - Widgets display the pre-calculated data
 * - App pushes temperature updates when opened
 * - Cache check prevents redundant calculations
 */

// Types for iOS widget message handlers
type WidgetMessage =
  | { action: 'savePrayerTimes'; data: { prayers: Record<string, Array<{ name: string; time: string }>>; location?: Location; calculationMethod?: CalculationMethodName; madhab?: 'shafi' | 'hanafi'; settings?: WidgetSettingsPayload } }
  | { action: 'savePrayerTimesPhaseA'; data: { prayers: Record<string, Array<{ name: string; time: string }>>; location?: Location; calculationMethod?: CalculationMethodName; madhab?: 'shafi' | 'hanafi'; settings?: WidgetSettingsPayload } }
  | { action: 'savePrayerTimesPhaseB'; data: { prayers: Record<string, Array<{ name: string; time: string }>>; location?: Location; calculationMethod?: CalculationMethodName; madhab?: 'shafi' | 'hanafi'; settings?: WidgetSettingsPayload } }
  | { action: 'saveWeather'; data: { temperature: string } }
  | { action: 'saveSettings'; data: WidgetSettingsPayload };

// Declare the global bridge function injected by PrayerPalViewController (iOS)
declare global {
  interface Window {
    // syncWidgetPrayers can accept either the old array format or the new object format
    syncWidgetPrayers?: (data: Array<{ name: string; time: string }> | {
      prayers: Record<string, Array<{ name: string; time: string }>>;
      location: Location;
      calculationMethod: CalculationMethodName;
      madhab: 'shafi' | 'hanafi';
    }) => Promise<{ success: boolean }>;

    webkit?: {
      messageHandlers?: {
        widgetSync?: {
          postMessage: (message: WidgetMessage) => void;
        };
        watchSync?: {
          postMessage: (message: { action: string; data: unknown }) => void;
        };
      };
    };
  }
}

// Native alarm data structure for Android
export interface NativeAlarm {
  id: number;
  prayerName: string;
  displayName: string;
  timeMillis: number;
  isBefore: boolean;
  minutesBefore?: number;
  soundType?: string;
  notificationTitle?: string;
  notificationBody?: string;
}

// Android Widget Bridge Plugin interface
interface WidgetBridgePlugin {
  syncPrayerData(options: { data: string }): Promise<{ success: boolean }>;
  saveWeather(options: { temperature: string }): Promise<{ success: boolean }>;
  syncWatchSettings(options: { settings: string }): Promise<{ success: boolean }>;
  getSystemClockFormat(): Promise<{ success: boolean; timeFormat24: boolean }>;
  getSystemTemperatureUnit?(): Promise<{ success: boolean; temperatureUnit: 'C' | 'F' }>;
  scheduleNativeAlarms(options: { alarms: string }): Promise<{ success: boolean; scheduledCount: number }>;
  cancelNativeAlarms(): Promise<{ success: boolean }>;
  saveNotificationSettings(options: { settings: string }): Promise<{ success: boolean }>;
  shareApp(options: { title: string; text: string; url: string }): Promise<{ success: boolean; error?: string }>;
}

// Register the native plugin
const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/**
 * Provide a stable WidgetBridge singleton accessor.
 * Used by Settings (shareApp) to avoid multiple plugin registrations.
 */
export function getWidgetBridge() {
  return WidgetBridge;
}

type WidgetLocalizedStrings = {
  appName: string;
  welcome: string;
  openAppToSync: string;
  waitingForPhone: string;
};

type WidgetSettingsPayload = {
  timeFormat24: boolean;
  temperatureUnit: 'C' | 'F';
  language: string;
  strings: WidgetLocalizedStrings;
  prayerNames: Record<string, string>;
};

const WIDGET_SETTINGS_HASH_KEY = 'widget-settings-hash';
const WIDGET_SETTINGS_TIME_KEY = 'widget-settings-time';
const WIDGET_WEATHER_VALUE_KEY = 'widget-weather-last';
const WIDGET_WEATHER_TIME_KEY = 'widget-weather-time';
const WIDGET_WEATHER_DEDUP_MS = 15 * 60 * 1000;
const WEATHER_CACHE_KEY_TIME = 'weather-cache-time';
const WEATHER_CACHE_KEY_VAL = 'weather-cache-val';
const WEATHER_CACHE_KEY_COORDS = 'weather-cache-coords';
const WEATHER_CACHE_KEY_UNIT = 'weather-cache-unit';
const WEATHER_METRICS_KEY = 'weather-sync-metrics-v1';
export const WEATHER_REFRESH_SLA_MS = 60 * 60 * 1000;
export const WEATHER_PREEMPTIVE_REFRESH_MS = 50 * 60 * 1000;
const WIDGET_MESSAGE_DEBOUNCE_MS = 250;
const WIDGET_MESSAGE_RETRY_MS = 600;
type HighLatitudeRuleValue = typeof HighLatitudeRule[keyof typeof HighLatitudeRule] | undefined;
type HighLatitudeMode = 'off' | 'auto' | 'middle' | 'seventh' | 'twilight';

type WidgetPrayerCalcOptions = {
  manualCorrections?: ManualCorrections;
  daylightSavingOffset?: number;
  highLatitudeMode?: HighLatitudeMode;
};

const WIDGET_ACTION_ORDER: Array<WidgetMessage['action']> = [
  'saveSettings',
  'saveWeather',
  'savePrayerTimesPhaseA',
  'savePrayerTimesPhaseB',
  'savePrayerTimes',
];

type PendingMessageMap = Partial<Record<WidgetMessage['action'], WidgetMessage>>;

type WeatherMetrics = {
  syncAttempt: number;
  syncSuccess: number;
  syncFailure: number;
  cacheWriteFailure: number;
  cacheHit: number;
  dedupSkip: number;
  lastAttemptAt: number;
  lastSuccessAt: number;
  lastFailureAt: number;
};

type WeatherMetricCounterKey = 'syncAttempt' | 'syncSuccess' | 'syncFailure' | 'cacheWriteFailure' | 'cacheHit' | 'dedupSkip';

const DEFAULT_WEATHER_METRICS: WeatherMetrics = {
  syncAttempt: 0,
  syncSuccess: 0,
  syncFailure: 0,
  cacheWriteFailure: 0,
  cacheHit: 0,
  dedupSkip: 0,
  lastAttemptAt: 0,
  lastSuccessAt: 0,
  lastFailureAt: 0,
};

let widgetMessageQueue: PendingMessageMap = {};
let widgetMessageTimer: number | undefined;
const widgetLastDispatchSignature: Partial<Record<WidgetMessage['action'], string>> = {};
const widgetLastDispatchAt: Partial<Record<WidgetMessage['action'], number>> = {};
const WIDGET_DUPLICATE_DISPATCH_WINDOW_MS = 5000;

function isWidgetDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (globalThis.window === undefined) return false;
  try {
    return StorageService.getItem('prayerpal-debug-widget') === '1';
  } catch {
    return false;
  }
}

function widgetDebug(...args: unknown[]): void {
  if (!isWidgetDebugEnabled()) return;
  console.log(...args);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${parts.join(',')}}`;
  }

  return JSON.stringify(value);
}

function scheduleWidgetMessageFlush(delayMs: number) {
  if (widgetMessageTimer !== undefined) {
    globalThis.clearTimeout(widgetMessageTimer);
  }

  widgetMessageTimer = globalThis.setTimeout(() => {
    widgetMessageTimer = undefined;
    void flushWidgetMessages();
  }, delayMs);
}

function shouldSkipDuplicateWidgetDispatch(message: WidgetMessage): boolean {
  const signature = stableStringify(message.data);
  const now = Date.now();
  const lastSignature = widgetLastDispatchSignature[message.action];
  const lastAt = widgetLastDispatchAt[message.action] ?? 0;

  if (lastSignature === signature && now - lastAt < WIDGET_DUPLICATE_DISPATCH_WINDOW_MS) {
    return true;
  }

  widgetLastDispatchSignature[message.action] = signature;
  widgetLastDispatchAt[message.action] = now;
  return false;
}

async function flushWidgetMessages(): Promise<void> {
  if (!Object.keys(widgetMessageQueue).length) {
    return;
  }

  const handlerReady = await waitForWidgetHandler(2000);
  if (!handlerReady) {
    scheduleWidgetMessageFlush(WIDGET_MESSAGE_RETRY_MS);
    return;
  }

  const pending = widgetMessageQueue;
  widgetMessageQueue = {};

  for (const action of WIDGET_ACTION_ORDER) {
    const message = pending[action];
    if (!message) continue;
    if (shouldSkipDuplicateWidgetDispatch(message)) continue;
    await dispatchWidgetMessage(message);
  }
}

async function dispatchWidgetMessage(message: WidgetMessage): Promise<void> {
  const win = globalThis.window;

  if (message.action === 'savePrayerTimes' && typeof win?.syncWidgetPrayers === 'function') {
    try {
      if (message.data.location && message.data.calculationMethod && message.data.madhab) {
        await win.syncWidgetPrayers({
          prayers: message.data.prayers,
          location: message.data.location,
          calculationMethod: message.data.calculationMethod,
          madhab: message.data.madhab
        });
        return;
      }
    } catch {
      // Fall through to widgetSync handler
    }
  }

  win?.webkit?.messageHandlers?.widgetSync?.postMessage(message);
}

function enqueueWidgetMessage(message: WidgetMessage): void {
  widgetMessageQueue[message.action] = message;
  scheduleWidgetMessageFlush(WIDGET_MESSAGE_DEBOUNCE_MS);
}

function readWeatherMetrics(): WeatherMetrics {
  try {
    const raw = StorageService.getItem(WEATHER_METRICS_KEY);
    if (!raw) {
      return { ...DEFAULT_WEATHER_METRICS };
    }
    return {
      ...DEFAULT_WEATHER_METRICS,
      ...(JSON.parse(raw) as Partial<WeatherMetrics>),
    };
  } catch {
    return { ...DEFAULT_WEATHER_METRICS };
  }
}

function writeWeatherMetrics(metrics: WeatherMetrics): void {
  try {
    StorageService.setItem(WEATHER_METRICS_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage errors
  }
}

function bumpWeatherMetric(key: WeatherMetricCounterKey): void {
  const metrics = readWeatherMetrics();
  metrics[key] = Number(metrics[key] || 0) + 1;
  if (key === 'syncAttempt') metrics.lastAttemptAt = Date.now();
  if (key === 'syncSuccess') metrics.lastSuccessAt = Date.now();
  if (key === 'syncFailure') metrics.lastFailureAt = Date.now();
  writeWeatherMetrics(metrics);
}

export function getWeatherSyncMeta(): {
  lastSyncAt: number;
  ageMs: number;
  metrics: WeatherMetrics;
} {
  const lastSyncAt = Number.parseInt(StorageService.getItem(WIDGET_WEATHER_TIME_KEY) || '0', 10);
  return {
    lastSyncAt,
    ageMs: lastSyncAt > 0 ? Math.max(0, Date.now() - lastSyncAt) : Number.POSITIVE_INFINITY,
    metrics: readWeatherMetrics(),
  };
}

// Cache keys for avoiding redundant calculations
const CACHE_KEY_STORAGE = 'widget-cache-key';
const CACHE_TIME_STORAGE = 'widget-sync-time';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Get translated prayer name for widget display
 */
function getTranslatedPrayerName(prayerKey: string, language: string): string {
  const normalizedKey = prayerKey.toLowerCase();
  return i18n.t(`prayers.${normalizedKey}`, {
    lng: language
  }) as string;
}

function getPrayerNameMap(language: string): Record<string, string> {
  return {
    fajr: getTranslatedPrayerName('fajr', language),
    shurooq: getTranslatedPrayerName('shurooq', language),
    dhuhr: getTranslatedPrayerName('dhuhr', language),
    asr: getTranslatedPrayerName('asr', language),
    maghrib: getTranslatedPrayerName('maghrib', language),
    isha: getTranslatedPrayerName('isha', language),
  };
}

function getWidgetLocalizedStrings(language: string): WidgetLocalizedStrings {
  return {
    appName: i18n.t('app.name', { lng: language}) as string,
    welcome: i18n.t('widget.welcome', { lng: language}) as string,
    openAppToSync: i18n.t('widget.openAppToSync', { lng: language}) as string,
    waitingForPhone: i18n.t('watch.waitingForPhone', { lng: language}) as string,
  };
}

function getUses24HourClock(): boolean {
  try {
    if (globalThis.window !== undefined) {
      const cachedClockFormat = StorageService.getItem('prayerpal-clock-format');
      if (cachedClockFormat === '24' || cachedClockFormat === '12') {
        return cachedClockFormat === '24';
      }
    }
  } catch {
    // localStorage unavailable – fall through to Intl detection
  }

  try {
    return !Intl.DateTimeFormat().resolvedOptions().hour12;
  } catch {
    return true;
  }
}

function getWidgetSettingsPayload(language: string): WidgetSettingsPayload {
  const uses24Hour = getUses24HourClock();
  const temperatureUnit = getTemperatureUnit();

  return {
    timeFormat24: uses24Hour,
    temperatureUnit,
    language,
    strings: getWidgetLocalizedStrings(language),
    prayerNames: getPrayerNameMap(language),
  };
}

/**
 * Format time for widget/watch payload in canonical 24-hour format.
 * Native platforms localize final rendering (including AM/PM markers) per locale.
 */
function formatTimeForWidget(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const WIDGET_PRAYER_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

const WIDGET_CORRECTION_KEYS: Record<typeof WIDGET_PRAYER_NAMES[number], keyof ManualCorrections> = {
  fajr: 'fajr',
  sunrise: 'shurooq',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

function formatWidgetDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

function applyHighLatitudeRuleToParams(
  params: ReturnType<typeof getCalculationParams>,
  coords: Coordinates,
  locationLatitude: number,
  highLatitudeMode: HighLatitudeMode,
): void {
  if (highLatitudeMode === 'off') return;

  let rule: HighLatitudeRuleValue | undefined;
  if (highLatitudeMode === 'middle') rule = HighLatitudeRule.MiddleOfTheNight;
  else if (highLatitudeMode === 'seventh') rule = HighLatitudeRule.SeventhOfTheNight;
  else if (highLatitudeMode === 'twilight') rule = HighLatitudeRule.TwilightAngle;
  else {
    try {
      rule = HighLatitudeRule.recommended(coords);
    } catch (error) {
      console.warn('[WidgetPrayerTimes] HighLatitudeRule.recommended failed; applying safety fallback if applicable.', {
        lat: coords.latitude,
        lon: coords.longitude,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      rule = Math.abs(coords.latitude) >= 48 ? HighLatitudeRule.SeventhOfTheNight : undefined;
    }
  }

  if (rule && (highLatitudeMode !== 'auto' || Math.abs(locationLatitude) >= 48)) {
    params.highLatitudeRule = rule;
  }
}

function applyManualCorrectionsAndDst(options: WidgetPrayerCalcOptions, dstOffsetMs: number, times: Record<typeof WIDGET_PRAYER_NAMES[number], Date>) {
  const corrected = { ...times };

  if (options.manualCorrections) {
    for (const name of WIDGET_PRAYER_NAMES) {
      const correction = options.manualCorrections[WIDGET_CORRECTION_KEYS[name]] || 0;
      if (correction !== 0) {
        corrected[name] = new Date(corrected[name].getTime() + correction * 60 * 1000);
      }
    }
  }

  if (dstOffsetMs !== 0) {
    for (const name of WIDGET_PRAYER_NAMES) {
      corrected[name] = new Date(corrected[name].getTime() + dstOffsetMs);
    }
  }

  return corrected;
}

/**
 * Check if widget sync handler is ready
 */
function isWidgetHandlerReady(): boolean {
  return (
    (typeof globalThis.window?.syncWidgetPrayers === 'function') ||
    (globalThis.window?.webkit?.messageHandlers?.widgetSync !== undefined) ||
    (globalThis.window?._widgetHandlerReady === true)
  );
}

/**
 * Wait for widget handler to be ready (with timeout)
 */
function waitForWidgetHandler(timeoutMs: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isWidgetHandlerReady()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isWidgetHandlerReady()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Get calculation parameters for prayer time calculation
 */
function getCalculationParams(method: CalculationMethodName, madhab: 'shafi' | 'hanafi') {
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

/**
 * Generate cache key for current settings
 * FIX C (v3.1.3): Added countryCode so Saudi Ramadan exception triggers cache invalidation
 * FIX B (v3.1.3): Added manualCorrections hash, daylightSavingOffset, highLatitudeMode
 */
function generateCacheKey(
  location: Location,
  calculationMethod: CalculationMethodName,
  madhab: string,
  language: string,
  manualCorrections?: ManualCorrections,
  daylightSavingOffset?: number,
  highLatitudeMode?: string,
): string {
  const corrHash = manualCorrections
    ? `${manualCorrections.fajr},${manualCorrections.shurooq},${manualCorrections.dhuhr},${manualCorrections.asr},${manualCorrections.maghrib},${manualCorrections.isha}`
    : '0,0,0,0,0,0';
  const uses24Hour = getUses24HourClock() ? '24' : '12';
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)},${calculationMethod},${madhab},${language},${location.countryCode || ''},${corrHash},${daylightSavingOffset || 0},${highLatitudeMode || 'auto'},${uses24Hour}`;
}

/**
 * Check if we need to recalculate prayer times
 * Returns true if cache is invalid or expired
 */
function needsRecalculation(
  location: Location,
  calculationMethod: CalculationMethodName,
  madhab: string,
  language: string,
  manualCorrections?: ManualCorrections,
  daylightSavingOffset?: number,
  highLatitudeMode?: string,
): boolean {
  try {
    const currentKey = generateCacheKey(location, calculationMethod, madhab, language, manualCorrections, daylightSavingOffset, highLatitudeMode);
    const lastKey = StorageService.getItem(CACHE_KEY_STORAGE);
    const lastSyncTime = Number.parseInt(StorageService.getItem(CACHE_TIME_STORAGE) || '0', 10);

    // Recalculate if:
    // 1. Settings changed (location, method, madhab, language, countryCode, corrections, DST, HLM)
    // 2. More than 1 day since last sync
    if (lastKey !== currentKey) {
      widgetDebug('[WidgetService] Cache invalid - settings changed');
      return true;
    }

    if (Date.now() - lastSyncTime > ONE_DAY_MS) {
      widgetDebug('[WidgetService] Cache expired - more than 1 day old');
      return true;
    }

    widgetDebug('[WidgetService] Cache valid - skipping recalculation');
    return false;
  } catch {
    return true; // On error, recalculate to be safe
  }
}

/**
 * Update cache markers after successful sync
 */
function updateCacheMarkers(
  location: Location,
  calculationMethod: CalculationMethodName,
  madhab: string,
  language: string,
  manualCorrections?: ManualCorrections,
  daylightSavingOffset?: number,
  highLatitudeMode?: string,
): void {
  try {
    const key = generateCacheKey(location, calculationMethod, madhab, language, manualCorrections, daylightSavingOffset, highLatitudeMode);
    StorageService.setItem(CACHE_KEY_STORAGE, key);
    StorageService.setItem(CACHE_TIME_STORAGE, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Calculate N days of prayer times for widget storage.
 * Uses requestIdleCallback for background processing
 * 
 * FIX B (v3.1.3): Now accepts manualCorrections, daylightSavingOffset, and highLatitudeMode
 * to ensure widget displays match the app exactly. Previously, the widget pipeline ignored
 * these settings, causing drift between app and widget prayer times.
 */
async function calculatePrayerTimesForDays(
  location: Location,
  calculationMethod: CalculationMethodName,
  madhab: 'shafi' | 'hanafi',
  language: string,
  days: number,
  options: WidgetPrayerCalcOptions = {},
): Promise<Record<string, Array<{ name: string; time: string }>>> {
  return new Promise((resolve) => {
    const runCalculation = () => {
      const coords = new Coordinates(location.latitude, location.longitude);
      const params = getCalculationParams(calculationMethod, madhab);

      // FIX B: Apply high latitude rule (same logic as usePrayerTimes.ts)
      applyHighLatitudeRuleToParams(params, coords, location.latitude, options.highLatitudeMode || 'auto');

      const prayersByDate: Record<string, Array<{ name: string; time: string }>> = {};

      const today = new Date();

      // FIX B: Pre-calculate DST offset once (in ms)
      const dstOffsetMs = (options.daylightSavingOffset || 0) * 60 * 60 * 1000;

      const totalDays = Math.max(1, Math.min(60, Math.floor(days)));

      // Calculate N days of prayer times
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(12, 0, 0, 0); // Noon to avoid DST edge cases

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

        const correctedTimes = applyManualCorrectionsAndDst(options, dstOffsetMs, adjustedTimes);
        const dateKey = formatWidgetDateKey(date);

        // Format times using device's local timezone (GLOBAL FIX)
        prayersByDate[dateKey] = [
          { name: getTranslatedPrayerName('fajr', language), time: formatTimeForWidget(correctedTimes.fajr) },
          { name: getTranslatedPrayerName('shurooq', language), time: formatTimeForWidget(correctedTimes.sunrise) },
          { name: getTranslatedPrayerName('dhuhr', language), time: formatTimeForWidget(correctedTimes.dhuhr) },
          { name: getTranslatedPrayerName('asr', language), time: formatTimeForWidget(correctedTimes.asr) },
          { name: getTranslatedPrayerName('maghrib', language), time: formatTimeForWidget(correctedTimes.maghrib) },
          { name: getTranslatedPrayerName('isha', language), time: formatTimeForWidget(correctedTimes.isha) },
        ];
      }

      resolve(prayersByDate);
    };

    // Use requestIdleCallback for background processing
    if (typeof requestIdleCallback === 'undefined') {
      setTimeout(runCalculation, 0);
    } else {
      requestIdleCallback(() => runCalculation(), { timeout: 5000 });
    }
  });
}

function buildPrayerSyncPayload(options: {
  prayersByDate: Record<string, Array<{ name: string; time: string }>>;
  language: string;
  location: Location;
  calculationMethod: CalculationMethodName;
  madhab: 'shafi' | 'hanafi';
}) {
  return {
    prayers: options.prayersByDate,
    location: options.location,
    calculationMethod: options.calculationMethod,
    madhab: options.madhab,
    settings: getWidgetSettingsPayload(options.language),
  };
}

async function buildPrayerPhaseData(options: {
  location: Location;
  calculationMethod: CalculationMethodName;
  madhab: 'shafi' | 'hanafi';
  language: string;
  days: number;
  calcOptions: WidgetPrayerCalcOptions;
}): Promise<ReturnType<typeof buildPrayerSyncPayload>> {
  const prayersByDate = await calculatePrayerTimesForDays(
    options.location,
    options.calculationMethod,
    options.madhab,
    options.language,
    options.days,
    options.calcOptions,
  );

  return buildPrayerSyncPayload({
    prayersByDate,
    language: options.language,
    location: options.location,
    calculationMethod: options.calculationMethod,
    madhab: options.madhab,
  });
}

async function syncPrayerPhasesToAndroid(options: {
  phaseAData: ReturnType<typeof buildPrayerSyncPayload>;
  phaseBData: ReturnType<typeof buildPrayerSyncPayload> | null;
  cacheArgs: {
    location: Location;
    calculationMethod: CalculationMethodName;
    madhab: 'shafi' | 'hanafi';
    language: string;
    calcOptions: WidgetPrayerCalcOptions;
  };
}): Promise<void> {
  // Always write Phase A so a fresh widget/watch install has something immediately.
  const phaseAResult = await WidgetBridge.syncPrayerData({
    data: JSON.stringify({ ...options.phaseAData, phase: "A" }),
  });

  if (phaseAResult.success) {
    widgetDebug('[WidgetService] ✅ Android widget Phase A synced');
  }

  if (options.phaseBData) {
    const phaseBResult = await WidgetBridge.syncPrayerData({
      data: JSON.stringify({ ...options.phaseBData, phase: "B" }),
    });
    if (phaseBResult.success) {
      widgetDebug('[WidgetService] ✅ Android widget Phase B synced');
    }
  }

  updateCacheMarkers(
    options.cacheArgs.location,
    options.cacheArgs.calculationMethod,
    options.cacheArgs.madhab,
    options.cacheArgs.language,
    options.cacheArgs.calcOptions.manualCorrections,
    options.cacheArgs.calcOptions.daylightSavingOffset,
    options.cacheArgs.calcOptions.highLatitudeMode,
  );
}

async function syncPrayerPhasesToIos(options: {
  phaseAData: ReturnType<typeof buildPrayerSyncPayload>;
  phaseBData: ReturnType<typeof buildPrayerSyncPayload> | null;
  cacheArgs: {
    location: Location;
    calculationMethod: CalculationMethodName;
    madhab: 'shafi' | 'hanafi';
    language: string;
    calcOptions: WidgetPrayerCalcOptions;
  };
}): Promise<void> {
  const handlerReady = await waitForWidgetHandler(2000);
  if (!handlerReady) {
    console.warn('[WidgetService] ⚠️ Widget handler not ready');
    return;
  }

  enqueueWidgetMessage({
    action: 'savePrayerTimesPhaseA',
    data: options.phaseAData,
  });

  if (options.phaseBData) {
    enqueueWidgetMessage({
      action: 'savePrayerTimesPhaseB',
      data: options.phaseBData,
    });
  }

  updateCacheMarkers(
    options.cacheArgs.location,
    options.cacheArgs.calculationMethod,
    options.cacheArgs.madhab,
    options.cacheArgs.language,
    options.cacheArgs.calcOptions.manualCorrections,
    options.cacheArgs.calcOptions.daylightSavingOffset,
    options.cacheArgs.calcOptions.highLatitudeMode,
  );
}

/**
 * Sync prayer times to widget (iOS and Android)
 * 
 * OPTIMIZATION: Only recalculates if settings changed or cache expired (>1 day)
 * This prevents redundant 365-day calculations on every app open.
 * 
 * FIX B (v3.1.3): Now accepts manualCorrections, daylightSavingOffset, and highLatitudeMode
 * to ensure widget displays match the app exactly.
 */
export async function syncPrayerTimesToWidget(
  prayerTimes: Prayer[],
  language: string = 'en',
  location?: Location,
  calculationMethod?: CalculationMethodName,
  madhab?: 'shafi' | 'hanafi',
  options: WidgetPrayerCalcOptions = {},
): Promise<void> {
  const platform = Capacitor.getPlatform();

  // Only sync on native platforms
  if (platform !== 'ios' && platform !== 'android') {
    return;
  }

  // Need location and settings for calculation
  if (!location || !calculationMethod || !madhab) {
    widgetDebug('[WidgetService] Missing location/settings, skipping sync');
    return;
  }

  const shouldComputePhaseB = needsRecalculation(
    location,
    calculationMethod,
    madhab,
    language,
    options.manualCorrections,
    options.daylightSavingOffset,
    options.highLatitudeMode,
  );

  const cacheArgs = {
    location,
    calculationMethod,
    madhab,
    language,
    calcOptions: options,
  };

  // Phase A: 24h bootstrap. Implemented as "today + tomorrow" (2 days)
  // so widgets/watch can compute the next 24 hours even across midnight.
  widgetDebug('[WidgetService] Calculating Phase A (24h) prayer times...');
  const phaseAData = await buildPrayerPhaseData({
    location,
    calculationMethod,
    madhab,
    language,
    days: 2,
    calcOptions: options,
  });

  let phaseBData: ReturnType<typeof buildPrayerSyncPayload> | null = null;
  if (shouldComputePhaseB) {
    widgetDebug('[WidgetService] Calculating Phase B (30d) prayer times...');
    phaseBData = await buildPrayerPhaseData({
      location,
      calculationMethod,
      madhab,
      language,
      days: 30,
      calcOptions: options,
    });
  }

  // Platform-specific sync
  if (platform === 'android') {
    try {
      await syncPrayerPhasesToAndroid({ phaseAData, phaseBData, cacheArgs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[WidgetService] ❌ Android sync failed:', message);
    }
    return;
  }

  try {
    await syncPrayerPhasesToIos({ phaseAData, phaseBData, cacheArgs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WidgetService] ❌ iOS sync failed:', message);
  }
}

/**
 * Force sync - bypasses cache check
 * Use when user explicitly changes settings
 * 
 * FIX E (v3.1.3): Now accepts additional settings parameters and is wired up
 * to be called when settings change.
 */
export async function forceSyncPrayerTimesToWidget(
  prayerTimes: Prayer[],
  language: string = 'en',
  location?: Location,
  calculationMethod?: CalculationMethodName,
  madhab?: 'shafi' | 'hanafi',
  options: WidgetPrayerCalcOptions = {},
): Promise<void> {
  // Clear cache to force recalculation
  try {
    StorageService.removeItem(CACHE_KEY_STORAGE);
    StorageService.removeItem(CACHE_TIME_STORAGE);
  } catch {
    // Ignore
  }

  return syncPrayerTimesToWidget(
    prayerTimes, language, location, calculationMethod, madhab,
    options,
  );
}

/**
 * Sync weather temperature to widget (iOS and Android)
 * Called when app opens to push fresh temperature.
 * @param force When true, skips the 15-minute same-value dedupe so native storage/widgets refresh (e.g. Weather screen just fetched).
 */
export async function syncWeatherToWidget(temperature: string, force = false): Promise<void> {
  return syncWeatherToWidgetInternal(temperature, force);
}

async function syncWeatherToWidgetInternal(temperature: string, forceSync: boolean): Promise<void> {
  const platform = Capacitor.getPlatform();

  if (platform !== 'ios' && platform !== 'android') return;

  try {
    const lastValue = StorageService.getItem(WIDGET_WEATHER_VALUE_KEY);
    const lastTime = Number.parseInt(StorageService.getItem(WIDGET_WEATHER_TIME_KEY) || '0', 10);
    if (!forceSync && lastValue === temperature && Date.now() - lastTime < WIDGET_WEATHER_DEDUP_MS) {
      bumpWeatherMetric('dedupSkip');
      return;
    }

    StorageService.setItem(WIDGET_WEATHER_VALUE_KEY, temperature);
    StorageService.setItem(WIDGET_WEATHER_TIME_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }

  try {
    bumpWeatherMetric('syncAttempt');
    if (platform === 'android') {
      const result = await WidgetBridge.saveWeather({ temperature });
      if (result.success) {
        bumpWeatherMetric('syncSuccess');
        widgetDebug('[WidgetService] ✅ Android weather synced:', temperature);
      } else {
        bumpWeatherMetric('syncFailure');
      }
      return;
    }

    // iOS
    enqueueWidgetMessage({
      action: 'saveWeather',
      data: { temperature },
    });
    bumpWeatherMetric('syncSuccess');
    widgetDebug('[WidgetService] ✅ iOS weather synced:', temperature);
  } catch (error: unknown) {
    bumpWeatherMetric('syncFailure');
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[WidgetService] Weather sync failed:', message);
  }
}

/**
 * Sync settings to Apple Watch
 * Sends language and temperature unit preferences
 */
export async function syncSettingsToWatch(settings: {
  language: string;
  temperatureUnit: 'C' | 'F';
}): Promise<void> {
  const platform = Capacitor.getPlatform();

  if (platform !== 'ios' && platform !== 'android') return;

  try {
    const payload = {
      ...getWidgetSettingsPayload(settings.language),
      temperatureUnit: settings.temperatureUnit,
    };

    if (platform === 'android') {
      const result = await WidgetBridge.syncWatchSettings({
        settings: JSON.stringify(payload),
      });

      if (result.success) {
        widgetDebug('[WidgetService] ✅ Wear settings synced:', payload);
      }
      return;
    }

    try {
      const payloadHash = stableStringify(payload);
      const lastHash = StorageService.getItem(WIDGET_SETTINGS_HASH_KEY);
      const lastTime = Number.parseInt(StorageService.getItem(WIDGET_SETTINGS_TIME_KEY) || '0', 10);
      if (lastHash === payloadHash && Date.now() - lastTime < 30 * 1000) {
        return;
      }
      // Hash stored AFTER sync to avoid blocking retries on failure
    } catch {
      // Ignore storage errors
    }

    if (globalThis.window?.webkit?.messageHandlers?.watchSync) {
      globalThis.window.webkit.messageHandlers.watchSync.postMessage({
        action: 'syncSettings',
        data: payload,
      });
      widgetDebug('[WidgetService] ✅ Watch settings synced:', payload);
    }

    enqueueWidgetMessage({
      action: 'saveSettings',
      data: payload,
    });
    widgetDebug('[WidgetService] ✅ Widget settings synced:', payload);

    // Store dedup hash only AFTER successful sync
    try {
      const payloadHash = stableStringify(payload);
      StorageService.setItem(WIDGET_SETTINGS_HASH_KEY, payloadHash);
      StorageService.setItem(WIDGET_SETTINGS_TIME_KEY, Date.now().toString());
    } catch {
      // Ignore storage errors
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[WidgetService] Watch settings sync failed:', message);
  }
}

/**
 * Fetch and sync temperature from Open-Meteo API
 */
export async function fetchAndSyncTemperature(latitude: number, longitude: number): Promise<void> {
  try {
    // CACHE CHECK: Keep API usage low while refreshing before the 60-minute freshness SLA.
    const CACHE_WINDOW_MS = WEATHER_PREEMPTIVE_REFRESH_MS;

    // Get stored cache
    const lastTime = Number.parseInt(StorageService.getItem(WEATHER_CACHE_KEY_TIME) || '0', 10);
    const lastVal = StorageService.getItem(WEATHER_CACHE_KEY_VAL);
    const lastCoords = StorageService.getItem(WEATHER_CACHE_KEY_COORDS);
    const lastUnit = StorageService.getItem(WEATHER_CACHE_KEY_UNIT);

    // Check if we moved significantly (more than ~10km or 0.1 degrees)
    const currentCoords = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
    const tempUnit = getTemperatureUnit();
    const hasMoved = lastCoords !== currentCoords;
    const unitChanged = lastUnit !== tempUnit;

    // If cache is valid (< 50 minutes), unit unchanged, and we haven't moved, use cached value.
    if (!hasMoved && !unitChanged && Date.now() - lastTime < CACHE_WINDOW_MS && lastVal) {
      bumpWeatherMetric('cacheHit');
      widgetDebug('[WidgetService] Using cached weather:', lastVal);
      await syncWeatherToWidgetInternal(lastVal, true);
      return;
    }

    const response = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`,
      {},
      8000,
    );

    if (!response.ok) return;

    const data = await response.json();
    const tempCelsius = data?.current?.temperature_2m;

    if (typeof tempCelsius !== 'number') return;

    const temp = tempUnit === 'F'
      ? Math.round((tempCelsius * 9 / 5) + 32)
      : Math.round(tempCelsius);

    const weatherString = `${temp}°${tempUnit}`;

    // Update cache
    try {
      StorageService.setItem(WEATHER_CACHE_KEY_VAL, weatherString);
      StorageService.setItem(WEATHER_CACHE_KEY_COORDS, currentCoords);
      StorageService.setItem(WEATHER_CACHE_KEY_TIME, Date.now().toString());
      StorageService.setItem(WEATHER_CACHE_KEY_UNIT, tempUnit);
    } catch {
      bumpWeatherMetric('cacheWriteFailure');
    }

    await syncWeatherToWidget(weatherString);
  } catch {
    bumpWeatherMetric('syncFailure');
    // Silent fail - temperature sync is non-critical
  }
}

/**
 * Schedule native alarms for Android
 */
export async function scheduleNativeAlarms(alarms: NativeAlarm[]): Promise<number> {
  const platform = Capacitor.getPlatform();

  if (platform !== 'android') return 0;

  try {
    const result = await WidgetBridge.scheduleNativeAlarms({
      alarms: JSON.stringify(alarms),
    });

    if (result.success) {
      widgetDebug(`[WidgetService] ✅ Scheduled ${result.scheduledCount} native alarms`);
      return result.scheduledCount;
    }
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WidgetService] ❌ Alarm scheduling failed:', message);
    return 0;
  }
}

/**
 * Cancel all native alarms on Android
 */
export async function cancelNativeAlarms(): Promise<boolean> {
  const platform = Capacitor.getPlatform();

  if (platform !== 'android') return true;

  try {
    const result = await WidgetBridge.cancelNativeAlarms();
    if (result.success) {
      widgetDebug('[WidgetService] ✅ Cancelled all native alarms');
      return true;
    }
    return false;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WidgetService] ❌ Alarm cancellation failed:', message);
    return false;
  }
}

/**
 * Save notification settings to native storage
 */
export async function saveNativeNotificationSettings(settings: {
  masterEnabled: boolean;
  soundType: string;
  prePrayerMinutes: number;
  enabledPrayers: string[];
}): Promise<boolean> {
  const platform = Capacitor.getPlatform();

  if (platform !== 'android') return true;

  try {
    const result = await WidgetBridge.saveNotificationSettings({
      settings: JSON.stringify(settings),
    });

    if (result.success) {
      widgetDebug('[WidgetService] ✅ Saved notification settings');
      return true;
    }
    return false;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WidgetService] ❌ Settings save failed:', message);
    return false;
  }
}
