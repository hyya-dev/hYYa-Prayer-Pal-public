import type { TafsirLanguage } from "@/lib/tafsirCatalog";
import { StorageService } from "@/services/StorageService";


export interface TafsirVerseBookmark {
  id: string;
  tafsirId: string;
  resourceId: number;
  language: TafsirLanguage;
  surahNo: number;
  ayaNo: number;
  timestamp: number;
}

const STORAGE_KEY = "tafsir_verse_bookmarks_v1";

function buildBookmarkId(
  tafsirId: string,
  resourceId: number,
  language: TafsirLanguage,
  surahNo: number,
  ayaNo: number,
): string {
  return `${tafsirId}:${resourceId}:${language}:${surahNo}:${ayaNo}`;
}

export function getAllTafsirBookmarks(): TafsirVerseBookmark[] {
  try {
    const raw = StorageService.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TafsirVerseBookmark[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => {
      return (
        typeof entry?.id === "string" &&
        typeof entry.tafsirId === "string" &&
        typeof entry.resourceId === "number" &&
        typeof entry.language === "string" &&
        typeof entry.surahNo === "number" &&
        typeof entry.ayaNo === "number"
      );
    });
  } catch {
    return [];
  }
}

function saveAllTafsirBookmarks(bookmarks: TafsirVerseBookmark[]): void {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // no-op
  }
}

export function isTafsirVerseBookmarked(
  tafsirId: string,
  resourceId: number,
  language: TafsirLanguage,
  surahNo: number,
  ayaNo: number,
  bookmarks?: TafsirVerseBookmark[],
): boolean {
  const id = buildBookmarkId(tafsirId, resourceId, language, surahNo, ayaNo);
  const source = bookmarks ?? getAllTafsirBookmarks();
  return source.some((entry) => entry.id === id);
}

export function toggleTafsirVerseBookmark(
  tafsirId: string,
  resourceId: number,
  language: TafsirLanguage,
  surahNo: number,
  ayaNo: number,
): boolean {
  const id = buildBookmarkId(tafsirId, resourceId, language, surahNo, ayaNo);
  const all = getAllTafsirBookmarks();
  const exists = all.some((entry) => entry.id === id);

  if (exists) {
    saveAllTafsirBookmarks(all.filter((entry) => entry.id !== id));
    return false;
  }

  const next: TafsirVerseBookmark = {
    id,
    tafsirId,
    resourceId,
    language,
    surahNo,
    ayaNo,
    timestamp: Date.now(),
  };
  all.push(next);
  saveAllTafsirBookmarks(all);
  return true;
}
