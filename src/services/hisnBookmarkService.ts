import type { HisnBookmark } from '@/types/hisn';
import { StorageService } from "@/services/StorageService";

// Local interface definition removed, imported from types

const STORAGE_KEY = 'hisn_bookmarks';

export function getAllHisnBookmarks(): HisnBookmark[] {
  try {
    const stored = StorageService.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as HisnBookmark[];
  } catch {
    return [];
  }
}

function save(bookmarks: HisnBookmark[]): void {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // ignore
  }
}

export function isHisnBookmarked(chapterIndex: number, itemId: number): boolean {
  const id = `${chapterIndex}:${itemId}`;
  return getAllHisnBookmarks().some((b) => b.id === id);
}

export function addHisnBookmark(chapterIndex: number, itemId: number, note?: string): HisnBookmark {
  const bookmarks = getAllHisnBookmarks();
  const id = `${chapterIndex}:${itemId}`;
  const existing = bookmarks.find((b) => b.id === id);
  if (existing) return existing;

  const b: HisnBookmark = { id, chapterIndex, itemId, timestamp: Date.now(), note };
  bookmarks.push(b);
  save(bookmarks);
  return b;
}

export function removeHisnBookmark(chapterIndex: number, itemId: number): boolean {
  const bookmarks = getAllHisnBookmarks();
  const id = `${chapterIndex}:${itemId}`;
  const next = bookmarks.filter((b) => b.id !== id);
  if (next.length === bookmarks.length) return false;
  save(next);
  return true;
}

export function removeHisnBookmarksForChapter(chapterIndex: number): boolean {
  const bookmarks = getAllHisnBookmarks();
  const next = bookmarks.filter((b) => b.chapterIndex !== chapterIndex);
  if (next.length === bookmarks.length) return false;
  save(next);
  return true;
}

export function toggleHisnBookmark(chapterIndex: number, itemId: number): boolean {
  if (isHisnBookmarked(chapterIndex, itemId)) {
    removeHisnBookmark(chapterIndex, itemId);
    return false;
  }
  addHisnBookmark(chapterIndex, itemId);
  return true;
}

