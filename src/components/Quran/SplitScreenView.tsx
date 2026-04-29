import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Verse, Surah, QuranLanguageCode } from '@/types/quran';
import { TranslationText } from './TranslationText';

interface SplitScreenViewProps {
  readonly surah: Surah;
  readonly verses: Verse[];
  readonly currentLanguage: QuranLanguageCode;
  readonly arabicFontSize?: number;
  readonly translationFontSize?: number;
  readonly onBookmarkToggle?: (surahNumber: number, verseNumber: number) => void;
  readonly isBookmarked?: (surahNumber: number, verseNumber: number) => boolean;
}

/**
 * Split Screen View Component
 * Displays Arabic on one side and translation on the other side
 */
export function SplitScreenView({
  surah,
  verses,
  currentLanguage,
  arabicFontSize = 24,
  translationFontSize = 16,
  onBookmarkToggle,
  isBookmarked,
}: SplitScreenViewProps) {
  const { t } = useTranslation();
  const showTranslation = currentLanguage !== 'ar';
  const [scrollPosition, setScrollPosition] = useState(0);
  const arabicScrollRef = useRef<HTMLDivElement>(null);
  const translationScrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll between Arabic and Translation panels
  const handleArabicScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollPosition(scrollTop);
    if (translationScrollRef.current) {
      translationScrollRef.current.scrollTop = scrollTop;
    }
  };

  const handleTranslationScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollPosition(scrollTop);
    if (arabicScrollRef.current) {
      arabicScrollRef.current.scrollTop = scrollTop;
    }
  };

  // Sync scroll on mount
  useEffect(() => {
    if (arabicScrollRef.current && translationScrollRef.current) {
      arabicScrollRef.current.scrollTop = scrollPosition;
      translationScrollRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  if (!verses || verses.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--pp-text-primary)' }}>
        <p>{t('quran.noVerses')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full py-4 h-full flex flex-col">
      {/* Split Screen Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-250px)]">
        {/* Arabic Panel */}
        <div 
          ref={arabicScrollRef}
          onScroll={handleArabicScroll}
          className="overflow-y-auto pe-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="space-y-4">
            {verses.map((verse) => (
              <div
                key={`arabic-${verse.id}`}
                className="group"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ color: 'var(--pp-text-primary)' }}>
                    {verse.verseNumber}
                  </div>
                </div>
                <div>
                  <p
                    className="leading-relaxed text-right pp-quran-arabic-font"
                    style={{ 
                      direction: 'rtl',
                      fontSize: `${arabicFontSize}px`,
                      lineHeight: '2.5',
                      color: 'var(--pp-text-primary)',
                    }}
                  >
                    {verse.arabicText}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Translation Panel */}
        {showTranslation && (
          <div 
            ref={translationScrollRef}
            onScroll={handleTranslationScroll}
            className="overflow-y-auto ps-2 border-s"
            style={{ scrollbarWidth: 'thin', borderColor: 'var(--pp-border-soft)' }}
          >
            <div className="space-y-4">
              {verses.map((verse) => {
                const translation = verse.translations[currentLanguage] ?? verse.translations.en ?? '';
                return (
                  <div
                    key={`translation-${verse.id}`}
                    className="group"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ color: 'var(--pp-text-primary)' }}>
                        {verse.verseNumber}
                      </div>
                    </div>
                    <p 
                      className="leading-relaxed"
                      dir="auto"
                      style={{
                        fontSize: `${translationFontSize}px`,
                        lineHeight: '1.8',
                        color: 'var(--pp-text-secondary)',
                      }}
                    >
                      <TranslationText text={translation} />
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* If Arabic only, show message */}
        {!showTranslation && (
          <div className="flex items-center justify-center" style={{ color: 'var(--pp-text-secondary)' }}>
            <p>{t('quran.arabicTextOnly')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
