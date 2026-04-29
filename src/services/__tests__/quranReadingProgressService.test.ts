import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from "@/services/StorageService";

import {
  clearReadingProgress,
  getAllReadVerses,
  getReadingStreak,
  isVerseRead,
  markVerseAsRead,
  markVersesAsRead,
  unmarkVerseAsRead,
} from '@/services/quranReadingProgressService';

describe('quranReadingProgressService', () => {
  beforeEach(() => {
    StorageService.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks a verse as read only once', () => {
    markVerseAsRead(1, 1);
    markVerseAsRead(1, 1);

    expect(getAllReadVerses()).toHaveLength(1);
    expect(isVerseRead(1, 1)).toBe(true);
  });

  it('marks multiple verses and avoids duplicates', () => {
    markVersesAsRead([
      { surahNumber: 2, verseNumber: 255 },
      { surahNumber: 2, verseNumber: 286 },
      { surahNumber: 2, verseNumber: 255 },
    ]);

    expect(getAllReadVerses()).toHaveLength(2);
    expect(isVerseRead(2, 255)).toBe(true);
    expect(isVerseRead(2, 286)).toBe(true);
  });

  it('increments streak on consecutive day and not multiple times on same day', () => {
    markVerseAsRead(1, 1);
    markVerseAsRead(1, 2);
    expect(getReadingStreak()).toBe(1);

    vi.setSystemTime(new Date('2026-02-21T12:00:00Z'));
    markVerseAsRead(1, 3);
    expect(getReadingStreak()).toBe(2);

    markVerseAsRead(1, 4);
    expect(getReadingStreak()).toBe(2);
  });

  it('resets streak to 1 when a day is missed', () => {
    markVerseAsRead(3, 1);
    expect(getReadingStreak()).toBe(1);

    vi.setSystemTime(new Date('2026-02-23T12:00:00Z'));
    markVerseAsRead(3, 2);

    expect(getReadingStreak()).toBe(1);
  });

  it('unmarks a verse correctly', () => {
    markVerseAsRead(4, 5);
    expect(isVerseRead(4, 5)).toBe(true);

    unmarkVerseAsRead(4, 5);
    expect(isVerseRead(4, 5)).toBe(false);
  });

  it('clears all reading progress', () => {
    markVerseAsRead(5, 10);
    expect(getAllReadVerses()).toHaveLength(1);

    clearReadingProgress();

    expect(getAllReadVerses()).toHaveLength(0);
    expect(getReadingStreak()).toBe(0);
  });

  it('handles corrupted localStorage payload safely', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    StorageService.setItem('quran_reading_progress', '{not-valid-json');

    expect(getAllReadVerses()).toEqual([]);
    expect(getReadingStreak()).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
