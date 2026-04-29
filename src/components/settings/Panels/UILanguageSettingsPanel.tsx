import { useTranslation } from "react-i18next";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsLanguageSelector } from "../../settings/SettingsLanguageSelector";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, Language } from "@/hooks/useAppSettings";
import { StorageService } from "@/services/StorageService";

interface UILanguageSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onBack: () => void;
  languages: Array<{
    value: Language;
    label: string;
    originalLabel: string;
  }>;
}

export function UILanguageSettingsPanel({
  settings,
  onUpdateSettings,
  onBack,
  languages,
}: UILanguageSettingsPanelProps) {
  const { t, i18n } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("settings.language.uiLanguageTitle")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory noTransform className="mb-0">
        <SettingsLanguageSelector
          languages={languages}
          currentLanguage={settings.language}
          onSelect={(value) => {
            StorageService.setItem("language", value);
            onUpdateSettings({ language: value as Language });
            i18n.changeLanguage(value);
          }}
        />
      </SettingsCategory>
    </SettingsSubScreen>
  );
}
