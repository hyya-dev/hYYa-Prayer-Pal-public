/**
 * Quran Transliteration Service
 * Handles transliteration (phonetic pronunciation) of Arabic text
 */

export interface TransliterationData {
  surahNumber: number;
  verses: Record<number, string>; // verseNumber -> transliteration
}

// Cache for transliteration data
const transliterationCache = new Map<number, TransliterationData>();

/**
 * Load transliteration for a surah
 */
export async function loadTransliteration(surahNumber: number): Promise<TransliterationData | null> {
  // Check cache first
  if (transliterationCache.has(surahNumber)) {
    return transliterationCache.get(surahNumber)!;
  }

  try {
    // Try to load from local file
    const response = await fetch(`/data/quran/transliteration/surah_${surahNumber}.json`);
    if (response.ok) {
      const data: TransliterationData = await response.json();
      transliterationCache.set(surahNumber, data);
      return data;
    }
  } catch (error) {
    console.error(`Error loading transliteration for surah ${surahNumber}:`, error);
  }

  return null;
}

/**
 * Get transliteration for a specific verse
 */
export async function getVerseTransliteration(
  surahNumber: number,
  verseNumber: number
): Promise<string | null> {
  const data = await loadTransliteration(surahNumber);
  if (!data) return null;
  
  return data.verses[verseNumber] || null;
}

/**
 * Check if transliteration is available for a surah
 */
export async function isTransliterationAvailable(surahNumber: number): Promise<boolean> {
  const data = await loadTransliteration(surahNumber);
  return data !== null;
}

/**
 * Clear transliteration cache
 */
export function clearTransliterationCache(): void {
  transliterationCache.clear();
}
