import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Heart, Bookmark } from "lucide-react";
import type { HisnChapter, HisnLanguage } from "@/types/hisn";

/**
 * HisnChapterList — Chapter list for Hisn Muslim.
 *
 * The Bookmarks button and Search bar have been moved to the LibrarySubpageShell
 * controlsRow (sharing the row with the back button), per UX Logic Rules.
 * This component only renders the chapter list itself.
 */
interface HisnChapterListProps {
  loading: boolean;
  searching: boolean;
  searchQuery: string;
  searchResults: HisnChapter[] | null;
  visibleChapters: HisnChapter[];
  effectiveLanguage: HisnLanguage;
  onSelectChapter: (index: number) => void;
  onToggleListBookmark?: (index: number, isFavorited: boolean) => void;
  /** Chapters that contain at least one bookmarked item */
  bookmarkedChapters?: Set<number>;
  /** Chapters that contain at least one bookmarked article (item) */
  chaptersWithBookmarkedItems?: Set<number>;
}

export const HisnChapterList = React.memo(function HisnChapterList({
  loading,
  searching,
  searchQuery,
  searchResults,
  visibleChapters,
  effectiveLanguage,
  onSelectChapter,
  onToggleListBookmark,
  bookmarkedChapters,
  chaptersWithBookmarkedItems,
}: HisnChapterListProps) {
  const { t } = useTranslation();
  const isArabicScript = effectiveLanguage === "ar";
  const isRtlLayout = isArabicScript;

  // Only show full-screen loading on initial load, not when searching
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] pp-view-enter">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--pp-text-primary)' }} />
          <p style={{ color: 'var(--pp-text-primary)' }}>{t("library.loading", { lng: effectiveLanguage })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full pt-4 pb-0 pp-view-enter">
      {searching && (
        <div className="text-center text-sm py-2 flex items-center justify-center gap-2" style={{ color: 'var(--pp-text-secondary)' }}>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>{t("quran.searching", { lng: effectiveLanguage })}</span>
        </div>
      )}
      <div className="space-y-2">
        {visibleChapters.map((ch, index) => (
          <button
            key={ch.index}
            type="button"
            onClick={() => onSelectChapter(ch.index)}
            className="w-full rounded-xl px-4 py-3 border relative overflow-hidden backdrop-blur-sm hover:scale-[1.01] active:scale-[0.99] transition-all animate-fade-in-up text-center"
            style={{
              background: 'var(--pp-button-bg)',
              borderColor: 'var(--pp-border-soft)',
              color: 'var(--pp-text-primary)',
              boxShadow: "var(--pp-surface-shadow-lg)",
              animationDelay: `${Math.min(index * 0.02, 0.2)}s`,
              animationFillMode: "both",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            {/*
              Layout:
              - Number badge on the leading edge (LEFT in LTR, RIGHT in RTL)
              - Text CENTERED (flex-1 flex items-center justify-center)
              - Invisible spacer on the trailing edge for perfect centering
            */}
            <div className={`relative z-10 flex items-center gap-3 ${isRtlLayout ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ color: 'var(--pp-text-primary)' }}>
                {ch.index + 1}
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-center">
                <div
                  className={`font-bold break-words text-center transition-all ${isArabicScript ? "text-xl pp-quran-arabic-optimized" : "text-base"}`}
                  style={{
                    ...(isArabicScript ? {
                      lineHeight: "1.3",
                      letterSpacing: "0.03em",
                      wordSpacing: "0.15em",
                      textRendering: "optimizeLegibility",
                      WebkitFontSmoothing: "antialiased",
                      fontWeight: "700",
                      color: "var(--pp-text-primary)",
                    } : {
                      color: "var(--pp-text-primary)",
                    }),
                  }}
                >
                  {ch.title[effectiveLanguage] || ch.title.ar}
                </div>
              </div>
              {/* Favorite indicator similar to Quran Surah list */}
              <div className="w-8 flex-shrink-0 flex items-center justify-center">
                {/*
                  UX clarity:
                  - Heart fill = chapter is favorited
                  - Small bookmark badge = chapter contains favorited articles
                */}
                {(() => {
                  const chapterFav = bookmarkedChapters?.has(ch.index) ?? false;
                  const itemFav = chaptersWithBookmarkedItems?.has(ch.index) ?? false;
                  const isFav = chapterFav || itemFav;

                  return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleListBookmark?.(ch.index, isFav);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 transition-colors"
                  aria-label={t("library.favorites", { lng: effectiveLanguage })}
                  style={{
                    color: isFav
                      ? "var(--pp-text-primary)"
                      : "var(--pp-text-secondary)",
                  }}
                >
                  <span className="relative">
                    <Heart
                      className={`w-4 h-4 ${isFav ? "fill-current" : ""}`}
                      aria-hidden="true"
                    />
                    {itemFav && (
                      <Bookmark
                        className="w-3 h-3 absolute -bottom-1 -end-1 opacity-90"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </button>
                  );
                })()}
              </div>
            </div>
          </button>
        ))}
      </div>
      {!!searchQuery.trim() && searchResults?.length === 0 && !searching && (
        <div className="text-center text-sm py-6" style={{ color: 'var(--pp-text-secondary)' }}>
          {t("quran.noSearchResults", { lng: effectiveLanguage })}
        </div>
      )}
    </div>
  );
});
