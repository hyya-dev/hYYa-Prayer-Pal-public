import React from "react";
import { useTranslation } from "react-i18next";
import { SurahList } from "./SurahList";
import type { Surah, Language, QuranLanguageCode } from "@/types/quran";

/**
 * QuranListView — Surah/Juz tab selector + list.
 *
 * Layout (per UX Logic Rules):
 * [Surah | Juz] tabs  ← first row
 * [Search Surahs bar] ← second row (surah mode only, inline filter)
 * Surah/Juz list
 *
 * The Bookmarks button has been moved to the LibrarySubpageShell controlsRow
 * (sharing the row with the back button), per UX Logic Rules.
 */
export interface QuranListViewProps {
  readonly listMode: "surah" | "juz";
  readonly surahSearchQuery: string;
  readonly displayLanguage: QuranLanguageCode;
  readonly surahs: Surah[];
  readonly surahSearchResults: Surah[] | null;
  readonly surahSearching: boolean;
  readonly selectedSurahNumber?: number | null;
  readonly selectedJuzNumber?: number | null;
  readonly handleSelectSurah: (id: number) => void;
  readonly handleSelectJuz: (id: number) => void;
  readonly appLanguage: Language;
  readonly surahBookmarks?: Set<number>;
  readonly onSurahBookmarkToggle?: (surahNumber: number) => void;
}

export function QuranListView({
  listMode,
  surahSearchQuery,
  displayLanguage,
  surahs,
  surahSearchResults,
  surahSearching,
  selectedSurahNumber,
  selectedJuzNumber,
  handleSelectSurah,
  handleSelectJuz,
  appLanguage,
  surahBookmarks,
  onSurahBookmarkToggle,
}: QuranListViewProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      {listMode === "surah" ? (
        <>
          <SurahList
            surahs={surahSearchResults ?? surahs}
            currentLanguage={displayLanguage}
            selectedSurahNumber={selectedSurahNumber}
            onSelectSurah={handleSelectSurah}
            surahBookmarks={surahBookmarks}
            onSurahBookmarkToggle={onSurahBookmarkToggle}
          />
          {surahSearching && (
            <div className="text-center text-sm py-2 pp-text-secondary">
              {t("quran.searching", { lng: displayLanguage})}
            </div>
          )}
          {!!surahSearchQuery.trim() &&
            surahSearchResults?.length === 0 &&
            !surahSearching && (
              <div className="text-center text-sm py-2 pp-text-secondary">
                {t("quran.noSearchResults", {
                  lng: displayLanguage
                })}
              </div>
            )}
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 30 }).map((_, idx) => {
            const n = idx + 1;
            const isSelected = selectedJuzNumber === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleSelectJuz(n)}
                className={[
                  "pp-juz-button rounded-xl px-3 py-3 text-sm font-semibold transition-all backdrop-blur-sm border relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up",
                  isSelected ? "pp-juz-button-active" : "pp-juz-button-inactive",
                  "pp-anim-fill-both",
                ].join(" ")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                <div className="relative z-10 text-center">
                  {`${t("quran.juz", { lng: displayLanguage})} ${n}`}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
