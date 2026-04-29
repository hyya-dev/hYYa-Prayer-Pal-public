import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  markVerseAsRead,
  markVersesAsRead,
} from "@/services/quranReadingProgressService";
import type { Surah, Verse, Language } from "@/types/quran";
import { StorageService } from "@/services/StorageService";


export type ViewMode = "surah-list" | "reader" | "search";
export type ReadingMode = "verse" | "page";

const LAST_READING_STATE_KEY = "quran_last_reading_state_v1";

export function useQuranReadingState(
  selectedSurah: Surah | null,
  verses: Verse[],
  displayLanguage: Language,
  setSelectedSurah: (surah: Surah | null) => void,
  handleSelectSurah: (num: number) => Promise<void>,
  setVerses: (verses: Verse[]) => void,
) {
  const [viewMode, setViewMode] = useState<ViewMode>("surah-list");
  const [readingMode, setReadingMode] = useState<ReadingMode>("page");

  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Restore state to apply after verses load
  const pendingRestoreRef = useRef<{
    surahNumber: number;
    readingMode: ReadingMode;
    verseNumber?: number;
    pageNumber?: number;
  } | null>(null);

  const prevDisplayLanguageRef = useRef<Language | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Helper to get visible verse number (for preserving position on language change)
  const getVisibleVerseNumber = useCallback((): number => {
    // Prefer the verse card currently closest to the center of the scroll container.
    const container = mainContentRef.current;
    if (!container) return verses[currentVerseIndex]?.verseNumber ?? 1;

    const containerRect = container.getBoundingClientRect();
    const containerCenterY = containerRect.top + containerRect.height / 2;

    const verseEls = Array.from(
      container.querySelectorAll<HTMLElement>("[data-verse-number]"),
    );
    if (verseEls.length === 0)
      return verses[currentVerseIndex]?.verseNumber ?? 1;

    let bestVerse: { verseNumber: number; distance: number } | null = null;

    for (const el of verseEls) {
      const rect = el.getBoundingClientRect();
      const isVisible =
        rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      if (!isVisible) continue;

      const verseNumber = Number(el.dataset.verseNumber);
      if (!Number.isFinite(verseNumber) || verseNumber <= 0) continue;

      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(centerY - containerCenterY);
      if (!bestVerse || distance < bestVerse.distance)
        bestVerse = { verseNumber, distance };
    }

    return (
      bestVerse?.verseNumber ?? verses[currentVerseIndex]?.verseNumber ?? 1
    );
  }, [verses, currentVerseIndex]);

  const prepareRestoreForSurahSelection = useCallback((surahNumber: number) => {
    try {
      const raw = StorageService.getItem(LAST_READING_STATE_KEY);
      if (!raw) {
        pendingRestoreRef.current = null;
        return;
      }
      const parsed = JSON.parse(raw) as {
        surahNumber?: number;
        readingMode?: ReadingMode;
        verseNumber?: number;
        pageNumber?: number;
      };

      if (
        !parsed?.surahNumber ||
        parsed.surahNumber < 1 ||
        parsed.surahNumber > 114
      ) {
        pendingRestoreRef.current = null;
        return;
      }

      if (parsed.surahNumber !== surahNumber) {
        pendingRestoreRef.current = null;
        return;
      }

      pendingRestoreRef.current = {
        surahNumber: parsed.surahNumber,
        readingMode: parsed.readingMode === "page" ? "page" : "verse",
        verseNumber:
          typeof parsed.verseNumber === "number"
            ? parsed.verseNumber
            : undefined,
        pageNumber:
          typeof parsed.pageNumber === "number" ? parsed.pageNumber : undefined,
      };
    } catch {
      pendingRestoreRef.current = null;
    }
  }, []);

  // When translation language changes, anchor position
  useEffect(() => {
    const prev = prevDisplayLanguageRef.current;
    prevDisplayLanguageRef.current = displayLanguage;

    if (!prev) return;
    if (prev === displayLanguage) return;
    if (pendingRestoreRef.current) return;
    if (viewMode !== "reader" || !selectedSurah || verses.length === 0) return;

    if (readingMode === "page") {
      pendingRestoreRef.current = {
        surahNumber: selectedSurah.number,
        readingMode: "page",
        pageNumber: currentPage,
      };
    } else {
      pendingRestoreRef.current = {
        surahNumber: selectedSurah.number,
        readingMode: "verse",
        verseNumber: getVisibleVerseNumber(),
      };
    }
  }, [
    displayLanguage,
    viewMode,
    selectedSurah,
    verses.length,
    readingMode,
    currentPage,
    getVisibleVerseNumber,
  ]);

  // When user taps a surah from the list: selectedSurah and verses get set, but viewMode stays
  // 'surah-list', so the reader never shows until they navigate away and back. Switch to reader
  // as soon as we have selectedSurah + verses and we're still on the list.
  useEffect(() => {
    if (!selectedSurah || verses.length === 0) return;
    if (viewMode !== "surah-list") return;
    if (pendingRestoreRef.current?.surahNumber === selectedSurah.number) return; // handled by restore effect

    setViewMode("reader");
    setCurrentVerseIndex(0);
    setCurrentPage(verses[0]?.pageNumber ?? 1);
  }, [selectedSurah, verses, viewMode]);

  // Apply restore state when verses load
  // We need to detect when verses "just loaded" for the selected surah.
  // This logic was inside the data loading effect in original code.
  // Here, we watch verses and selectedSurah.
  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!selectedSurah || verses.length === 0 || !pending) return;

    if (pending.surahNumber === selectedSurah.number) {
      setReadingMode(pending.readingMode);

      if (pending.readingMode === "page") {
        const minPage = Math.min(...verses.map((v) => v.pageNumber));
        const maxPage = Math.max(...verses.map((v) => v.pageNumber));
        const targetPage = pending.pageNumber ?? verses[0]?.pageNumber ?? 1;
        setCurrentPage(Math.min(maxPage, Math.max(minPage, targetPage)));
        setCurrentVerseIndex(0);
      } else {
        const targetVerseNumber = pending.verseNumber ?? 1;
        const idx = verses.findIndex(
          (v) => v.verseNumber === targetVerseNumber,
        );
        const safeIdx = Math.max(0, idx);
        setCurrentVerseIndex(safeIdx);
        setCurrentPage(
          verses[safeIdx]?.pageNumber || verses[0]?.pageNumber || 1,
        );
      }

      setViewMode("reader");
      pendingRestoreRef.current = null;
    }
  }, [selectedSurah, verses]);

  // Persist last reading state
  useEffect(() => {
    if (!selectedSurah) return;

    const safeVerseNumber =
      verses[currentVerseIndex]?.verseNumber ??
      Math.min(
        selectedSurah.verseCount || 1,
        Math.max(1, currentVerseIndex + 1),
      );

    const state = {
      surahNumber: selectedSurah.number,
      readingMode,
      verseNumber: readingMode === "verse" ? safeVerseNumber : undefined,
      pageNumber: readingMode === "page" ? currentPage : undefined,
      updatedAt: Date.now(),
    };

    try {
      StorageService.setItem(LAST_READING_STATE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [selectedSurah, readingMode, currentVerseIndex, currentPage, verses]);

  // Mark progress as read
  useEffect(() => {
    if (!selectedSurah || verses.length === 0) return;

    if (readingMode === "verse") {
      const current = verses[currentVerseIndex];
      if (current) markVerseAsRead(selectedSurah.number, current.verseNumber);
      return;
    }

    // page mode
    const pageVerses = verses.filter((v) => v.pageNumber === currentPage);
    if (pageVerses.length > 0) {
      markVersesAsRead(
        pageVerses.map((v) => ({
          surahNumber: selectedSurah.number,
          verseNumber: v.verseNumber,
        })),
      );
    }
  }, [selectedSurah, verses, currentVerseIndex, currentPage, readingMode]);

  const handleBackToList = useCallback(() => {
    setViewMode("surah-list");
    setSelectedSurah(null);
    setVerses([]); // Clear verses to prevent flash
    setCurrentVerseIndex(0);
    // Search reset logic belongs in search hook, but we need to signal it.
    // Providing a way to reset would be good.
    // For now, this hook only manages its state.

    requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0 });
    });
  }, [setSelectedSurah, setVerses]);

  const canGoPrevious = useMemo(() => {
    if (!selectedSurah || verses.length === 0) return false;
    if (readingMode === "verse") return currentVerseIndex > 0;
    return currentPage > Math.min(...verses.map((v) => v.pageNumber));
  }, [selectedSurah, verses, readingMode, currentVerseIndex, currentPage]);

  const canGoNext = useMemo(() => {
    if (!selectedSurah || verses.length === 0) return false;
    if (readingMode === "verse") return currentVerseIndex < verses.length - 1;
    return currentPage < Math.max(...verses.map((v) => v.pageNumber));
  }, [selectedSurah, verses, readingMode, currentVerseIndex, currentPage]);

  const handlePrevious = useCallback(() => {
    if (!selectedSurah || verses.length === 0) return;

    if (readingMode === "verse") {
      setCurrentVerseIndex((idx) => Math.max(0, idx - 1));
      return;
    }

    const minPage = Math.min(...verses.map((v) => v.pageNumber));
    setCurrentPage((p) => Math.max(minPage, p - 1));
  }, [selectedSurah, verses, readingMode]);

  const handleNext = useCallback(() => {
    if (!selectedSurah || verses.length === 0) return;

    if (readingMode === "verse") {
      setCurrentVerseIndex((idx) => Math.min(verses.length - 1, idx + 1));
      return;
    }

    const maxPage = Math.max(...verses.map((v) => v.pageNumber));
    setCurrentPage((p) => Math.min(maxPage, p + 1));
  }, [selectedSurah, verses, readingMode]);

  const lastReadingState = useMemo(() => {
    try {
      const raw = StorageService.getItem(LAST_READING_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        surahNumber?: number;
        readingMode?: ReadingMode;
        verseNumber?: number;
        pageNumber?: number;
      };
      if (
        !parsed?.surahNumber ||
        parsed.surahNumber < 1 ||
        parsed.surahNumber > 114
      )
        return null;
      return {
        surahNumber: parsed.surahNumber,
        readingMode: parsed.readingMode === "page" ? "page" : "verse",
        verseNumber:
          typeof parsed.verseNumber === "number"
            ? parsed.verseNumber
            : undefined,
        pageNumber:
          typeof parsed.pageNumber === "number" ? parsed.pageNumber : undefined,
      };
    } catch {
      return null;
    }
  }, []); // updates on mount, but doesn't track storage changes automatically.

  const handleResumeLastReading = useCallback(async () => {
    const state = lastReadingState;
    if (!state) return;

    prepareRestoreForSurahSelection(state.surahNumber);

    try {
      await handleSelectSurah(state.surahNumber);
      setViewMode("reader");
      requestAnimationFrame(() => {
        mainContentRef.current?.scrollTo({ top: 0 });
      });
    } catch (e) {
      console.warn("[Quran] Failed to resume last reading:", e);
    }
  }, [lastReadingState, handleSelectSurah, prepareRestoreForSurahSelection]);

  return {
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
    handleBackToList,
    handleResumeLastReading,
    lastReadingState,
    pendingRestoreRef, // Exposed if needed for external logic
    prepareRestoreForSurahSelection,
  };
}
