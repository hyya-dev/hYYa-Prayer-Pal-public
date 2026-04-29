import { useState, useEffect } from 'react';
import { translationService, TranslationCategory } from '@/services/TranslationService';
import { useTranslation } from 'react-i18next';

/**
 * UX Logic Layer 4: Centralized Content Sourcing Hook
 * Automatically translates Category B content if not already available.
 * Strips all automated translation for Category A (Religious) content.
 */
export function useDynamicTranslation(
  text: string, 
  category: TranslationCategory = 'B',
  sourceLang?: string
) {
  const { i18n } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function performTranslation() {
      if (category === 'A') {
        setTranslatedText(text);
        return;
      }

      if (!text || text.trim() === '') {
        setTranslatedText(text);
        return;
      }

      const targetLang = i18n.language;
      if (sourceLang === targetLang) {
        setTranslatedText(text);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await translationService.translate(text, {
          category,
          sourceLang,
          targetLang
        });
        
        if (active) {
          setTranslatedText(result);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Translation failed');
          setTranslatedText(text);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    performTranslation();

    return () => {
      active = false;
    };
  }, [text, category, sourceLang, i18n.language]);

  return { translatedText, isLoading, error };
}
