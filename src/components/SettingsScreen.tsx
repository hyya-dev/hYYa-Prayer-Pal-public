import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AppSettings,
  Language,
  QuranLanguageCode,
  HisnLibraryLanguage,
  NotificationSoundType,
} from "@/hooks/useAppSettings";
import { SensorStatus } from "@/hooks/useSensorCalibration";
import { useIsIpad } from "@/hooks/useIsIpad";
import { ALL_QURAN_LANGUAGES } from "@/lib/quranLanguages";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { logger } from "@/utils/logger";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { InAppReview } from "@capacitor-community/in-app-review";

import SadaqahBannerPhone from "@/assets/SadaqahJariyah.png";
import SadaqahBannerIpad from "@/assets/ipad/Sadaqah Jariyah.png";
import { getWidgetBridge } from "@/services/widgetService";

// Sub-panels
import { SettingsMainArea } from "./settings/Panels/SettingsMainArea";
import { LocationSettingsPanel } from "./settings/Panels/LocationSettingsPanel";
import { NotificationSettingsPanel } from "./settings/Panels/NotificationSettingsPanel";
import { CalculationSettingsPanel } from "./settings/Panels/CalculationSettingsPanel";
import { UILanguageSettingsPanel } from "./settings/Panels/UILanguageSettingsPanel";
import { PrivacySettingsPanel } from "./settings/Panels/PrivacySettingsPanel";
import { QuranSourcesPanel } from "./settings/Panels/QuranSourcesPanel";
import { ContentLanguageSettingsPanel } from "./settings/Panels/ContentLanguageSettingsPanel";
import { QuranLanguageSettingsPanel } from "./settings/Panels/QuranLanguageSettingsPanel";
import { HisnLanguageSettingsPanel } from "./settings/Panels/HisnLanguageSettingsPanel";

const WidgetBridge = getWidgetBridge();

interface SettingsScreenProps {
  readonly settings: AppSettings;
  readonly onUpdateLocation: (location: Partial<AppSettings["location"]>) => void;
  readonly onUpdateNotifications: (
    notifications: Partial<AppSettings["notifications"]>,
  ) => void;
  readonly onUpdateCalculation: (
    calculation: Partial<AppSettings["calculation"]>,
  ) => void;
  readonly onUpdateLanguage: (language: Language) => void;
  readonly onUpdateQuranLanguage: (language: QuranLanguageCode | null) => void;
  readonly onUpdateHisnLanguage: (language: HisnLibraryLanguage | null) => void;
  readonly sensorStatus: SensorStatus;
  readonly onRequestCalibration: () => void;
  readonly onTestSound?: (soundType: NotificationSoundType) => void;
  readonly notificationPermission?: "granted" | "denied" | "prompt";
  readonly onRequestNotificationPermission?: () => Promise<boolean>;
  readonly initialView?: SettingsView;
}

export type SettingsView =
  | "main"
  | "uiLanguage"
  | "libraryLanguage"
  | "quranLanguage"
  | "hisnLanguage"
  | "calculation"
  | "privacy"
  | "quranSources"
  | "location"
  | "notifications";

// Quran Languages Helper (from original file)
const QURAN_LANGUAGES_OPTIONS = ALL_QURAN_LANGUAGES.map((lang) => ({
  code: lang.code,
  name: lang.name,
  nativeName: lang.nativeName,
}));

// Generate languages array for the UI selector
const languages: { value: Language; label: string; originalLabel: string }[] = ALL_QURAN_LANGUAGES.map(
  (lang) => ({
    value: lang.code as Language,
    label: lang.nativeName && lang.nativeName !== lang.name
      ? `${lang.nativeName} — ${lang.name}`
      : lang.name,
    originalLabel: lang.name,
  }),
);

