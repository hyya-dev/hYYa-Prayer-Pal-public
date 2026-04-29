import { StorageService } from "@/services/StorageService";

export interface QuranSurahBookmark {
  id: string; // "surahNumber"
  surahNumber: number;
  timestamp: number;
}

const STORAGE_KEY = "quran_surah_bookmarks_v1";
let bookmarksCache: QuranSurahBookmark[] | null = null;

export function getAllSurahBookmarks(): QuranSurahBookmark[] {
  if (bookmarksCache) {
    return bookmarksCache;
  }

  try {
    const raw = StorageService.getItem(STORAGE_KEY);
    if (!raw) {
      bookmarksCache = [];
      return bookmarksCache;
    }
    const parsed = JSON.parse(raw) as QuranSurahBookmark[];
    if (!Array.isArray(parsed)) {
      bookmarksCache = [];
      return bookmarksCache;
    }
    bookmarksCache = parsed.filter((item) => {
      return (
        typeof item?.id === "string" &&
        typeof item.surahNumber === "number" &&
        typeof item.timestamp === "number"
      );
    });
    return bookmarksCache;
  } catch {
    bookmarksCache = [];
    return bookmarksCache;
  }
}

function saveAllSurahBookmarks(bookmarks: QuranSurahBookmark[]): boolean {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    bookmarksCache = bookmarks;
    return true;
  } catch (error) {
    if (!import.meta.env.PROD) {
      console.error("[quranSurahBookmarkService] Failed to persist bookmarks", error);
    }
    return false;
  }
}

export function isSurahBookmarked(surahNumber: number): boolean {
  const id = String(surahNumber);
  const bookmarks = getAllSurahBookmarks();
  return bookmarks.some((entry) => entry.id === id);
}

export function toggleSurahBookmark(surahNumber: number): boolean {
  const id = String(surahNumber);
  const all = getAllSurahBookmarks();
  const exists = all.some((entry) => entry.id === id);

  if (exists) {
    const next = all.filter((entry) => entry.id !== id);
    saveAllSurahBookmarks(next);
    return false; // Returns true if added, false if removed
  }

  const next = [...all, {
    id,
    surahNumber,
    timestamp: Date.now(),
  }];
  saveAllSurahBookmarks(next);
  return true;
}
