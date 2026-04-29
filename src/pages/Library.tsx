import React, { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Screen } from "@/components/BottomNav";
import { useAppSettings } from "@/hooks/useAppSettings";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { allowedLanguages, HISN_SEARCH_PLACEHOLDER } from "@/hooks/library/useLibrarySettings";

import { LibraryHome } from "@/components/Library/LibraryHome";
import { HisnMuslimSubpage } from "@/components/Library/HisnMuslimSubpage";
import Quran from "@/pages/Quran";
import { TafsirSubpage } from "@/components/Library/TafsirSubpage";
import { QuranAudioLibrarySubpage } from "@/components/Library/QuranAudioLibrarySubpage";
import { ManasikSubpage } from "@/components/Library/ManasikSubpage";
import {
  getLibrarySectionAvailability,
  type LibrarySectionKey,
} from "@/lib/libraryContentAvailability";
import type { QuranLanguageCode } from "@/types/quran";
import type { HisnLanguage } from "@/types/hisn";
const supportedHisnLanguages = new Set(allowedLanguages);

interface LibraryProps {
  readonly onNavigate?: (screen: Screen) => void;
  readonly sessionKey?: number;
  readonly onNavBackTap?: () => void;
}

export default function Library({ onNavigate, sessionKey, onNavBackTap }: LibraryProps) {
  const { t } = useTranslation();
  const [librarySection, setLibrarySection] = useState<"home" | LibrarySectionKey>("home");

  const { settings: appSettingsLocal, updateQuranLanguage } = useAppSettings();

  const uiLanguage = appSettingsLocal.language;
  const isUiRTL = isRtlLanguage(uiLanguage);

  const curatedLanguage = (appSettingsLocal.defaultQuranLanguage ?? appSettingsLocal.language) as QuranLanguageCode;
  const isCuratedRTL = isRtlLanguage(curatedLanguage);
  // Hisn Muslim is religious content and is not machine-translated.
  // When Curated Translations is not English, we display Arabic (source of truth).
  const curatedHisnLanguage = curatedLanguage === "en" ? "en" : "ar";
  const libraryRenderKey = `${uiLanguage}:${curatedLanguage}:${librarySection}`;

  const derivedHisnLanguage = curatedHisnLanguage
    ?? appSettingsLocal.defaultHisnLanguage
    ?? (supportedHisnLanguages.has(uiLanguage as (typeof allowedLanguages)[number])
      ? (uiLanguage as (typeof allowedLanguages)[number])
      : "en");

  const hisnMuslimTitle = t("library.hisnMuslimTitle", { lng: derivedHisnLanguage });

  const sectionAvailability = useMemo(
    () => getLibrarySectionAvailability(curatedLanguage),
    [curatedLanguage],
  );
  const hisnSectionAvailable = useMemo(
    () => getLibrarySectionAvailability(curatedLanguage).hisn,
    [curatedLanguage],
  );

  const openHisnSubpage = useCallback(() => {
    setLibrarySection("hisn");
  }, []);

  const openQuranSubpage = useCallback(() => {
    setLibrarySection("quran");
  }, []);

  const openQuranAudioSubpage = useCallback(() => {
    setLibrarySection("quran-audio");
  }, []);

  const openTafsirSubpage = useCallback(() => {
    setLibrarySection("tafsir");
  }, []);

  const openManasikUmrahSubpage = useCallback(() => {
    setLibrarySection("manasik-umrah");
  }, []);

  const openManasikHajjSubpage = useCallback(() => {
    setLibrarySection("manasik-hajj");
  }, []);

  const handleBackToLibraryHome = useCallback(() => {
    setLibrarySection("home");
  }, []);

  if (librarySection === "home") {
    return (
      <LibraryHome
        title={t("library.title", { lng: uiLanguage })}
        isUiRTL={isUiRTL}
        uiLanguage={uiLanguage}
        curatedLanguage={curatedLanguage}
        onLanguageChange={(lang: string) => updateQuranLanguage(lang as QuranLanguageCode)}
        sectionAvailability={sectionAvailability}
        hisnSectionAvailable={hisnSectionAvailable}
        onOpenQuran={openQuranSubpage}
        onOpenQuranAudio={openQuranAudioSubpage}
        onOpenHisn={openHisnSubpage}
        onOpenTafsir={openTafsirSubpage}
        onOpenManasikUmrah={openManasikUmrahSubpage}
        onOpenManasikHajj={openManasikHajjSubpage}
        libraryRenderKey={libraryRenderKey}
      />
    );
  }

  if (librarySection === "quran") {
    return (
      <Quran
        sessionKey={sessionKey}
        onBackToParent={handleBackToLibraryHome}
        navigationLanguage={curatedLanguage}
        onNavigateToQuranAudio={openQuranAudioSubpage}
      />
    );
  }

  if (librarySection === "tafsir") {
    return (
      <TafsirSubpage
        sessionKey={sessionKey}
        onBackToLibraryHome={handleBackToLibraryHome}
        uiLanguage={uiLanguage}
        uiIsRtl={isCuratedRTL}
        libraryLanguage={curatedLanguage}
      />
    );
  }

  if (librarySection === "quran-audio") {
    return (
      <QuranAudioLibrarySubpage
        sessionKey={sessionKey}
        onBackToLibraryHome={handleBackToLibraryHome}
        uiLanguage={uiLanguage}
        uiIsRtl={isCuratedRTL}
        libraryLanguage={curatedLanguage}
      />
    );
  }

  if (librarySection === "manasik-umrah") {
    return (
      <ManasikSubpage
        sessionKey={sessionKey}
        onBackToLibraryHome={handleBackToLibraryHome}
        uiLanguage={uiLanguage}
        uiIsRtl={isCuratedRTL}
        language={curatedLanguage}
        type="umrah"
      />
    );
  }

  if (librarySection === "manasik-hajj") {
    return (
      <ManasikSubpage
        sessionKey={sessionKey}
        onBackToLibraryHome={handleBackToLibraryHome}
        uiLanguage={uiLanguage}
        uiIsRtl={isCuratedRTL}
        language={curatedLanguage}
        type="hajj"
      />
    );
  }

  // Default fallback (hisn)
  return (
    <HisnMuslimSubpage
      uiLanguage={uiLanguage}
      isUiRTL={isRtlLanguage(derivedHisnLanguage)}
      derivedHisnLanguage={derivedHisnLanguage as HisnLanguage}
      uiHisnMuslimTitle={hisnMuslimTitle}
      placeholderSearchChapters={HISN_SEARCH_PLACEHOLDER[derivedHisnLanguage as keyof typeof HISN_SEARCH_PLACEHOLDER] ?? HISN_SEARCH_PLACEHOLDER.en}
      sessionKey={sessionKey}
      onBackToHome={handleBackToLibraryHome}
      libraryRenderKey={libraryRenderKey}
    />
  );
}
