import { useState, useEffect, useCallback, useRef } from "react";
import i18n from "@/i18n";
import { ALL_QURAN_LANGUAGES } from "@/lib/quranLanguages";
import { StorageService } from "@/services/StorageService";


export type CalculationMethodName =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "MoonsightingCommittee"
  | "NorthAmerica"
  | "Kuwait"
  | "Qatar"
  | "Singapore"
  | "Tehran"
  | "Turkey";

export type HijriCalendarType =
  | "Islamic"
  | "IslamicCivil"
  | "IslamicTabular"
  | "IslamicUmmAlQura";

// UI language – all 63 Quran languages are also valid app UI languages.
// For languages without a dedicated locale file the app falls back to English then Arabic
// via i18next's fallbackLng mechanism.
export type Language =
  | "ar" | "en" | "sq" | "ber" | "am" | "as" | "az" | "bm" | "bn" | "bs" | "bg"
  | "km" | "zh" | "prs" | "dv" | "nl" | "fr" | "de" | "gu" | "ha"
  | "he" | "hi" | "id" | "it" | "ja" | "kk" | "rw" | "ko" | "ku" | "ms"
  | "ml" | "mrw" | "mr" | "ne" | "om" | "ps" | "fa" | "pl" | "pt" | "ro" | "ru"
  | "sd" | "si" | "so" | "es" | "sw" | "sv" | "tl" | "tg" | "ta" | "te" | "th"
  | "tr" | "uk" | "ur" | "ug" | "uz" | "vi" | "yau" | "yo";

/**
 * All Quran language codes: Arabic (original) + 59 verified Sunni translations
 * Includes all language codes from ALL_QURAN_LANGUAGES
 */
export type QuranLanguageCode =
  | "ar" | "en" | "sq" | "ber" | "am" | "as" | "az" | "bm" | "bn" | "bs" | "bg"
  | "km" | "zh" | "prs" | "dv" | "nl" | "fr" | "de" | "gu" | "ha"
  | "he" | "hi" | "id" | "it" | "ja" | "kk" | "rw" | "ko" | "ku" | "ms"
  | "ml" | "mrw" | "mr" | "ne" | "om" | "ps" | "fa" | "pl" | "pt" | "ro" | "ru"
  | "sd" | "si" | "so" | "es" | "sw" | "sv" | "tl" | "tg" | "ta" | "te" | "th"
  | "tr" | "uk" | "ur" | "ug" | "uz" | "vi" | "yau" | "yo";

/** Hisn Muslim–supported languages only */
export type HisnLibraryLanguage = "ar" | "en";

export interface PrayerNotificationSettings {
  fajr: boolean;
  shurooq: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
}

export interface ManualCorrections {
  fajr: number;
  shurooq: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface LocationSettings {
  autoDetect: boolean;
  manualCity: string;
  manualLatitude: number;
  manualLongitude: number;
}

// 'discreet' = iOS Rebound sound (for prayer time + before prayer)
// 'takbir' = Takbir sound (for prayer time ONLY, not for before prayer)
export type NotificationSoundType = "discreet" | "takbir";

export interface NotificationSettings {
  masterEnabled: boolean;
  prayerNotifications: PrayerNotificationSettings;
  prePrayerNotifications: PrayerNotificationSettings;
  prePrayerMinutes: number;
  sound: boolean;
  soundType: NotificationSoundType;
  vibration: boolean;
}

export interface CalculationSettings {
  method: CalculationMethodName;
  madhab: "shafi" | "hanafi";
  highLatitudeMode: "off" | "auto" | "middle" | "seventh" | "twilight";
  manualCorrections: ManualCorrections;
  daylightSaving: "auto" | "manual";
  daylightSavingOffset: number;
  hijriCalendarType: HijriCalendarType;
  hijriDateCorrection: number;
}

export interface AppSettings {
  location: LocationSettings;
  notifications: NotificationSettings;
  calculation: CalculationSettings;
  language: Language;
  /** Quran content language; null = use app language (with Quran fallback) */
  defaultQuranLanguage: QuranLanguageCode | null;
  /** Hisn Muslim content language; null = use app language (with Hisn fallback) */
  defaultHisnLanguage: HisnLibraryLanguage | null;
  /** Internal schema version for safe, idempotent migrations */
  schemaVersion: number;
}

const VALID_QURAN_LANGUAGE_CODES = new Set(
  ALL_QURAN_LANGUAGES.map((lang) => lang.code.toLowerCase()),
);

function normalizeLanguageCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.split("-")[0].toLowerCase();
}

