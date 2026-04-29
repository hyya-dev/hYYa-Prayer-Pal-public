import { StorageService } from "@/services/StorageService";

const STORAGE_KEY = "hisn_chapter_bookmarks_v1";

function load(): number[] {
  try {
    const raw = StorageService.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(Number)
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

function save(indices: number[]) {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(indices));
  } catch {
    // ignore
  }
}

export function getAllHisnChapterBookmarks(): number[] {
  return load();
}

export function isHisnChapterBookmarked(chapterIndex: number): boolean {
  return load().includes(chapterIndex);
}

export function toggleHisnChapterBookmark(chapterIndex: number): boolean {
  const current = new Set(load());
  if (current.has(chapterIndex)) {
    current.delete(chapterIndex);
    save(Array.from(current));
    return false;
  }
  current.add(chapterIndex);
  save(Array.from(current));
  return true;
}

