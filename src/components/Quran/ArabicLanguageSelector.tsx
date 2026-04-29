import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';
import type { QuranLanguageCode } from '@/types/quran';
import { ALL_QURAN_LANGUAGES } from '@/lib/quranLanguages';

interface ArabicLanguageSelectorProps {
  secondaryLanguage: QuranLanguageCode | null;
  onLanguageChange: (language: QuranLanguageCode | null) => void;
}

const allLanguages: QuranLanguageCode[] = ALL_QURAN_LANGUAGES
  .map((lang) => lang.code as QuranLanguageCode)
  .filter((code) => code !== 'ar');

const languageLabels = ALL_QURAN_LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code as QuranLanguageCode] = lang.name;
    return acc;
  },
  {} as Record<QuranLanguageCode, string>,
);

export function ArabicLanguageSelector({
  secondaryLanguage,
  onLanguageChange,
}: Readonly<ArabicLanguageSelectorProps>) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelect = (value: string) => {
    const lang = value === 'ar-only' ? null : (value as QuranLanguageCode);
    onLanguageChange(lang);
    setIsOpen(false);
  };

  const currentValue = secondaryLanguage || 'ar-only';
  const displayText = currentValue === 'ar-only'
    ? t('quran.arabicOnly')
    : languageLabels[secondaryLanguage!] || 'EN';

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 relative backdrop-blur-sm border transition-all"
        style={{
          background: 'var(--pp-button-bg)',
          borderColor: 'var(--pp-border-soft)',
          boxShadow: 'var(--pp-surface-shadow)',
        }}
        aria-label={t('quran.selectTranslation')}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
        <Languages className="w-4 h-4 flex-shrink-0 relative z-10 pointer-events-none" style={{ color: 'var(--pp-text-secondary)' }} />
        <span className="text-xs relative z-10 whitespace-nowrap" style={{ color: 'var(--pp-text-primary)' }}>
          {displayText}
        </span>
        <ChevronDown
          className={`w-3 h-3 flex-shrink-0 relative z-10 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--pp-text-secondary)' }}
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            style={{ background: 'transparent', border: 'none', padding: 0 }}
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
            aria-label="Close language menu"
            tabIndex={-1}
          />
          <div
            className="absolute top-full end-0 mt-2 rounded-xl shadow-lg border z-50 backdrop-blur-sm"
            style={{
              background: 'var(--pp-surface-gradient-strong)',
              borderColor: 'var(--pp-border-soft)',
              boxShadow: 'var(--pp-surface-shadow-lg)',
              width: 'max-content',
              maxWidth: 'none',
              position: 'absolute',
              pointerEvents: 'auto',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none rounded-xl" />
            <div className="p-2 relative z-10">
              <button
                onClick={() => handleSelect('ar-only')}
                className={`block text-start px-3 py-2 rounded-lg transition-all whitespace-nowrap ${currentValue === 'ar-only'
                    ? 'bg-white/25 text-white font-bold border'
                    : 'hover:bg-white/10'
                  }`}
                style={{
                  color: 'var(--pp-text-primary)',
                  borderColor: currentValue === 'ar-only' ? 'var(--pp-accent)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{t('quran.arabicOnly')}</span>
                  {currentValue === 'ar-only' && (
                    <span className="text-white flex-shrink-0">✓</span>
                  )}
                </div>
              </button>
              {allLanguages
                .filter((l) => l !== 'ar')
                .map((l) => (
                  <button
                    key={l}
                    onClick={() => handleSelect(l)}
                    className={`block text-start px-3 py-2 rounded-lg transition-all whitespace-nowrap ${currentValue === l
                        ? 'bg-white/20 text-white font-semibold border'
                        : 'hover:bg-white/10'
                      }`}
                    style={{
                      color: currentValue === l ? undefined : 'var(--pp-text-primary)',
                      borderColor: currentValue === l ? 'var(--pp-border-soft)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{languageLabels[l]}</span>
                      {currentValue === l && (
                        <span className="text-white flex-shrink-0">✓</span>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
