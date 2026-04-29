import React from "react";
import { Heart } from "lucide-react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import type { Verse, Surah, QuranLanguageCode } from "@/types/quran";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import {
  getArabicSizeClass,
  getTranslationSizeClass,
  getArabicVerseNumberSizeClass,
  getTranslationVerseNumberSizeClass,
} from "./fontSizeClasses";

interface PageViewProps {
  readonly surah: Surah;
  readonly verses: Verse[];
  readonly currentLanguage: QuranLanguageCode;
  readonly currentPage: number;
  readonly arabicFontSize?: number;
  readonly translationFontSize?: number;
  readonly showArabic?: boolean;
  readonly activeVerseNumber?: number | null;
  readonly onVersePress?: (surahNumber: number, verseNumber: number, verseText: string) => void;
  readonly onPageBookmarkToggle?: (pageNumber: number) => void;
  readonly currentPageBookmarked?: boolean;
}

interface RenderConfig {
  surah: Surah;
  currentLanguage: QuranLanguageCode;
  showArabic: boolean;
  showTranslation: boolean;
  arabicFontSize: number;
  translationFontSize: number;
  isRTL: boolean;
  activeVerseNumber: number | null;
  currentPageNumber: number;
  onVersePress?: (surahNumber: number, verseNumber: number, verseText: string) => void;
  onPageBookmarkToggle?: (pageNumber: number) => void;
  currentPageBookmarked?: boolean;
}

/**
 * Page View Component
 * Displays verses in traditional Mushaf page layout
 *
 * Quran policy: render from bundled local data only.
 */
export function PageView({
  surah,
  verses,
  currentLanguage,
  currentPage,
  showArabic = true,
  arabicFontSize = 22,
  translationFontSize = 14,
  activeVerseNumber = null,
  onVersePress,
  onPageBookmarkToggle,
  currentPageBookmarked,
}: PageViewProps) {
  const { t } = useTranslation();
  const isRTL = isRtlLanguage(currentLanguage);
  const showTranslation = currentLanguage !== "ar";

  // Filter verses for current page (fallback data)
  const pageVerses = verses.filter((v) => v.pageNumber === currentPage);

  const config: RenderConfig = {
    surah,
    currentLanguage,
    showArabic,
    showTranslation,
    arabicFontSize,
    translationFontSize,
    isRTL,
    activeVerseNumber: activeVerseNumber ?? null,
    currentPageNumber: currentPage,
    onVersePress,
    onPageBookmarkToggle,
    currentPageBookmarked,
  };

  // Render using local data (simplified fallback)
  if (pageVerses.length === 0) {
    return (
      <div className="text-center py-8 pp-text-primary">
        <p>
          {t("quran.noVersesOnPage")}
        </p>
      </div>
    );
  }

  return renderSimplifiedLayout(config, pageVerses);
}

/**
 * Render simplified layout using local verse data (fallback)
 */
