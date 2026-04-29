import React, { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Heart, ArrowUpToLine } from "lucide-react";

import { LibrarySubpageShell } from "@/components/Library/LibrarySubpageShell";
import { HisnChapterList } from "@/components/Library/HisnChapterList";
import { HisnSearchBar } from "@/components/Library/HisnSearchBar";
import { HisnReader } from "@/components/Library/HisnReader";
import { GlassButton } from "@/components/Library/GlassButton";
import { markHisnItemAsRead } from "@/services/hisnReadingProgressService";
import { StorageService } from "@/services/StorageService";
import { isRtlLanguage } from "@/lib/rtlLanguages";

import { useLibrarySettings } from "@/hooks/library/useLibrarySettings";
import { useLibraryData } from "@/hooks/library/useLibraryData";
import { useLibraryList } from "@/hooks/library/useLibraryList";
import { useLibraryNavigation } from "@/hooks/library/useLibraryNavigation";
import type { ViewMode, ReadingMode } from "@/types/library";
import type { HisnLanguage, HisnChapter, HisnItem } from "@/types/hisn";

export interface HisnMuslimSubpageProps {
  readonly uiLanguage: string;
  readonly isUiRTL: boolean;
  readonly derivedHisnLanguage: HisnLanguage;
  readonly uiHisnMuslimTitle: string;
  readonly placeholderSearchChapters: string;
  readonly sessionKey?: number;
  readonly onBackToHome: () => void;
  readonly libraryRenderKey: string;
}

interface HisnStoredState {
  chapterIndex?: number;
  itemId?: number;
  readingMode?: "focus" | "list";
}

function getStoredHisnState(): HisnStoredState | null {
  try {
    const rawState = StorageService.getItem("hisn_last_reading_state_v1");
    if (!rawState) return null;
    const state = JSON.parse(rawState);
    if (state && typeof state.chapterIndex === "number") {
      return state as HisnStoredState;
    }
  } catch (e) {
    console.error("[Hisn Muslim] Failed to restore reading state", e);
  }
  return null;
}

function getChapterSubtitle(selectedChapter: HisnChapter | null | undefined, effectiveLanguage: string, headerTitle: string): string | null {
  if (!selectedChapter) return null;
  const firstValue = Object.values(selectedChapter.title || {})[0];
  const firstTitle = typeof firstValue === "string" ? firstValue : null;
  return (
    selectedChapter.title?.[effectiveLanguage]
    || selectedChapter.title?.["en"]
    || firstTitle
    || headerTitle
  );
}

