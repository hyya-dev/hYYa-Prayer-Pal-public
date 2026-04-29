import { useTranslation } from "react-i18next";
import { startTransition } from "react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, HisnLibraryLanguage } from "@/hooks/useAppSettings";
import { HISN_LIBRARY_LANGUAGES } from "./ContentLanguageSettingsPanel";

interface HisnLanguageSettingsPanelProps {
  settings: AppSettings;
  onUpdateHisnLanguage: (language: HisnLibraryLanguage | null) => void;
  onBack: () => void;
}

export function HisnLanguageSettingsPanel({
  settings,
  onUpdateHisnLanguage,
  onBack,
}: HisnLanguageSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("screens.library")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory
        title={t("settings.language.contentLanguage")}
      >
        <button
          key="null"
          onClick={() => startTransition(() => onUpdateHisnLanguage(null))}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 active:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out flex-shrink-0"
        >
          <span className="text-sm text-white">
            {t("settings.language.sameAsAppLanguage")}
          </span>
          {settings.defaultHisnLanguage === null && (
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          )}
        </button>
        {HISN_LIBRARY_LANGUAGES.map((lang, idx) => (
          <button
            key={lang.value}
            onClick={() =>
              startTransition(() => onUpdateHisnLanguage(lang.value))
            }
            className={`w-full flex items-center justify-between px-4 py-3 active:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out flex-shrink-0 ${
              idx !== HISN_LIBRARY_LANGUAGES.length - 1
                ? "border-b border-white/5"
                : ""
            }`}
          >
            <span className="text-sm text-white min-w-0 pr-4 truncate">{t(lang.labelKey)}</span>
            {settings.defaultHisnLanguage === lang.value && (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </button>
        ))}
      </SettingsCategory>
    </SettingsSubScreen>
  );
}
