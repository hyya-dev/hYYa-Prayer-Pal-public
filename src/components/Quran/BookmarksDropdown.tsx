import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Surah } from "@/types/quran";

export interface BookmarksDropdownProps {
  readonly showBookmarks: boolean;
  readonly onClose: () => void;
  readonly bookmarks: ReadonlyArray<{ id: string; pageNumber: number }>;
  readonly verseBookmarks: ReadonlyArray<{ id: string; surahNumber: number; verseNumber: number }>;
  readonly surahs: ReadonlyArray<Surah>;
  readonly displayLanguage: string;
  readonly handleOpenBookmarkPage: (pageNumber: number) => void;
  readonly handleOpenBookmarkVerse: (surahNumber: number, verseNumber: number) => void;
  readonly handleRemoveBookmark: (pageNumber: number) => void;
  readonly handleRemoveBookmarkVerse: (surahNumber: number, verseNumber: number) => void;
}

function getLocalizedSurahName(
  surah: {
    nameArabic: string;
    nameTranslated: Record<string, string>;
    nameTransliterated: string;
  },
  language: string,
): string {
  if (language === "ar") {
    return surah.nameArabic || surah.nameTransliterated;
  }

  const translated = surah.nameTranslated[language];
  if (translated && translated.trim().length > 0) {
    return translated;
  }

  return (
    surah.nameTranslated.en || surah.nameTransliterated || surah.nameArabic
  );
}

export function BookmarksDropdown({
  showBookmarks,
  onClose,
  bookmarks,
  verseBookmarks,
  surahs,
  handleOpenBookmarkPage,
  handleRemoveBookmark,
  handleOpenBookmarkVerse,
  handleRemoveBookmarkVerse,
  displayLanguage,
}: BookmarksDropdownProps) {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showBookmarks) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // If clicking outside the dropdown container, close it
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Find if they clicked the anchor button, and if so let its onClick handle toggle
        const isAnchor = (event.target as Element).closest('[data-bookmark-anchor="true"]');
        if (!isAnchor) {
          onClose();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showBookmarks, onClose]);

  if (!showBookmarks) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full mt-2 w-[280px] backdrop-blur-sm rounded-xl overflow-hidden border z-50 flex flex-col animate-fade-in origin-top end-0"
      style={{
        maxHeight: "350px",
        background: "var(--pp-button-bg)",
        borderColor: "var(--pp-border-soft)",
        boxShadow: "var(--pp-surface-shadow-lg)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col w-full pb-2">
        {bookmarks.length === 0 && verseBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4">
            <span className="text-sm font-medium" style={{ color: "var(--pp-text-secondary)" }}>
              {t("quran.noFavorites", { lng: displayLanguage })}
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {[...bookmarks].sort((a, b) => a.pageNumber - b.pageNumber).map((bookmark, index) => {
              const surah = surahs.find(
                (s) => bookmark.pageNumber >= s.startPage && bookmark.pageNumber <= s.endPage,
              );
              const surahName = surah
                ? getLocalizedSurahName(surah, displayLanguage)
                : t("nav.quran", { lng: displayLanguage });
              
              const isLast = index === bookmarks.length - 1 && verseBookmarks.length === 0;

              return (
                <div
                  key={`page-${bookmark.id}`}
                  className={[
                    "flex items-center justify-between w-full px-4 py-3 text-left transition-colors relative group",
                    isLast ? "" : "border-b border-white/5",
                  ].join(" ")}
                >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  
                  <button
                    onClick={() => {
                      handleOpenBookmarkPage(bookmark.pageNumber);
                      onClose();
                    }}
                    className="relative z-10 flex-1 flex flex-col items-start"
                  >
                    <span
                      className="font-medium"
                      style={{ color: "var(--pp-text-primary)" }}
                    >
                      {surahName} . {t("quran.page", { lng: displayLanguage })} {bookmark.pageNumber}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBookmark(bookmark.pageNumber);
                    }}
                    className="relative z-10 text-xs transition-all ml-4 shrink-0 px-3 py-1.5 rounded-lg hover:scale-105 active:scale-95 border"
                    style={{ 
                      backgroundColor: "rgba(239, 68, 68, 0.15)", 
                      color: "#ef4444",
                      borderColor: "rgba(239, 68, 68, 0.3)" 
                    }}
                  >
                    {t("quran.removeFavorite", { lng: displayLanguage })}
                  </button>
                </div>
              );
            })}

            {[...verseBookmarks].sort((a, b) => a.surahNumber === b.surahNumber ? a.verseNumber - b.verseNumber : a.surahNumber - b.surahNumber).map((vBmk, index) => {
               const surah = surahs.find(s => s.number === vBmk.surahNumber);
               const surahName = surah
                 ? getLocalizedSurahName(surah, displayLanguage)
                 : t("nav.quran", { lng: displayLanguage });
                 
               const isLast = index === verseBookmarks.length - 1;

               return (
                <div
                  key={`verse-${vBmk.id}`}
                  className={[
                    "flex items-center justify-between w-full px-4 py-3 text-left transition-colors relative group",
                    isLast ? "" : "border-b border-white/5",
                  ].join(" ")}
                >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  
                  <button
                    onClick={() => {
                      handleOpenBookmarkVerse(vBmk.surahNumber, vBmk.verseNumber);
                      onClose();
                    }}
                    className="relative z-10 flex-1 flex flex-col items-start"
                  >
                    <span
                      className="font-medium"
                      style={{ color: "var(--pp-text-primary)" }}
                    >
                      {surahName} • {t("quran.verse", { lng: displayLanguage })} {vBmk.verseNumber}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBookmarkVerse(vBmk.surahNumber, vBmk.verseNumber);
                    }}
                    className="relative z-10 text-xs transition-all ml-4 shrink-0 px-3 py-1.5 rounded-lg hover:scale-105 active:scale-95 border"
                    style={{ 
                      backgroundColor: "rgba(239, 68, 68, 0.15)", 
                      color: "#ef4444",
                      borderColor: "rgba(239, 68, 68, 0.3)" 
                    }}
                  >
                    {t("quran.removeFavorite", { lng: displayLanguage })}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
