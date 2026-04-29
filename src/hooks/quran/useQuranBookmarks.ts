import { useState, useCallback, useMemo } from "react";
import {
  addBookmark,
  getAllBookmarks,
  isBookmarked,
  removeBookmark,
} from "@/services/quranBookmarkService";
import {
  isVerseBookmarked,
  toggleVerseBookmark,
  getAllVerseBookmarks,
} from "@/services/quranVerseBookmarkService";
import {
  isSurahBookmarked,
  toggleSurahBookmark,
  getAllSurahBookmarks,
} from "@/services/quranSurahBookmarkService";
import type { Surah } from "@/types/quran";
import type { ViewMode, ReadingMode } from "./useQuranReadingState";

interface UseQuranBookmarksProps {
  currentPageNumber: number;
  selectedVerseAction: { surahNumber: number; verseNumber: number } | null;
  surahs: Surah[];
  pendingRestoreRef: React.MutableRefObject<{
    surahNumber: number;
    readingMode: ReadingMode;
    pageNumber?: number;
    verseNumber?: number;
  } | null>;
  handleSelectSurah: (num: number) => Promise<void>;
  setReadingMode: (mode: ReadingMode) => void;
  setViewMode: (mode: ViewMode) => void;
}

export function useQuranBookmarks({
  currentPageNumber,
  selectedVerseAction,
  surahs,
  pendingRestoreRef,
  handleSelectSurah,
  setReadingMode,
  setViewMode,
}: UseQuranBookmarksProps) {
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [verseBookmarkVersion, setVerseBookmarkVersion] = useState(0);

  const [surahBookmarkVersion, setSurahBookmarkVersion] = useState(0);

  const currentPageBookmarked = useMemo(() => {
    // Intentionally read bookmarkVersion so useMemo recomputes when bookmarks change.
    void bookmarkVersion;
    if (!currentPageNumber) return false;
    return isBookmarked(currentPageNumber);
  }, [currentPageNumber, bookmarkVersion]);

  const bookmarks = useMemo(() => {
    // Intentionally read bookmarkVersion so useMemo recomputes when bookmarks change.
    void bookmarkVersion;
    return getAllBookmarks().sort((a, b) => a.pageNumber - b.pageNumber);
  }, [bookmarkVersion]);

  const verseBookmarks = useMemo(() => {
    void verseBookmarkVersion;
    return getAllVerseBookmarks().sort((a, b) => {
      if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
      return a.verseNumber - b.verseNumber;
    });
  }, [verseBookmarkVersion]);

  const surahBookmarks = useMemo(() => {
    void surahBookmarkVersion;
    return getAllSurahBookmarks();
  }, [surahBookmarkVersion]);

  const selectedVerseIsBookmarked = useMemo(() => {
    void verseBookmarkVersion;
    if (!selectedVerseAction) return false;
    return isVerseBookmarked(
      selectedVerseAction.surahNumber,
      selectedVerseAction.verseNumber,
    );
  }, [selectedVerseAction, verseBookmarkVersion]);

  const toggleCurrentPageBookmark = useCallback(() => {
    if (!currentPageNumber) return;
    if (isBookmarked(currentPageNumber)) {
      removeBookmark(currentPageNumber);
    } else {
      addBookmark(currentPageNumber);
    }
    setBookmarkVersion((v) => v + 1);
  }, [currentPageNumber]);

  const handleRemoveBookmark = useCallback((pageNumber: number) => {
    removeBookmark(pageNumber);
    setBookmarkVersion((v) => v + 1);
  }, []);

  const handleOpenBookmarkPage = useCallback(
    async (pageNumber: number) => {
      const targetSurah = surahs.find(
        (s) => pageNumber >= s.startPage && pageNumber <= s.endPage,
      );
      if (!targetSurah) return;

      if (pendingRestoreRef) {
        pendingRestoreRef.current = {
          surahNumber: targetSurah.number,
          readingMode: "page",
          pageNumber,
        };
      }

      await handleSelectSurah(targetSurah.number);
      setReadingMode("page");
      setViewMode("reader");
      setShowBookmarks(false);
    },
    [surahs, pendingRestoreRef, handleSelectSurah, setReadingMode, setViewMode],
  );

  const handleOpenBookmarkVerse = useCallback(
    async (surahNumber: number, verseNumber: number) => {
      if (pendingRestoreRef) {
        pendingRestoreRef.current = {
          surahNumber,
          readingMode: "verse",
          verseNumber,
        };
      }
      await handleSelectSurah(surahNumber);
      setReadingMode("verse");
      setViewMode("reader");
      setShowBookmarks(false);
    },
    [pendingRestoreRef, handleSelectSurah, setReadingMode, setViewMode],
  );

  const handleRemoveBookmarkVerse = useCallback(
    (surahNumber: number, verseNumber: number) => {
      toggleVerseBookmark(surahNumber, verseNumber);
      setVerseBookmarkVersion((v) => v + 1);
    },
    []
  );

  const handleToggleSelectedVerseBookmark = useCallback(() => {
    if (!selectedVerseAction) return;
    toggleVerseBookmark(
      selectedVerseAction.surahNumber,
      selectedVerseAction.verseNumber,
    );
    setVerseBookmarkVersion((v) => v + 1);
  }, [selectedVerseAction]);

  const handleToggleSurahBookmark = useCallback((surahNumber: number) => {
    toggleSurahBookmark(surahNumber);
    setSurahBookmarkVersion((v) => v + 1);
  }, []);

  const handleToggleVerseBookmark = useCallback((surahNumber: number, verseNumber: number) => {
    toggleVerseBookmark(surahNumber, verseNumber);
    setVerseBookmarkVersion((v) => v + 1);
  }, []);

  return {
    showBookmarks,
    setShowBookmarks,
    currentPageBookmarked,
    bookmarks,
    verseBookmarks,
    surahBookmarks,
    selectedVerseIsBookmarked,
    toggleCurrentPageBookmark,
    handleRemoveBookmark,
    handleOpenBookmarkPage,
    handleOpenBookmarkVerse,
    handleRemoveBookmarkVerse,
    handleToggleSelectedVerseBookmark,
    handleToggleSurahBookmark,
    handleToggleVerseBookmark,
  };
}
