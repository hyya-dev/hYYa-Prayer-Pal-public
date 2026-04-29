import { useState, useEffect } from "react";
import { Theme } from "@/hooks/usePrayerTimes";
import { useIsIpad } from "@/hooks/useIsIpad";

// iPhone backgrounds (9:19.5 aspect ratio)
import qiblaSunriseTheme from "@/assets/Qibla Sunrise Theme.webp";
import qiblaAfternoonTheme from "@/assets/Qibla Afternoon Theme.webp";
import qiblaSunsetTheme from "@/assets/Qibla Sunset Theme.webp";
import homeSunriseTheme from "@/assets/Home Sunrise Theme.webp";
import homeAfternoonTheme from "@/assets/Home Afternoon Theme.webp";
import homeSunsetTheme from "@/assets/Home Sunset Theme.webp";
import librarySubpagesBackground from "@/assets/Library subpages background.webp";
import settingsBackground from "@/assets/Settings background.webp";
import temperatureSunriseTheme from "@/assets/Temperature Sunrise Theme.webp";
import temperatureAfternoonTheme from "@/assets/Temperature Afternoon Theme.webp";
import temperatureSunsetTheme from "@/assets/Temperature Sunset Theme.webp";
import counterSunriseTheme from "@/assets/Counter Sunrise Theme.webp";
import counterAfternoonTheme from "@/assets/Counter Afternoon Theme.webp";
import counterSunsetTheme from "@/assets/Counter Sunset Theme.webp";

// iPad backgrounds (3:4 aspect ratio)
import ipadQiblaSunriseTheme from "@/assets/ipad/Qibla Sunrise Theme.webp";
import ipadQiblaAfternoonTheme from "@/assets/ipad/Qibla Afternoon Theme.webp";
import ipadQiblaSunsetTheme from "@/assets/ipad/Qibla Sunset Theme.webp";
import ipadHomeSunriseTheme from "@/assets/ipad/Home Sunrise Theme.webp";
import ipadHomeAfternoonTheme from "@/assets/ipad/Home Afternoon Theme.webp";
import ipadHomeSunsetTheme from "@/assets/ipad/Home Sunset Theme.webp";
import ipadLibrarySubpagesBackground from "@/assets/ipad/Library subpages background.webp";
import ipadSettingsBackground from "@/assets/ipad/Settings background.webp";
import ipadTemperatureSunriseTheme from "@/assets/ipad/Temperature Sunrise Theme.webp";
import ipadTemperatureAfternoonTheme from "@/assets/ipad/Temperature Afternoon Theme.webp";
import ipadTemperatureSunsetTheme from "@/assets/ipad/Temperature Sunset Theme.webp";
import ipadCounterSunriseTheme from "@/assets/ipad/Counter Sunrise Theme.webp";
import ipadCounterAfternoonTheme from "@/assets/ipad/Counter Afternoon Theme.webp";
import ipadCounterSunsetTheme from "@/assets/ipad/Counter Sunset Theme.webp";

export type PageType =
  | "home"
  | "qibla"
  | "library"
  | "counter"
  | "weather"
  | "settings";

// Default background color while images load (dark navy)
const FALLBACK_BG_COLOR = "#1a1a2e";

// iPhone backgrounds (9:19.5 aspect ratio)
const iphoneBackgrounds: Record<PageType, Record<Theme, string>> = {
  home: {
    sunrise: homeSunriseTheme,
    afternoon: homeAfternoonTheme,
    sunset: homeSunsetTheme,
  },
  qibla: {
    sunrise: qiblaSunriseTheme,
    afternoon: qiblaAfternoonTheme,
    sunset: qiblaSunsetTheme,
  },
  library: {
    sunrise: librarySubpagesBackground,
    afternoon: librarySubpagesBackground,
    sunset: librarySubpagesBackground,
  },
  counter: {
    sunrise: counterSunriseTheme,
    afternoon: counterAfternoonTheme,
    sunset: counterSunsetTheme,
  },
  weather: {
    sunrise: temperatureSunriseTheme,
    afternoon: temperatureAfternoonTheme,
    sunset: temperatureSunsetTheme,
  },
  settings: {
    sunrise: settingsBackground,
    afternoon: settingsBackground,
    sunset: settingsBackground,
  },
};

