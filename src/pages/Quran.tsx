import React, { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { type TFunction } from "i18next";
import { Loader2, BookOpenText, List, Pause, Play, ArrowUpToLine } from "lucide-react";

import { Header } from "@/components/Header";
import { LibrarySubpageShell } from "@/components/Library/LibrarySubpageShell";
import { useAppSettings } from "@/hooks/useAppSettings";
import { isRtlLanguage } from "@/lib/rtlLanguages";

// Hooks
import { useQuranSettings } from "@/hooks/quran/useQuranSettings";
import { useQuranData } from "@/hooks/quran/useQuranData";
import { useQuranReadingState } from "@/hooks/quran/useQuranReadingState";
import { useQuranSearch } from "@/hooks/quran/useQuranSearch";
import { useQuranBookmarks } from "@/hooks/quran/useQuranBookmarks";
import { useQuranAudio } from "@/hooks/quran/useQuranAudio";
import { useQuranTafsir } from "@/hooks/quran/useQuranTafsir";

// Components
import { QuranListView } from "@/components/Quran/QuranListView";
import { QuranListHeader } from "@/components/Quran/QuranListHeader";
import { QuranReaderView } from "@/components/Quran/QuranReaderView";
import { QuranSearchView } from "@/components/Quran/QuranSearchView";
import { SearchBar } from "@/components/Quran/SearchBar";
import { VerseActionModal } from "@/components/Quran/VerseActionModal";
import { BookmarksModal } from "@/components/Quran/BookmarksModal";

// Helpers
import { logQuranReaderAudio } from "@/lib/quranReaderTelemetry";
import type { QuranLanguageCode, Language } from "@/types/quran";
import type { Bookmark } from "@/services/quranBookmarkService";
import { getAllSurahBookmarks, toggleSurahBookmark } from "@/services/quranSurahBookmarkService";

export interface QuranProps {
  readonly sessionKey?: number;
  readonly onBackToParent?: () => void;
  readonly titleOverride?: string;
  readonly navigationLanguage?: QuranLanguageCode;
  /** When set, reader audio prompts can jump to Library → Quran Audio. */
  readonly onNavigateToQuranAudio?: () => void;
}

type QuranListViewProps = ComponentProps<typeof QuranListView>;
type QuranReaderViewProps = ComponentProps<typeof QuranReaderView>;
type QuranSearchViewProps = ComponentProps<typeof QuranSearchView>;
type QuranViewMode = "surah-list" | "reader" | "search";

function QuranReaderControls({
  isRtlNavigation,
  readingMode,
  setReadingMode,
  verses,
  currentPage,
  setCurrentPage,
  currentVerseIndex,
  setCurrentVerseIndex,
  surahSubtitle,
  toggleFontSize,
  displayLanguage,
  handleSearch,
  setViewMode,
  t,
  effectiveNavLanguage,
  onJumpToReadingAnchor,
}: Readonly<{
  isRtlNavigation: boolean;
  readingMode: "verse" | "page";
  setReadingMode: React.Dispatch<React.SetStateAction<"verse" | "page">>;
  verses: QuranReaderViewProps["verses"];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  currentVerseIndex: number;
  setCurrentVerseIndex: React.Dispatch<React.SetStateAction<number>>;
  surahSubtitle: string | null;
  toggleFontSize: () => void;
  displayLanguage: QuranLanguageCode;
  handleSearch: QuranSearchViewProps["handleSearch"];
  setViewMode: React.Dispatch<React.SetStateAction<QuranViewMode>>;
  t: TFunction;
  effectiveNavLanguage: QuranLanguageCode;
  onJumpToReadingAnchor: () => void;
}>) {
  const viewToggle = (
    <button
      onClick={() => {
        if (readingMode === "verse") {
          const page = verses[currentVerseIndex]?.pageNumber;
          if (typeof page === "number") {
            setCurrentPage(page);
          }
          setReadingMode("page");
          return;
        }

        const idx = verses.findIndex((v) => v.pageNumber === currentPage);
        setCurrentVerseIndex(Math.max(0, idx));
        setReadingMode("verse");
      }}
      className="p-2 shrink-0 rounded-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden backdrop-blur-sm border flex items-center justify-center gap-1.5 pp-glass-surface-button"
      aria-label={
        readingMode === "verse"
          ? t("quran.pageView", { lng: effectiveNavLanguage })
          : t("quran.verseByVerse", { lng: effectiveNavLanguage })
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
      <div className="relative z-10 flex items-center justify-center gap-1.5">
        {readingMode === "verse" ? (
          <>
            <BookOpenText className="w-5 h-5" />
            <span className="text-xs font-medium hidden sm:inline">
              {t("quran.pageView", { lng: effectiveNavLanguage })}
            </span>
          </>
        ) : (
          <>
            <List className="w-5 h-5" />
            <span className="text-xs font-medium hidden sm:inline">
              {t("quran.verseView", { lng: effectiveNavLanguage })}
            </span>
          </>
        )}
      </div>
    </button>
  );

  const titleChip = surahSubtitle ? (
    <div className="w-full rounded-lg px-2 py-2 text-center border relative overflow-hidden pp-quran-header-chip shadow-sm min-w-0">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
      <p className="relative z-10 text-lg font-bold text-center leading-none truncate">
        {surahSubtitle}
      </p>
    </div>
  ) : null;

  const searchBar = (
    <SearchBar
      className="relative mb-0 w-full h-12 flex-1 min-w-0"
      onSearch={(q) => {
        handleSearch(q);
        setViewMode(q.trim().length > 0 ? "search" : "reader");
      }}
      currentLanguage={displayLanguage}
      placeholder={t("quran.searchPlaceholder", { lng: displayLanguage })}
    />
  );

  const ttButton = (
    <button
      onClick={toggleFontSize}
      className="p-2 shrink-0 rounded-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden backdrop-blur-sm border pp-glass-surface-button flex items-center justify-center"
      aria-label={t("quran.textSize", { lng: effectiveNavLanguage })}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
      <div
        className={[
          "relative z-10 flex items-end justify-center gap-0.5 px-0.5",
          isRtlNavigation ? "flex-row-reverse" : "flex-row",
        ].join(" ")}
      >
        <span className="text-xs font-bold leading-none mb-0.5">T</span>
        <span className="text-lg font-bold leading-none">T</span>
      </div>
    </button>
  );

  const jumpToAnchorLabel =
    readingMode === "page"
      ? t("quran.jumpToSurahStart", { lng: effectiveNavLanguage })
      : t("common.backToTop", { lng: effectiveNavLanguage });

  const jumpToAnchorButton = (
    <button
      type="button"
      onClick={onJumpToReadingAnchor}
      className="p-2 shrink-0 rounded-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden backdrop-blur-sm border pp-glass-surface-button flex items-center justify-center"
      aria-label={jumpToAnchorLabel}
      title={jumpToAnchorLabel}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
      <ArrowUpToLine className="relative z-10 w-5 h-5" />
    </button>
  );

  return (
    <div className="w-full md:max-w-2xl md:mx-auto space-y-2">
      {titleChip}

      <div className="flex items-stretch gap-2 w-full">
        {isRtlNavigation ? (
          <>
            {viewToggle}
            {jumpToAnchorButton}
            {ttButton}
            {searchBar}
          </>
        ) : (
          <>
            {searchBar}
            {ttButton}
            {jumpToAnchorButton}
            {viewToggle}
          </>
        )}
      </div>
    </div>
  );
}

function QuranMainContent({
  loadingVerses,
  viewMode,
  selectedSurah,
  listMode,
  surahSearchQuery,
  displayLanguage,
  surahs,
  surahSearchResults,
  surahSearching,
  selectedListEntry,
  handleSelectSurahFromList,
  handleSelectJuzFromList,
  appLanguage,
  surahBookmarksSet,
  onSurahBookmarkToggle,
  readingMode,
  verses,
  currentVerseIndex,
  currentPage,
  arabicFontSize,
  translationFontSize,
  showArabic,
  handlePageSwipeStart,
  handlePageSwipeEnd,
  handlePrevious,
  handleNext,
  handleBackToList,
  canGoPrevious,
  canGoNext,
  isRtlNavigation,
  mainContentRef,
  activeVerseNumber,
  onVersePress,
  verseBookmarks,
  onVerseBookmarkToggle,
  onPageBookmarkToggle,
  currentPageBookmarked,
  handleSearch,
  resetSearch,
  setViewMode,
  searchResults,
  searchQuery,
  searching,
  handleSelectSearchResult,
  handleSurahSearch,
  setListMode,
  setShowBookmarks,
  bookmarks,
}: Readonly<{
  loadingVerses: boolean;
  viewMode: QuranViewMode;
  selectedSurah: QuranReaderViewProps["selectedSurah"] | null;
  listMode: QuranListViewProps["listMode"];
  surahSearchQuery: QuranListViewProps["surahSearchQuery"];
  displayLanguage: QuranListViewProps["displayLanguage"];
  surahs: QuranListViewProps["surahs"];
  surahSearchResults: QuranListViewProps["surahSearchResults"];
  surahSearching: QuranListViewProps["surahSearching"];
  selectedListEntry: { mode: "surah" | "juz"; value: number } | null;
  handleSelectSurahFromList: (surahNumber: number) => Promise<void>;
  handleSelectJuzFromList: (juzNumber: number) => Promise<void>;
  appLanguage: Language;
  surahBookmarksSet: Set<number>;
  onSurahBookmarkToggle: (surahNumber: number) => void;
  readingMode: QuranReaderViewProps["readingMode"];
  verses: QuranReaderViewProps["verses"];
  currentVerseIndex: QuranReaderViewProps["currentVerseIndex"];
  currentPage: QuranReaderViewProps["currentPage"];
  arabicFontSize: QuranReaderViewProps["arabicFontSize"];
  translationFontSize: QuranReaderViewProps["translationFontSize"];
  showArabic: QuranReaderViewProps["showArabic"];
  handlePageSwipeStart: (e: React.TouchEvent) => void;
  handlePageSwipeEnd: (e: React.TouchEvent) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  handleBackToList: () => void;
  canGoPrevious: QuranReaderViewProps["canGoPrevious"];
  canGoNext: QuranReaderViewProps["canGoNext"];
  isRtlNavigation: QuranReaderViewProps["isRtlNavigation"];
  mainContentRef: React.RefObject<HTMLDivElement>;
  activeVerseNumber: QuranReaderViewProps["activeVerseNumber"];
  onVersePress: QuranReaderViewProps["onVersePress"];
  verseBookmarks: QuranReaderViewProps["verseBookmarks"];
  onVerseBookmarkToggle: QuranReaderViewProps["onVerseBookmarkToggle"];
  onPageBookmarkToggle: () => void;
  currentPageBookmarked: QuranReaderViewProps["currentPageBookmarked"];
  handleSearch: QuranSearchViewProps["handleSearch"];
  resetSearch: () => void;
  setViewMode: React.Dispatch<React.SetStateAction<QuranViewMode>>;
  searchResults: QuranSearchViewProps["searchResults"];
  searchQuery: QuranSearchViewProps["searchQuery"];
  searching: QuranSearchViewProps["searching"];
  handleSelectSearchResult: QuranSearchViewProps["handleSelectSearchResult"];
  handleSurahSearch: (q: string) => void;
  setListMode: React.Dispatch<React.SetStateAction<QuranListViewProps["listMode"]>>;
  setShowBookmarks: React.Dispatch<React.SetStateAction<boolean>>;
  bookmarks: Bookmark[];
}>) {
  if (loadingVerses && viewMode !== "search") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 pp-text-primary" />
          <p className="pp-text-primary">Loading verses</p>
        </div>
      </div>
    );
  }

  if (viewMode === "search" && selectedSurah) {
    return (
      <QuranSearchView
        handleSearch={handleSearch}
        displayLanguage={displayLanguage}
        onCancel={() => {
          setViewMode("reader");
          resetSearch();
        }}
        searchResults={searchResults}
        searchQuery={searchQuery}
        searching={searching}
        handleSelectSearchResult={handleSelectSearchResult}
      />
    );
  }

  if (viewMode === "surah-list") {
    return (
      <div className="pp-view-enter">
        <QuranListHeader
          listMode={listMode}
          setListMode={setListMode}
          surahSearchQuery={surahSearchQuery}
          handleSurahSearch={handleSurahSearch}
          displayLanguage={displayLanguage}
          onOpenBookmarks={() => setShowBookmarks(true)}
          hasBookmarks={bookmarks.length > 0}
        />
        <QuranListView
          listMode={listMode}
          surahSearchQuery={surahSearchQuery}
          displayLanguage={displayLanguage}
          surahs={surahs}
          surahSearchResults={surahSearchResults}
          surahSearching={surahSearching}
          selectedSurahNumber={selectedListEntry?.mode === "surah" ? selectedListEntry.value : null}
          selectedJuzNumber={selectedListEntry?.mode === "juz" ? selectedListEntry.value : null}
          handleSelectSurah={handleSelectSurahFromList}
          handleSelectJuz={handleSelectJuzFromList}
          appLanguage={appLanguage}
          surahBookmarks={surahBookmarksSet}
          onSurahBookmarkToggle={onSurahBookmarkToggle}
        />
      </div>
    );
  }

  if (viewMode === "reader" && selectedSurah) {
    return (
      <QuranReaderView
        readingMode={readingMode}
        selectedSurah={selectedSurah}
        verses={verses}
        displayLanguage={displayLanguage}
        currentVerseIndex={currentVerseIndex}
        currentPage={currentPage}
        arabicFontSize={arabicFontSize}
        translationFontSize={translationFontSize}
        showArabic={showArabic}
        handlePageSwipeStart={handlePageSwipeStart}
        handlePageSwipeEnd={handlePageSwipeEnd}
        handlePrevious={handlePrevious}
        handleNext={handleNext}
        handleBackToList={handleBackToList}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        isRtlNavigation={isRtlNavigation}
        mainContentRef={mainContentRef}
        activeVerseNumber={activeVerseNumber}
        onVersePress={onVersePress}
        verseBookmarks={verseBookmarks}
        onVerseBookmarkToggle={onVerseBookmarkToggle}
        onPageBookmarkToggle={onPageBookmarkToggle}
        currentPageBookmarked={currentPageBookmarked}
      />
    );
  }

  return null;
}

