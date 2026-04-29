import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addBookmark, getAllBookmarks, removeBookmark } from '@/services/quranBookmarkService';
import { StorageService } from "@/services/StorageService";


describe('quranBookmarkService.removeBookmark', () => {
  beforeEach(() => {
    StorageService.clear();
    vi.restoreAllMocks();
  });

  it('removes an existing bookmark and persists updated list', () => {
    addBookmark(5);
    addBookmark(10);

    const setItemSpy = vi.spyOn(StorageService, 'setItem');
    const removed = removeBookmark(5);

    expect(removed).toBe(true);
    expect(getAllBookmarks().map((b) => b.pageNumber)).toEqual([10]);
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('returns false and does not write storage when bookmark does not exist', () => {
    addBookmark(20);

    const setItemSpy = vi.spyOn(StorageService, 'setItem');
    const removed = removeBookmark(99);

    expect(removed).toBe(false);
    expect(getAllBookmarks().map((b) => b.pageNumber)).toEqual([20]);
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
