import { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import { Capacitor } from "@capacitor/core";
import { useWeather } from "@/hooks/useWeather";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getHijriMonthsForLanguage, HIJRI_MONTHS_ENGLISH } from '@/lib/hijriTranslations';
import { toWesternDigits } from '@/lib/toWesternDigits';
import { getTemperatureUnit, onTemperatureUnitChanged, setTemperatureUnit } from '@/lib/temperatureUnit';
import iconCalendar from "@/assets/Icon Calendar.png";
import { useDynamicTranslation } from "@/hooks/useDynamicTranslation";
import {
  fetchAndSyncTemperature,
  syncSettingsToWatch,
  syncWeatherToWidget,
} from "@/services/widgetService";

function normalizeMonthName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '');
}

function replaceMonthName(hijriLine: string, englishMonth: string, localizedMonth: string): string {
  if (hijriLine.includes(englishMonth)) {
    return hijriLine.replace(englishMonth, localizedMonth);
  }

  const lineWords = hijriLine.split(/\s+/);
  const monthWords = englishMonth.split(/\s+/);
  const normalizedEnglish = normalizeMonthName(englishMonth);

  for (let start = 0; start <= lineWords.length - monthWords.length; start++) {
    const candidateWords = lineWords.slice(start, start + monthWords.length);
    const candidate = candidateWords.join(' ');
    if (normalizeMonthName(candidate) === normalizedEnglish) {
      const updatedWords = [...lineWords];
      updatedWords.splice(start, monthWords.length, localizedMonth);
      return updatedWords.join(' ');
    }
  }

  return hijriLine;
}

function getCalendarDateDisplay(currentLanguage: string, hijriDateCorrectionDays: number): {
  hijriLine: string;
} {
  const now = new Date();
  const adjustedDate = new Date(now);
  adjustedDate.setDate(now.getDate() + hijriDateCorrectionDays);
  const locale = currentLanguage || "en";

  const fallback = {
    hijriLine: toWesternDigits(adjustedDate.toLocaleDateString("en-u-ca-islamic", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })),
  };

  try {
    // Get full Hijri date with locale-native ordering
    let hijriLine = toWesternDigits(adjustedDate.toLocaleDateString(`${locale}-u-ca-islamic`, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }));

    // Replace English month name with localized version if available
    const localizedMonths = getHijriMonthsForLanguage(locale);
    for (let i = 0; i < HIJRI_MONTHS_ENGLISH.length; i++) {
      const replaced = replaceMonthName(hijriLine, HIJRI_MONTHS_ENGLISH[i], localizedMonths[i]);
      if (replaced !== hijriLine) {
        hijriLine = replaced;
        break;
      }
    }

    return {
      hijriLine,
    };
  } catch {
    return fallback;
  }
}

// Device-aware default moved to @/lib/temperatureUnit

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