function normalizeStoredQuranLanguage(
  code: string | null | undefined,
): QuranLanguageCode | null {
  const normalized = normalizeLanguageCode(code);
  if (!normalized || !VALID_QURAN_LANGUAGE_CODES.has(normalized)) return null;
  return normalized as QuranLanguageCode;
}

function normalizeStoredUiLanguage(code: string | null | undefined): Language {
  const normalized = normalizeLanguageCode(code);
  if (!normalized || !VALID_QURAN_LANGUAGE_CODES.has(normalized)) return "en";
  return normalized as Language;
}

const DEFAULT_SETTINGS: AppSettings = {
  location: {
    autoDetect: true,
    manualCity: "",
    manualLatitude: 21.4225,
    manualLongitude: 39.8262,
  },
  notifications: {
    masterEnabled: false,
    prayerNotifications: {
      fajr: true,
      shurooq: true,
      dhuhr: true,
      asr: true,
      maghrib: true,
      isha: true,
    },
    prePrayerNotifications: {
      fajr: true, // Before Fajr: ON
      shurooq: true, // Before Shurooq: ON
      dhuhr: false, // Before Dhuhr: OFF
      asr: false, // Before Asr: OFF
      maghrib: true, // Before Maghrib: ON
      isha: false, // Before Isha: OFF
    },
    prePrayerMinutes: 30,
    sound: true,
    soundType: "discreet" as NotificationSoundType,
    vibration: true,
  },
  calculation: {
    method: "UmmAlQura",
    madhab: "shafi",
    highLatitudeMode: "auto",
    manualCorrections: {
      fajr: 0,
      shurooq: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    },
    daylightSaving: "auto",
    daylightSavingOffset: 0,
    hijriCalendarType: "IslamicUmmAlQura",
    hijriDateCorrection: 0,
  },
  // Language will be set dynamically from i18n detection
  // This placeholder is overridden in the useState initializer
  language: "en",
  defaultQuranLanguage: null,
  defaultHisnLanguage: null,
  schemaVersion: 0,
};

const CURRENT_SETTINGS_SCHEMA_VERSION = 3;

function safeLogValueShape(value: unknown) {
  if (value == null) return { type: value };
  if (typeof value === "string") return { type: "string", length: value.length };
  if (typeof value === "number" || typeof value === "boolean") return { type: typeof value };
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value as Record<string, unknown>).slice(0, 12),
    };
  }
  return { type: typeof value };
}

type MigrationContext = {
  hasSavedSettings: boolean;
};

type Migration = {
  name: string;
  fromVersion: number;
  toVersion: number;
  migrate: (input: unknown, ctx: MigrationContext) => unknown;
};

