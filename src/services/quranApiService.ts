/**
 * Quran API Service
 * 
 * Local-only Quran data service.
 *
 * Policy: Quran content is loaded strictly from bundled local data.
 * No remote Quran text fallback is used.
 */

import type { QuranLanguageCode } from '@/types/quran';
import { dbService } from './db';
import { fetchMushafPageBundleJson, initMushafLayoutDb } from './mushafLayoutDb';

/**
 * Word-by-word data structure (from quran.com API)
 */
export interface WordData {
  id: number;
  text_uthmani: string;
  text_imlaei?: string;
  text_indopak?: string;
  line_number?: number;
  page_number?: number;
  position?: number;
  verse_key: string;
  char_type_name?: string;
  transliteration?: {
    text: string;
  };
  translation?: {
    text: string;
  };
}

/**
 * Verse with word-by-word data
 */
export interface VerseWithWords {
  id: number;
  verse_key: string;
  text_uthmani: string;
  words: WordData[];
  page_number: number;
  verse_number: number;
  chapter_id: number;
  translations: Record<string, string>; // Added for UI compatibility
}

/**
 * Page layout data (from Mushaf layout API)
 */
export interface PageLayoutLine {
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah';
  is_centered: boolean;
  surah_number: number;
  first_word_id?: number;
  last_word_id?: number;
}

export interface PageLayout {
  page_number: number;
  lines: PageLayoutLine[];
}

/**
 * Cached API response
 */
interface CachedResponse<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache duration: 7 days
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface LocalWordRaw {
  id?: unknown;
  text_uthmani?: unknown;
  text_imlaei?: unknown;
  text_indopak?: unknown;
  line_number?: unknown;
  page_number?: unknown;
  position?: unknown;
  verse_key?: unknown;
  char_type_name?: unknown;
  transliteration?: {
    text?: unknown;
  };
  translation?: {
    text?: unknown;
  };
}

interface LocalVerseRaw {
  id?: unknown;
  verse_key?: unknown;
  text_uthmani?: unknown;
  verse_number?: unknown;
  chapter_id?: unknown;
  page_number?: unknown;
  translations?: unknown;
  words?: unknown;
}

