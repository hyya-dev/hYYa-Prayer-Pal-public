import React from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { SearchBar } from "./SearchBar";
import type { QuranLanguageCode } from "@/types/quran";

export interface QuranListHeaderProps {
  readonly listMode: "surah" | "juz";
  readonly setListMode: (mode: "surah" | "juz") => void;
  readonly surahSearchQuery: string;
  readonly handleSurahSearch: (query: string) => void;
  readonly displayLanguage: QuranLanguageCode;
  readonly onOpenBookmarks: () => void;
  readonly hasBookmarks?: boolean;
}

export function QuranListHeader({
  listMode,
  setListMode,
  surahSearchQuery,
  handleSurahSearch,
  displayLanguage,
  onOpenBookmarks,
  hasBookmarks,
}: QuranListHeaderProps) {
  const { t } = useTranslation();
  const isContentRTL = isRtlLanguage(displayLanguage);

  return (
    <div className="w-full md:max-w-2xl md:mx-auto" dir={isContentRTL ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-in-up pp-anim-fill-both">
        <button
          type="button"
          onClick={() => setListMode("surah")}
          className={[
            "rounded-xl px-3 py-3 text-sm font-semibold border-2 relative overflow-hidden backdrop-blur-sm transition-all pp-glass-surface-button",
          ].join(" ")}
          style={{
            background: listMode === "surah" ? "var(--pp-button-bg)" : "var(--pp-button-bg-soft)",
            borderColor: listMode === "surah" ? "var(--pp-border-strong)" : "var(--pp-border-soft)",
            color: listMode === "surah" ? "var(--pp-text-primary)" : "var(--pp-text-secondary)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
          <span className="relative z-10">
            {t("quran.surahs", {
              lng: displayLanguage,
            })}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setListMode("juz")}
          className={[
            "rounded-xl px-3 py-3 text-sm font-semibold border-2 relative overflow-hidden backdrop-blur-sm transition-all pp-glass-surface-button",
          ].join(" ")}
          style={{
            background: listMode === "juz" ? "var(--pp-button-bg)" : "var(--pp-button-bg-soft)",
            borderColor: listMode === "juz" ? "var(--pp-border-strong)" : "var(--pp-border-soft)",
            color: listMode === "juz" ? "var(--pp-text-primary)" : "var(--pp-text-secondary)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
          <span className="relative z-10">
            {t("quran.juz", { lng: displayLanguage })}
          </span>
        </button>
      </div>

      <div className="flex items-stretch gap-3 mb-3 animate-fade-in-up pp-anim-fill-both">
        {listMode === "surah" ? (
          <div className="flex-1 min-w-0">
            <SearchBar
              className="relative mb-0 w-full h-full"
              onSearch={handleSurahSearch}
              currentLanguage={displayLanguage}
              placeholder={t("quran.searchSurahPlaceholder", {
                lng: displayLanguage,
              })}
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0" /> /* Keep spacing consistent when listMode != surah */
        )}
        <button
          type="button"
          onClick={onOpenBookmarks}
          className="w-12 h-12 rounded-xl border-2 relative overflow-hidden backdrop-blur-sm transition-all pp-glass-surface-button flex items-center justify-center shrink-0"
          aria-label={t("quran.favorites", { lng: displayLanguage })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
          <Heart className={`w-5 h-5 relative z-10 ${hasBookmarks ? "fill-current" : ""}`} />
        </button>
      </div>
    </div>
  );
}
