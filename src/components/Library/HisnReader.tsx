import React from 'react';
import type { HisnChapter, HisnItem, HisnLanguage, HisnBookmark } from '@/types/hisn';
import type { ReadingMode } from '@/types/library';
import { HisnItemCard } from './HisnItemCard';
import { NavigationControls } from '@/components/Quran/NavigationControls';

interface HisnReaderProps {
    items: HisnItem[];
    selectedChapter: HisnChapter;
    readingMode: ReadingMode;
    currentItemIndex: number;
    effectiveLanguage: HisnLanguage;
    fontSize: number;
    bookmarks: HisnBookmark[];
    isRtlNavigation: boolean;
    canGoPrevious: boolean;
    canGoNext: boolean;
    onToggleBookmark: (chapterIndex: number, itemId: number) => void;
    onMarkAsRead: (chapterIndex: number, itemId: number) => void;
    onSetCurrentItemIndex: (index: number) => void;
    onPrevious: () => void;
    onNext: () => void;
    onBackToList: () => void;
    onSwipeStart: (e: React.TouchEvent) => void;
    onSwipeEnd: (e: React.TouchEvent) => void;
}

export function HisnReader({
    items,
    selectedChapter,
    readingMode,
    currentItemIndex,
    effectiveLanguage,
    fontSize,
    bookmarks,
    isRtlNavigation,
    canGoPrevious,
    canGoNext,
    onToggleBookmark,
    onMarkAsRead,
    onSetCurrentItemIndex,
    onPrevious,
    onNext,
    onBackToList,
    onSwipeStart,
    onSwipeEnd,
}: HisnReaderProps) {

    const getItemTranslation = (item: HisnItem): string => {
        if (effectiveLanguage === 'en') return item.translations.en || '';
        return '';
    };

    const isBookmarked = (chapterIndex: number, itemId: number) => {
        return bookmarks.some(b => b.chapterIndex === chapterIndex && b.itemId === itemId);
    };

    return (
        <>
            <div
                className="max-w-2xl mx-auto w-full pt-4 pb-0 pp-view-enter"
                onTouchStart={onSwipeStart}
                onTouchEnd={onSwipeEnd}
            >
                {readingMode === 'focus' ? (
                    (() => {
                        const item = items[currentItemIndex];
                        if (!item) return null;
                        const translation = getItemTranslation(item);
                        const showTranslation = effectiveLanguage !== 'ar' && !!translation;
                        const bookmarked = isBookmarked(selectedChapter.index, item.itemId);
                        return (
                            <HisnItemCard
                                item={item}
                                indexLabel={currentItemIndex + 1}
                                showArabic={effectiveLanguage === 'ar'}
                                translation={translation}
                                showTranslation={showTranslation}
                                arabicFontSize={fontSize}
                                translationFontSize={fontSize}
                                bookmarked={bookmarked}
                                effectiveLanguage={effectiveLanguage}
                                onToggleBookmark={() => onToggleBookmark(selectedChapter.index, item.itemId)}
                            />
                        );
                    })()
                ) : (
                    <div className="space-y-4">
                        {items.map((item, idx) => {
                            const translation = getItemTranslation(item);
                            const showTranslation = effectiveLanguage !== 'ar' && !!translation;
                            const bookmarked = isBookmarked(selectedChapter.index, item.itemId);
                            return (
                                <HisnItemCard
                                    key={item.id}
                                    item={item}
                                    indexLabel={idx + 1}
                                    showArabic={effectiveLanguage === 'ar'}
                                    translation={translation}
                                    showTranslation={showTranslation}
                                    arabicFontSize={fontSize}
                                    translationFontSize={fontSize}
                                    bookmarked={bookmarked}
                                    effectiveLanguage={effectiveLanguage}
                                    onToggleBookmark={() => onToggleBookmark(selectedChapter.index, item.itemId)}
                                    onClick={() => {
                                        onSetCurrentItemIndex(idx);
                                        onMarkAsRead(selectedChapter.index, item.itemId);
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {readingMode === 'focus' && items.length > 0 && (
                <NavigationControls
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onBackToList={onBackToList}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                    showBackToList
                    language={effectiveLanguage}
                    isRTL={isRtlNavigation}
                />
            )}
        </>
    );
}
