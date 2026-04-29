import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Heart } from "lucide-react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import type { Verse, Surah, QuranLanguageCode } from "@/types/quran";
import { getSajdahLabel } from '@/lib/sajdahLocalization';
import { TransliterationDisplay } from "./TransliterationDisplay";
import { TranslationText } from "./TranslationText";
import {
  getArabicSizeClass,
  getTranslationSizeClass,
} from "./fontSizeClasses";

interface VerseReaderProps {
  readonly surah: Surah;
  readonly verses: Verse[];
  readonly currentLanguage: QuranLanguageCode;
  readonly currentVerseIndex: number;
  readonly arabicFontSize?: number;
  readonly translationFontSize?: number;
  readonly showTransliteration?: boolean;
  readonly showArabic?: boolean;
  readonly onBookmarkToggle?: (surahNumber: number, verseNumber: number) => void;
  readonly isBookmarked?: (surahNumber: number, verseNumber: number) => boolean;
  readonly activeVerseNumber?: number | null;
  readonly onVersePress?: (surahNumber: number, verseNumber: number, verseText: string) => void;
  readonly scrollParentRef?: React.RefObject<HTMLElement | null>;
  readonly verseBookmarks?: { surahNumber: number; verseNumber: number }[];
}

/** Resolves translation text from verse data, handling Arabic-only fallback. */
function resolveTranslation(
  verse: Verse,
  currentLanguage: QuranLanguageCode,
  showArabic: boolean,
  showTranslation: boolean,
): string {
  if (!showTranslation) return "";
  const fallbackArabic = verse.translations.ar || verse.arabicText || "";
  const translated = verse.translations[currentLanguage];
  if (translated) return translated;
  return showArabic ? "" : fallbackArabic;
}

type VerseReaderRowProps = Readonly<{
  index: number;
  verse: Verse;
  surah: Surah;
  currentVerseIndex: number;
  currentLanguage: QuranLanguageCode;
  showArabic: boolean;
  showTranslation: boolean;
  showTransliteration: boolean;
  translationFontSize: number;
  activeVerseNumber: number | null | undefined;
  onVersePress?: (surahNumber: number, verseNumber: number, verseText: string) => void;
  onBookmarkToggle?: (surahNumber: number, verseNumber: number) => void;
  isVerseBookmarked: (surahNumber: number, verseNumber: number) => boolean;
  isRTL: boolean;
  sajdahLabel: string;
  arabicSizeClass: string;
  translationSizeClass: string;
}>;

type VerseBookmarkButtonProps = Readonly<{
  surahNumber: number;
  verseNumber: number;
  currentLanguage: QuranLanguageCode;
  isRTL: boolean;
  isBookmarked: boolean;
  onToggle: () => void;
}>;

function SajdahChip({ sajdahLabel }: Readonly<{ sajdahLabel: string }>) {
  return (
    <div className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded-full text-xs font-bold pp-sajdah-chip">
      <span className="pp-sajdah-chip-text">{`۩ ${sajdahLabel}`}</span>
    </div>
  );
}

function ArabicVerseLine({
  verse,
  surahNumber,
  sajdahLabel,
  arabicSizeClass,
  showTranslationHasText,
  showTransliteration,
}: Readonly<{
  verse: Verse;
  surahNumber: number;
  sajdahLabel: string;
  arabicSizeClass: string;
  showTranslationHasText: boolean;
  showTransliteration: boolean;
}>) {
  return (
    <p
      dir="rtl"
      className={`notranslate pp-quran-arabic-text text-white ${arabicSizeClass} ${showTranslationHasText || showTransliteration ? "mb-3" : ""} ${surahNumber === 1 && verse.verseNumber === 1 ? "text-center" : "text-right"}`}
      translate="no"
    >
      {verse.arabicText}
      <span className="font-bold text-[#D4AF37] mx-1 inline-flex items-center justify-center min-w-[2em] h-[2em] rounded-full border border-[#D4AF37]/50 select-none text-[0.8em] px-1">
        {verse.verseNumber}
      </span>
      {verse.isSajdah ? (
        <span className="font-bold pp-accent-sajdah text-[#D4AF37]">{` ۩ ${sajdahLabel}`}</span>
      ) : null}
    </p>
  );
}

