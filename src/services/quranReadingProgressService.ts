import { StorageService } from "@/services/StorageService";
/**
 * Quran Reading Progress Service
 * Tracks reading progress, marks verses as read, and calculates statistics
 */

export interface ReadVerse {
  surahNumber: number;
  verseNumber: number;
  timestamp: number; // When it was marked as read
}

export interface ReadingProgress {
  readVerses: ReadVerse[];
  lastReadDate: number | null; // Last date when user read (for streak calculation)
  streakDays: number; // Current reading streak
}

export interface SurahProgress {
  surahNumber: number;
  readCount: number;
  totalVerses: number;
  percentage: number;
}

export interface JuzProgress {
  juzNumber: number;
  readCount: number;
  totalVerses: number;
  percentage: number;
}

const STORAGE_KEY = 'quran_reading_progress';
const LAST_READ_DATE_KEY = 'quran_last_read_date';
const STREAK_DAYS_KEY = 'quran_streak_days';

/**
 * Get all reading progress data
 */
function getProgressData(): ReadingProgress {
  try {
    const stored = StorageService.getItem(STORAGE_KEY);
    const readVerses: ReadVerse[] = stored ? JSON.parse(stored) : [];
    
    const lastReadDate = StorageService.getItem(LAST_READ_DATE_KEY);
    const streakDays = StorageService.getItem(STREAK_DAYS_KEY);
    
    return {
      readVerses,
      lastReadDate: lastReadDate ? parseInt(lastReadDate, 10) : null,
      streakDays: streakDays ? parseInt(streakDays, 10) : 0,
    };
  } catch (error) {
    console.error('Error loading reading progress:', error);
    return {
      readVerses: [],
      lastReadDate: null,
      streakDays: 0,
    };
  }
}

/**
 * Save reading progress data
 */
function saveProgressData(progress: ReadingProgress): void {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(progress.readVerses));
    if (progress.lastReadDate !== null) {
      StorageService.setItem(LAST_READ_DATE_KEY, progress.lastReadDate.toString());
    }
    StorageService.setItem(STREAK_DAYS_KEY, progress.streakDays.toString());
  } catch (error) {
    console.error('Error saving reading progress:', error);
  }
}

/**
 * Mark a verse as read
 */
export function markVerseAsRead(surahNumber: number, verseNumber: number): void {
  const progress = getProgressData();
  const verseId = `${surahNumber}:${verseNumber}`;
  
  // Check if already marked as read
  const existing = progress.readVerses.find(
    v => v.surahNumber === surahNumber && v.verseNumber === verseNumber
  );
  
  if (!existing) {
    progress.readVerses.push({
      surahNumber,
      verseNumber,
      timestamp: Date.now(),
    });
    
    // Update reading streak
    updateReadingStreak(progress);
    saveProgressData(progress);
  }
}

/**
 * Mark multiple verses as read (e.g., when viewing a page)
 */
export function markVersesAsRead(verses: Array<{ surahNumber: number; verseNumber: number }>): void {
  const progress = getProgressData();
  let updated = false;
  
  for (const verse of verses) {
    const existing = progress.readVerses.find(
      v => v.surahNumber === verse.surahNumber && v.verseNumber === verse.verseNumber
    );
    
    if (!existing) {
      progress.readVerses.push({
        surahNumber: verse.surahNumber,
        verseNumber: verse.verseNumber,
        timestamp: Date.now(),
      });
      updated = true;
    }
  }
  
  if (updated) {
    updateReadingStreak(progress);
    saveProgressData(progress);
  }
}

/**
 * Unmark a verse as read
 */
export function unmarkVerseAsRead(surahNumber: number, verseNumber: number): void {
  const progress = getProgressData();
  progress.readVerses = progress.readVerses.filter(
    v => !(v.surahNumber === surahNumber && v.verseNumber === verseNumber)
  );
  saveProgressData(progress);
}

/**
 * Check if a verse is marked as read
 */
export function isVerseRead(surahNumber: number, verseNumber: number): boolean {
  const progress = getProgressData();
  return progress.readVerses.some(
    v => v.surahNumber === surahNumber && v.verseNumber === verseNumber
  );
}

