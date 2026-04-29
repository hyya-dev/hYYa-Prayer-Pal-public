import { useTranslation } from "react-i18next";
import { startTransition } from "react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, QuranLanguageCode } from "@/hooks/useAppSettings";

interface QuranLanguageSettingsPanelProps {
  settings: AppSettings;
  onUpdateQuranLanguage: (language: QuranLanguageCode | null) => void;
  quranLanguagesOptions: Array<{ code: string; name: string; nativeName?: string }>;
  onBack: () => void;
}

export function QuranLanguageSettingsPanel({
  settings,
  onUpdateQuranLanguage,
  quranLanguagesOptions,
  onBack,
}: QuranLanguageSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("settings.quran.title")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory
        noTransform
        title={t("settings.language.contentLanguage")}
      >
        <div className="px-4 py-2 border-b border-white/5">
          <p className="text-xs text-white/50">
            {t(
              "settings.language.quranLanguageDesc",
            )}
          </p>
        </div>
        <button
          key="null"
          onClick={() => startTransition(() => onUpdateQuranLanguage(null))}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 active:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out flex-shrink-0"
        >
          <span className="text-sm text-white">
            {t("settings.language.sameAsAppLanguage")}
          </span>
          {settings.defaultQuranLanguage === null && (
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          )}
        </button>
        {quranLanguagesOptions.map((lang, idx) => (
          <button
            key={lang.code}
            onClick={() =>
              startTransition(() =>
                onUpdateQuranLanguage(lang.code as QuranLanguageCode),
              )
            }
            className={`w-full flex items-center justify-between px-4 py-3 active:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out flex-shrink-0 ${
              idx !== quranLanguagesOptions.length - 1
                ? "border-b border-white/5"
                : ""
            }`}
          >
            <div className="flex flex-col items-start min-w-0 pr-4">
              <span className="text-sm text-white truncate">{lang.name}</span>
              {lang.nativeName && lang.nativeName !== lang.name && (
                <span className="text-xs text-white/40 truncate">
                  {lang.nativeName}
                </span>
              )}
            </div>
            {settings.defaultQuranLanguage === lang.code && (
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
