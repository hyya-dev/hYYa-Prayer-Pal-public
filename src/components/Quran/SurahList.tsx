import React from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import type { Surah, QuranLanguageCode } from "@/types/quran";

interface SurahListProps {
  readonly surahs: Surah[];
  readonly currentLanguage: QuranLanguageCode;
  readonly selectedSurahNumber?: number | null;
  readonly onSelectSurah: (surahNumber: number) => void;
  readonly surahBookmarks?: Set<number>;
  readonly onSurahBookmarkToggle?: (surahNumber: number) => void;
}

export const SurahList = React.memo(function SurahList({
  surahs,
  currentLanguage,
  selectedSurahNumber,
  onSelectSurah,
  surahBookmarks,
  onSurahBookmarkToggle,
}: SurahListProps) {
  const { t } = useTranslation();
  const isRTL = isRtlLanguage(currentLanguage);
  const isArabicScript = currentLanguage === "ar";
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const didMountRef = React.useRef(false);
  const selectedIndex = surahs.findIndex((surah) => surah.number === selectedSurahNumber);
  const activeIndex = Math.max(selectedIndex, 0);

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (selectedIndex < 0) {
      return;
    }

    const selectedItem = itemRefs.current[selectedIndex];
    if (!selectedItem) {
      return;
    }

    selectedItem.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedIndex]);

  const handleArrowNavigation = (targetIndex: number) => {
    const boundedIndex = (targetIndex + surahs.length) % surahs.length;
    const nextSurah = surahs[boundedIndex];

    if (!nextSurah) {
      return;
    }

    onSelectSurah(nextSurah.number);
  };

  const getLocalizedName = (surah: Surah): string => {
    if (currentLanguage === "ar") return surah.nameArabic || surah.nameTransliterated;

    const translated = (surah.nameTranslated as Record<string, string>)[currentLanguage];
    if (translated && translated.trim().length > 0) {
      return translated;
    }

    return surah.nameTranslated.en || surah.nameTransliterated || surah.nameArabic;
  };

  return (
    <div className="max-w-2xl mx-auto w-full pt-4 pb-0">
      <div
        className="space-y-2"
        aria-label={t("quran.selectSurah", {
          lng: currentLanguage
        })}
      >
        {surahs.map((surah, index) => {
          const isSelected = selectedSurahNumber === surah.number;
          const optionClass = `w-full rounded-xl px-4 py-3 text-start font-semibold transition-all backdrop-blur-sm border relative overflow-hidden group cursor-pointer hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up pp-anim-fill-both ${onSurahBookmarkToggle ? "pe-14" : ""} ${isSelected ? "pp-surah-item-active" : "pp-surah-item"}`;
          const handleSelect = () => onSelectSurah(surah.number);
          const isBookmarked = surahBookmarks?.has(surah.number) ?? false;

          return (
            <div key={surah.number} className="relative">
              <button
                type="button"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                aria-pressed={isSelected}
                onClick={handleSelect}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    handleArrowNavigation(index + 1);
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    handleArrowNavigation(index - 1);
                  }
                }}
                className={optionClass}
                tabIndex={isSelected || index === activeIndex ? 0 : -1}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {/*
                  UX Logic Layer 2 — Content-Layer Directionality Exception.
                  Surah names are displayed in the selected Quran language (e.g. Arabic, English, Urdu),
                  not the UI language. Direction follows the content language, not the root document direction.
                */}
                <div
                  className="relative z-10 flex items-center justify-between"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-base pp-text-primary">
                      {surah.number}
                    </div>
                  </div>

                  <div className="flex-1 px-3 text-center">
                    <div
                      className={`font-bold transition-all pp-text-primary ${isArabicScript ? "text-xl pp-quran-arabic-optimized" : "text-base"}`}
                    >
                      {getLocalizedName(surah)}
                    </div>
                  </div>

                  <div className={`flex-shrink-0 text-sm opacity-60 ${isArabicScript ? "pp-quran-arabic-optimized" : ""}`}>
                    {surah.verseCount}{" "}
                    {t("quran.verses", {
                      lng: currentLanguage
                    })}
                  </div>
                </div>
              </button>

              {onSurahBookmarkToggle ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSurahBookmarkToggle(surah.number);
                  }}
                  className="absolute top-1/2 -translate-y-1/2 end-3 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white/90 shadow-none transition-opacity hover:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 opacity-90"
                  aria-label={isBookmarked ? t('quran.removeFavorite') : t('quran.addFavorite')}
                >
                  <Heart className={`w-4 h-4 ${isBookmarked ? 'text-white fill-white' : 'text-white/70'}`} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
});