/**
 * Get all read verses
 */
export function getAllReadVerses(): ReadVerse[] {
  return getProgressData().readVerses;
}

/**
 * Get progress for a specific surah
 */
export function getSurahProgress(surahNumber: number, totalVerses: number): SurahProgress {
  const progress = getProgressData();
  const readCount = progress.readVerses.filter(v => v.surahNumber === surahNumber).length;
  
  return {
    surahNumber,
    readCount,
    totalVerses,
    percentage: totalVerses > 0 ? Math.round((readCount / totalVerses) * 100) : 0,
  };
}

/**
 * Get progress for a specific juz
 * Requires juz mapping to determine which verses belong to the juz
 */
export function getJuzProgress(
  juzNumber: number,
  juzMapping: { startSurah: number; startVerse: number; endSurah: number; endVerse: number },
  surahVerseCounts: Map<number, number> // Map of surah number -> verse count
): JuzProgress {
  const progress = getProgressData();
  
  // Calculate total verses in juz
  let totalVerses = 0;
  if (juzMapping.startSurah === juzMapping.endSurah) {
    // Juz spans one surah
    totalVerses = juzMapping.endVerse - juzMapping.startVerse + 1;
  } else {
    // Juz spans multiple surahs
    // Verses from start surah
    const startSurahTotal = surahVerseCounts.get(juzMapping.startSurah) || 0;
    totalVerses += startSurahTotal - juzMapping.startVerse + 1;
    
    // Verses from middle surahs
    for (let surah = juzMapping.startSurah + 1; surah < juzMapping.endSurah; surah++) {
      totalVerses += surahVerseCounts.get(surah) || 0;
    }
    
    // Verses from end surah
    totalVerses += juzMapping.endVerse;
  }
  
  // Count read verses in juz
  const readVerses = progress.readVerses.filter(v => {
    if (v.surahNumber < juzMapping.startSurah || v.surahNumber > juzMapping.endSurah) {
      return false;
    }
    if (v.surahNumber === juzMapping.startSurah && v.verseNumber < juzMapping.startVerse) {
      return false;
    }
    if (v.surahNumber === juzMapping.endSurah && v.verseNumber > juzMapping.endVerse) {
      return false;
    }
    return true;
  });
  
  return {
    juzNumber,
    readCount: readVerses.length,
    totalVerses,
    percentage: totalVerses > 0 ? Math.round((readVerses.length / totalVerses) * 100) : 0,
  };
}

/**
 * Get overall progress (total verses read)
 */
export function getOverallProgress(totalVerses: number = 6236): { readCount: number; totalVerses: number; percentage: number } {
  const progress = getProgressData();
  const readCount = progress.readVerses.length;
  
  return {
    readCount,
    totalVerses,
    percentage: Math.round((readCount / totalVerses) * 100),
  };
}

/**
 * Get reading streak
 */
export function getReadingStreak(): number {
  return getProgressData().streakDays;
}

/**
 * Update reading streak based on last read date
 */
function updateReadingStreak(progress: ReadingProgress): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  if (progress.lastReadDate === null) {
    // First time reading
    progress.lastReadDate = todayTimestamp;
    progress.streakDays = 1;
  } else {
    const lastReadDate = new Date(progress.lastReadDate);
    lastReadDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((todayTimestamp - lastReadDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      // Same day - streak continues
      // Don't update streak, just keep it
    } else if (daysDiff === 1) {
      // Consecutive day - increment streak
      progress.streakDays += 1;
      progress.lastReadDate = todayTimestamp;
    } else {
      // Streak broken - reset to 1
      progress.streakDays = 1;
      progress.lastReadDate = todayTimestamp;
    }
  }
}

/**
 * Clear all reading progress
 */
export function clearReadingProgress(): void {
  StorageService.removeItem(STORAGE_KEY);
  StorageService.removeItem(LAST_READ_DATE_KEY);
  StorageService.removeItem(STREAK_DAYS_KEY);
}
