import { useTranslation } from "react-i18next";
import { Shield, MapPin, Bell, Mail } from "lucide-react";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { Capacitor } from "@capacitor/core";

interface PrivacySettingsPanelProps {
  onBack: () => void;
}

export function PrivacySettingsPanel({ onBack }: PrivacySettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("settings.privacy.title")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 mx-auto mb-3 text-white/70" />
          <h2 className="text-xl font-bold" style={{ color: "var(--pp-header-title-color)" }}>
            {t("app.name")}
          </h2>
          <p className="text-sm" style={{ color: "var(--pp-text-secondary)" }}>
            {t("settings.privacy.subtitle")}
          </p>
        </div>

        {Capacitor.getPlatform() === "android" && (
          <div className="p-4 rounded-xl bg-black/35 border border-white/15">
            <p className="text-sm text-white/70 leading-relaxed">
              {t(
                "settings.privacy.androidPolicyHint",
              )}
            </p>
          </div>
        )}

        {/* Location Data */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-white/70" />
            <h3 className="font-semibold text-white">
              {t("settings.privacy.locationTitle")}
            </h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.privacy.locationDesc",
            )}
          </p>
        </div>

        {/* Notifications */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-5 h-5 text-white/70" />
            <h3 className="font-semibold text-white">
              {t("settings.privacy.notificationsTitle")}
            </h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.privacy.notificationsDesc",
            )}
          </p>
        </div>

        {/* Data Sharing */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">
              {t("settings.privacy.noSharingTitle")}
            </h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.privacy.noSharingDesc",
            )}
          </p>
        </div>

        {/* Contact */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-white/70" />
            <h3 className="font-semibold text-white">
              {t("settings.privacy.contactTitle")}
            </h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.privacy.contactDesc",
            )}
          </p>
          <a
            href="mailto:h@hyya.com"
            className="inline-block mt-2 text-white/70 font-medium hover:underline"
          >
            h@hyya.com
          </a>
        </div>

        {/* Last Updated */}
        <p className="text-center text-xs text-white/40 pt-4">
          {t("settings.privacy.lastUpdated")}
        </p>
      </div>
    </SettingsSubScreen>
  );
}
