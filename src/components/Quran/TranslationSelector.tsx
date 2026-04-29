import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Languages } from 'lucide-react';
import type { QuranLanguageCode } from '@/types/quran';
import { ALL_QURAN_LANGUAGES } from '@/lib/quranLanguages';
import curatedTranslationsIcon from '@/assets/icon-curated-translations.png';
import { isRtlLanguage } from '@/lib/rtlLanguages';

interface TranslationOption {
  code: QuranLanguageCode;
  name: string;
  nameNative?: string;
}

// All 63 verified Sunni Quran translations
const translationOptions: TranslationOption[] = ALL_QURAN_LANGUAGES.map(lang => ({
  code: lang.code as QuranLanguageCode,
  name: lang.name,
  nameNative: lang.nativeName,
}));

interface TranslationSelectorProps {
  currentLanguage: QuranLanguageCode;
  onLanguageChange: (language: QuranLanguageCode) => void;
  compact?: boolean;
  /** Library home: pill label follows UI Settings language while list stays curated. */
  pillLabelLanguage?: string;
}

/**
 * Translation Selector Component
 * Allows users to switch between 63 verified Sunni Quran translations
 */
export function TranslationSelector({
  currentLanguage,
  onLanguageChange,
  compact = false,
  pillLabelLanguage,
}: TranslationSelectorProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  const pillLng = pillLabelLanguage ?? i18n.language;
  const isUiRtl = isRtlLanguage(i18n.language);
  const currentOption = translationOptions.find(opt => opt.code === currentLanguage) || translationOptions[0];

  const handleSelect = (language: QuranLanguageCode) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="pp-curated-translations-btn rounded-full px-5 py-2 min-h-[48px] flex items-center justify-center backdrop-blur-md border relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
          style={{ background: 'var(--pp-button-bg)', borderColor: 'var(--pp-border-soft)' }}
          aria-label={t('quran.selectTranslation', { lng: pillLng })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/20 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5">
            <img
              src={curatedTranslationsIcon}
              alt=""
              className="w-5 h-5 object-contain"
            />
            <span className="text-sm font-semibold pp-text-primary tracking-wide">
              {t('settings.quran.curatedTitle', { lng: pillLng })}
            </span>
          </div>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-xl shadow-lg border z-20 overflow-hidden backdrop-blur-sm pp-glass-surface-strong pp-translation-compact-menu">
              <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none rounded-xl" />
              <div className="p-2 relative z-10">
                {translationOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleSelect(option.code)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                      currentLanguage === option.code
                        ? 'bg-white/20 text-white font-semibold border pp-translation-option-selected'
                        : 'hover:bg-white/10 pp-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{option.nameNative || option.name}</span>
                      {currentLanguage === option.code && (
                        <span className="text-white flex-shrink-0">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm pp-glass-surface-soft"
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <Languages className="w-5 h-5 text-white" />
          <h3 className="font-bold pp-text-primary">{t('quran.translation')}</h3>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden backdrop-blur-sm border pp-glass-surface-button"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
            {/*
              UX Logic Layer 2 — Content-Layer Directionality Exception.
              The selected translation name is shown in its own native script (e.g. "العربية" for Arabic).
              Direction follows the translation's own language, not the UI language.
            */}
            <div
              lang={currentOption.code}
              dir={isRtlLanguage(currentOption.code) ? "rtl" : "ltr"}
              className="relative z-10 flex items-center justify-between w-full"
            >
              <span>{currentOption.nameNative || currentOption.name}</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              <div
                className="absolute top-full left-0 mt-2 rounded-xl shadow-lg border z-20 w-full overflow-hidden backdrop-blur-sm pp-glass-surface-strong pp-translation-menu"
              >
                <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none rounded-xl" />
                <div className="p-2 relative z-10">
                  {/* UX Logic Layer 2 — Content-Layer Directionality Exception.
                      Each translation option label is in its own native script.
                      Direction follows each option's own language, not the UI language. */}
                  {translationOptions.map((option) => (
                    <button
                      key={option.code}
                      onClick={() => handleSelect(option.code)}
                      lang={option.code}
                      dir={isRtlLanguage(option.code) ? "rtl" : "ltr"}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        currentLanguage === option.code
                          ? 'bg-white/20 text-white font-semibold border pp-translation-option-selected'
                          : 'hover:bg-white/10 pp-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{option.nameNative || option.name}</div>
                          {option.nameNative && option.name !== option.nameNative && (
                            <div className="text-xs pp-text-secondary">{option.name}</div>
                          )}
                        </div>
                        {currentLanguage === option.code && <span className="text-white text-xl">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-xs mt-3 pp-text-secondary">
          {t('quran.currentTranslation')}: {currentOption.nameNative || currentOption.name}
        </p>
      </div>
    </div>
  );
}
