import { StorageService } from "@/services/StorageService";
/**
 * Quran Bookmark Service
 * Handles bookmarking pages and storing in localStorage
 */

export interface Bookmark {
  id: string; // Unique ID: "pageNumber"
  pageNumber: number;
  timestamp: number;
}

const STORAGE_KEY = 'quran_bookmarks';

/**
 * Get all bookmarks
 */
export function getAllBookmarks(): Bookmark[] {
  try {
    const stored = StorageService.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Array<Bookmark | { pageNumber?: number }>;
    return parsed
      .filter((item) => typeof item.pageNumber === 'number')
      .map((item) => ({
        id: String(item.pageNumber),
        pageNumber: item.pageNumber as number,
        timestamp: (item as Bookmark).timestamp || Date.now(),
      }));
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    return [];
  }
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarks(bookmarks: Bookmark[]): void {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Error saving bookmarks:', error);
  }
}

/**
 * Add a bookmark
 */
export function addBookmark(pageNumber: number): Bookmark {
  const bookmarks = getAllBookmarks();
  const bookmarkId = String(pageNumber);

  const existing = bookmarks.find((b) => b.id === bookmarkId);
  if (existing) return existing;

  const bookmark: Bookmark = {
    id: bookmarkId,
    pageNumber,
    timestamp: Date.now(),
  };

  bookmarks.push(bookmark);
  saveBookmarks(bookmarks);
  return bookmark;
}

/**
 * Remove a bookmark
 */
export function removeBookmark(pageNumber: number): boolean {
  const bookmarks = getAllBookmarks();
  const bookmarkId = String(pageNumber);
  const filtered = bookmarks.filter((b) => b.id !== bookmarkId);

  if (filtered.length < bookmarks.length) {
    saveBookmarks(filtered);
    return true;
  }

  return false;
}

/**
 * Check if a verse is bookmarked
 */
export function isBookmarked(pageNumber: number): boolean {
  const bookmarks = getAllBookmarks();
  const bookmarkId = String(pageNumber);
  return bookmarks.some((b) => b.id === bookmarkId);
}