const MIGRATIONS: Migration[] = [
  {
    name: "v0_to_v1_add_content_language_keys_and_soundtype",
    fromVersion: 0,
    toVersion: 1,
    migrate: (input) => {
      const parsed = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};

      const notifications = (parsed.notifications && typeof parsed.notifications === "object")
        ? (parsed.notifications as Record<string, unknown>)
        : {};

      const soundType = notifications.soundType;
      if (soundType === "bell" || soundType === "adhan") {
        notifications.soundType = "discreet";
      }

      // Handle legacy key `defaultTranslationLanguage` -> defaultQuranLanguage (+ hisn iff allowed)
      const hasNewKeys = ("defaultQuranLanguage" in parsed) && ("defaultHisnLanguage" in parsed);
      if (!hasNewKeys) {
        const old = (parsed as { defaultTranslationLanguage?: unknown }).defaultTranslationLanguage;
        if (typeof old === "string" && old.trim().length > 0) {
          parsed.defaultQuranLanguage = old;
          const hisnAllowed: HisnLibraryLanguage[] = ["ar", "en"];
          parsed.defaultHisnLanguage = hisnAllowed.includes(old as HisnLibraryLanguage)
            ? (old as HisnLibraryLanguage)
            : null;
        } else {
          parsed.defaultQuranLanguage = null;
          parsed.defaultHisnLanguage = null;
        }
      }

      parsed.notifications = notifications;
      return parsed;
    },
  },
  {
    name: "v1_to_v2_import_reader_legacy_storage_keys",
    fromVersion: 1,
    toVersion: 2,
    migrate: (input) => {
      const parsed = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
      const oldSecondaryLang = StorageService.getItem("quran_secondary_language");
      const oldHideArabic = StorageService.getItem("quran_hide_arabic");

      if (typeof oldSecondaryLang === "string" && oldSecondaryLang.trim().length > 0 && parsed.defaultQuranLanguage == null) {
        parsed.defaultQuranLanguage = oldSecondaryLang;
        const hisnAllowed: HisnLibraryLanguage[] = ["ar", "en"];
        parsed.defaultHisnLanguage = hisnAllowed.includes(oldSecondaryLang as HisnLibraryLanguage)
          ? (oldSecondaryLang as HisnLibraryLanguage)
          : null;
      } else if (oldHideArabic === "true" && parsed.defaultQuranLanguage == null) {
        parsed.defaultQuranLanguage = null;
        parsed.defaultHisnLanguage = null;
      }

      StorageService.removeItem("quran_secondary_language");
      StorageService.removeItem("quran_hide_arabic");
      return parsed;
    },
  },
  {
    name: "v2_to_v3_existing_install_arabic_defaults_once",
    fromVersion: 2,
    toVersion: 3,
    migrate: (input, ctx) => {
      const parsed = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
      const v310DefaultsSet = StorageService.getItem("v3_1_0_defaults_set");
      if (!v310DefaultsSet && ctx.hasSavedSettings) {
        parsed.defaultQuranLanguage = "ar";
        parsed.defaultHisnLanguage = "ar";
        StorageService.setItem("v3_1_0_defaults_set", "true");
      }
      return parsed;
    },
  },
];

