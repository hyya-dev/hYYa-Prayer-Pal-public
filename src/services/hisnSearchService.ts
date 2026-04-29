import type { HisnChapter, HisnLanguage, HisnSearchResult } from '@/types/hisn';
import { loadHisnChapter, loadHisnChapters } from '@/services/hisnService';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeArabicDiacritics(text: string): string {
  return text.replace(/[\u064b-\u0652\u0670\u0640]/g, '');
}

function normalizeArabicForSearch(text: string): string {
  return removeArabicDiacritics(text).trim();
}

/**
 * Highlight search term in text (returns safe array of parts)
 * @deprecated Use getHighlightParts() instead for XSS-safe rendering
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text;
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const flags = isArabic ? 'g' : 'gi';
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, flags);
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Highlight parts interface for safe React rendering
 */
export interface HighlightPart {
  text: string;
  highlight: boolean;
}

/**
 * Get highlight parts for safe React rendering
 * Returns an array of { text, highlight } objects safe to render without dangerouslySetInnerHTML
 */
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

export async function searchChapters(searchTerm: string, language: HisnLanguage): Promise<HisnChapter[]> {
  if (!searchTerm.trim()) return [];
  try {
    const chapters = await loadHisnChapters();
    const lower = searchTerm.toLowerCase().trim();
    const normalizedArabic = normalizeArabicForSearch(searchTerm);

    return chapters.filter((ch) => {
      // Search in current language title and Arabic fallback so all languages get results
      const titleCurrent = ch.title[language] || ch.title.ar || '';
      const titleEn = ch.title.en || '';
      if (language === 'ar') {
        return normalizeArabicForSearch(titleCurrent).includes(normalizedArabic) || titleCurrent.includes(searchTerm);
      }
      return titleCurrent.toLowerCase().includes(lower) || titleEn.toLowerCase().includes(lower);
    });
  } catch (e) {
    console.warn('[Hisn Muslim] Chapter search failed:', e);
    return [];
  }
}

export async function searchInChapter(
  chapterIndex: number,
  searchTerm: string,
  language: HisnLanguage,
): Promise<HisnSearchResult[]> {
  if (!searchTerm.trim()) return [];
  try {
    const { chapter, items } = await loadHisnChapter(chapterIndex);
    const results: HisnSearchResult[] = [];
    const lower = searchTerm.toLowerCase().trim();
    const normalizedArabic = normalizeArabicForSearch(searchTerm);

    // Chapter title search (current language + en fallback)
    const chapterTitle = chapter.title[language] || chapter.title.en || '';
    if (
      (language === 'ar' && normalizeArabicForSearch(chapterTitle).includes(normalizedArabic)) ||
      (language !== 'ar' && chapterTitle.toLowerCase().includes(lower))
    ) {
      if (items[0]) {
        results.push({
          chapterIndex,
          item: items[0],
          matchType: 'chapterTitle',
          matchText: searchTerm,
        });
      }
    }

    // Arabic search
    for (const item of items) {
      const normalized = normalizeArabicForSearch(item.arabicText);
      if (normalized.includes(normalizedArabic)) {
        results.push({
          chapterIndex,
          item,
          matchType: 'arabic',
          matchText: searchTerm,
        });
      }
    }

    // Translation search (en) with fallback so all languages get results
    if (language !== 'ar') {
      const keys: ('en')[] = ['en'];
      for (const item of items) {
        if (results.some((r) => r.item.id === item.id)) continue;
        for (const key of keys) {
          const t = (item.translations[key] || '').toLowerCase();
          if (t.includes(lower)) {
            results.push({
              chapterIndex,
              item,
              matchType: 'translation',
              matchText: searchTerm,
            });
            break;
          }
        }
      }
    }

    return results;
  } catch (e) {
    console.warn('[Hisn Muslim] searchInChapter failed:', e);
    return [];
  }
}