interface LocalBundleRaw {
  verses?: unknown;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeTranslations(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  if (Array.isArray(input)) {
    const fromArray = input
      .map((item) => (typeof item === 'object' && item !== null ? toNonEmptyString((item as { text?: unknown }).text) : null))
      .find((text): text is string => Boolean(text));
    return fromArray ? { en: fromArray } : {};
  }

  const result: Record<string, string> = {};
  Object.entries(input).forEach(([key, value]) => {
    const text = toNonEmptyString(value);
    if (text) result[key] = text;
  });
  return result;
}

function sanitizeWord(rawWord: LocalWordRaw, fallbackVerseKey: string, fallbackPageNumber?: number): WordData | null {
  const id = toPositiveNumber(rawWord.id);
  const textUthmani = toNonEmptyString(rawWord.text_uthmani);
  const verseKey = toNonEmptyString(rawWord.verse_key) || fallbackVerseKey;

  if (!id || !textUthmani || !verseKey) {
    return null;
  }

  const lineNumber = toPositiveNumber(rawWord.line_number) ?? undefined;
  const pageNumber = toPositiveNumber(rawWord.page_number) ?? fallbackPageNumber;
  const position = toPositiveNumber(rawWord.position) ?? undefined;
  const transliterationText = toNonEmptyString(rawWord.transliteration?.text);
  const translationText = toNonEmptyString(rawWord.translation?.text);

  return {
    id,
    text_uthmani: textUthmani,
    text_imlaei: toNonEmptyString(rawWord.text_imlaei) ?? undefined,
    text_indopak: toNonEmptyString(rawWord.text_indopak) ?? undefined,
    line_number: lineNumber,
    page_number: pageNumber,
    position,
    verse_key: verseKey,
    char_type_name: toNonEmptyString(rawWord.char_type_name) ?? undefined,
    transliteration: transliterationText ? { text: transliterationText } : undefined,
    translation: translationText ? { text: translationText } : undefined,
  };
}

function sanitizeVerse(rawVerse: LocalVerseRaw, fallbackPageNumber?: number): VerseWithWords | null {
  const id = toPositiveNumber(rawVerse.id);
  const verseKey = toNonEmptyString(rawVerse.verse_key);
  const textUthmani = toNonEmptyString(rawVerse.text_uthmani);
  const verseNumber = toPositiveNumber(rawVerse.verse_number);
  const chapterId = toPositiveNumber(rawVerse.chapter_id);

  if (!id || !verseKey || !textUthmani || !verseNumber || !chapterId) {
    return null;
  }

  const rawWords = Array.isArray(rawVerse.words) ? (rawVerse.words as LocalWordRaw[]) : [];
  const words = rawWords
    .map((word) => sanitizeWord(word, verseKey, fallbackPageNumber))
    .filter((word): word is WordData => word !== null);

  if (words.length === 0) {
    return null;
  }

  const versePageNumber =
    toPositiveNumber(rawVerse.page_number) ??
    words.find((word) => typeof word.page_number === 'number')?.page_number ??
    fallbackPageNumber;

  if (!versePageNumber) {
    return null;
  }

  return {
    id,
    verse_key: verseKey,
    text_uthmani: textUthmani,
    words,
    page_number: versePageNumber,
    verse_number: verseNumber,
    chapter_id: chapterId,
    translations: sanitizeTranslations(rawVerse.translations),
  };
}

function parseLocalVerses(rawData: unknown, fallbackPageNumber?: number): VerseWithWords[] {
  const bundle = (rawData as LocalBundleRaw) ?? {};
  const rawVerses = Array.isArray(bundle.verses) ? (bundle.verses as LocalVerseRaw[]) : [];

  return rawVerses
    .map((verse) => sanitizeVerse(verse, fallbackPageNumber))
    .filter((verse): verse is VerseWithWords => verse !== null);
}

async function enrichVersesWithLocalTranslations(verses: VerseWithWords[]): Promise<VerseWithWords[]> {
  if (verses.length === 0) return verses;
  const chapters = [...new Set(verses.map((v) => v.chapter_id))];
  const byChapter = new Map<number, Map<string, Record<string, string>>>();

  await Promise.all(
    chapters.map(async (chapterId) => {
      const surahVerses = await loadLocalSurahWordData(chapterId);
      const verseMap = new Map<string, Record<string, string>>();
      if (surahVerses) {
        for (const sv of surahVerses) {
          if (sv.translations && Object.keys(sv.translations).length > 0) {
            verseMap.set(sv.verse_key, sv.translations);
          }
        }
      }
      byChapter.set(chapterId, verseMap);
    }),
  );

  return verses.map((v) => {
    const fromSurah = byChapter.get(v.chapter_id)?.get(v.verse_key);
    if (!fromSurah) return v;
    return { ...v, translations: { ...fromSurah, ...v.translations } };
  });
}

/**
 * Get cached data from IndexedDB
 */
async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = (await dbService.get('quran_data', key)) as CachedResponse<T> | undefined;
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      await dbService.delete('quran_data', key);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('[QuranAPI] Cache read error:', error);
    return null;
  }
}

/**
 * Cache data in IndexedDB
 */
async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const cached: CachedResponse<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    await dbService.put('quran_data', key, cached);
  } catch (error) {
    console.error('[QuranAPI] Cache write error:', error);
  }
}

async function loadLocalSurahWordData(surahNumber: number): Promise<VerseWithWords[] | null> {
  try {
    const response = await fetch(`/data/quran/surahs/surah_${surahNumber}.json`);
    if (response.ok) {
      const data = await response.json();
      const parsed = parseLocalVerses(data);
      return parsed.length > 0 ? parsed : null;
    }
  } catch (error) {
    console.warn(`[QuranAPI] Failed local surah bundle for surah ${surahNumber}`, error);
  }
  return null;
}