function useHisnChapterSelection(
  loadChapter: (idx: number) => Promise<{ items: HisnItem[] } | null | void>,
  setViewMode: (mode: ViewMode) => void,
  setReadingMode: (mode: ReadingMode) => void,
  setCurrentItemIndex: (idx: number) => void,
  pendingRestoreRef: React.MutableRefObject<HisnStoredState | null>,
  mainContentRef: React.RefObject<HTMLDivElement>
) {
  return useCallback(
    async (chapterIndex: number) => {
      setViewMode("reader");

      const result = await loadChapter(chapterIndex);
      if (!result) return;

      const { items: newItems } = result;
      const pending = pendingRestoreRef.current;

      if (pending?.chapterIndex !== chapterIndex) {
        setCurrentItemIndex(0);
        return;
      }

      setReadingMode(pending.readingMode === "focus" ? "focus" : "list");
      const targetItemId = pending.itemId;

      if (typeof targetItemId !== "number") {
        setCurrentItemIndex(0);
        pendingRestoreRef.current = null;
        return;
      }

      const idx = newItems.findIndex((it: HisnItem) => it.itemId === targetItemId);
      setCurrentItemIndex(Math.max(0, idx));

      requestAnimationFrame(() => {
        mainContentRef.current
          ?.querySelector<HTMLElement>(`[data-item-id="${targetItemId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      pendingRestoreRef.current = null;
    },
    [loadChapter, setViewMode, setReadingMode, setCurrentItemIndex, pendingRestoreRef, mainContentRef]
  );
}

interface HisnReadingEffectsConfig {
  sessionKey: number | undefined;
  viewMode: ViewMode;
  readingMode: ReadingMode;
  selectedChapter: HisnChapter | null | undefined;
  items: HisnItem[];
  currentItemIndex: number;
  pendingRestoreRef: React.MutableRefObject<HisnStoredState | null>;
  setViewMode: (mode: ViewMode) => void;
  setSelectedChapter: (chapter: HisnChapter | null) => void;
  setItems: (items: HisnItem[]) => void;
  setCurrentItemIndex: (idx: number) => void;
  persistLastReading: (c: number, i: number | undefined, m: ReadingMode) => void;
  handleBackToList: () => void;
  onBackToHome: () => void;
}

function useHisnReadingEffects({
  sessionKey,
  viewMode,
  readingMode,
  selectedChapter,
  items,
  currentItemIndex,
  pendingRestoreRef,
  setViewMode,
  setSelectedChapter,
  setItems,
  setCurrentItemIndex,
  persistLastReading,
  handleBackToList,
  onBackToHome
}: HisnReadingEffectsConfig) {
  const prevSessionKey = useRef(sessionKey);
  const libViewModeRef = useRef(viewMode);
  libViewModeRef.current = viewMode;

  useEffect(() => {
    if (sessionKey === undefined || sessionKey === prevSessionKey.current) return;
    prevSessionKey.current = sessionKey;

    if (libViewModeRef.current === "reader") {
      handleBackToList();
    } else {
      onBackToHome();
    }
  }, [sessionKey, handleBackToList, onBackToHome]);

  useEffect(() => {
    sessionStorage.setItem("hisn_last_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedChapter) return;
    const itemId = items[currentItemIndex]?.itemId;
    persistLastReading(selectedChapter.index, itemId, readingMode);
  }, [selectedChapter, items, currentItemIndex, readingMode, persistLastReading]);

  useEffect(() => {
    if (viewMode !== "reader" || readingMode !== "focus") return;
    if (!selectedChapter) return;
    const item = items[currentItemIndex];
    if (!item) return;
    markHisnItemAsRead(selectedChapter.index, item.itemId);
  }, [viewMode, readingMode, selectedChapter, items, currentItemIndex]);
}

export function HisnMuslimSubpage({
  uiLanguage,
  isUiRTL,
  derivedHisnLanguage,
  uiHisnMuslimTitle,
  placeholderSearchChapters,
  sessionKey,
  onBackToHome,
  libraryRenderKey
}: HisnMuslimSubpageProps) {
  const { t } = useTranslation();
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    effectiveLanguage,
    isRtlNavigation,
    fontSize,
    toggleFontSize,
  } = useLibrarySettings(derivedHisnLanguage, uiLanguage);

  const isContentRTL = isRtlLanguage(effectiveLanguage);

  const {
    chapters,
    selectedChapter,
    setSelectedChapter,
    items,
    setItems,
    loading,
    loadingChapter,
    bookmarks,
    handleToggleBookmark,
    chapterBookmarks,
    toggleChapterBookmark,
    handleToggleListBookmark,
    loadChapter,
    persistLastReading,
  } = useLibraryData();

  const {
    chapterSearchQuery,
    chapterSearchResults,
    chapterSearching,
    showBookmarksOnly,
    setShowBookmarksOnly,
    handleChapterSearch,
    visibleChapters,
    resetListState,
  } = useLibraryList(chapters, bookmarks, effectiveLanguage);

  const {
    viewMode,
    setViewMode,
    readingMode,
    setReadingMode,
    currentItemIndex,
    setCurrentItemIndex,
    handleBackToList,
    canGoPrevious,
    canGoNext,
    handlePrevious,
    handleNext,
    handleSwipeStart,
    handleSwipeEnd,
    pendingRestoreRef,
  } = useLibraryNavigation(
    items,
    effectiveLanguage,
    selectedChapter,
    setSelectedChapter,
    setItems,
    resetListState,
    mainContentRef,
  );

  // Handle Chapter Selection
  const handleSelectChapter = useHisnChapterSelection(
    loadChapter,
    setViewMode,
    setReadingMode,
    setCurrentItemIndex,
    pendingRestoreRef,
    mainContentRef
  );

  const handleChapterSelectFromList = useCallback(
    async (chapterIndex: number) => {
      const stored = getStoredHisnState();
      if (stored?.chapterIndex === chapterIndex) {
        pendingRestoreRef.current = {
          chapterIndex,
          itemId: stored.itemId,
          readingMode: stored.readingMode === "focus" ? "focus" : "list",
        };
      } else {
        pendingRestoreRef.current = null;
      }
      await handleSelectChapter(chapterIndex);
    },
    [handleSelectChapter, pendingRestoreRef],
  );

  // Delegate UX and reading side-effects out of this component's body
  useHisnReadingEffects({
    sessionKey,
    viewMode,
    readingMode,
    selectedChapter,
    items,
    currentItemIndex,
    pendingRestoreRef,
    setViewMode,
    setSelectedChapter,
    setItems,
    setCurrentItemIndex,
    persistLastReading,
    handleBackToList,
    onBackToHome
  });

  const headerTitle = uiHisnMuslimTitle;
  const chapterSubtitle = getChapterSubtitle(selectedChapter, effectiveLanguage, headerTitle);

  // Pure boolean evaluated component rendering avoids excessive control flow branching
  const isReaderMode = viewMode === "reader";
  const isListViewMode = viewMode === "chapter-list";
  const shouldRenderReaderControls = isReaderMode;
  const shouldRenderListControls = isListViewMode;
  
  const shouldRenderLoading = loadingChapter;
  const shouldRenderList = isListViewMode && !loadingChapter;
  const shouldRenderReader = isReaderMode && !loadingChapter && !!selectedChapter;
  
  const activeBookmarkClass = showBookmarksOnly ? "fill-current" : "";
  const listDir = isContentRTL ? "rtl" : "ltr";
  const bookmarkedChapters = React.useMemo(
    () => new Set(chapterBookmarks),
    [chapterBookmarks],
  );

  const chaptersWithBookmarkedItems = React.useMemo(() => {
    return new Set(bookmarks.map((b) => b.chapterIndex));
  }, [bookmarks]);

  const handleJumpToChapterStart = useCallback(() => {
    setCurrentItemIndex(0);
    requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      const firstId = items[0]?.itemId;
      if (firstId != null) {
        mainContentRef.current
          ?.querySelector<HTMLElement>(`[data-item-id="${firstId}"]`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }, [items, setCurrentItemIndex, mainContentRef]);

  return (
    <LibrarySubpageShell
      key={`library-hisn-${libraryRenderKey}`}
      title={headerTitle}
      uiLanguage={uiLanguage}
      uiIsRtl={isUiRTL}
      contentLanguage={effectiveLanguage}
      contentIsRtl={isContentRTL}
      contentClassName="pp-library-scroll-content"
      contentRef={mainContentRef}
      controlsRow={
        <div className="w-full md:max-w-2xl md:mx-auto">
          {shouldRenderReaderControls && selectedChapter ? (
            <div className="flex items-center w-full gap-2">
              {/* LTR: TT | Title   — RTL: Title | TT */}
              {isContentRTL && (
                <GlassButton
                  onClick={handleJumpToChapterStart}
                  className="px-3 py-2 text-sm font-semibold flex-shrink-0"
                  ariaLabel={t("common.backToTop", { lng: effectiveLanguage })}
                >
                  <ArrowUpToLine className="w-5 h-5" />
                </GlassButton>
              )}
              {!isContentRTL && (
                <GlassButton
                  onClick={toggleFontSize}
                  className="px-3 py-2 text-sm font-semibold flex-shrink-0"
                  ariaLabel={t("library.toggleFontSize", { lng: effectiveLanguage })}
                >
                  <div
                    className={[
                      "flex items-end gap-0.5 px-0.5",
                      isContentRTL ? "flex-row-reverse" : "flex-row",
                    ].join(" ")}
                  >
                    <span className="text-xs font-bold leading-none mb-0.5">T</span>
                    <span className="text-lg font-bold leading-none">T</span>
                  </div>
                </GlassButton>
              )}
              <div className="flex-1 rounded-lg px-3 py-2 border relative overflow-hidden pp-quran-header-chip min-w-0">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
                <p
                  className={[
                    "relative z-10 text-base font-semibold truncate text-center",
                  ].join(" ")}
                >
                  {chapterSubtitle}
                </p>
              </div>
              {isContentRTL && (
                <GlassButton
                  onClick={toggleFontSize}
                  className="px-3 py-2 text-sm font-semibold flex-shrink-0"
                  ariaLabel={t("library.toggleFontSize", { lng: effectiveLanguage })}
                >
                  <div
                    className={[
                      "flex items-end gap-0.5 px-0.5",
                      isContentRTL ? "flex-row-reverse" : "flex-row",
                    ].join(" ")}
                  >
                    <span className="text-xs font-bold leading-none mb-0.5">T</span>
                    <span className="text-lg font-bold leading-none">T</span>
                  </div>
                </GlassButton>
              )}
              {!isContentRTL && (
                <GlassButton
                  onClick={handleJumpToChapterStart}
                  className="px-3 py-2 text-sm font-semibold flex-shrink-0"
                  ariaLabel={t("common.backToTop", { lng: effectiveLanguage })}
                >
                  <ArrowUpToLine className="w-5 h-5" />
                </GlassButton>
              )}
            </div>
          ) : null}
          {shouldRenderListControls ? (
            <div className="flex items-stretch gap-3 w-full" dir={listDir}>
              <div className="flex-1 min-w-0">
                <HisnSearchBar
                  className="relative mb-0 w-full h-full"
                  currentLanguage={effectiveLanguage}
                  uiLanguage={uiLanguage}
                  placeholder={placeholderSearchChapters}
                  onSearch={handleChapterSearch}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowBookmarksOnly((v) => !v)}
                className="w-12 h-12 rounded-xl border relative overflow-hidden backdrop-blur-sm transition-all pp-glass-surface-button flex items-center justify-center shrink-0"
                aria-label={t("library.favorites", { lng: effectiveLanguage })}
                style={{ color: showBookmarksOnly ? "var(--pp-text-primary)" : "var(--pp-text-secondary)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
                <Heart className={`w-5 h-5 relative z-10 ${activeBookmarkClass}`} />
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {shouldRenderLoading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 pp-text-primary" />
            <p className="pp-text-primary">{t("library.loading", { lng: effectiveLanguage })}</p>
          </div>
        </div>
      )}
      {shouldRenderList && (
        <HisnChapterList
          loading={loading}
          searching={chapterSearching}
          searchQuery={chapterSearchQuery}
          searchResults={chapterSearchResults}
          chapters={chapters}
          visibleChapters={visibleChapters}
          effectiveLanguage={effectiveLanguage}
          onSelectChapter={handleChapterSelectFromList}
          bookmarkedChapters={bookmarkedChapters}
          chaptersWithBookmarkedItems={chaptersWithBookmarkedItems}
          onToggleListBookmark={handleToggleListBookmark}
        />
      )}
      {shouldRenderReader && selectedChapter && (
        <HisnReader
          selectedChapter={selectedChapter}
          items={items}
          effectiveLanguage={effectiveLanguage}
          readingMode={readingMode}
          fontSize={fontSize}
          currentItemIndex={currentItemIndex}
          bookmarks={bookmarks}
          onToggleBookmark={handleToggleBookmark}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSwipeStart={handleSwipeStart}
          onSwipeEnd={(e) => handleSwipeEnd(e, isRtlNavigation)}
          isRtlNavigation={isRtlNavigation}
          onMarkAsRead={(c, i) => markHisnItemAsRead(c, i)}
          onSetCurrentItemIndex={setCurrentItemIndex}
          onBackToList={handleBackToList}
        />
      )}
    </LibrarySubpageShell>
  );
}
