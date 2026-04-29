import React from 'react';
import { VerseReader } from './VerseReader';
import { PageView } from './PageView';
import { NavigationControls } from './NavigationControls';
import type { Surah, Verse, QuranLanguageCode } from '@/types/quran';

interface QuranReaderViewProps {
    readonly readingMode: 'verse' | 'page';
    readonly selectedSurah: Surah;
    readonly verses: Verse[];
    readonly displayLanguage: QuranLanguageCode;
    readonly currentVerseIndex: number;
    readonly currentPage: number;
    readonly arabicFontSize: number;
    readonly translationFontSize: number;
    readonly showArabic: boolean;
    readonly handlePageSwipeStart: (e: React.TouchEvent) => void;
    readonly handlePageSwipeEnd: (e: React.TouchEvent) => void;
    // Navigation
    readonly handlePrevious: () => void;
    readonly handleNext: () => void;
    readonly handleBackToList: () => void;
    readonly canGoPrevious: boolean;
    readonly canGoNext: boolean;
    readonly isRtlNavigation: boolean;
    readonly mainContentRef: React.RefObject<HTMLDivElement>;
    readonly activeVerseNumber?: number | null;
    readonly onVersePress?: (surahNumber: number, verseNumber: number, verseText: string) => void;
    readonly verseBookmarks?: { surahNumber: number; verseNumber: number }[];
    readonly onVerseBookmarkToggle?: (surahNumber: number, verseNumber: number) => void;
    readonly onPageBookmarkToggle?: (pageNumber: number) => void;
    readonly currentPageBookmarked?: boolean;
}

export function QuranReaderView({
    readingMode,
    selectedSurah,
    verses,
    displayLanguage,
    currentVerseIndex,
    currentPage,
    arabicFontSize,
    translationFontSize,
    showArabic,
    handlePageSwipeStart,
    handlePageSwipeEnd,
    handlePrevious,
    handleNext,
    handleBackToList,
    canGoPrevious,
    canGoNext,
    isRtlNavigation,
    mainContentRef,
    activeVerseNumber,
    onVersePress,
    verseBookmarks,
    onVerseBookmarkToggle,
    onPageBookmarkToggle,
    currentPageBookmarked,
}: QuranReaderViewProps) {

    const scrollToTop = () => {
        requestAnimationFrame(() => {
            mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    const onPreventDefaultWrapper = (fn: () => void) => {
        fn();
        scrollToTop();
    };

    return (
        <div key={readingMode} className="max-w-2xl mx-auto w-full pt-4 pb-0 pp-mode-switch">
            {readingMode === 'verse' ? (
                <VerseReader
                    surah={selectedSurah}
                    verses={verses}
                    currentLanguage={displayLanguage}
                    currentVerseIndex={currentVerseIndex}
                    activeVerseNumber={activeVerseNumber}
                    arabicFontSize={arabicFontSize}
                    translationFontSize={translationFontSize}
                    showArabic={showArabic}
                    onVersePress={onVersePress}
                    scrollParentRef={mainContentRef}
                    verseBookmarks={verseBookmarks}
                    onBookmarkToggle={onVerseBookmarkToggle}
                />
            ) : (
                <div onTouchStart={handlePageSwipeStart} onTouchEnd={handlePageSwipeEnd} className="relative">
                    <PageView
                        surah={selectedSurah}
                        verses={verses}
                        currentLanguage={displayLanguage}
                        currentPage={currentPage}
                        arabicFontSize={arabicFontSize}
                        translationFontSize={translationFontSize}
                        showArabic={showArabic}
                        activeVerseNumber={activeVerseNumber}
                        onVersePress={onVersePress}
                        onPageBookmarkToggle={onPageBookmarkToggle}
                        currentPageBookmarked={currentPageBookmarked}
                    />
                </div>
            )}

            {/* Page View Controls */}
            {verses.length > 0 && readingMode === 'page' && (
                <NavigationControls
                    onPrevious={() => onPreventDefaultWrapper(handlePrevious)}
                    onNext={() => onPreventDefaultWrapper(handleNext)}
                    onBackToList={handleBackToList}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                    showBackToList={false}
                    isRTL={isRtlNavigation}
                    language={displayLanguage}
                />
            )}
        </div>
    );
}
