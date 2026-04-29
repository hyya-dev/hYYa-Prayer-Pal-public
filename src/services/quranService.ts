/**
 * Quran Service
 * Handles loading and caching of Quran data — 100% offline, no API calls.
 * All surah metadata (titles in 63 languages) and translations are bundled.
 */

import type { Surah, Verse, Juz, SurahMetadata, JuzMapping, QuranLanguageCode } from '@/types/quran';
import { ALL_QURAN_LANGUAGES } from '@/lib/quranLanguages';
import { isSajdahVerse } from '@/lib/quranSajdah';

interface TranslationFile {
  allSurahs?: Record<string, Record<string, string>>;
  surahNumber?: number;
  translations?: Record<string, string>;
}

// Translation file mapping (one file per language code)
const translationFiles = ALL_QURAN_LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code as QuranLanguageCode] = `lang_${lang.code}`;
    return acc;
  },
  {} as Record<QuranLanguageCode, string>,
);

// Cache for loaded data
const cache = {
  surahs: null as Surah[] | null,
  juzs: null as Juz[] | null,
  arabicVerses: new Map<number, Verse[]>(),
  translations: new Map<string, Record<string, string>>(), // Key: "surahNumber_language"
  translationFiles: new Map<QuranLanguageCode, TranslationFile>(),
};

function isTranslationFile(value: unknown): value is TranslationFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TranslationFile>;
  const hasAllSurahs =
    candidate.allSurahs !== undefined &&
    typeof candidate.allSurahs === 'object' &&
    candidate.allSurahs !== null;
  const hasSingleSurah =
    typeof candidate.surahNumber === 'number' &&
    candidate.translations !== undefined &&
    typeof candidate.translations === 'object' &&
    candidate.translations !== null;
  return hasAllSurahs || hasSingleSurah;
}

/**
 * Normalize translation text for display.
 * Strips ALL HTML tags that Quran.com translations may contain
 * (e.g. <sup>, <a>, <i>, <span>, <b>, <p>, <br> etc.).
 * Also collapses multiple whitespace into single spaces.
 */
function normalizeTranslationTextForDisplay(input: string): string {
  if (!input) return '';
  // Remove <sup>...</sup> and <a class="sup">...</a> entirely (footnote markers)
  let result = input.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '');
  result = result.replace(/<a\s+class="sup"[^>]*>[\s\S]*?<\/a>/gi, '');
  // Strip ALL remaining HTML tags (opening, closing, self-closing)
  result = result.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&nbsp;/g, ' ');
  result = result.replace(/&quot;/g, '"');
  // Collapse multiple whitespace into single spaces
  result = result.replace(/\s{2,}/g, ' ');
  // Trim leading/trailing whitespace
  result = result.trim();
  return result;
}


/**
 * Load surah metadata — fully offline from bundled surahs_metadata.json.
 * All 63 language translations are pre-bundled in nameTranslated.
 */
export async function loadSurahMetadata(
  language?: QuranLanguageCode,
): Promise<Surah[]> {
  if (cache.surahs) {
    return cache.surahs;
  }

  const response = await fetch('/data/quran/metadata/surahs_metadata.json');
  const data: SurahMetadata = await response.json();

  if (!data.surahs || data.surahs.length < 114) {
    throw new Error(`[QuranService] Local surah metadata incomplete (${data.surahs?.length || 0}/114). Bundle full data for offline use.`);
  }

  cache.surahs = data.surahs;
  return data.surahs;
}

/**
 * Load juz mapping
 */
export async function loadJuzMapping(): Promise<Juz[]> {
  if (cache.juzs) {
    return cache.juzs;
  }

  try {
    const response = await fetch('/data/quran/metadata/juz_mapping.json');
    const data: JuzMapping = await response.json();
    if (!data.juzs || data.juzs.length < 30) {
      throw new Error(`[QuranService] Local juz mapping incomplete (${data.juzs?.length || 0}/30). Bundle full data for offline use.`);
    }
    cache.juzs = data.juzs;
    return data.juzs;
  } catch (error) {
    console.error('Error loading juz mapping:', error);
    throw error;
  }
}


/**
 * Load Arabic verses for a surah — fully offline from bundled files.
 */
