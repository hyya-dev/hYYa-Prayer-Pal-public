import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Verse, Surah, QuranLanguageCode } from '@/types/quran';
import { TranslationText } from './TranslationText';

interface ContinuousScrollViewProps {
  readonly surah: Surah;
  readonly verses: Verse[];
  readonly currentLanguage: QuranLanguageCode;
  readonly arabicFontSize?: number;
  readonly translationFontSize?: number;
  readonly onBookmarkToggle?: (surahNumber: number, verseNumber: number) => void;
  readonly isBookmarked?: (surahNumber: number, verseNumber: number) => boolean;
}

/**
 * Continuous Scroll View Component
 * Displays all verses in a continuous, flowing scroll without individual cards
 */
export function ContinuousScrollView({
  surah,
  verses,
  currentLanguage,
  arabicFontSize = 24,
  translationFontSize = 16,
  onBookmarkToggle,
  isBookmarked,
}: ContinuousScrollViewProps) {
  const { t } = useTranslation();
  const showTranslation = currentLanguage !== 'ar';

  // Performance: Progressive rendering to avoid blocking the main thread
  // Start with a small number of verses to render immediately
  const [renderLimit, setRenderLimit] = React.useState(15);

  // Reset limit when surah changes
  React.useEffect(() => {
    setRenderLimit(15);
  }, [surah.number]); // Use surah.number or ID as dependency

  // progressively load more verses
  React.useEffect(() => {
    if (renderLimit < verses.length) {
      const timeout = requestAnimationFrame(() => {
        setRenderLimit(prev => Math.min(prev + 50, verses.length));
      });
      return () => cancelAnimationFrame(timeout);
    }
  }, [renderLimit, verses.length]);

  if (!verses || verses.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--pp-text-primary)' }}>
        <p>{t('quran.noVerses')}</p>
      </div>
    );
  }

  // Optimize: Only render visible subset
  const visibleVerses = verses.slice(0, renderLimit);

  return (
    <div className="max-w-4xl mx-auto w-full py-4">
      {/* Continuous Text Flow */}
      <div className="space-y-6">
        {visibleVerses.map((verse) => {
          const translation = showTranslation
            ? (verse.translations[currentLanguage] ?? verse.translations.en)
            : undefined;

          return (
            <div
              key={verse.id}
              className="group"
              style={{ contentVisibility: 'auto', containIntrinsicSize: '200px' }} // Browser optimization
            >
              {/* Verse Number Badge */}
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1" style={{ color: 'var(--pp-text-primary)' }}>
                  {verse.verseNumber}
                </div>
              </div>

              {/* Arabic Text - Continuous flow */}
              <div>
                <p
                  className="leading-relaxed mb-3 text-end pp-quran-arabic-font"
                  style={{
                    fontSize: `${arabicFontSize}px`,
                    lineHeight: '2.5',
                    color: 'var(--pp-text-primary)',
                  }}
                >
                  {verse.arabicText}
                </p>
              </div>

              {/* Translation - Continuous flow below Arabic */}
              {showTranslation && translation && (
                <p
                  className="leading-relaxed mb-6 text-start"
                  style={{
                    fontSize: `${translationFontSize}px`,
                    lineHeight: '1.8',
                    color: 'var(--pp-text-secondary)',
                  }}
                >
                  <TranslationText text={translation} />
                </p>
              )}
            </div>
          );
        })}

        {/* Loading Indicator for progressive render */}
        {renderLimit < verses.length && (
          <div className="py-4 text-center text-sm" style={{ color: 'var(--pp-text-secondary)' }}>
            {t('quran.loadingMoreVerses')}
          </div>
        )}
      </div>
    </div>
  );
}