function getLocalizedSurahName(
  surah: { nameArabic: string; nameTranslated: Record<string, string>; nameTransliterated: string },
  language: string,
): string {
  if (language === "ar") {
    return surah.nameArabic || surah.nameTransliterated;
  }

  const translated = surah.nameTranslated[language];
  if (translated && translated.trim().length > 0) {
    return translated;
  }

  return surah.nameTranslated.en || surah.nameTransliterated || surah.nameArabic;
}

export default function Quran({
  sessionKey,
  onBackToParent,
  titleOverride,
  navigationLanguage,
  onNavigateToQuranAudio,
}: QuranProps) {
  const { t } = useTranslation();
  const { settings: appSettings } = useAppSettings();
  
  const [selectedListEntry, setSelectedListEntry] = useState<{ mode: "surah" | "juz"; value: number } | null>(null);
  const [selectedVerseAction, setSelectedVerseAction] = useState<{
    surahNumber: number;
    verseNumber: number;
    verseText: string;
  } | null>(null);

  // Surah bookmarks state
  const [surahBookmarkVersion, setSurahBookmarkVersion] = useState(0);
  const surahBookmarksSet = useMemo(() => {
    // surahBookmarkVersion is used only as a reactivity trigger
    return new Set(getAllSurahBookmarks().map((b) => b.surahNumber));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahBookmarkVersion]);
  const handleSurahBookmarkToggle = useCallback((surahNumber: number) => {
    toggleSurahBookmark(surahNumber);
    setSurahBookmarkVersion((v) => v + 1);
  }, []);
  const handleRemoveSurahBookmark = useCallback((surahNumber: number) => {
    toggleSurahBookmark(surahNumber);
    setSurahBookmarkVersion((v) => v + 1);
  }, []);

  // Derived array of surah bookmarks for the modal (from the correctly-versioned Set)
  const surahBookmarksForModal = useMemo(() => {
    return Array.from(surahBookmarksSet).map((num) => ({ surahNumber: num }));
  }, [surahBookmarksSet]);

  // 1. Settings Hook
  const {
    appLanguage,
    displayLanguage,
    showArabic,
    isRtlNavigation,
    arabicFontSize,
    translationFontSize,
    toggleFontSize,
  } = useQuranSettings(appSettings);
  const isUiRTL = isRtlLanguage(appLanguage);
  const effectiveNavLanguage = navigationLanguage ?? displayLanguage;

  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );
  useEffect(() => {
    const onUp = () => setNetworkOnline(true);
    const onDown = () => setNetworkOnline(false);
    globalThis.addEventListener("online", onUp);
    globalThis.addEventListener("offline", onDown);
    return () => {
      globalThis.removeEventListener("online", onUp);
      globalThis.removeEventListener("offline", onDown);
    };
  }, []);

  // 2. Data Hook
  const {
    surahs,
    juzs,
    selectedSurah,
    setSelectedSurah,
    verses,
    setVerses,
    loading,
    loadingVerses,
    error,
    handleSelectSurah,
  } = useQuranData(displayLanguage);

  // 3. Reading State Hook
  const {
    viewMode,
    setViewMode,
    readingMode,
    setReadingMode,
    currentVerseIndex,
    setCurrentVerseIndex,
    currentPage,
    setCurrentPage,
    mainContentRef,
    canGoPrevious,
    canGoNext,
    handlePrevious,
    handleNext,
    handleBackToList: baseHandleBackToList,
    pendingRestoreRef,
    prepareRestoreForSurahSelection,
  } = useQuranReadingState(
    selectedSurah,
    verses,
    displayLanguage,
    setSelectedSurah,
    handleSelectSurah,
    setVerses,
  );

  // 4. Search Hook
  const {
    searchQuery,
    searchResults,
    searching,
    surahSearchQuery,
    handleSurahSearch,
    surahSearchResults,
    surahSearching,
    listMode,
    setListMode,
    handleSearch,
    resetSearch,
  } = useQuranSearch(displayLanguage, selectedSurah);

  // 5. Bookmarks Hook
  const currentPageNumber = useMemo(() => {
    if (readingMode === "page") return currentPage;
    return verses[currentVerseIndex]?.pageNumber ?? currentPage;
  }, [readingMode, currentPage, verses, currentVerseIndex]);

  const {
    showBookmarks,
    setShowBookmarks,
    currentPageBookmarked,
    bookmarks,
    verseBookmarks,
    selectedVerseIsBookmarked,
    toggleCurrentPageBookmark,
    handleRemoveBookmark,
    handleOpenBookmarkPage,
    handleOpenBookmarkVerse,
    handleRemoveBookmarkVerse,
    handleToggleSelectedVerseBookmark,
    handleToggleVerseBookmark,
  } = useQuranBookmarks({
    currentPageNumber,
    selectedVerseAction,
    surahs,
    pendingRestoreRef,
    handleSelectSurah,
    setReadingMode,
    setViewMode,
  });

  const handleOpenBookmarkSurah = useCallback(async (surahNumber: number) => {
    setSelectedListEntry({ mode: "surah", value: surahNumber });
    prepareRestoreForSurahSelection(surahNumber);
    await handleSelectSurah(surahNumber);
    setViewMode("reader");
    setShowBookmarks(false);
  }, [handleSelectSurah, prepareRestoreForSurahSelection, setViewMode, setShowBookmarks]);

  const surahVerseCountForAudio = useMemo(() => {
    return Math.max(1, verses.length);
  }, [verses.length]);

  // 6. Audio Hook
  const {
    audioReciters,
    selectedAudioReciterId,
    setSelectedAudioReciterId,
    selectedAudioReciter,
    audioScope,
    setAudioScope,
    showReciterMenu,
    setShowReciterMenu,
    audioLoading,
    audioError,
    audioStatusMessage,
    audioIsPlaying,
    audioIsPaused,
    stopAudioPlayback,
    pauseReaderAudio,
    resumeReaderAudio,
    handlePlaySelectedVerseAudio,
    setAudioError,
    setAudioStatusMessage,
    audioUiPrompt,
    clearAudioUiPrompt,
    readerAudioSession,
    readerHighlightVerse,
  } = useQuranAudio({
    t,
    selectedVerseAction,
    surahVerseCount: surahVerseCountForAudio,
    uiLanguage: appLanguage,
    displayLanguage,
    surahNameByNumber: (n) => {
      const s = surahs.find((entry) => entry.number === n);
      return s ? getLocalizedSurahName(s, displayLanguage) : null;
    },
  });

  // If the user navigates to a different surah while reader audio is active,
  // stop playback to avoid a misleading mini-player (e.g. Baqarah screen while
  // the mini-player still shows / controls Fatihah audio).
  useEffect(() => {
    if (!selectedSurah || !readerAudioSession) return;
    if (selectedVerseAction) return; // verse modal manages its own stop/start logic
    if (readerAudioSession.surahNumber === selectedSurah.number) return;
    stopAudioPlayback();
    setAudioStatusMessage("");
    setAudioError(null);
  }, [readerAudioSession, selectedSurah, selectedVerseAction, stopAudioPlayback, setAudioStatusMessage, setAudioError]);

  const readerActiveVerseNumber = useMemo(() => {
    if (selectedVerseAction) return selectedVerseAction.verseNumber;
    if (!readerAudioSession || !selectedSurah) return null;
    if (readerAudioSession.surahNumber !== selectedSurah.number) return null;
    return readerHighlightVerse;
  }, [readerAudioSession, readerHighlightVerse, selectedSurah, selectedVerseAction]);

  // 7. Tafsir Hook
  const {
    selectedTafsirSource,
    tafsirLoading,
    tafsirError,
    tafsirPreview,
    handleShareSelectedTafsir,
  } = useQuranTafsir({
    t,
    displayLanguage,
    selectedSurah,
    selectedVerseAction,
  });

  // Combined handlers
  const handleBackToList = useCallback(() => {
    baseHandleBackToList();
    resetSearch();
  }, [baseHandleBackToList, resetSearch]);

  const handleJumpToReadingAnchor = useCallback(() => {
    if (!selectedSurah || verses.length === 0) return;
    if (readingMode === "page") {
      const minPage = Math.min(...verses.map((v) => v.pageNumber));
      setCurrentPage(minPage);
    } else {
      setCurrentVerseIndex(0);
    }
    requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [
    selectedSurah,
    verses,
    readingMode,
    setCurrentPage,
    setCurrentVerseIndex,
    mainContentRef,
  ]);

  useEffect(() => {
    sessionStorage.setItem("quran_last_view_mode", viewMode);
  }, [viewMode]);

  const handleSelectSearchResult = useCallback(
    (surahNumber: number, verseNumber: number) => {
      if (selectedSurah?.number !== surahNumber) {
        prepareRestoreForSurahSelection(surahNumber);
        handleSelectSurah(surahNumber);
        return;
      }

      const idx = verses.findIndex((v) => v.verseNumber === verseNumber);
      if (idx >= 0) {
        setCurrentVerseIndex(idx);
        setReadingMode("verse");
        setViewMode("reader");
        requestAnimationFrame(() => {
          mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    },
    [
      prepareRestoreForSurahSelection,
      handleSelectSurah,
      selectedSurah,
      verses,
      setCurrentVerseIndex,
      setReadingMode,
      setViewMode,
      mainContentRef,
    ],
  );

  const handleVersePress = useCallback(
    (surahNumber: number, verseNumber: number, verseText: string) => {
      setSelectedVerseAction({ surahNumber, verseNumber, verseText });
      setAudioError(null);
      setAudioStatusMessage("");
      setAudioScope("verse-only");
      stopAudioPlayback();
    },
    [setAudioError, setAudioStatusMessage, setAudioScope, stopAudioPlayback],
  );

  const closeVerseModal = useCallback(() => {
    if (!audioIsPlaying) {
      stopAudioPlayback();
    }
    setShowReciterMenu(false);
    setSelectedVerseAction(null);
    setAudioStatusMessage("");
    setAudioError(null);
  }, [
    audioIsPlaying,
    stopAudioPlayback,
    setShowReciterMenu,
    setAudioStatusMessage,
    setAudioError,
  ]);

  const handleOpenQuranAudioFromReader = useCallback(() => {
    logQuranReaderAudio("reader_audio_nav_library_audio", { source: "verse_modal" });
    clearAudioUiPrompt();
    setShowReciterMenu(false);
    stopAudioPlayback();
    setSelectedVerseAction(null);
    setAudioStatusMessage("");
    setAudioError(null);
    onNavigateToQuranAudio?.();
  }, [
    clearAudioUiPrompt,
    onNavigateToQuranAudio,
    stopAudioPlayback,
    setShowReciterMenu,
    setAudioStatusMessage,
    setAudioError,
  ]);

  const handleSelectJuz = useCallback(
    async (juzNumber: number) => {
      const juz = juzs.find((j) => j.number === juzNumber);
      if (!juz) return;

      if (pendingRestoreRef) {
        pendingRestoreRef.current = {
          surahNumber: juz.startSurah,
          readingMode: "verse",
          verseNumber: juz.startVerse,
        };
      }

      await handleSelectSurah(juz.startSurah);
    },
    [juzs, pendingRestoreRef, handleSelectSurah],
  );

  const handleSelectSurahFromList = useCallback(
    async (surahNumber: number) => {
      setSelectedListEntry({ mode: "surah", value: surahNumber });
      prepareRestoreForSurahSelection(surahNumber);
      await handleSelectSurah(surahNumber);
    },
    [handleSelectSurah, prepareRestoreForSurahSelection],
  );

  const handleSelectJuzFromList = useCallback(
    async (juzNumber: number) => {
      setSelectedListEntry({ mode: "juz", value: juzNumber });
      await handleSelectJuz(juzNumber);
    },
    [handleSelectJuz],
  );

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const handlePageSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handlePageSwipeEnd = useCallback(
    (e: React.TouchEvent) => {
      if (readingMode !== "page") return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = e.changedTouches?.[0];
      if (!start || !touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (isRtlNavigation) {
        if (dx < 0) {
          if (canGoPrevious) handlePrevious();
        } else if (canGoNext) {
          handleNext();
        }
      } else if (dx < 0) {
        if (canGoNext) handleNext();
      } else if (canGoPrevious) {
        handlePrevious();
      }

      requestAnimationFrame(() => {
        mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [readingMode, isRtlNavigation, canGoNext, handleNext, canGoPrevious, handlePrevious, mainContentRef],
  );

  const prevSessionKey = React.useRef(sessionKey);
  const viewModeRef = React.useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    if (sessionKey === undefined || sessionKey === prevSessionKey.current)
      return;
    prevSessionKey.current = sessionKey;

    if (viewModeRef.current === "search" || viewModeRef.current === "reader") {
      pendingRestoreRef.current = null;
      handleBackToList();
    } else if (viewModeRef.current === "surah-list") {
      onBackToParent?.();
    }
  }, [sessionKey, handleBackToList, onBackToParent, pendingRestoreRef]);

  const headerTitle = titleOverride ?? t("library.quranTitle", { lng: effectiveNavLanguage });
  const surahSubtitle = selectedSurah
    ? getLocalizedSurahName(selectedSurah, displayLanguage)
    : null;

  if (loading) {
    return (
      <div className="page-quran flex-1 flex flex-col h-full overflow-hidden">
        <Header title={headerTitle} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 pp-text-primary" />
            <p className="pp-text-primary">{t("quran.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-quran flex-1 flex flex-col h-full overflow-hidden">
        <Header title={headerTitle} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-lg mb-2 pp-text-primary">{error}</p>
            <button
              onClick={() => globalThis.location.reload()}
              className="px-4 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden backdrop-blur-sm border pp-glass-surface-button"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
              <span className="relative z-10">{t("quran.retry")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LibrarySubpageShell
      title={headerTitle}
      uiLanguage={appLanguage}
      uiIsRtl={isUiRTL}
      contentLanguage={displayLanguage}
      contentIsRtl={isRtlNavigation}
      contentClassName="pp-quran-scroll-content"
      contentRef={mainContentRef}
      subtitleRow={undefined}
      controlsRow={
        viewMode === "reader" ? (
          <QuranReaderControls
            isRtlNavigation={isRtlNavigation}
            readingMode={readingMode}
            setReadingMode={setReadingMode}
            verses={verses}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            currentVerseIndex={currentVerseIndex}
            setCurrentVerseIndex={setCurrentVerseIndex}
            surahSubtitle={surahSubtitle}
            toggleFontSize={toggleFontSize}
            displayLanguage={displayLanguage}
            handleSearch={handleSearch}
            setViewMode={setViewMode}
            t={t}
            effectiveNavLanguage={effectiveNavLanguage}
            onJumpToReadingAnchor={handleJumpToReadingAnchor}
          />
        ) : undefined
      }
    >
      <div className="pp-quran-scroll-content">
        <QuranMainContent
          loadingVerses={loadingVerses}
          viewMode={viewMode}
          selectedSurah={selectedSurah}
          listMode={listMode}
          surahSearchQuery={surahSearchQuery}
          displayLanguage={displayLanguage}
          surahs={surahs}
          surahSearchResults={surahSearchResults}
          surahSearching={surahSearching}
          selectedListEntry={selectedListEntry}
          handleSelectSurahFromList={handleSelectSurahFromList}
          handleSelectJuzFromList={handleSelectJuzFromList}
          appLanguage={appLanguage}
          surahBookmarksSet={surahBookmarksSet}
          onSurahBookmarkToggle={handleSurahBookmarkToggle}
          readingMode={readingMode}
          verses={verses}
          currentVerseIndex={currentVerseIndex}
          currentPage={currentPage}
          arabicFontSize={arabicFontSize}
          translationFontSize={translationFontSize}
          showArabic={showArabic}
          handlePageSwipeStart={handlePageSwipeStart}
          handlePageSwipeEnd={handlePageSwipeEnd}
          handlePrevious={handlePrevious}
          handleNext={handleNext}
          handleBackToList={handleBackToList}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          isRtlNavigation={isRtlNavigation}
          mainContentRef={mainContentRef}
          activeVerseNumber={readerActiveVerseNumber}
          onVersePress={handleVersePress}
          verseBookmarks={verseBookmarks}
          onVerseBookmarkToggle={handleToggleVerseBookmark}
          onPageBookmarkToggle={toggleCurrentPageBookmark}
          currentPageBookmarked={currentPageBookmarked}
          handleSearch={handleSearch}
          resetSearch={resetSearch}
          setViewMode={setViewMode}
          searchResults={searchResults}
          searchQuery={searchQuery}
          searching={searching}
          handleSelectSearchResult={handleSelectSearchResult}
          handleSurahSearch={handleSurahSearch}
          setListMode={setListMode}
          setShowBookmarks={setShowBookmarks}
          bookmarks={bookmarks}
        />
      </div>

      <VerseActionModal
        selectedVerseAction={selectedVerseAction}
        onClose={closeVerseModal}
        handleToggleSelectedVerseBookmark={handleToggleSelectedVerseBookmark}
        selectedVerseIsBookmarked={selectedVerseIsBookmarked}
        audioReciters={audioReciters}
        selectedAudioReciterId={selectedAudioReciterId}
        setSelectedAudioReciterId={setSelectedAudioReciterId}
        selectedAudioReciter={selectedAudioReciter}
        showReciterMenu={showReciterMenu}
        setShowReciterMenu={setShowReciterMenu}
        audioScope={audioScope}
        setAudioScope={setAudioScope}
        handlePlaySelectedVerseAudio={handlePlaySelectedVerseAudio}
        audioLoading={audioLoading}
        audioStatusMessage={audioStatusMessage}
        audioError={audioError}
        audioUiPrompt={audioUiPrompt}
        clearAudioUiPrompt={clearAudioUiPrompt}
        onOpenQuranAudio={handleOpenQuranAudioFromReader}
        networkOnline={networkOnline}
        uiLanguage={appLanguage}
        selectedTafsirSource={selectedTafsirSource}
        tafsirLoading={tafsirLoading}
        tafsirError={tafsirError}
        tafsirPreview={tafsirPreview}
        handleShareSelectedTafsir={handleShareSelectedTafsir}
        contentLanguage={displayLanguage}
      />

      {audioError && !selectedVerseAction ? (
        <div
          className="fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
          style={{ bottom: "calc(var(--pp-above-nav) + 64px)" }}
        >
          <div className="pointer-events-auto max-w-xl w-full rounded-xl border border-red-400/40 bg-black/70 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-xs text-red-200 flex-1">{audioError}</p>
            <button
              type="button"
              onClick={() => setAudioError(null)}
              className="shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold pp-glass-surface-button"
            >
              {t("quran.dismiss", { lng: appLanguage })}
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === "reader" && readerAudioSession && !selectedVerseAction && (audioIsPlaying || audioIsPaused) ? (
        <div
          className="fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
          style={{ bottom: "var(--pp-above-nav)" }}
        >
          <div className="pointer-events-auto max-w-xl w-full rounded-xl border backdrop-blur-md px-3 py-2 flex flex-col items-center gap-1 pp-quran-bookmark-row pp-white-border-glow relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25 pointer-events-none rounded-xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none" />
            {(() => {
              const activeSurah = surahs.find((s) => s.number === readerAudioSession.surahNumber);
              const surahName = activeSurah
                ? getLocalizedSurahName(activeSurah, displayLanguage)
                : `${t("quran.sura", { lng: appLanguage })} ${readerAudioSession.surahNumber}`;
              return (
                <div className="relative z-10 text-xs font-semibold pp-text-primary text-center truncate max-w-full" aria-live="polite">
                  {surahName}
                </div>
              );
            })()}
            <div dir="ltr" className="relative z-10 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (audioIsPlaying) {
                    pauseReaderAudio();
                  } else {
                    resumeReaderAudio();
                  }
                }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border pp-glass-surface-button"
                aria-label={
                  audioIsPlaying
                    ? t("quran.pause", { lng: appLanguage })
                    : t("quran.play", { lng: appLanguage })
                }
              >
                {audioIsPlaying ? (
                  <Pause className="w-5 h-5" aria-hidden />
                ) : (
                  <Play className="w-5 h-5" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BookmarksModal
        showBookmarks={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={bookmarks}
        surahs={surahs}
        handleOpenBookmarkPage={handleOpenBookmarkPage}
        handleRemoveBookmark={handleRemoveBookmark}
        displayLanguage={displayLanguage}
        surahBookmarks={surahBookmarksForModal}
        handleOpenBookmarkSurah={handleOpenBookmarkSurah}
        handleRemoveSurahBookmark={handleRemoveSurahBookmark}
        verseBookmarks={verseBookmarks}
        handleOpenBookmarkVerse={handleOpenBookmarkVerse}
        handleRemoveVerseBookmark={handleRemoveBookmarkVerse}
      />
    </LibrarySubpageShell>
  );
}