function TranslationVerseLine({
  verse,
  translation,
  translationSizeClass,
  isRTL,
  showArabic,
  sajdahLabel,
  isFatihaVerse1,
}: Readonly<{
  verse: Verse;
  translation: string;
  translationSizeClass: string;
  isRTL: boolean;
  showArabic: boolean;
  sajdahLabel: string;
  isFatihaVerse1: boolean;
}>) {
  return (
    <p
      dir={isRTL ? "rtl" : "ltr"}
      className={`notranslate leading-relaxed pp-text-secondary ${translationSizeClass} ${isFatihaVerse1 ? "text-center" : "text-start"}`}
      translate="no"
    >
      <TranslationText text={translation} />
      {verse.isSajdah ? (
        <span className="font-bold ms-2 inline-block pp-accent-sajdah">{`۩ ${sajdahLabel}`}</span>
      ) : null}
      {!showArabic && (
        <span className="font-bold text-[#D4AF37] ms-2 inline-flex items-center justify-center min-w-[2em] h-[2em] rounded-full border border-[#D4AF37]/50 select-none text-[0.8em] px-1">
          {verse.verseNumber}
        </span>
      )}
    </p>
  );
}

function VerseBookmarkButton({
  surahNumber,
  verseNumber,
  currentLanguage,
  isRTL,
  isBookmarked,
  onToggle,
}: VerseBookmarkButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none transition-opacity hover:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 opacity-90`}
      aria-label={
        isBookmarked
          ? i18next.t("quran.removeFavorite", { lng: currentLanguage })
          : i18next.t("quran.addFavorite", { lng: currentLanguage })
      }
    >
      <Heart className={`w-4 h-4 ${isBookmarked ? "text-white fill-white" : "text-white/70"}`} />
      <span className="sr-only">{`${surahNumber}:${verseNumber}`}</span>
    </button>
  );
}

function VerseReaderRow({
  index,
  verse,
  surah,
  currentVerseIndex,
  currentLanguage,
  showArabic,
  showTranslation,
  showTransliteration,
  translationFontSize,
  activeVerseNumber,
  onVersePress,
  onBookmarkToggle,
  isVerseBookmarked,
  isRTL,
  sajdahLabel,
  arabicSizeClass,
  translationSizeClass,
}: VerseReaderRowProps) {
  const translation = resolveTranslation(verse, currentLanguage, showArabic, showTranslation);
  const isCurrentVerse = index === currentVerseIndex;
  const isActiveVerse = activeVerseNumber === verse.verseNumber;
  const isBookmarked = isVerseBookmarked(surah.number, verse.verseNumber);
  const showTranslationHasText = showTranslation && Boolean(translation);

  return (
    <div className="pb-4">
      <div
        className={`w-full rounded-xl border relative overflow-hidden transition-all pp-quran-reading-card ${isCurrentVerse ? "ring-2 ring-white/40" : ""} ${isActiveVerse ? "ring-2 ring-white/60" : ""}`}
      >
        <button
          type="button"
          data-verse-number={verse.verseNumber}
          onClick={() => {
            const verseText = verse.translations[currentLanguage] || verse.arabicText || "";
            onVersePress?.(surah.number, verse.verseNumber, verseText);
          }}
          className="w-full text-start rounded-xl p-6 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
        >
          {/* Glass highlight - matching Library/Settings style */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />

          {verse.isSajdah ? <SajdahChip sajdahLabel={sajdahLabel} /> : null}

          <div className="relative z-10 flex items-start gap-4">
            <div className="flex-1 min-w-0 w-full">
              {showArabic ? (
                <ArabicVerseLine
                  verse={verse}
                  surahNumber={surah.number}
                  sajdahLabel={sajdahLabel}
                  arabicSizeClass={arabicSizeClass}
                  showTranslationHasText={showTranslationHasText}
                  showTransliteration={showTransliteration}
                />
              ) : null}

              <TransliterationDisplay
                surahNumber={surah.number}
                verseNumber={verse.verseNumber}
                showTransliteration={showTransliteration || false}
                translationFontSize={translationFontSize}
              />

              {showTranslationHasText ? (
                <TranslationVerseLine
                  verse={verse}
                  translation={translation}
                  translationSizeClass={translationSizeClass}
                  isRTL={isRTL}
                  showArabic={showArabic}
                  sajdahLabel={sajdahLabel}
                  isFatihaVerse1={surah.number === 1 && verse.verseNumber === 1}
                />
              ) : null}
            </div>
          </div>
        </button>

        {onBookmarkToggle ? (
          <VerseBookmarkButton
            surahNumber={surah.number}
            verseNumber={verse.verseNumber}
            currentLanguage={currentLanguage}
            isRTL={isRTL}
            isBookmarked={isBookmarked}
            onToggle={() => onBookmarkToggle(surah.number, verse.verseNumber)}
          />
        ) : null}
      </div>
    </div>
  );
}

type VerseReaderVirtuosoContext = Omit<VerseReaderRowProps, "index" | "verse">;

function createVerseReaderItemRenderer(ctx: VerseReaderVirtuosoContext) {
  return (index: number, verse: Verse) => (
    <VerseReaderRow {...ctx} index={index} verse={verse} />
  );
}

export function VerseReader({
  surah,
  verses,
  currentLanguage,
  currentVerseIndex,
  arabicFontSize = 24,
  translationFontSize = 16,
  showTransliteration = false,
  showArabic = true,
  onBookmarkToggle,
  isBookmarked,
  activeVerseNumber,
  onVersePress,
  scrollParentRef,
  verseBookmarks,
}: VerseReaderProps) {
  const { t } = useTranslation();
  const isRTL = isRtlLanguage(currentLanguage);
  const sajdahLabel = getSajdahLabel(currentLanguage);
  const arabicSizeClass = getArabicSizeClass(arabicFontSize);
  const translationSizeClass = getTranslationSizeClass(translationFontSize);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const prevVerseIndexRef = useRef<number | null>(null);

  // Scroll to current verse when verse changes externally (audio sync/search)
  useEffect(() => {
    if (prevVerseIndexRef.current === null) {
      prevVerseIndexRef.current = currentVerseIndex;
      return;
    }

    if (
      prevVerseIndexRef.current !== currentVerseIndex &&
      currentVerseIndex >= 0 &&
      (verses?.length ?? 0) > 0
    ) {
      virtuosoRef.current?.scrollToIndex({
        index: currentVerseIndex,
        align: "center",
        behavior: "smooth",
      });
    }
    prevVerseIndexRef.current = currentVerseIndex;
  }, [currentVerseIndex, verses?.length]);

  // For Arabic, don't show translation (Arabic text only)
  // For other languages, show translation
  // Show translation if displayLanguage is not Arabic
  const showTranslation = currentLanguage !== "ar";

  const isVerseBookmarked = useCallback(
    (surahNumber: number, verseNumber: number) => {
      if (isBookmarked) return isBookmarked(surahNumber, verseNumber);
      return verseBookmarks?.some((b) => b.surahNumber === surahNumber && b.verseNumber === verseNumber) || false;
    },
    [isBookmarked, verseBookmarks],
  );

  const virtuosoItemContent = useMemo(
    () =>
      createVerseReaderItemRenderer({
        surah,
        currentVerseIndex,
        currentLanguage,
        showArabic,
        showTranslation,
        showTransliteration,
        translationFontSize,
        activeVerseNumber,
        onVersePress,
        onBookmarkToggle,
        isVerseBookmarked,
        isRTL,
        sajdahLabel,
        arabicSizeClass,
        translationSizeClass,
      }),
    [
      surah,
      currentVerseIndex,
      currentLanguage,
      showArabic,
      showTranslation,
      showTransliteration,
      translationFontSize,
      activeVerseNumber,
      onVersePress,
      onBookmarkToggle,
      isVerseBookmarked,
      isRTL,
      sajdahLabel,
      arabicSizeClass,
      translationSizeClass,
    ],
  );

  if (!verses || verses.length === 0) {
    return (
      <div className="text-center py-8 pp-text-primary">
        <p>{t("quran.noVerses")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full py-4">
      {/* All Verses Display */}
      {/* Virtuoso Virtualized Display */}
      <Virtuoso
          ref={virtuosoRef}
          {...(scrollParentRef?.current
            ? { customScrollParent: scrollParentRef.current }
            : {})}
          data={verses}
          initialTopMostItemIndex={Math.max(currentVerseIndex, 0)}
          itemContent={virtuosoItemContent}
        />
    </div>
  );
}
