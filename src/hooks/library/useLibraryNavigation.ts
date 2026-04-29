import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { HisnChapter, HisnItem, HisnLanguage } from "@/types/hisn";
import type { ViewMode, ReadingMode } from "@/types/library";

export function useLibraryNavigation(
  items: HisnItem[],
  effectiveLanguage: HisnLanguage,
  selectedChapter: HisnChapter | null,
  setSelectedChapter: (chapter: HisnChapter | null) => void,
  setItems: (items: HisnItem[]) => void,
  resetListState: () => void,
  mainContentRef: React.RefObject<HTMLDivElement>,
) {
  const [viewMode, setViewMode] = useState<ViewMode>("chapter-list");
  const [readingMode, setReadingMode] = useState<ReadingMode>("list");
  const [currentItemIndex, setCurrentItemIndex] = useState(0);

  const pendingRestoreRef = useRef<{
    chapterIndex: number;
    itemId?: number;
    readingMode?: ReadingMode;
  } | null>(null);
  const prevEffectiveLanguageRef = useRef<HisnLanguage | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Anchor current item when language changes
  useEffect(() => {
    const prev = prevEffectiveLanguageRef.current;
    prevEffectiveLanguageRef.current = effectiveLanguage;
    if (!prev) return;
    if (prev === effectiveLanguage) return;
    if (!selectedChapter || items.length === 0) return;
    const itemId = items[currentItemIndex]?.itemId;
    if (typeof itemId !== "number") return;
    pendingRestoreRef.current = {
      chapterIndex: selectedChapter.index,
      itemId,
      readingMode,
    };
  }, [
    effectiveLanguage,
    selectedChapter,
    items,
    currentItemIndex,
    readingMode,
  ]);

  const scrollToItemId = useCallback(
    (itemId: number) => {
      requestAnimationFrame(() => {
        mainContentRef.current
          ?.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [mainContentRef], // Added dependency
  );

  const handleBackToList = useCallback(() => {
    // Save state for Undo/Restore capability
    if (selectedChapter) {
      const itemId = items[currentItemIndex]?.itemId;
      if (typeof itemId === "number") {
        const buffer = {
          chapterIndex: selectedChapter.index,
          itemId,
          readingMode,
        };
        sessionStorage.setItem("hisn_undo_buffer", JSON.stringify(buffer));
      }
    }

    setViewMode("chapter-list");
    setSelectedChapter(null);
    setItems([]);
    setCurrentItemIndex(0);
    resetListState();
    requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0 });
    });
  }, [
    selectedChapter,
    items,
    currentItemIndex,
    readingMode,
    setSelectedChapter,
    setItems,
    resetListState,
    mainContentRef,
  ]);

  const canGoPrevious = useMemo(() => currentItemIndex > 0, [currentItemIndex]);
  const canGoNext = useMemo(
    () => currentItemIndex < items.length - 1,
    [currentItemIndex, items.length],
  );

  const handlePrevious = useCallback(() => {
    const nextIndex = Math.max(0, currentItemIndex - 1);
    const nextItemId = items[nextIndex]?.itemId;
    setCurrentItemIndex(nextIndex);
    if (typeof nextItemId === "number") scrollToItemId(nextItemId);
  }, [currentItemIndex, items, scrollToItemId]);

  const handleNext = useCallback(() => {
    const nextIndex = Math.min(items.length - 1, currentItemIndex + 1);
    const nextItemId = items[nextIndex]?.itemId;
    setCurrentItemIndex(nextIndex);
    if (typeof nextItemId === "number") scrollToItemId(nextItemId);
  }, [currentItemIndex, items, scrollToItemId]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleSwipeEnd = useCallback(
    (e: React.TouchEvent, isRtlNavigation: boolean) => {
      if (readingMode !== "focus") return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = e.changedTouches?.[0];
      if (!start || !touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (!isRtlNavigation) {
        if (dx < 0) {
          if (canGoNext) handleNext();
        } else {
          if (canGoPrevious) handlePrevious();
        }
      } else {
        if (dx < 0) {
          if (canGoPrevious) handlePrevious();
        } else {
          if (canGoNext) handleNext();
        }
      }
    },
    [readingMode, canGoNext, canGoPrevious, handleNext, handlePrevious],
  );

  return {
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
    scrollToItemId,
    pendingRestoreRef,
  };
}