/**
 * Fetch verses with word-by-word data
 * Optimized to Prefer Local Bundles
 */
export async function fetchVersesWithWords(
  surahNumber: number,
  language: QuranLanguageCode = 'en'
): Promise<VerseWithWords[]> {
  const cacheKey = `verses_words_${surahNumber}_${language}`;

  const localData = await loadLocalSurahWordData(surahNumber);
  if (localData) {
    await setCached(cacheKey, localData);
    return localData;
  }

  const cached = await getCached<VerseWithWords[]>(cacheKey);
  if (cached) return cached;

  console.error(`[QuranAPI] Local Quran bundle missing for surah ${surahNumber}. Remote fallback is disabled by policy.`);
  return [];
}

/**
 * Fetch verses for a specific page with word-by-word data.
 * Source order: IndexedDB cache (if fresh), then bundled `mushaf_layout.sqlite3`,
 * then verse-level translations merged from `public/data/quran/surahs/surah_*.json`.
 */
export async function fetchPageVersesWithWords(
  pageNumber: number,
  language: QuranLanguageCode = 'en'
): Promise<VerseWithWords[]> {
  const cacheKey = `page_verses_words_${pageNumber}_${language}`;

  const cached = await getCached<VerseWithWords[]>(cacheKey);
  if (cached) return cached;

  const bundleJson = await fetchMushafPageBundleJson(pageNumber);
  if (bundleJson) {
    const fromDb = parseLocalVerses(bundleJson, pageNumber);
    if (fromDb.length > 0) {
      const enriched = await enrichVersesWithLocalTranslations(fromDb);
      await setCached(cacheKey, enriched);
      return enriched;
    }
  }

  console.warn(`[QuranAPI] No bundled Mushaf page data for page ${pageNumber}.`);
  return [];
}

/**
 * Fetch page layout data for Mushaf rendering
 */
export async function fetchPageLayout(
  pageNumber: number
): Promise<PageLayout> {
  const cacheKey = `page_layout_${pageNumber}`;

  const cached = await getCached<PageLayout>(cacheKey);
  if (cached) return cached;

  const verses = await fetchPageVersesWithWords(pageNumber, 'en');
  const lineMap = new Map<number, PageLayoutLine>();

  verses.forEach((verse) => {
    verse.words.forEach((word) => {
      if (word.line_number === undefined) return;

      const lineNumber = word.line_number;
      const line = lineMap.get(lineNumber);
      if (line) {
        if (word.id < (line.first_word_id || Infinity)) {
          line.first_word_id = word.id;
        }
        if (word.id > (line.last_word_id || 0)) {
          line.last_word_id = word.id;
        }
      } else {
        lineMap.set(lineNumber, {
          line_number: lineNumber,
          line_type: 'ayah',
          is_centered: false,
          surah_number: verse.chapter_id,
          first_word_id: word.id,
          last_word_id: word.id,
        });
      }
    });
  });

  const lines = Array.from(lineMap.values()).sort((a, b) => a.line_number - b.line_number);
  const layout: PageLayout = { page_number: pageNumber, lines };

  await setCached(cacheKey, layout);
  return layout;
}

/**
 * Check if API integration is available
 */
export function isApiAvailable(): boolean {
  return false;
}

/**
 * Initialize API service (called on app startup)
 */
export async function initializeApi(): Promise<void> {
  await initMushafLayoutDb();
}

/**
 * Clear all cached API responses
 */
export async function clearApiCache(): Promise<void> {
  try {
    await dbService.clear('quran_data');
    console.log('[QuranAPI] Cleared IndexedDB cache');
  } catch (error) {
    console.error('[QuranAPI] Error clearing cache:', error);
  }
}