export function SettingsScreen({
  settings,
  onUpdateLocation,
  onUpdateNotifications,
  onUpdateCalculation,
  onUpdateLanguage,
  onUpdateQuranLanguage,
  onUpdateHisnLanguage,
  sensorStatus,
  onRequestCalibration,
  onTestSound,
  notificationPermission,
  onRequestNotificationPermission,
  initialView,
}: SettingsScreenProps) {
  const [currentView, setCurrentView] = useState<SettingsView>(initialView ?? "main");
  const { t, i18n } = useTranslation();
  const isRTL = isRtlLanguage(i18n.language);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const isIpad = useIsIpad();

  const openExternal = async (url: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url, presentationStyle: "popover" });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      logger.warn("Failed to open external URL:", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const openRating = async () => {
    const appId = "com.hyya.prayerpal.open";
    const appStoreId = "6757415305";
    const platform = Capacitor.getPlatform();

    if (Capacitor.isNativePlatform()) {
      try {
        await InAppReview.requestReview();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        logger.warn("In-app review failed:", error);
      }
    }

    try {
      if (platform === "ios" && appStoreId) {
        await Browser.open({
          url: `https://apps.apple.com/app/id${appStoreId}?action=write-review`,
          presentationStyle: "popover",
        });
      } else if (platform === "android") {
        const playStoreUrl = `https://play.google.com/store/apps/details?id=${appId}`;
        await Browser.open({ url: playStoreUrl, presentationStyle: "popover" });
      }
    } catch (error) {
      logger.warn("Failed to open store for rating:", error);
    }
  };

  const shareApp = async () => {
    try {
      const shareUrl = "https://hyya.app";
      const shareText = t("settings.links.shareText", {
        appTitle: t("app.name")
      });

      if (
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
      ) {
        if (WidgetBridge?.shareApp) {
          await WidgetBridge.shareApp({
            title: "hYYa Prayer Pal",
            text: shareText,
            url: shareUrl,
          });
          return;
        }
      }
      
      if (navigator.share) {
        await navigator.share({
          title: "hYYa Prayer Pal",
          text: shareText,
          url: shareUrl,
        });
      }
    } catch (error) {
      logger.warn("Share failed:", error);
    }
  };

  let content;

  switch (currentView) {
    case "location":
      content = (
        <LocationSettingsPanel
          settings={settings}
          onUpdateLocation={onUpdateLocation}
          onBack={() => setCurrentView("main")}
        />
      );
      break;
    case "notifications":
      content = (
        <NotificationSettingsPanel
          settings={settings}
          onUpdateNotifications={onUpdateNotifications}
          onBack={() => setCurrentView("main")}
          onTestSound={onTestSound}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={onRequestNotificationPermission}
        />
      );
      break;
    case "calculation":
      content = (
        <CalculationSettingsPanel
          settings={settings}
          onUpdateCalculation={onUpdateCalculation}
          onBack={() => setCurrentView("main")}
        />
      );
      break;
    case "uiLanguage":
      content = (
        <UILanguageSettingsPanel
          settings={settings}
          onUpdateSettings={(newSettings) => {
            if (newSettings.language) {
              onUpdateLanguage(newSettings.language);
            }
          }}
          onBack={() => setCurrentView("main")}
          languages={languages}
        />
      );
      break;
    case "libraryLanguage":
      content = (
        <ContentLanguageSettingsPanel
          settings={settings}
          setCurrentView={setCurrentView}
          quranLanguagesOptions={QURAN_LANGUAGES_OPTIONS}
          onBack={() => setCurrentView("main")}
        />
      );
      break;
    case "quranLanguage":
      content = (
        <QuranLanguageSettingsPanel
          settings={settings}
          onUpdateQuranLanguage={onUpdateQuranLanguage}
          quranLanguagesOptions={QURAN_LANGUAGES_OPTIONS}
          onBack={() => setCurrentView("libraryLanguage")}
        />
      );
      break;
    case "hisnLanguage":
      content = (
        <HisnLanguageSettingsPanel
          settings={settings}
          onUpdateHisnLanguage={onUpdateHisnLanguage}
          onBack={() => setCurrentView("libraryLanguage")}
        />
      );
      break;
    case "privacy":
      content = <PrivacySettingsPanel onBack={() => setCurrentView("main")} />;
      break;
    case "quranSources":
      content = <QuranSourcesPanel onBack={() => setCurrentView("main")} />;
      break;
    default:
      content = (
        <SettingsMainArea
          settings={settings}
          languages={languages}
          sensorStatus={sensorStatus}
          onRequestCalibration={onRequestCalibration}
          setCurrentView={setCurrentView}
          shareApp={shareApp}
          openRating={openRating}
          openExternal={openExternal}
          isRTL={isRTL}
        />
      );
      break;
  }

  return (
    <div className="page-settings flex-1 flex flex-col h-full overflow-hidden">
      <header
        className="sticky top-0 z-30 px-4 pb-4"
        style={{
          paddingTop:
            "calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
        }}
      >
        <h1
          className={`text-3xl font-bold title-3d text-start animate-fade-in`}
          style={{ marginTop: "calc(0.25rem - 1mm)" }}
        >
          {t("screens.settings")}
        </h1>
        <div
          className="flex justify-center animate-scale-in"
          style={{
            marginTop: "5mm",
            marginBottom: currentView === "main" ? "10mm" : "2mm",
            animationDelay: "0.1s",
            animationFillMode: "both",
          }}
        >
          <img
            src={isIpad ? SadaqahBannerIpad : SadaqahBannerPhone}
            alt="Sadaqah Jariyah"
            className="w-full max-w-md h-auto object-contain"
            style={{ maxHeight: "75px" }}
          />
        </div>
      </header>
      <div
        ref={settingsContainerRef}
        className="settings-container page-scroll-content flex-1 overflow-y-auto px-0"
        style={{
          paddingBottom: "calc(var(--pp-nav-only) + 5mm)",
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        {content}
      </div>
    </div>
  );
}
