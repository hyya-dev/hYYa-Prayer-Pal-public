import React from "react";
import { useTranslation } from "react-i18next";
import type { Surah } from "@/types/quran";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { Heart } from "lucide-react";

export interface BookmarksModalProps {
  readonly showBookmarks: boolean;
  readonly onClose: () => void;
  readonly bookmarks: ReadonlyArray<{ id: string; pageNumber: number }>;
  readonly surahs: ReadonlyArray<Surah>;
  readonly handleOpenBookmarkPage: (pageNumber: number) => void;
  readonly handleRemoveBookmark: (pageNumber: number) => void;
  readonly displayLanguage: string;
  // Surah bookmarks
  readonly surahBookmarks?: ReadonlyArray<{ surahNumber: number }>;
  readonly handleOpenBookmarkSurah?: (surahNumber: number) => void;
  readonly handleRemoveSurahBookmark?: (surahNumber: number) => void;
  // Verse bookmarks
  readonly verseBookmarks?: ReadonlyArray<{ surahNumber: number; verseNumber: number }>;
  readonly handleOpenBookmarkVerse?: (surahNumber: number, verseNumber: number) => void;
  readonly handleRemoveVerseBookmark?: (surahNumber: number, verseNumber: number) => void;
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

export function BookmarksModal({
  showBookmarks,
  onClose,
  bookmarks,
  surahs,
  handleOpenBookmarkPage,
  handleRemoveBookmark,
  displayLanguage,
  surahBookmarks,
  handleOpenBookmarkSurah,
  handleRemoveSurahBookmark,
  verseBookmarks,
  handleOpenBookmarkVerse,
  handleRemoveVerseBookmark,
}: BookmarksModalProps) {
  const { t } = useTranslation();
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = React.useRef<HTMLElement | null>(null);
  const isContentRTL = isRtlLanguage(displayLanguage);

  React.useEffect(() => {
    if (!showBookmarks) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modalNode = modalRef.current;
    const focusableEls = modalNode
      ? Array.from(modalNode.querySelectorAll<HTMLElement>(focusableSelector))
      : [];

    if (focusableEls.length > 0) {
      focusableEls[0].focus();
    } else {
      modalNode?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const currentFocusableEls = modalNode
        ? Array.from(modalNode.querySelectorAll<HTMLElement>(focusableSelector))
        : [];

      if (currentFocusableEls.length === 0) {
        event.preventDefault();
        return;
      }

      const first = currentFocusableEls[0];
      const last = currentFocusableEls.at(-1)!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedElementRef.current?.focus?.();
    };
  }, [onClose, showBookmarks]);

  if (!showBookmarks) return null;

  const hasSurahBookmarks = surahBookmarks && surahBookmarks.length > 0;
  const hasPageBookmarks = bookmarks.length > 0;
  const hasVerseBookmarks = verseBookmarks && verseBookmarks.length > 0;
  const hasAny = hasSurahBookmarks || hasPageBookmarks || hasVerseBookmarks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default bg-black/50 backdrop-blur-sm"
        aria-label={t("quran.close")}
        onClick={onClose}
      />
      <dialog
        open
        ref={modalRef as unknown as React.RefObject<HTMLDialogElement>}
        aria-modal="true"
        aria-labelledby="bookmarksTitle"
        tabIndex={-1}
        lang={displayLanguage}
        dir={isContentRTL ? "rtl" : "ltr"}
        className={`relative m-auto rounded-2xl border w-full max-w-md p-6 z-10 backdrop-blur-sm overflow-hidden pp-quran-modal-card bg-transparent text-inherit ${isContentRTL ? 'direction-rtl' : 'direction-ltr'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none rounded-2xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 id="bookmarksTitle" className="text-lg font-bold pp-text-primary flex items-center gap-2">
              <Heart className="w-5 h-5 text-white fill-white" />
              <span>{t("quran.favorites", { lng: displayLanguage })}</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-all pp-text-primary"
              aria-label={t("quran.close")}
            >
              <span className="text-xl">×</span>
            </button>
          </div>

          {!hasAny ? (
            <div className="text-sm text-center py-6 pp-text-secondary">
              {t("quran.noFavorites")}
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {/* Surah Bookmarks */}
              {hasSurahBookmarks && surahBookmarks.map((sb) => {
                const surah = surahs.find((s) => s.number === sb.surahNumber);
                if (!surah) return null;
                const surahName = getLocalizedSurahName(surah, displayLanguage);

                return (
                  <div
                    key={`surah-${sb.surahNumber}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 border pp-quran-bookmark-row"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenBookmarkSurah?.(sb.surahNumber)}
                      className="flex-1 pp-text-primary"
                      style={{ textAlign: isContentRTL ? "right" : "left" }}
                    >
                      <div className="text-sm font-semibold">
                        {surahName}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSurahBookmark?.(sb.surahNumber)}
                      className="z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 border bg-white/20 border-white/40 shrink-0"
                      aria-label={t("quran.removeFavorite")}
                    >
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </button>
                  </div>
                );
              })}

              {/* Page Bookmarks */}
              {bookmarks.map((bookmark) => {
                const surah = surahs.find(
                  (s) =>
                    bookmark.pageNumber >= s.startPage &&
                    bookmark.pageNumber <= s.endPage,
                );
                const surahName = surah
                  ? getLocalizedSurahName(surah, displayLanguage)
                  : t("nav.quran");

                return (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 border pp-quran-bookmark-row"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenBookmarkPage(bookmark.pageNumber)}
                      className="flex-1 pp-text-primary"
                      style={{ textAlign: isContentRTL ? "right" : "left" }}
                    >
                      <div className="text-sm font-semibold">
                        {surahName} · {t("quran.page")} {bookmark.pageNumber}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveBookmark(bookmark.pageNumber)}
                      className="z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 border bg-white/20 border-white/40 shrink-0"
                      aria-label={t("quran.removeFavorite")}
                    >
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </button>
                  </div>
                );
              })}

              {/* Verse Bookmarks */}
              {hasVerseBookmarks && verseBookmarks.map((vb) => {
                const surah = surahs.find((s) => s.number === vb.surahNumber);
                const surahName = surah
                  ? getLocalizedSurahName(surah, displayLanguage)
                  : t("nav.quran");

                return (
                  <div
                    key={`verse-${vb.surahNumber}-${vb.verseNumber}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 border pp-quran-bookmark-row"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenBookmarkVerse?.(vb.surahNumber, vb.verseNumber)}
                      className="flex-1 pp-text-primary"
                      style={{ textAlign: isContentRTL ? "right" : "left" }}
                    >
                      <div className="text-sm font-semibold">
                        {surahName} · {t("quran.verse")} {vb.verseNumber}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVerseBookmark?.(vb.surahNumber, vb.verseNumber)}
                      className="z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 border bg-white/20 border-white/40 shrink-0"
                      aria-label={t("quran.removeFavorite")}
                    >
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
