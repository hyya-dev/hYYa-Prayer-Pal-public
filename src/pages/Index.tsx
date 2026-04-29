import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useQibla } from "@/hooks/useQibla";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppSettings, CalculationMethodName } from "@/hooks/useAppSettings";
import { useSensorCalibration } from "@/hooks/useSensorCalibration";
import {
  getWidgetBridge,
  syncSettingsToWatch,
  syncPrayerTimesToWidget,
} from "@/services/widgetService";
import { applyNativeTemperatureUnit, getTemperatureUnit } from '@/lib/temperatureUnit';
import { ThemeBackground } from "@/components/ThemeBackground";
import { Header } from "@/components/Header";
import { QiblaCompass } from "@/components/QiblaCompass";
import { HomeView } from "@/components/HomeView";
import { BottomNav, Screen } from "@/components/BottomNav";
import { NotificationPrePrompt } from "@/components/NotificationPrePrompt";
import { NotificationPostPrompt } from "@/components/NotificationPostPrompt";
import { LocationBadgePreview } from "@/components/LocationBadgePreview";
import { LocationBadge } from "@/components/LocationBadge";
import { useIsIpad } from "@/hooks/useIsIpad";
import { useNotificationScheduling } from "@/hooks/useNotificationScheduling";
import { useWeatherSync } from "@/hooks/useWeatherSync";
import { StorageService } from "@/services/StorageService";

const Counter = lazy(() => import("./Counter"));
const Weather = lazy(() => import("./Weather"));
const Library = lazy(() => import("./Library"));
const SettingsScreen = lazy(async () => {
  const mod = await import("@/components/SettingsScreen");
  return { default: mod.SettingsScreen };
});

const screenLoadingFallback = (
  <div className="flex-1 flex items-center justify-center">
    <Loader2
      className="w-8 h-8 animate-spin"
      style={{ color: "var(--pp-header-meta-color)" }}
    />
  </div>
);

// ============================================
// Pure function: resolve calculation method from location
// Reference: https://praytimes.org/wiki/Calculation_Methods
// ============================================
const COUNTRY_CODE_METHOD_MAP: Record<string, CalculationMethodName> = {
  SA: 'UmmAlQura', AE: 'Dubai', KW: 'Kuwait', QA: 'Qatar',
  EG: 'Egyptian', TR: 'Turkey', IR: 'Tehran', PK: 'Karachi',
  US: 'NorthAmerica', CA: 'NorthAmerica',
  GB: 'MoonsightingCommittee', IE: 'MoonsightingCommittee',
  SG: 'Singapore', MY: 'Singapore', ID: 'Singapore', BN: 'Singapore',
};

const COUNTRY_NAME_METHOD_MAP: Array<{ matches: string[]; method: CalculationMethodName }> = [
  { matches: ['saudi', 'ksa', 'السعود'], method: 'UmmAlQura' },
  { matches: ['united arab emirates', 'uae', 'الإمارات'], method: 'Dubai' },
  { matches: ['kuwait', 'الكويت'], method: 'Kuwait' },
  { matches: ['qatar', 'قطر'], method: 'Qatar' },
  { matches: ['egypt', 'مصر'], method: 'Egyptian' },
  { matches: ['turkey', 'türkiye', 'تركيا'], method: 'Turkey' },
  { matches: ['iran', 'إيران'], method: 'Tehran' },
  { matches: ['pakistan', 'پاکستان'], method: 'Karachi' },
  { matches: ['united states', 'usa', 'canada'], method: 'NorthAmerica' },
  { matches: ['united kingdom', 'uk', 'ireland'], method: 'MoonsightingCommittee' },
  { matches: ['singapore', 'malaysia', 'indonesia', 'brunei'], method: 'Singapore' },
];

interface GeoLocation {
  latitude: number;
  longitude: number;
  country?: string;
  countryCode?: string;
}

