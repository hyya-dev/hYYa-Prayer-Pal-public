import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useIsIpad } from "@/hooks/useIsIpad";
import { TranslationSelector } from "@/components/Quran/TranslationSelector";
import { Header } from "@/components/Header";
import type { QuranLanguageCode } from "@/types/quran";
import type { Language } from "@/hooks/useAppSettings";
import { isRtlLanguage } from "@/lib/rtlLanguages";

import hisnMuslimIconPhone from "@/assets/Icon HisnMuslim.png";
import hisnMuslimIconTablet from "@/assets/ipad/Icon HisnMuslim.png";
import quranIconPhone from "@/assets/Icon Quran.png";
import quranIconTablet from "@/assets/ipad/Icon Quran.png";
import quranAudioIconPhone from "@/assets/Icon Quran Audio.png";
import quranAudioIconTablet from "@/assets/ipad/Icon Quran Audio.png";
import tafsirIconPhone from "@/assets/Icon Tafsir.png";
import tafsirIconTablet from "@/assets/ipad/Icon Tafsir.png";
import manasikUmrahIconPhone from "@/assets/Icon Manasik Umrah.png";
import manasikUmrahIconTablet from "@/assets/ipad/Icon Manasik Umrah.png";
import manasikHajjIconPhone from "@/assets/Icon Manasik Hajj.png";
import manasikHajjIconTablet from "@/assets/ipad/Icon Manasik Hajj.png";

interface LibraryHomeButtonProps {
  readonly onClick: () => void;
  readonly className: string;
  readonly title: string;
  readonly iconSrc: string;
  readonly languageCountLabel: string;
  /** Curated (Translation) script RTL/LTR: RTL → icon on the right, language count on the left; LTR → icon left, count right. */
  readonly layoutUiRtl: boolean;
  /** Curated language for section titles and count line (text direction follows script). */
  readonly labelLanguage: Language;
}

function LibraryHomeButton({
  onClick,
  className,
  title,
  iconSrc,
  languageCountLabel,
  layoutUiRtl,
  labelLanguage,
}: LibraryHomeButtonProps) {
  const isCuratedTextRtl = isRtlLanguage(labelLanguage);
  return (
    <button
      onClick={onClick}
      className={`${className} w-full min-h-[56px] rounded-2xl p-3 relative overflow-hidden backdrop-blur-sm border hover:scale-[1.01] active:scale-[0.99] transition-all duration-300`}
      style={{ background: 'var(--pp-button-bg)', borderColor: 'var(--pp-border-soft)', color: 'var(--pp-text-primary)' }}
      aria-label={title}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-2xl" />
      <div
        className={`relative z-10 flex w-full items-center justify-between gap-4 ${layoutUiRtl ? "flex-row-reverse" : "flex-row"}`}
      >
        <img
          src={iconSrc}
          alt={title}
          className="w-10 h-10 object-contain rounded-full flex-shrink-0"
        />
        <span
          dir={isCuratedTextRtl ? "rtl" : "ltr"}
          lang={labelLanguage}
          className={`text-base font-semibold pp-text-primary flex-1 text-center ${isCuratedTextRtl ? "text-xl" : ""}`}
        >
          {title}
        </span>
        <span
          dir={isCuratedTextRtl ? "rtl" : "ltr"}
          lang={labelLanguage}
          className="text-xs pp-text-secondary whitespace-nowrap flex-shrink-0 text-end"
          style={{ minWidth: "4rem" }}
        >
          {languageCountLabel}
        </span>
      </div>
    </button>
  );
}

export interface LibraryHomeProps {
  readonly title: string;
  readonly isUiRTL: boolean;
  readonly uiLanguage: Language;
  readonly curatedLanguage: QuranLanguageCode;
  readonly onLanguageChange: (lang: string) => void;
  readonly sectionAvailability: Record<string, boolean>;
  readonly hisnSectionAvailable: boolean;
  readonly onOpenQuran: () => void;
  readonly onOpenQuranAudio: () => void;
  readonly onOpenHisn: () => void;
  readonly onOpenTafsir: () => void;
  readonly onOpenManasikUmrah: () => void;
  readonly onOpenManasikHajj: () => void;
  readonly libraryRenderKey: string;
}

