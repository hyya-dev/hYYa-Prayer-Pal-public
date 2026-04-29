import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Language, QuranLanguageCode } from "@/types/quran";
import type { AppSettings } from "@/hooks/useAppSettings";
import { ALL_QURAN_LANGUAGES } from "@/lib/quranLanguages";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { StorageService } from "@/services/StorageService";


const ARABIC_FONT_KEY = "quran_arabic_font_size";
const TRANSLATION_FONT_KEY = "quran_translation_font_size";

// All 63 supported Quran languages
const QURAN_LANGS = ALL_QURAN_LANGUAGES.map(l => l.code as QuranLanguageCode);

function normalizeQuranLanguageCode(code: string | null | undefined): QuranLanguageCode | null {
  if (!code) return null;
  const normalized = code.split("-")[0].toLowerCase() as QuranLanguageCode;
  return QURAN_LANGS.includes(normalized) ? normalized : null;
}

export function useQuranSettings(appSettings: AppSettings) {
  const { i18n } = useTranslation();
  const appLanguage = ((appSettings.language || i18n.language || "en").split("-")[0].toLowerCase()) as Language;
  const defaultQuranLanguage = normalizeQuranLanguageCode(appSettings.defaultQuranLanguage);

  const displayLanguage: QuranLanguageCode = useMemo(() => {
    if (defaultQuranLanguage) return defaultQuranLanguage;
    const normalizedAppLanguage = normalizeQuranLanguageCode(appLanguage);
    if (normalizedAppLanguage) return normalizedAppLanguage;
    return "ar";
  }, [appLanguage, defaultQuranLanguage]);

  const showArabic = useMemo(() => {
    if (defaultQuranLanguage === null) return appLanguage === "ar";
    if (defaultQuranLanguage === "ar") return true;
    return false;
  }, [appLanguage, defaultQuranLanguage]);

  // Navigation direction: governed by the Quran display language.
  const isRtlNavigation = isRtlLanguage(displayLanguage);

  // Font size S/M/L: S=(16,12), M=(24,16), L=(32,20). Medium is default.
  const [arabicFontSize, setArabicFontSize] = useState(() => {
    try {
      const saved = StorageService.getItem(ARABIC_FONT_KEY);
      return saved ? parseInt(saved, 10) : 24;
    } catch {
      return 24;
    }
  });

  const [translationFontSize, setTranslationFontSize] = useState(() => {
    try {
      const saved = StorageService.getItem(TRANSLATION_FONT_KEY);
      return saved ? parseInt(saved, 10) : 16;
    } catch {
      return 16;
    }
  });

  const [showFontSettings, setShowFontSettings] = useState(false);

  const handleArabicFontSizeChange = useCallback((size: number) => {
    setArabicFontSize(size);
    try {
      StorageService.setItem(ARABIC_FONT_KEY, size.toString());
    } catch {
      // ignore
    }
  }, []);

  const handleTranslationFontSizeChange = useCallback((size: number) => {
    setTranslationFontSize(size);
    try {
      StorageService.setItem(TRANSLATION_FONT_KEY, size.toString());
    } catch {
      // ignore
    }
  }, []);

  const toggleFontSize = useCallback(() => {
    // Cycle: Medium (24/16) -> Large (32/20) -> Small (18/14) -> Medium
    // Current logic based on arabicFontSize
    if (arabicFontSize === 24) {
      handleArabicFontSizeChange(32);
      handleTranslationFontSizeChange(20);
    } else if (arabicFontSize === 32) {
      handleArabicFontSizeChange(16); // Small
      handleTranslationFontSizeChange(12); // Small
    } else {
      handleArabicFontSizeChange(24);
      handleTranslationFontSizeChange(16);
    }
  }, [
    arabicFontSize,
    handleArabicFontSizeChange,
    handleTranslationFontSizeChange,
  ]);

  return {
    appLanguage,
    displayLanguage,
    showArabic,
    isRtlNavigation,
    arabicFontSize,
    handleArabicFontSizeChange,
    translationFontSize,
    handleTranslationFontSizeChange,
    toggleFontSize,
    showFontSettings,
    setShowFontSettings,
    settings: {
      arabicFontSize,
      translationFontSize,
      showArabic,
    },
  };
}