function resolveMethodFromCountry(country: string, countryCode: string): CalculationMethodName | null {
  const codeMatch = COUNTRY_CODE_METHOD_MAP[countryCode];
  if (codeMatch) return codeMatch;
  const nameMatch = COUNTRY_NAME_METHOD_MAP.find((entry) =>
    entry.matches.some((token) => country.includes(token)),
  );
  return nameMatch?.method ?? null;
}

const COORDINATE_REGIONS: Array<{ latMin: number; latMax: number; lonMin: number; lonMax: number; method: CalculationMethodName }> = [
  { latMin: 24, latMax: 72, lonMin: -170, lonMax: -50, method: 'NorthAmerica' },
  { latMin: 49, latMax: 61, lonMin: -11, lonMax: 2, method: 'MoonsightingCommittee' },
  { latMin: 55, latMax: 72, lonMin: -10, lonMax: 40, method: 'MoonsightingCommittee' },
  { latMin: 35, latMax: 72, lonMin: -10, lonMax: 40, method: 'MuslimWorldLeague' },
  { latMin: 16, latMax: 33, lonMin: 34, lonMax: 56, method: 'UmmAlQura' },
  { latMin: 22, latMax: 27, lonMin: 51, lonMax: 57, method: 'Dubai' },
  { latMin: 28.5, latMax: 30.5, lonMin: 46, lonMax: 49, method: 'Kuwait' },
  { latMin: 24, latMax: 27, lonMin: 50, lonMax: 52, method: 'Qatar' },
  { latMin: 22, latMax: 32, lonMin: 24, lonMax: 37, method: 'Egyptian' },
  { latMin: 36, latMax: 42, lonMin: 26, lonMax: 45, method: 'Turkey' },
  { latMin: 25, latMax: 40, lonMin: 44, lonMax: 64, method: 'Tehran' },
  { latMin: 18, latMax: 38, lonMin: -18, lonMax: 25, method: 'MuslimWorldLeague' },
  { latMin: 29, latMax: 38, lonMin: 34, lonMax: 49, method: 'MuslimWorldLeague' },
  { latMin: 23, latMax: 37, lonMin: 60, lonMax: 78, method: 'Karachi' },
  { latMin: 5, latMax: 37, lonMin: 68, lonMax: 98, method: 'Karachi' },
  { latMin: -11, latMax: 8, lonMin: 95, lonMax: 142, method: 'Singapore' },
];

function resolveMethodFromCoordinates(lat: number, lon: number): CalculationMethodName {
  const match = COORDINATE_REGIONS.find(
    (r) => lat >= r.latMin && lat <= r.latMax && lon >= r.lonMin && lon <= r.lonMax,
  );
  return match?.method ?? 'MuslimWorldLeague';
}

function getRecommendedCalculationMethod(loc: GeoLocation): CalculationMethodName {
  const country = (loc.country || '').toLowerCase();
  const countryCode = (loc.countryCode || '').toUpperCase();
  const countryMethod = resolveMethodFromCountry(country, countryCode);
  if (countryMethod) return countryMethod;
  return resolveMethodFromCoordinates(loc.latitude, loc.longitude);
}

type ClockFormat = "12" | "24";

