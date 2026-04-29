/**
 * Quran Search Service
 * Handles searching through Quran text and translations
 */

import type { Verse, Surah, QuranLanguageCode } from '@/types/quran';
import { loadSurahMetadata, loadSurahVerses } from './quranService';

export interface SearchResult {
  surahNumber: number;
  verse: Verse;
  matchType: 'arabic' | 'translation' | 'verseNumber' | 'surahName';
  matchText: string;
}

/**
 * Highlight search term in text (returns safe array of parts)
 * @deprecated Use getHighlightParts() instead for XSS-safe rendering
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text;
  
  // For Arabic text, search case-sensitively
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const flags = isArabic ? 'g' : 'gi';
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, flags);
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Get highlight parts for safe React rendering
 * Returns an array of { text, highlight } objects safe to render without dangerouslySetInnerHTML
 */
export interface HighlightPart {
  text: string;
  highlight: boolean;
}

export function getHighlightParts(text: string, searchTerm: string): HighlightPart[] {
  if (!searchTerm || !text) return [{ text, highlight: false }];
  
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const flags = isArabic ? 'g' : 'gi';
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, flags);
  
  const parts: HighlightPart[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add non-matching part before this match
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        highlight: false
      });
    }
    
    // Add matching part
    parts.push({
      text: match[0],
      highlight: true
    });
    
    lastIndex = regex.lastIndex;
  }
  
  // Add any remaining non-matching part
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      highlight: false
    });
  }
  
  return parts.length > 0 ? parts : [{ text, highlight: false }];
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Remove Arabic diacritics (tashkeel) for searching
 * This allows searching without needing exact diacritics
 */
function removeArabicDiacritics(text: string): string {
  // Remove Arabic diacritics (tashkeel)
  // Range: \u064b-\u0652 covers most common diacritics
  // Also includes: \u0670 (Arabic letter superscript alef)
  return text.replace(/[\u064b-\u0652\u0670\u0640]/g, '');
}

/**
 * Normalize Arabic text for searching (remove diacritics and normalize)
 */
function normalizeArabicForSearch(text: string): string {
  return removeArabicDiacritics(text).trim();
}

/**
 * Search for Surahs by name only (for surah list page)
 * Searches ONLY within the selected curated language for this page.
 * - If Arabic is selected, search Arabic surah names only (normalized + raw).
 * - Otherwise, search the translated surah name for the selected language only.
 */
export async function searchSurahs(searchTerm: string, language: QuranLanguageCode): Promise<Surah[]> {
  if (!searchTerm.trim()) return [];

  try {
    const surahs = await loadSurahMetadata();
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    const normalizedSearchTerm = normalizeArabicForSearch(searchTerm);

    return surahs.filter((surah) => {
      if (language === 'ar') {
        const normalizedArabicName = normalizeArabicForSearch(surah.nameArabic);
        return normalizedArabicName.includes(normalizedSearchTerm) || surah.nameArabic.includes(searchTerm);
      }

      const translatedName = (surah.nameTranslated?.[language]?.trim() ?? '');
      return translatedName.toLowerCase().includes(lowerSearchTerm);
    });
  } catch (err) {
    console.warn('[Quran] searchSurahs failed:', err);
    return [];
  }
}

/**
 * Search verses in a surah (for verse reader/page view)
 * Works in all languages: Arabic (normalized), selected-language translations, and verse number.
 */
export async function searchInSurah(
  surahNumber: number,
  searchTerm: string,
  language: QuranLanguageCode
): Promise<SearchResult[]> {
  if (!searchTerm.trim()) return [];

  try {
    const verses = await loadSurahVerses(surahNumber, language);
    const results: SearchResult[] = [];
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    // Search ONLY within the selected curated language.
    // - If Arabic is selected, search Arabic text only.
    // - Otherwise, search the selected translation only (no Arabic fallback).
    if (language === 'ar') {
      const normalizedSearchTerm = normalizeArabicForSearch(searchTerm);
      verses.forEach((verse) => {
        const normalizedVerseText = normalizeArabicForSearch(verse.arabicText);
        if (!normalizedVerseText.includes(normalizedSearchTerm)) return;
        results.push({
          surahNumber,
          verse,
          matchType: 'arabic',
          matchText: searchTerm,
        });
      });
    } else {
      verses.forEach((verse) => {
        const translation = (verse.translations?.[language]?.trim() ?? '');
        if (!translation?.toLowerCase().includes(lowerSearchTerm)) return;
        results.push({
          surahNumber,
          verse,
          matchType: 'translation',
          matchText: searchTerm,
        });
      });
    }

    // Search by verse number
    const verseNumberMatch = /^\d+$/.exec(searchTerm);
    if (verseNumberMatch) {
      const verseNum = Number.parseInt(verseNumberMatch[0], 10);
      const verse = verses.find(v => v.verseNumber === verseNum);
      if (verse && !results.some(r => r.verse.id === verse.id)) {
        results.push({
          surahNumber,
          verse,
          matchType: 'verseNumber',
          matchText: `Verse ${verseNum}`,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('[Quran] searchInSurah failed:', err);
    return [];
  }
}

/**
 * Search across all surahs (limited to loaded surahs for now)
 * @deprecated Use searchSurahs for surah list or searchInSurah for verse search
 */
export async function searchAll(
  searchTerm: string,
  language: QuranLanguageCode
): Promise<SearchResult[]> {
  if (!searchTerm.trim()) return [];

  const surahs = await loadSurahMetadata();
  const allResults: SearchResult[] = [];

  // Search in verses (currently only Al-Fatihah is available)
  // In Phase 4, this will search all surahs
  for (const surah of surahs) {
    try {
      const surahResults = await searchInSurah(surah.number, searchTerm, language);
      allResults.push(...surahResults);
    } catch (error) {
      // Skip surahs that aren't loaded yet
      console.warn(`Skipping search in surah ${surah.number}:`, error);
    }
  }

  return allResults;
}