function renderSimplifiedLayout(
  config: RenderConfig,
  pageVerses: Verse[],
) {
  const {
    surah,
    currentLanguage,
    showArabic,
    showTranslation,
    arabicFontSize,
    translationFontSize,
    isRTL,
    onVersePress,
    onPageBookmarkToggle,
    currentPageBookmarked,
    currentPageNumber,
  } = config;
  const arabicTextColorClass = "pp-text-primary";
  const arabicSizeClass = getArabicSizeClass(arabicFontSize);
  const translationSizeClass = getTranslationSizeClass(translationFontSize);
  const arabicVerseNumberSizeClass = getArabicVerseNumberSizeClass(arabicFontSize);
  const translationVerseNumberSizeClass = getTranslationVerseNumberSizeClass(translationFontSize);
  const isFatiha = surah.number === 1;

  const fatihaV1 = isFatiha ? pageVerses.find((v) => v.verseNumber === 1) : null;
  const arabicParagraphVerses = isFatiha
    ? pageVerses.filter((v) => v.verseNumber !== 1)
    : pageVerses;
  const translationParagraphVerses = arabicParagraphVerses;

  return (
    <div className="max-w-2xl mx-auto w-full py-4">
      {/* Page Content */}
      <div
        className="rounded-xl p-6 border relative overflow-hidden pp-quran-reading-card pp-min-h-60vh"
      >
        {/* Glass highlight - matching Library/Settings/VerseReader style */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
        {onPageBookmarkToggle ? (
          <button
            type="button"
            onClick={() => onPageBookmarkToggle(currentPageNumber)}
            className={`absolute top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none transition-opacity hover:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 opacity-90 ${isRTL ? "left-2" : "right-2"}`}
            aria-label={
              currentPageBookmarked
                ? i18next.t("quran.removeFavorite", { lng: currentLanguage })
                : i18next.t("quran.addFavorite", { lng: currentLanguage })
            }
          >
            <Heart
              className={`w-4 h-4 ${currentPageBookmarked ? "text-white fill-white" : "text-white/70"}`}
            />
          </button>
        ) : null}
        <div className="relative z-10">
          {/* Bismillah for Surahs other than Fatiha (1) and Tawbah (9) */}
          {surah.number !== 1 &&
            surah.number !== 9 &&
            pageVerses[0]?.verseNumber === 1 && (
              <div className="text-center mb-6 mt-2">
                <p
                  className={`text-2xl notranslate pp-quran-arabic-font ${arabicTextColorClass}`}
                >
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                </p>
              </div>
            )}
          {/* UX Logic Layer 2 — Content-Layer Directionality Exception.
              Quran Arabic text is always RTL regardless of UI language. */}
          {showArabic && (
            <div
              dir="rtl"
              className={`notranslate mb-6 pp-quran-arabic-font pp-quran-arabic-block ${arabicTextColorClass} ${arabicSizeClass}`}
              translate="no"
            >
              {isFatiha && fatihaV1?.arabicText && (
                <div className="text-center mb-4">
                  <button
                    type="button"
                    className="contents"
                    onClick={() => onVersePress?.(surah.number, fatihaV1.verseNumber, fatihaV1.arabicText)}
                  >
                    <span className="cursor-pointer">
                      {fatihaV1.arabicText}
                      <span
                        className={`inline-flex items-center justify-center min-w-[2em] h-[2em] px-1 rounded-full border border-[#D4AF37]/50 text-[#D4AF37] mx-1 font-bold pp-quran-arabic-font align-baseline ${arabicVerseNumberSizeClass}`}
                      >
                        {fatihaV1.verseNumber}
                      </span>
                    </span>
                  </button>
                </div>
              )}

              <p className="m-0">
                {arabicParagraphVerses.map((verse, idx) => (
                  <React.Fragment key={verse.id}>
                    <button
                      type="button"
                      className="contents"
                      onClick={() => onVersePress?.(surah.number, verse.verseNumber, verse.arabicText)}
                    >
                      <span className="cursor-pointer">
                        {verse.arabicText}
                        <span
                          className={`inline-flex items-center justify-center min-w-[2em] h-[2em] px-1 rounded-full border border-[#D4AF37]/50 text-[#D4AF37] mx-1 font-bold pp-quran-arabic-font align-baseline ${arabicVerseNumberSizeClass}`}
                        >
                          {verse.verseNumber}
                        </span>
                      </span>
                    </button>
                    {idx < arabicParagraphVerses.length - 1 && " "}
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}

          {/* UX Logic Layer 2 — Content-Layer Directionality Exception.
              Translation direction follows the selected translation language, not the UI language. */}
          {showTranslation && translationParagraphVerses.length > 0 && (
            <div
              className="mt-6 pt-6 border-t border-[var(--pp-border-soft)]"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div
                className={`notranslate pp-quran-translation-block pp-text-secondary ${translationSizeClass}`}
                translate="no"
              >
                <p className="m-0">
                  {translationParagraphVerses.map((verse, idx) => {
                    const fallbackArabic = verse.translations.ar || verse.arabicText || "";
                    const translation =
                      verse.translations[currentLanguage] || (showArabic ? "" : fallbackArabic);
                    if (!translation) return null;
                    return (
                      <React.Fragment key={verse.id}>
                        <button
                          type="button"
                          className="contents"
                          onClick={() => onVersePress?.(surah.number, verse.verseNumber, translation)}
                        >
                          <span className="cursor-pointer">
                            {translation}
                            <span
                              className={`inline-flex items-center justify-center min-w-[2em] h-[2em] px-1 rounded-full border border-[#D4AF37]/40 text-[#D4AF37] mx-1 font-semibold align-baseline ${translationVerseNumberSizeClass}`}
                            >
                              {verse.verseNumber}
                            </span>
                          </span>
                        </button>
                        {idx < translationParagraphVerses.length - 1 && " "}
                      </React.Fragment>
                    );
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