export default function Index() {
  const CLOCK_FORMAT_STORAGE_KEY = "prayerpal-clock-format";

  const getClockFormatFromIntl = () =>
    Intl.DateTimeFormat().resolvedOptions().hour12 ? "12" : "24";

  const getDeviceClockFormat = () =>
    (StorageService.getItem(CLOCK_FORMAT_STORAGE_KEY) as ClockFormat | null) ??
    getClockFormatFromIntl();

  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [settingsKey, setSettingsKey] = useState(0); // Key to force Settings reset
  const [settingsInitialView, setSettingsInitialView] = useState<import("@/components/SettingsScreen").SettingsView | undefined>(undefined);
  const [libraryKey, setLibraryKey] = useState(0); // Key to force Library full remount (navigate-away)
  const [librarySessionKey, setLibrarySessionKey] = useState(0); // Incremented on active-tab back-tap
  const [weatherKey, setWeatherKey] = useState(0); // Key to force Weather reset
  const [deviceClockFormat, setDeviceClockFormat] = useState<ClockFormat>(
    getDeviceClockFormat,
  );
  const [homeRefreshKey, setHomeRefreshKey] = useState<number | undefined>(
    undefined,
  );
  const activeScreen: Screen = currentScreen === "quran" ? "library" : currentScreen;

  // Handle screen navigation with scroll reset
  const handleScreenNavigation = useCallback(
    (screen: Screen) => {
      // UX Logic Rule 3: Tapping active nav icon steps back one level at a time.
      if (screen === currentScreen) {
        if (screen === "library") {
          // Step back one level inside Library (reader → list → home)
          setLibrarySessionKey((prev) => prev + 1);
        }
        if (screen === "settings") setSettingsKey((prev) => prev + 1);
        if (screen === "weather") setWeatherKey((prev) => prev + 1);
        // For Home, we could scroll to top, but it's fixed height mostly
      } else {
        if (screen === "library") {
          // Full remount when navigating TO library from another screen
          setLibraryKey((prev) => prev + 1);
        }
        setCurrentScreen(screen);
      }
    },
    [currentScreen],
  );

  const { t, i18n } = useTranslation();
  const showBadgePreview = globalThis.window !== undefined && new URLSearchParams(globalThis.location.search).get('badgePreview') === '1';

  // Add Android detection class to body for CSS targeting
  useEffect(() => {
    const isAndroid = Capacitor.getPlatform() === "android";
    if (isAndroid) {
      document.body.classList.add("is-android");
      document.documentElement.classList.add("is-android");
    }
    return () => {
      document.body.classList.remove("is-android");
      document.documentElement.classList.remove("is-android");
    };
  }, []);

  // Lock document scroll when Home is active (no scroll up/down on Home)
  useEffect(() => {
    if (activeScreen === "home") {
      document.body.classList.add("home-no-scroll");
      document.documentElement.classList.add("home-no-scroll");
    } else {
      document.body.classList.remove("home-no-scroll");
      document.documentElement.classList.remove("home-no-scroll");
    }
    return () => {
      document.body.classList.remove("home-no-scroll");
      document.documentElement.classList.remove("home-no-scroll");
    };
  }, [activeScreen]);

  const {
    settings: appSettings,
    updateLocation,
    updateNotifications,
    updateCalculation,
    updateLanguage,
    updateQuranLanguage,
    updateHisnLanguage,
  } = useAppSettings();

  // Sync i18n language with app settings
  // Language change must be synchronous to prevent visible flash of wrong language
  useEffect(() => {
    if (i18n.language !== appSettings.language) {
      i18n.changeLanguage(appSettings.language);
    }
  }, [appSettings.language, i18n]);

  const { sensorStatus, requestCalibration } = useSensorCalibration();

  useEffect(() => {
    const fetchAndroidBridgeFormats = async (): Promise<{
      clockFormat: ClockFormat | null;
      tempUnit: "C" | "F" | null;
    }> => {
      if (Capacitor.getPlatform() !== "android") return { clockFormat: null, tempUnit: null };
      try {
        const bridge = getWidgetBridge();
        const result = await bridge.getSystemClockFormat();
        let clockFormat: ClockFormat | null = null;
        if (result?.success) {
          clockFormat = result.timeFormat24 ? "24" : "12";
        }

        let tempUnit: "C" | "F" | null = null;
        if (bridge.getSystemTemperatureUnit) {
          const tempResult = await bridge.getSystemTemperatureUnit();
          if (tempResult?.success && (tempResult.temperatureUnit === 'C' || tempResult.temperatureUnit === 'F')) {
            tempUnit = tempResult.temperatureUnit;
          }
        }
        return { clockFormat, tempUnit };
      } catch {
        return { clockFormat: null, tempUnit: null };
      }
    };

    const refreshClockFormat = async () => {
      let next = getDeviceClockFormat();

      const { clockFormat, tempUnit } = await fetchAndroidBridgeFormats();
      if (clockFormat) next = clockFormat;

      try {
        StorageService.setItem(CLOCK_FORMAT_STORAGE_KEY, next);
      } catch {
        // localStorage may be unavailable in some environments
      }
      setDeviceClockFormat((prev) => (prev === next ? prev : next));

      if (tempUnit) {
        applyNativeTemperatureUnit(tempUnit);
      }
    };

    void refreshClockFormat();

    const intervalId = globalThis.setInterval(() => {
      void refreshClockFormat();
    }, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshClockFormat();
      }
    };

    const handleWindowFocus = () => {
      void refreshClockFormat();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      globalThis.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleWindowFocus);
    };
  // getDeviceClockFormat is recreated per render by design in this screen module;
  // effect lifecycle should remain tied to mount/visibility events only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    prayerTimes,
    nextPrayer,
    currentTheme,
    location,
    locationSource: _locationSource,
    isLocating,
    locationConfidence,
    locationTimeZone,
  } = usePrayerTimes(
    appSettings.language,
    appSettings.location,
    useMemo(
      () => ({
        method: appSettings.calculation.method,
        madhab: appSettings.calculation.madhab,
        highLatitudeMode: appSettings.calculation.highLatitudeMode,
        manualCorrections: appSettings.calculation.manualCorrections,
        daylightSaving: appSettings.calculation.daylightSaving,
        daylightSavingOffset: appSettings.calculation.daylightSavingOffset,
      }),
      [
        appSettings.calculation.method,
        appSettings.calculation.madhab,
        appSettings.calculation.highLatitudeMode,
        appSettings.calculation.manualCorrections,
        appSettings.calculation.daylightSaving,
        appSettings.calculation.daylightSavingOffset,
      ],
    ),
    homeRefreshKey,
  );

  // Location status logging removed to improve performance

  // Auto-select calculation method based on location
  useEffect(() => {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;

    const hasManualOverride =
      StorageService.getItem("calculationMethodManualOverride") === "true";
    if (hasManualOverride) return;

    const recommendedMethod = getRecommendedCalculationMethod(location);
    if (appSettings.calculation.method !== recommendedMethod) {
      updateCalculation({ method: recommendedMethod });
    }
  }, [
    location,
    appSettings.calculation.method,
    updateCalculation,
  ]);

  // Note: Qibla direction automatically updates via useQibla hook's useMemo dependencies
  // which depend on location.latitude and location.longitude

  // Update Android status bar color based on theme (skip on iOS)
  // LESSON LEARNED: Use Capacitor.getPlatform() instead of user agent parsing
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    const themeColors: Record<string, string> = {
      sunrise: "#000000", // Pure black
      afternoon: "#000000", // Pure black
      sunset: "#000000", // Pure black
    };

    const color = themeColors[currentTheme] || themeColors.sunrise;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color);
  }, [currentTheme]);

  const qiblaDirection = useQibla(location.latitude, location.longitude);
  const {
    isEnabled: _isEnabled,
    isSupported,
    permission,
    requestPermission,
    autoGranted: _autoGranted,
    scheduleAllNotifications,
    testNotificationSound,
    // Pre-prompt modal
    showPrePrompt,
    handlePrePromptEnable,
    handlePrePromptLater,
    dismissPrePrompt,
    // Post-prompt modal (shown after permission is granted)
    showPostPrompt,
    showEnablePostPrompt,
    handlePostPromptEnable,
    handlePostPromptNotNow,
  } = useNotifications();

  // Use extracted scheduling logic
  useNotificationScheduling({
    prayerTimes,
    appSettings,
    location,
    locationTimeZone,
    permission,
    scheduleAllNotifications,
  });

  // WIDGET FIX: Sync weather to widget on foreground and periodically
  // Weather wasn't updating because it only synced with prayer times (which are cached for 12 months)
  useWeatherSync({
    location,
    language: appSettings.language,
  });

  const hasPrayerPayloadForSync =
    prayerTimes.length > 0 &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude);

  // Sync settings to Wear/Watch app when language or device 12/24 preference changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncSettings = async () => {
      const tempUnit = getTemperatureUnit();
      await syncSettingsToWatch({
        language: appSettings.language,
        temperatureUnit: tempUnit,
      });

      if (hasPrayerPayloadForSync) {
        await syncPrayerTimesToWidget(
          prayerTimes,
          appSettings.language,
          location,
          appSettings.calculation.method,
          appSettings.calculation.madhab,
          appSettings.calculation.manualCorrections,
          appSettings.calculation.daylightSaving === "manual"
            ? appSettings.calculation.daylightSavingOffset
            : 0,
          appSettings.calculation.highLatitudeMode,
        );
      }
    };

    void syncSettings();
  }, [
    appSettings.language,
    deviceClockFormat,
    prayerTimes,
    location,
    appSettings.calculation.method,
    appSettings.calculation.madhab,
    appSettings.calculation.manualCorrections,
    appSettings.calculation.daylightSaving,
    appSettings.calculation.daylightSavingOffset,
    appSettings.calculation.highLatitudeMode,
    hasPrayerPayloadForSync,
  ]);

  // NOTE: Temperature unit changes are synced from Weather.tsx
  // Settings sync on language change is handled by the effect above

  // Ensure Phase A (24h) + Phase B (30d) schedules are re-pushed when the app is reopened.
  // This is intentionally best-effort and never blocks UI.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncNow = () => {
      if (!hasPrayerPayloadForSync) return;

      void syncPrayerTimesToWidget(
        prayerTimes,
        appSettings.language,
        location,
        appSettings.calculation.method,
        appSettings.calculation.madhab,
        appSettings.calculation.manualCorrections,
        appSettings.calculation.daylightSaving === "manual"
          ? appSettings.calculation.daylightSavingOffset
          : 0,
        appSettings.calculation.highLatitudeMode,
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncNow();
      }
    };

    window.addEventListener("focus", syncNow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    appSettings.language,
    appSettings.calculation.method,
    appSettings.calculation.madhab,
    appSettings.calculation.manualCorrections,
    appSettings.calculation.daylightSaving,
    appSettings.calculation.daylightSavingOffset,
    appSettings.calculation.highLatitudeMode,
    hasPrayerPayloadForSync,
    prayerTimes,
    location,
  ]);

  const handleRequestNotifications = async () => {
    const platform = Capacitor.getPlatform();
    const usesNativePostPrompt = platform === "ios" || platform === "android";

    if (!isSupported) {
      return;
    }

    if (usesNativePostPrompt && permission === "granted") {
      showEnablePostPrompt();
      return;
    }

    const granted = await requestPermission();
    if (granted) {
      if (usesNativePostPrompt) {
        showEnablePostPrompt();
      } else {
        updateNotifications({ masterEnabled: true });
      }
    }
  };

  const handleRequestCalibration = async () => {
    const success = await requestCalibration();
    if (success) {
      // Toast removed
    }
  };

  const getScreenTitle = () => {
    switch (activeScreen) {
      case "home": {
        // Split the localized app name into word-per-line format for the header
        const appName = t("app.name", );
        return appName.replace(/\s+/g, "\n");
      }
      case "qibla":
        return t("screens.qibla");
      case "library":
        return t("screens.library");
      case "counter":
        return t("screens.counter");
      case "weather":
        return t("screens.weather");
      case "settings":
        return t("screens.settings");
    }
  };

  // PERFORMANCE FIX: Use centralized iPad detection hook
  const _isIpad = useIsIpad();

  return (
    <div
      className={`pp-app-root h-[100dvh] theme-${currentTheme}`}
    >
      <ThemeBackground theme={currentTheme} page={activeScreen} />

      <div
        className="pp-app-container relative z-10 h-full flex flex-col"
      >
        {activeScreen !== "qibla" &&
          activeScreen !== "weather" &&
          activeScreen !== "settings" &&
          activeScreen !== "counter" &&
          activeScreen !== "library" && (
            <Header
              title={getScreenTitle()}
              location={activeScreen === "home" ? location : undefined}
              showDate={false}
              onNotificationClick={
                activeScreen === "home"
                  ? handleRequestNotifications
                  : undefined
              }
              isLocating={activeScreen === "home" ? isLocating : undefined}
            />
          )}

        {/* Library Screen */}
        {activeScreen === "library" && (
          <Suspense fallback={screenLoadingFallback}>
            <Library
              key={libraryKey}
              sessionKey={librarySessionKey}
            />
          </Suspense>
        )}

        {activeScreen === "qibla" && (
          <>
            <Header title={getScreenTitle()} />
            {showBadgePreview && <LocationBadgePreview />}
            <LocationBadge locationConfidence={locationConfidence} />
            <div className="qibla-screen-wrapper flex-1 overflow-hidden px-4">
              <QiblaCompass qiblaDirection={qiblaDirection} />
            </div>
          </>
        )}

        {/* Home Screen - no scrolling; stack pushed up 1.5cm so Counter button is visible */}
        {activeScreen === "home" && (
          <>
            {showBadgePreview && <LocationBadgePreview />}
            <LocationBadge locationConfidence={locationConfidence} />
            <HomeView
              timeFormatKey={deviceClockFormat}
              prayerTimes={prayerTimes}
              nextPrayer={nextPrayer}
              locationTimeZone={locationTimeZone}
              onQiblaClick={() => setCurrentScreen("qibla")}
              onCounterClick={() => setCurrentScreen("counter")}
              onPullRefresh={() => setHomeRefreshKey(Date.now())}
              showLocationGate={
                !isLocating &&
                (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude))
              }
              onSetLocationClick={() => {
                setSettingsInitialView("location");
                setCurrentScreen("settings");
              }}
            />
          </>
        )}

        {/* Counter Screen */}
        {activeScreen === "counter" && (
          <Suspense fallback={screenLoadingFallback}>
            <Counter />
          </Suspense>
        )}

        {/* Weather Screen */}
        {activeScreen === "weather" && (
          <Suspense fallback={screenLoadingFallback}>
            <Weather key={weatherKey} />
          </Suspense>
        )}

        {/* Settings Screen - wrapped in Suspense for smooth language transitions */}
        {activeScreen === "settings" && (
          <Suspense fallback={screenLoadingFallback}>
            <SettingsScreen
              key={settingsKey}
              initialView={settingsInitialView}
              settings={appSettings}
              onUpdateLocation={(loc) => {
                updateLocation(loc);
              }}
              onUpdateNotifications={updateNotifications}
              onUpdateCalculation={(calc) => {
                updateCalculation(calc);
              }}
              onUpdateLanguage={(lang) => {
                updateLanguage(lang);
              }}
              onUpdateQuranLanguage={(lang) => {
                updateQuranLanguage(lang);
              }}
              onUpdateHisnLanguage={(lang) => {
                updateHisnLanguage(lang);
              }}
              sensorStatus={sensorStatus}
              onRequestCalibration={handleRequestCalibration}
              onTestSound={testNotificationSound}
              notificationPermission={permission}
              onRequestNotificationPermission={requestPermission}
            />
          </Suspense>
        )}
      </div>

      <BottomNav
        currentScreen={activeScreen}
        onNavigate={handleScreenNavigation}
      />

      {/* Notification Pre-Prompt Modal - reserved (Android now requests system prompt directly) */}
      {showPrePrompt && Capacitor.getPlatform() === "android" && (
        <NotificationPrePrompt
          onEnable={handlePrePromptEnable}
          onMaybeLater={handlePrePromptLater}
          onClose={dismissPrePrompt}
        />
      )}

      {/* Notification Post-Prompt Modal - native mobile (iOS + Android) */}
      {showPostPrompt && (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android") && (
        <NotificationPostPrompt
          onEnable={() => {
            handlePostPromptEnable();
            // Enable notifications when user explicitly chooses to enable
            updateNotifications({ masterEnabled: true });
            // Toast removed
          }}
          onNotNow={handlePostPromptNotNow}
        />
      )}
    </div>
  );
}