export function LibraryHome({
  title,
  isUiRTL,
  uiLanguage,
  curatedLanguage,
  onLanguageChange,
  sectionAvailability,
  hisnSectionAvailable,
  onOpenQuran,
  onOpenQuranAudio,
  onOpenHisn,
  onOpenTafsir,
  onOpenManasikUmrah,
  onOpenManasikHajj,
  libraryRenderKey
}: LibraryHomeProps) {
  const { t } = useTranslation();
  const isIpad = useIsIpad();

  const hisnMuslimIcon = isIpad ? hisnMuslimIconTablet : hisnMuslimIconPhone;
  const quranIcon = isIpad ? quranIconTablet : quranIconPhone;
  const quranAudioIcon = isIpad ? quranAudioIconTablet : quranAudioIconPhone;
  const tafsirIcon = isIpad ? tafsirIconTablet : tafsirIconPhone;
  const manasikUmrahIcon = isIpad ? manasikUmrahIconTablet : manasikUmrahIconPhone;
  const manasikHajjIcon = isIpad ? manasikHajjIconTablet : manasikHajjIconPhone;

  // Section button titles follow Curated Translations; Curated pill uses UI language (see TranslationSelector).
  const contentLng = curatedLanguage;
  const isCuratedLayoutRtl = isRtlLanguage(contentLng);
  const contentManasikUmrahTitle = t("library.manasikUmrahTitle", { lng: contentLng });
  const contentManasikHajjTitle = t("library.manasikHajjTitle", { lng: contentLng });
  const contentQuranAudioTitle = t("library.audioLibraryTitle", { lng: contentLng });
  const contentQuranTitle = t("library.quranTitle", { lng: contentLng });
  const contentHisnMuslimTitle = t("library.hisnMuslimTitle", { lng: contentLng });
  const contentTafsirTitle = t("library.tafsir.title", { lng: contentLng });

  const getLanguageCountLabel = useCallback(
    (count: number) => {
      return t("library.languageCount", {
        count,
        lng: contentLng,
      });
    },
    [contentLng, t],
  );

  return (
    <div className="page-library flex-1 flex flex-col h-full overflow-hidden">
      {/*
        Library main page title: parent passes string in Settings UI language; alignment matches UI RTL/LTR.
      */}
      <Header
        title={title}
        titleAlign={isUiRTL ? "right" : "left"}
      />

      {/*
        UX Logic Layer 1: TranslationSelector is UI chrome (language picker).
        It is centered as a standalone control, which is acceptable for a full-width selector.
      */}
      <div className="flex justify-center px-4 pb-[2cm] pt-2" key={`library-home-${libraryRenderKey}`}>
        <TranslationSelector
          currentLanguage={curatedLanguage}
          onLanguageChange={onLanguageChange}
          compact
          pillLabelLanguage={uiLanguage}
        />
      </div>

      <div
        dir={isRtlLanguage(curatedLanguage) ? "rtl" : "ltr"}
        lang={curatedLanguage}
        className="page-scroll-content flex-1 overflow-y-auto px-4 pb-32 flex items-center justify-center pp-library-scroll-content"
      >
        <div className="w-full max-w-2xl space-y-3 pp-view-enter">
          {/* Quran Button */}
          <LibraryHomeButton
            onClick={onOpenQuran}
            className="pp-library-quran-btn"
            title={contentQuranTitle}
            iconSrc={quranIcon}
            languageCountLabel={getLanguageCountLabel(60)}
            layoutUiRtl={isCuratedLayoutRtl}
            labelLanguage={contentLng}
          />

          {sectionAvailability["quran-audio"] && (
            <LibraryHomeButton
              onClick={onOpenQuranAudio}
              className="pp-library-quran-audio-btn"
              title={contentQuranAudioTitle}
              iconSrc={quranAudioIcon}
                languageCountLabel={getLanguageCountLabel(2)}
              layoutUiRtl={isCuratedLayoutRtl}
              labelLanguage={contentLng}
            />
          )}

          {/* Hisn Muslim Button */}
          {hisnSectionAvailable && (
            <LibraryHomeButton
              onClick={onOpenHisn}
              className="pp-library-hisn-btn"
              title={contentHisnMuslimTitle}
              iconSrc={hisnMuslimIcon}
              languageCountLabel={getLanguageCountLabel(2)}
              layoutUiRtl={isCuratedLayoutRtl}
              labelLanguage={contentLng}
            />
          )}

          {/* Tafsir Button */}
          {sectionAvailability.tafsir && (
            <LibraryHomeButton
              onClick={onOpenTafsir}
              className="pp-library-tafsir-btn"
              title={contentTafsirTitle}
              iconSrc={tafsirIcon}
              languageCountLabel={getLanguageCountLabel(5)}
              layoutUiRtl={isCuratedLayoutRtl}
              labelLanguage={contentLng}
            />
          )}

          {sectionAvailability["manasik-umrah"] && (
            <LibraryHomeButton
              onClick={onOpenManasikUmrah}
              className="pp-library-manasik-umrah-btn"
              title={contentManasikUmrahTitle}
              iconSrc={manasikUmrahIcon}
              languageCountLabel={getLanguageCountLabel(60)}
              layoutUiRtl={isCuratedLayoutRtl}
              labelLanguage={contentLng}
            />
          )}

          {sectionAvailability["manasik-hajj"] && (
            <LibraryHomeButton
              onClick={onOpenManasikHajj}
              className="pp-library-manasik-hajj-btn"
              title={contentManasikHajjTitle}
              iconSrc={manasikHajjIcon}
              languageCountLabel={getLanguageCountLabel(60)}
              layoutUiRtl={isCuratedLayoutRtl}
              labelLanguage={contentLng}
            />
          )}
        </div>
      </div>
    </div>
  );
}