export function migrateStoredAppSettings(raw: string | null | undefined, detectedLanguage: Language): AppSettings {
  const base: AppSettings = { ...DEFAULT_SETTINGS, language: detectedLanguage, schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION };
  if (!raw) {
    return base;
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(raw) as unknown;
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    console.warn("[AppSettings] Failed to parse stored settings", { errorType, raw: safeLogValueShape(raw) });
    // No safe partial recovery from invalid JSON; return defaults but not silently.
    return base;
  }

  const inputObj = (parsedUnknown && typeof parsedUnknown === "object") ? (parsedUnknown as Record<string, unknown>) : {};
  const fromVersion = typeof inputObj.schemaVersion === "number" ? inputObj.schemaVersion : 0;
  const ctx: MigrationContext = { hasSavedSettings: true };

  let working: unknown = inputObj;
  let version = fromVersion;
  for (const m of MIGRATIONS) {
    if (version !== m.fromVersion) continue;
    try {
      working = m.migrate(working, ctx);
      version = m.toVersion;
      // ensure we re-read schemaVersion on the object, but keep version authoritative
    } catch (error) {
      const errorType = error instanceof Error ? error.name : "unknown";
      console.warn("[AppSettings] Migration failed", {
        migration: m.name,
        errorType,
        value: safeLogValueShape(working),
      });
      // Keep whatever we have and stop applying further migrations.
      break;
    }
  }

  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(working && typeof working === "object" ? (working as Partial<AppSettings>) : {}),
    language: detectedLanguage,
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  };

  merged.language = normalizeStoredUiLanguage(merged.language);
  merged.defaultQuranLanguage = normalizeStoredQuranLanguage(merged.defaultQuranLanguage);
  if (
    merged.defaultHisnLanguage !== null &&
    merged.defaultHisnLanguage !== "ar" &&
    merged.defaultHisnLanguage !== "en"
  ) {
    merged.defaultHisnLanguage = null;
  }

  return merged;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const detectedLanguage = (i18n.language || "ar") as Language;
    const saved = StorageService.getItem("appSettings");
    return migrateStoredAppSettings(saved, detectedLanguage);
  });

  // PERFORMANCE FIX: Debounce localStorage writes to prevent UI jank
  // Synchronous StorageService.setItem can block the main thread on mobile devices
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the latest settings so cleanup never saves stale data
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      StorageService.setItem("appSettings", JSON.stringify(settings));
    }, 500);

    // Cleanup on unmount — use ref to always get LATEST settings, not stale closure
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save immediately on unmount to prevent data loss
        StorageService.setItem("appSettings", JSON.stringify(settingsRef.current));
      }
    };
  }, [settings]);

  // PERFORMANCE FIX: Wrap update functions with useCallback to maintain stable references
  // This prevents unnecessary re-renders in components that use these functions as dependencies
  const updateLocation = useCallback((location: Partial<LocationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      location: { ...prev.location, ...location },
    }));
  }, []);

  const updateNotifications = useCallback(
    (notifications: Partial<NotificationSettings>) => {
      setSettings((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, ...notifications },
      }));
    },
    [],
  );

  const updateCalculation = useCallback(
    (calculation: Partial<CalculationSettings>) => {
      setSettings((prev) => ({
        ...prev,
        calculation: { ...prev.calculation, ...calculation },
      }));
    },
    [],
  );

  const updateLanguage = useCallback((language: Language) => {
    // Performance monitoring for language switches (dev only)
    if (process.env.NODE_ENV === "development") {
      performance.mark("language-change-start");
    }

    setSettings((prev) => ({ ...prev, language }));

    // CRITICAL: Save language to localStorage SYNCHRONOUSLY before anything else.
    // The debounced save can lose the language change if the cleanup closure fires
    // with stale settings (React re-runs old effect cleanup with old state).
    try {
      const nextSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...settingsRef.current,
        language,
      };
      StorageService.setItem("appSettings", JSON.stringify(nextSettings));
    } catch {
      // Fallback: preserve full settings shape and only update language
      const fallbackSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...settingsRef.current,
        language,
      };
      StorageService.setItem("appSettings", JSON.stringify(fallbackSettings));
    }

    // Apply i18n language immediately to avoid UI getting stuck on previous locale
    // and keep detector cache in sync with explicit user choice.
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    StorageService.setItem("i18nextLng", language);

    // Measure after state update
    if (process.env.NODE_ENV === "development") {
      requestAnimationFrame(() => {
        performance.mark("language-change-end");
        performance.measure(
          "language-change",
          "language-change-start",
          "language-change-end",
        );

        const measures = performance.getEntriesByName("language-change");
        if (measures.length > 0) {
          console.log(
            `[Performance] Language change took ${measures[measures.length - 1].duration.toFixed(2)}ms`,
          );
        }

        // Clean up marks
        performance.clearMarks("language-change-start");
        performance.clearMarks("language-change-end");
        performance.clearMeasures("language-change");
      });
    }
  }, []);

  const updateQuranLanguage = useCallback(
    (defaultQuranLanguage: QuranLanguageCode | null) => {
      setSettings((prev) => ({ ...prev, defaultQuranLanguage }));
    },
    [],
  );

  const updateHisnLanguage = useCallback(
    (defaultHisnLanguage: HisnLibraryLanguage | null) => {
      setSettings((prev) => ({ ...prev, defaultHisnLanguage }));
    },
    [],
  );

  return {
    settings,
    updateLocation,
    updateNotifications,
    updateCalculation,
    updateLanguage,
    updateQuranLanguage,
    updateHisnLanguage,
  };
}
