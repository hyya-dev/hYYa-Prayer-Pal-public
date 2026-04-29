import { isRtlLanguage } from '@/lib/rtlLanguages';

/**
 * UX Logic Layer 4: Centralized Content Sourcing
 * Category A: Religious (Quran/Tafsir) - Pre-Curated ONLY.
 * Category B: Non-Religious (UI/Labels) - Google Cloud Translation API (via proxy).
 */

const API_PROXY_URL = "/api/translate";
const TIMEOUT_MS = 5000;

export type TranslationCategory = 'A' | 'B';

export interface TranslationOptions {
  category: TranslationCategory;
  sourceLang?: string;
  targetLang: string;
}

class TranslationService {
  private cache = new Map<string, string>();

  /**
   * Translates text using an internal proxy for Google Cloud Translation API.
   * Strictly forbids automated translation for Category A content.
   */
  async translate(text: string, options: TranslationOptions): Promise<string> {
    if (options.category === 'A') {
      console.warn("TranslationService: Attempted to translate Category A (Religious) content. Blocking request to maintain sanctity.");
      return text;
    }

    if (!text || text.trim() === '') return text;
    if (options.sourceLang === options.targetLang) return text;

    const cacheKey = `${text}_${options.targetLang}_${options.sourceLang || 'auto'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: options.targetLang,
          source: options.sourceLang,
          format: 'text',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network response was not ok' }));
        throw new Error(error.error || `Translation failed with status: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.data.translations[0].translatedText;

      this.cache.set(cacheKey, translatedText);
      return translatedText;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('TranslationService: Request timed out');
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('TranslationService: Request failed', errorMessage);
      }
      return text; // Fallback to original text on error
    }
  }

  /**
   * Helper to determine directionality for translated content
   */
  getDirection(languageCode: string): 'rtl' | 'ltr' {
    return isRtlLanguage(languageCode) ? 'rtl' : 'ltr';
  }
}

export const translationService = new TranslationService();