export async function loadArabicVerses(surahNumber: number): Promise<Verse[]> {
  const cacheKey = surahNumber;
  if (cache.arabicVerses.has(cacheKey)) {
    return cache.arabicVerses.get(cacheKey)!;
  }

  const response = await fetch(`/data/quran/arabic/surah_${surahNumber}.json`);
  if (!response.ok) {
    throw new Error(`[QuranService] Arabic surah file not found: surah_${surahNumber}.json. Bundle full data for offline use.`);
  }
  const data = await response.json();
  cache.arabicVerses.set(cacheKey, data.verses);
  return data.verses;
}


/**
 * Load translations for a surah — fully offline from bundled files.
 */
export async function loadTranslations(surahNumber: number, language: QuranLanguageCode): Promise<Record<string, string>> {
  const cacheKey = `${surahNumber}_${language}`;
  if (cache.translations.has(cacheKey)) {
    return cache.translations.get(cacheKey)!;
  }

  const translationFile = translationFiles[language];
  if (!translationFile) {
    throw new Error(`[QuranService] Unsupported translation language: ${language}.`);
  }

  let data = cache.translationFiles.get(language);
  if (!data) {
    const response = await fetch(`/data/quran/translations/${translationFile}.json`);
    if (!response.ok) {
      throw new Error(`[QuranService] Translation file not found: ${translationFile}.json. Bundle full translations for offline use.`);
    }
    const parsed: unknown = await response.json();
    if (!isTranslationFile(parsed)) {
      throw new Error(`[QuranService] Invalid translation file shape for ${translationFile}.json.`);
    }
    data = parsed;
    cache.translationFiles.set(language, data);
  }

  // Full translation file with allSurahs structure
  const surahKey = String(surahNumber);
  const allSurah = data.allSurahs?.[surahKey];
  if (allSurah) {
    const raw = allSurah;
    const rawOut: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw || {})) {
      rawOut[k] = normalizeTranslationTextForDisplay(v || '');
    }
    cache.translations.set(cacheKey, rawOut);
    return rawOut;
  }

  // Single-surah file format
  if (data.surahNumber === surahNumber && data.translations) {
    const raw = data.translations;
    const rawOut: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw || {})) {
      rawOut[k] = normalizeTranslationTextForDisplay(v || '');
    }
    cache.translations.set(cacheKey, rawOut);
    return rawOut;
  }

  throw new Error(`[QuranService] Translation data missing for surah ${surahNumber} (${language}). Bundle full translations for offline use.`);
}

/**
 * Load complete verse data (Arabic + Translation) for a surah
 */
export async function loadSurahVerses(surahNumber: number, language: QuranLanguageCode): Promise<Verse[]> {
  const arabicVerses = await loadArabicVerses(surahNumber);
  
  // For Arabic language, don't load translations (Arabic text only)
  if (language === 'ar') {
    return arabicVerses.map((verse) => ({
      ...verse,
      isSajdah: isSajdahVerse(surahNumber, verse.verseNumber),
      translations: {} as Record<QuranLanguageCode, string>,
    }));
  }

  // Load translations for other languages — strictly offline and strictly bundled.
  // If any translation file is missing or invalid, this is a build/content bug and should not silently degrade.
  const translations = await loadTranslations(surahNumber, language);

  // Combine Arabic text with translations
  return arabicVerses.map((verse) => ({
    ...verse,
    isSajdah: isSajdahVerse(surahNumber, verse.verseNumber),
    translations: {
      [language]: translations[verse.verseNumber.toString()] ?? '',
    } as Record<QuranLanguageCode, string>,
  }));
}

/**
 * Get surah by number
 */
export async function getSurah(surahNumber: number): Promise<Surah | null> {
  const surahs = await loadSurahMetadata();
  return surahs.find((s) => s.number === surahNumber) || null;
}

/**
 * Clear cache (useful for memory management)
 */
export function clearCache(): void {
  cache.surahs = null;
  cache.juzs = null;
  cache.arabicVerses.clear();
  cache.translations.clear();
  cache.translationFiles.clear();
}

/**
 * Clear specific surah from cache
 */
export function clearSurahCache(surahNumber: number): void {
  cache.arabicVerses.delete(surahNumber);
  // Clear all translation caches for this surah
  for (const key of cache.translations.keys()) {
    if (key.startsWith(`${surahNumber}_`)) {
      cache.translations.delete(key);
    }
  }
}
