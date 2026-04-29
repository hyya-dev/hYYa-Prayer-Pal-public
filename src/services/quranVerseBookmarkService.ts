import { StorageService } from "@/services/StorageService";
export interface QuranVerseBookmark {
  id: string;
  surahNumber: number;
  verseNumber: number;
  timestamp: number;
}

const STORAGE_KEY = "quran_verse_bookmarks_v1";
let bookmarksCache: QuranVerseBookmark[] | null = null;

function bookmarkId(surahNumber: number, verseNumber: number): string {
  return `${surahNumber}:${verseNumber}`;
}

export function getAllVerseBookmarks(): QuranVerseBookmark[] {
  if (bookmarksCache) {
    return bookmarksCache;
  }

  try {
    const raw = StorageService.getItem(STORAGE_KEY);
    if (!raw) {
      bookmarksCache = [];
      return bookmarksCache;
    }
    const parsed = JSON.parse(raw) as QuranVerseBookmark[];
    if (!Array.isArray(parsed)) {
      bookmarksCache = [];
      return bookmarksCache;
    }
    bookmarksCache = parsed.filter((item) => {
      return (
        typeof item?.id === "string" &&
        typeof item.surahNumber === "number" &&
        typeof item.verseNumber === "number" &&
        typeof item.timestamp === "number"
      );
    });
    return bookmarksCache;
  } catch {
    bookmarksCache = [];
    return bookmarksCache;
  }
}

function saveAllVerseBookmarks(bookmarks: QuranVerseBookmark[]): boolean {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    bookmarksCache = bookmarks;
    return true;
  } catch (error) {
    if (!import.meta.env.PROD) {
      console.error("[quranVerseBookmarkService] Failed to persist bookmarks", error);
    }
    return false;
  }
}

export function refreshVerseBookmarksCache(): QuranVerseBookmark[] {
  bookmarksCache = null;
  return getAllVerseBookmarks();
}

export function isVerseBookmarked(surahNumber: number, verseNumber: number): boolean {
  const id = bookmarkId(surahNumber, verseNumber);
  const bookmarks = getAllVerseBookmarks();
  return bookmarks.some((entry) => entry.id === id);
}

export function toggleVerseBookmark(surahNumber: number, verseNumber: number): boolean {
  const id = bookmarkId(surahNumber, verseNumber);
  const all = getAllVerseBookmarks();
  const exists = all.some((entry) => entry.id === id);

  if (exists) {
    const next = all.filter((entry) => entry.id !== id);
    saveAllVerseBookmarks(next);
    return false;
  }

  const next = [...all, {
    id,
    surahNumber,
    verseNumber,
    timestamp: Date.now(),
  }];
  saveAllVerseBookmarks(next);
  return true;
}
