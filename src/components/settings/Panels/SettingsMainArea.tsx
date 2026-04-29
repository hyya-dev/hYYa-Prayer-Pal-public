import { useTranslation } from "react-i18next";
import {
  MapPin,
  Bell,
  Globe,
  Calculator,
  ExternalLink,
  AlertTriangle,
  Star,
  BookOpen,
  Shield,
  Compass,
  Share2,
} from "lucide-react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsRow } from "../../settings/SettingsRow";
import { AppSettings, Language } from "@/hooks/useAppSettings";
import { SensorStatus } from "@/hooks/useSensorCalibration";
import { Capacitor } from "@capacitor/core";
import { logger } from "@/utils/logger";
import type { SettingsView } from "../../SettingsScreen";

interface SettingsMainAreaProps {
  settings: AppSettings;
  languages: Array<{ value: Language; label: string; originalLabel: string }>;
  sensorStatus: SensorStatus;
  onRequestCalibration: () => void;
  setCurrentView: (view: SettingsView) => void;
  shareApp: () => void;
  openRating: () => Promise<void>;
  openExternal: (url: string) => void;
  isRTL: boolean;
}

export function SettingsMainArea({
  settings,
  languages,
  sensorStatus,
  onRequestCalibration,
  setCurrentView,
  shareApp,
  openRating,
  openExternal,
  isRTL,
}: SettingsMainAreaProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        flex: "1 0 auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Sensor Calibration Alert */}
      {sensorStatus.errorMessage && (
        <div
          className="mx-4 mb-4 p-4 rounded-xl backdrop-blur-sm border border-white/20 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, rgba(245, 158, 11, 0.35) 0%, rgba(120, 70, 10, 0.45) 100%)",
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)",
            transform:
              Capacitor.getPlatform() === "android"
                ? "none"
                : "perspective(800px) rotateX(2deg)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative z-10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                {t("settings.sensorCalibration.calibrate")}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {sensorStatus.errorMessage}
              </p>
              <button
                onClick={onRequestCalibration}
                className="mt-2 text-xs font-medium text-white/70 underline"
              >
                {t("settings.sensorCalibration.calibrate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compass Status */}
      {!sensorStatus.isCalibrated && !sensorStatus.errorMessage && (
        <div
          className="mx-4 mb-4 p-4 rounded-xl backdrop-blur-sm border border-red-500/30 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, rgba(239, 68, 68, 0.35) 0%, rgba(120, 30, 30, 0.45) 100%)",
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)",
            transform:
              Capacitor.getPlatform() === "android"
                ? "none"
                : "perspective(800px) rotateX(2deg)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-300/50 to-transparent" />

          <div className="relative z-10 flex items-start gap-3">
            <Compass className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-100 font-medium">
                {t("settings.sensorCalibration.accuracy.low")}
              </p>
              <p className="text-xs text-red-200/70 mt-1">
                {t("toast.calibrationStartedDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-2">
        <SettingsCategory className="mb-0">
          <SettingsRow
            className="animate-fade-in-up"
            style={{ animationDelay: "0.15s" }}
            icon={<Globe className="w-5 h-5" />}
            label={t("settings.language.uiLanguageTitle")}
            value={
              languages.find((l) => l.value === settings.language)?.label ||
              settings.language
            }
            onClick={() => setCurrentView("uiLanguage")}
            showChevron
            isLast
            labelNextToIcon
          />
        </SettingsCategory>
        <SettingsCategory className="mb-0">
          <SettingsRow
            className="animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
            icon={<Bell className="w-5 h-5" />}
            label={t("settings.notifications.title")}
            value={
              settings.notifications.masterEnabled
                ? t("common.on")
                : t("common.off")
            }
            onClick={() => setCurrentView("notifications")}
            isLast
            labelNextToIcon
          />
        </SettingsCategory>
      </div>

      <div className="mb-2">
        <SettingsCategory className="mb-0">
          <SettingsRow
            className="animate-fade-in-up"
            style={{ animationDelay: "0.25s" }}
            icon={<MapPin className="w-5 h-5" />}
            label={t("settings.location.title")}
            value={
              settings.location.autoDetect
                ? t("settings.location.autoDetect")
                : t("settings.calculation.manual")
            }
            onClick={() => setCurrentView("location")}
            isLast
            labelNextToIcon
          />
        </SettingsCategory>
        <SettingsCategory className="mb-0">
          <SettingsRow
            className="animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
            icon={<Calculator className="w-5 h-5" />}
            label={t("settings.calculation.title")}
            value={t(`calculationMethods.${settings.calculation.method}`)
              .replace(/\s*\([^)]*\)\s*$/, "")
              .trim()}
            onClick={() => setCurrentView("calculation")}
            isLast
            labelNextToIcon
          />
        </SettingsCategory>
      </div>

      <SettingsCategory title={t("settings.links.title")}>
        <SettingsRow
          className="animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
          icon={<Share2 className="w-5 h-5" />}
          label={t("settings.links.shareSadaqah")}
          onClick={shareApp}
          labelNextToIcon
        />
        <SettingsRow
          className="animate-fade-in-up"
          style={{ animationDelay: "0.45s" }}
          icon={<Star className="w-5 h-5" />}
          label={t("settings.links.rateAjr")}
          onClick={() => {
            logger.log("Rate App button clicked");
            openRating().catch((error) => {
              logger.error("openRating error:", error);
            });
          }}
          labelNextToIcon
        />
        <SettingsRow
          className="animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
          icon={<ExternalLink className="w-5 h-5" />}
          label={
            <>
              {isRTL && (
                <span className="text-[1em] leading-none animate-pulse text-yellow-400">
                  ✨
                </span>
              )}
              <span>hYYa {t("settings.links.hyyaApps")}</span>
              {!isRTL && (
                <span className="text-[1em] leading-none animate-pulse text-yellow-400">
                  ✨
                </span>
              )}
            </>
          }
          onClick={() => openExternal("https://hyya.com")}
          showChevron={true}
          labelNextToIcon
          isLast
        />
      </SettingsCategory>

      <SettingsCategory title={t("settings.links.infoSupportTitle")} className="mb-0">
        <SettingsRow
          className="animate-fade-in-up"
          style={{ animationDelay: "0.55s" }}
          icon={<BookOpen className="w-5 h-5" />}
          label={t("settings.quran.sourcesShortTitle")}
          onClick={() => setCurrentView("quranSources")}
          labelNextToIcon
        />
        <SettingsRow
          className="animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
          icon={<Shield className="w-5 h-5" />}
          label={t("settings.privacy.title")}
          onClick={() => setCurrentView("privacy")}
          labelNextToIcon
        />
      </SettingsCategory>
    </div>
  );
}
