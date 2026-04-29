import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsRow } from "../../settings/SettingsRow";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, HisnLibraryLanguage } from "@/hooks/useAppSettings";

// eslint-disable-next-line react-refresh/only-export-components
export const HISN_LIBRARY_LANGUAGES: {
  value: HisnLibraryLanguage;
  labelKey: string;
}[] = [
  { value: "ar", labelKey: "settings.language.arabic" },
  { value: "en", labelKey: "settings.language.english" },
];

interface ContentLanguageSettingsPanelProps {
  settings: AppSettings;
  setCurrentView: (view: unknown) => void;
  quranLanguagesOptions: Array<{ code: string; name: string }>;
  onBack: () => void;
}

export function ContentLanguageSettingsPanel({
  settings,
  setCurrentView,
  quranLanguagesOptions,
  onBack,
}: ContentLanguageSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("settings.language.libraryLanguageTitle")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory
        title={t("settings.language.libraryLanguageTitle")}
      >
        <div className="px-4 py-2 border-b border-white/5">
          <p className="text-xs text-white/50">
            {t(
              "settings.language.libraryLanguageDesc",
            )}
          </p>
        </div>
        <SettingsRow
          icon={<BookOpen className="w-5 h-5" />}
          label={t("nav.quran")}
          value={
            settings.defaultQuranLanguage == null
              ? t("settings.language.sameAsAppLanguage")
              : quranLanguagesOptions.find(
                  (l) => l.code === settings.defaultQuranLanguage,
                )?.name || settings.defaultQuranLanguage
          }
          onClick={() => setCurrentView("quranLanguage")}
          showChevron
          labelNextToIcon
        />
        <SettingsRow
          icon={<BookOpen className="w-5 h-5" />}
          label={t("screens.library")}
          value={
            settings.defaultHisnLanguage == null
              ? t("settings.language.sameAsAppLanguage")
              : t(
                  HISN_LIBRARY_LANGUAGES.find(
                    (l) => l.value === settings.defaultHisnLanguage,
                  )?.labelKey || "",
                )
          }
          onClick={() => setCurrentView("hisnLanguage")}
          isLast
          showChevron
          labelNextToIcon
        />
      </SettingsCategory>
    </SettingsSubScreen>
  );
}
