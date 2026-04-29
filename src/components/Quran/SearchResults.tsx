import React from 'react';
import { useTranslation } from 'react-i18next';
import { isRtlLanguage } from '@/lib/rtlLanguages';
import type { QuranLanguageCode } from '@/types/quran';
import { getHighlightParts, type SearchResult } from '@/services/quranSearchService';

interface SearchResultsProps {
  readonly results: SearchResult[];
  readonly currentLanguage: QuranLanguageCode;
  readonly searchQuery: string;
  readonly searching?: boolean;
  readonly onSelectResult: (surahNumber: number, verseNumber: number) => void;
}

/**
 * Component to safely render text with highlighted search terms
 * Uses React nodes instead of dangerouslySetInnerHTML to prevent XSS
 */
function HighlightedText({ text, searchTerm }: { readonly text: string; readonly searchTerm: string }) {
  const parts = getHighlightParts(text, searchTerm);
  return (
    <>
      {parts.map((part, idx) =>
        part.highlight ? (
          <mark key={`${part.text}-${idx}`}>{part.text}</mark>
        ) : (
          <span key={`${part.text}-${idx}`}>{part.text}</span>
        )
      )}
    </>
  );
}

export function SearchResults({ results, currentLanguage, searchQuery, searching = false, onSelectResult }: SearchResultsProps) {
  const { t } = useTranslation();
  const isRTL = isRtlLanguage(currentLanguage);

  if (searching) {
    return (
      <div className="text-center py-8" style={{ color: "var(--pp-text-secondary)" }}>
        <p>{t('quran.searching')}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: "var(--pp-text-secondary)" }}>
        <p>{t('quran.noSearchResults')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm mb-4" style={{ color: "var(--pp-text-secondary)" }}>
        {t('quran.searchResultsCount', { count: results.length })}
      </div>
      {results.map((result, index) => {
        const translation = result.verse.translations[currentLanguage] ?? result.verse.translations.en ?? '';
        const showTranslation = currentLanguage !== 'ar' && translation;

        return (
          <button
            key={`${result.surahNumber}-${result.verse.id}-${index}`}
            onClick={() => onSelectResult(result.surahNumber, result.verse.verseNumber)}
            className="w-full rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] transition-all text-left"
            style={{
              background: 'var(--pp-surface-gradient-soft)',
              borderColor: 'var(--pp-border-soft)',
              color: 'var(--pp-text-primary)',
              boxShadow: 'var(--pp-surface-shadow)',
            }}
          >
            {/* Glass highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
            <div className="relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ color: 'var(--pp-text-secondary)' }}>
                {result.verse.verseNumber}
              </div>
              <div className="flex-1">
                <div className="text-xs mb-2" style={{ color: 'var(--pp-text-secondary)' }}>
                  {t('quran.sura')} {result.surahNumber}, {t('quran.verse')} {result.verse.verseNumber}
                </div>
                
                {/* Arabic Text */}
                {result.verse.arabicText && (
                  <div
                    className="mb-2 text-right notranslate text-lg pp-quran-arabic-font"
                    style={{
                      direction: 'rtl',
                      color: 'var(--pp-text-primary)',
                      lineHeight: "2.5",
                      letterSpacing: "0.03em",
                      wordSpacing: "0.15em",
                      textRendering: "optimizeLegibility",
                      WebkitFontSmoothing: "antialiased",
                      fontWeight: "700",
                    }}
                    translate="no"
                  >
                    <HighlightedText
                      text={result.verse.arabicText}
                      searchTerm={result.matchType === 'arabic' ? searchQuery : ''}
                    />
                  </div>
                )}
                
                {/* Translation */}
                {/* UX Logic Layer 2 — Content-Layer Directionality Exception.
                    Search result translation text direction follows the selected translation language,
                    not the UI language. */}
                {showTranslation && (
                  <div
                    className={`text-sm text-start`}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    style={{ color: 'var(--pp-text-secondary)' }}
                  >
                    <HighlightedText
                      text={translation}
                      searchTerm={result.matchType === 'translation' ? searchQuery : ''}
                    />
                  </div>
                )}
              </div>
            </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