export default function Weather() {
  const { t, i18n } = useTranslation();
  const { settings: appSettings } = useAppSettings();
  const currentLanguage = appSettings.language || i18n.language || "en";
  const isRTL = isRtlLanguage(currentLanguage);

  // Temperature unit state - initialize from device default, persist in localStorage
  const [tempUnit, setTempUnit] = useState<"C" | "F">(() => getTemperatureUnit());

  // Toggle temperature unit
  const toggleTempUnit = () => {
    const next = tempUnit === "C" ? "F" : "C";
    setTempUnit(next);
    setTemperatureUnit(next, 'user');
  };

  useEffect(() => {
    return onTemperatureUnitChanged(({ unit }) => {
      setTempUnit((prev) => (prev === unit ? prev : unit));
    });
  }, []);

  // Format temperature with unit conversion
  const formatTemp = useCallback(
    (celsius: number | undefined): string => {
      if (celsius === undefined) return "--";
      if (tempUnit === "F") {
        return String(celsiusToFahrenheit(celsius));
      }
      return String(celsius);
    },
    [tempUnit],
  );

  const { location } = usePrayerTimes(
    appSettings.language,
    appSettings.location,
    {
      method: appSettings.calculation.method,
      madhab: appSettings.calculation.madhab,
    },
  );

  const { weatherData, loading, error } = useWeather(location, currentLanguage);
  const currentTempC = weatherData?.current?.temperature;
  const calendarDate = getCalendarDateDisplay(
    currentLanguage,
    appSettings.calculation.hijriDateCorrection,
  );

  // Sync settings to Watch/Wear app when temperature unit changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncUnitChanges = async () => {
      await syncSettingsToWatch({
        language: appSettings.language,
        temperatureUnit: tempUnit,
      });

      const hasValidCoords =
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude);

      if (hasValidCoords) {
        await fetchAndSyncTemperature(location.latitude, location.longitude);
        return;
      }

      const currentCelsius = weatherData?.current?.temperature;
      if (typeof currentCelsius === "number") {
        const displayTemp =
          tempUnit === "F"
            ? celsiusToFahrenheit(currentCelsius)
            : currentCelsius;
        await syncWeatherToWidget(`${displayTemp}°${tempUnit}`, true);
      }
    };

    void syncUnitChanges();
  }, [
    tempUnit,
    appSettings.language,
    location.latitude,
    location.longitude,
    weatherData?.current?.temperature,
    weatherData,
  ]);

  // Same Open-Meteo value as the Weather page → App Group + Watch (useWeatherSync can lag by several minutes).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (loading || error || typeof currentTempC !== "number") return;

    const displayTemp =
      tempUnit === "F" ? celsiusToFahrenheit(currentTempC) : currentTempC;
    void syncWeatherToWidget(`${displayTemp}°${tempUnit}`, true);
  }, [currentTempC, tempUnit, loading, error]);

  // Forecast card styling — dark navy glass with premium accent
  const cardStyle = {
    background: "var(--pp-card-bg)",
    boxShadow:
      "0 8px 32px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.2)",
    border: "1px solid var(--pp-border-soft)",
  };

  // NowTemperature button — dark navy glass, premium accent text
  const nowTempStyle = {
    background: "var(--pp-button-bg)",
    borderColor: "var(--pp-border-soft)",
    boxShadow:
      "0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.2)",
    transform: "perspective(1000px) rotateX(2deg)",
    color: "var(--pp-text-primary)",
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Fixed Header: title left; 2cm below, NowTemperature card on opposite side (right) */}
      <header
        dir="ltr"
        className="sticky top-0 z-20 flex-shrink-0 px-4 pb-4"
        style={{
          paddingTop: "calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
          backgroundColor: "transparent",
        }}
      >
        <h1
          className="text-3xl font-bold title-3d min-w-0"
          style={{
            marginTop: "calc(0.25rem - 1mm)",
          }}
        >
          {t("screens.weather")}
        </h1>
        {/* NowTemperature card 2cm below page title, on opposite side (right) */}
        <div
          className="flex w-full animate-scale-in justify-end"
          style={{
            marginTop: "calc(5mm + 3cm)",
            animationDelay: "0.1s",
            animationFillMode: "both",
          }}
        >
          <button
            onClick={toggleTempUnit}
            className="rounded-xl px-3 py-1.5 backdrop-blur-md border relative overflow-hidden transition-all duration-300 active:scale-95 hover:scale-[1.02] cursor-pointer"
            style={nowTempStyle}
            aria-label={
              tempUnit === "C"
                ? t("weather.switchToFahrenheit")
                : t("weather.switchToCelsius")
            }
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/10 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10 text-xl font-bold whitespace-nowrap">
              {loading || error
                ? "--"
                : formatTemp(weatherData?.current.temperature)}
              °{tempUnit}
            </div>
          </button>
        </div>
      </header>

      {/* Fixed Content - No scrolling, 5 cards only */}
      <div
        className="flex-1 flex flex-col justify-end px-4 overflow-hidden animate-fade-in-up"
        style={{ paddingBottom: "calc(var(--pp-bottom-nav-height) + 5mm + var(--pp-bottom-safe))" }}
      >
        <div className="max-w-2xl mx-auto space-y-2 w-full">
          <div
            className="rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden border"
            style={cardStyle}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/15 pointer-events-none" />
            <div className="absolute -top-2 left-5 right-5 h-5 rounded-b-full opacity-75"
              style={{ background: "var(--pp-card-bg)", borderBottom: "1px solid var(--pp-border-soft)" }} />
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2">
                <img
                  src={iconCalendar}
                  alt=""
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                  aria-label={t("settings.calculation.hijriCalendar")}
                />
                <HijriDateDisplay
                  hijriLine={calendarDate.hijriLine}
                  isRTL={isRTL}
                />
              </div>
            </div>
          </div>

          {/* Forecast Cards - 5 days only */}
          {(() => {
            if (loading) {
              return ["a", "b", "c", "d", "e"].map((id) => (
                <div
                  key={id}
                  className="rounded-2xl p-4 min-h-[56px] backdrop-blur-sm relative overflow-hidden opacity-50"
                  style={cardStyle}
                >
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="text-base font-semibold text-shadow flex-shrink-0 text-start"
                      style={{ minWidth: "80px", color: "var(--pp-text-primary)" }}>
                      {t("weather.loading")}
                    </div>
                    <div className="text-sm text-shadow flex-1 text-center min-w-0" style={{ color: "var(--pp-text-secondary)" }}>--</div>
                    <div className="text-base font-semibold text-shadow flex-shrink-0 text-end"
                      style={{ minWidth: "80px", color: "var(--pp-text-primary)" }}>
                      --° / --°
                    </div>
                  </div>
                </div>
              ));
            }
            if (error) {
              return (
                <div
                  className="rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden"
                  style={cardStyle}
                >
                  <div className="relative z-10 text-center text-shadow" style={{ color: "var(--pp-text-primary)" }}>
                    {error}
                  </div>
                </div>
              );
            }
            return weatherData?.forecast.slice(0, 5).map((day) => (
              <ForecastDayRow
                key={day.day}
                day={day}
                index={0}
                cardStyle={cardStyle}
                formatTemp={formatTemp}
              />
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

function HijriDateDisplay({ hijriLine, isRTL }: { readonly hijriLine: string; readonly isRTL: boolean }) {
  const { translatedText: translatedHijri } = useDynamicTranslation(hijriLine, 'B');
  return (
    <p
      className="text-lg font-bold leading-tight"
      style={{
        color: "var(--pp-text-primary)",
        /*
         * UX Logic Layer 2 — No local dir override needed here.
         * Direction is inherited from document.documentElement.dir set by i18n/index.ts.
         * unicodeBidi: plaintext ensures the text itself determines its own bidi direction
         * without overriding the inherited document direction.
         */
        unicodeBidi: "plaintext",
      }}
    >
      {translatedHijri}
    </p>
  );
}

interface ForecastDay {
  day: string;
  condition: string;
  high: number;
  low: number;
}

const ForecastDayRow = memo(function ForecastDayRow({ day, index, cardStyle, formatTemp }: {
  day: ForecastDay;
  index: number;
  cardStyle: React.CSSProperties;
  formatTemp: (temp: number | undefined) => string;
}) {
  const { translatedText: translatedDay } = useDynamicTranslation(day.day, 'B');
  const { translatedText: translatedCondition } = useDynamicTranslation(day.condition, 'B');

  return (
    <div
      className="rounded-2xl p-3 min-h-[56px] backdrop-blur-sm relative overflow-hidden flex-shrink-0 animate-fade-in-up"
      style={{
        ...cardStyle,
        animationDelay: `${0.1 + index * 0.05}s`,
        animationFillMode: "both",
      }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      {/* Content - each section pushed to edges with even spacing */}
      <div className="relative z-10 flex items-center gap-4">
        <div
          className="text-base font-semibold text-shadow flex-shrink-0 text-start"
          style={{ minWidth: "80px", color: "var(--pp-text-secondary)" }}
        >
          {translatedDay}
        </div>
        <div className="text-sm text-shadow flex-1 text-center min-w-0" style={{ color: "var(--pp-text-secondary)" }}>
          {translatedCondition}
        </div>
        <div
          className="text-base font-semibold text-shadow flex-shrink-0 text-end"
          style={{ minWidth: "80px", color: "var(--pp-text-primary)" }}
        >
          {formatTemp(day.high)}° / {formatTemp(day.low)}°
        </div>
      </div>
    </div>
  );
});
