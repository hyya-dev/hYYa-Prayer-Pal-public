import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

interface LanguageOption {
  value: string;
  label: string;
  originalLabel: string;
}

interface SettingsLanguageSelectorProps {
  languages: LanguageOption[];
  currentLanguage: string;
  onSelect: (value: string) => void;
}

export function SettingsLanguageSelector({
  languages,
  currentLanguage,
  onSelect,
}: SettingsLanguageSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      {languages.map((lang, index) => {
        const isSelected = currentLanguage === lang.value;
        const isLast = index === languages.length - 1;

        return (
          <button
            key={lang.value}
            onClick={() => onSelect(lang.value)}
            className={[
              "flex items-center justify-between w-full px-4 py-3 text-left transition-colors relative group",
              !isLast ? "border-b border-white/5" : "",
            ].join(" ")}
          >
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10 flex flex-col">
              <span
                className={`font-medium ${isSelected ? "text-white" : ""}`}
                style={{ color: isSelected ? undefined : "var(--pp-text-primary)" }}
              >
                {t(`settings.language.${lang.originalLabel.toLowerCase()}`, lang.label)}
              </span>
            </div>

            {isSelected && (
              <Check className="w-5 h-5 text-white relative z-10" />
            )}
          </button>
        );
      })}
    </div>
  );
}