// iPad backgrounds (3:4 aspect ratio)
const ipadBackgrounds: Record<PageType, Record<Theme, string>> = {
  home: {
    sunrise: ipadHomeSunriseTheme,
    afternoon: ipadHomeAfternoonTheme,
    sunset: ipadHomeSunsetTheme,
  },
  qibla: {
    sunrise: ipadQiblaSunriseTheme,
    afternoon: ipadQiblaAfternoonTheme,
    sunset: ipadQiblaSunsetTheme,
  },
  library: {
    sunrise: ipadLibrarySubpagesBackground,
    afternoon: ipadLibrarySubpagesBackground,
    sunset: ipadLibrarySubpagesBackground,
  },
  counter: {
    sunrise: ipadCounterSunriseTheme,
    afternoon: ipadCounterAfternoonTheme,
    sunset: ipadCounterSunsetTheme,
  },
  weather: {
    sunrise: ipadTemperatureSunriseTheme,
    afternoon: ipadTemperatureAfternoonTheme,
    sunset: ipadTemperatureSunsetTheme,
  },
  settings: {
    sunrise: ipadSettingsBackground,
    afternoon: ipadSettingsBackground,
    sunset: ipadSettingsBackground,
  },
};

// All background URLs for preloading (iPhone + iPad)
const ALL_BACKGROUNDS = [
  // iPhone backgrounds
  qiblaSunriseTheme,
  qiblaAfternoonTheme,
  qiblaSunsetTheme,
  homeSunriseTheme,
  homeAfternoonTheme,
  homeSunsetTheme,
  librarySubpagesBackground,
  settingsBackground,
  temperatureSunriseTheme,
  temperatureAfternoonTheme,
  temperatureSunsetTheme,
  counterSunriseTheme,
  counterAfternoonTheme,
  counterSunsetTheme,
  // iPad backgrounds
  ipadQiblaSunriseTheme,
  ipadQiblaAfternoonTheme,
  ipadQiblaSunsetTheme,
  ipadHomeSunriseTheme,
  ipadHomeAfternoonTheme,
  ipadHomeSunsetTheme,
  ipadLibrarySubpagesBackground,
  ipadSettingsBackground,
  ipadTemperatureSunriseTheme,
  ipadTemperatureAfternoonTheme,
  ipadTemperatureSunsetTheme,
  ipadCounterSunriseTheme,
  ipadCounterAfternoonTheme,
  ipadCounterSunsetTheme,
];

// Preload all images on module load (runs once when app starts)
const preloadedImages: Set<string> = new Set();

function preloadAllBackgrounds() {
  ALL_BACKGROUNDS.forEach((src) => {
    if (!preloadedImages.has(src)) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        preloadedImages.add(src);
      };
    }
  });
}

// Start preloading immediately when module loads
if (typeof window !== "undefined") {
  preloadAllBackgrounds();
}

interface ThemeBackgroundProps {
  theme: Theme;
  page?: PageType;
}

export function ThemeBackground({
  theme,
  page = "home",
}: ThemeBackgroundProps) {
  const isIpad = useIsIpad();

  // Select backgrounds based on device type
  const backgrounds = isIpad ? ipadBackgrounds : iphoneBackgrounds;
  const backgroundUrl = backgrounds[page][theme];
  const [isLoaded, setIsLoaded] = useState(preloadedImages.has(backgroundUrl));

  useEffect(() => {
    // If already preloaded, show immediately
    if (preloadedImages.has(backgroundUrl)) {
      setIsLoaded(true);
      return;
    }

    // Otherwise, wait for this specific image to load
    setIsLoaded(false);
    const img = new Image();
    img.src = backgroundUrl;
    img.onload = () => {
      preloadedImages.add(backgroundUrl);
      setIsLoaded(true);
    };
  }, [backgroundUrl]);

  return (
    <>
      {/* Solid fallback background - always visible */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          backgroundColor: FALLBACK_BG_COLOR,
          width: "100%",
          maxWidth: "100vw",
          left: 0,
          right: 0,
        }}
      />

      {/* Actual background image - fades in when loaded */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10 transition-opacity duration-500"
        style={{
          backgroundImage: `url(${backgroundUrl})`,
          opacity: isLoaded ? 1 : 0,
          width: "100%",
          maxWidth: "100vw",
          left: 0,
          right: 0,
        }}
      />
    </>
  );
}
