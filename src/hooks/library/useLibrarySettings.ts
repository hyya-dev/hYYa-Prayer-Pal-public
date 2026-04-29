import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { HisnLanguage } from "@/types/hisn";
import { StorageService } from "@/services/StorageService";

const ARABIC_FONT_KEY = "hisn_arabic_font_size_v1";
const TRANSLATION_FONT_KEY = "hisn_translation_font_size_v1";
const FONT_SIZE_KEY = "hisn_font_size_v1";

export const allowedLanguages: HisnLanguage[] = ["ar", "en"];

export const HISN_SEARCH_PLACEHOLDER: Record<HisnLanguage, string> = {
  ar: "ابحث في الفصول...",
  en: "Search chapters...",
};

export const HISN_FONT_SIZE_LABEL: Record<HisnLanguage, string> = {
  ar: "حجم الخط",
  en: "Font size",
};

function safeParseInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function resolveSupportedLibraryLanguage(
  appLanguage: string | undefined,
): HisnLanguage {
  const raw = (appLanguage || "ar").toLowerCase();
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("en")) return "en";
  return "ar";
}

function getLanguageLabel(lang: HisnLanguage): string {
  if (lang === "ar") return "العربية";
  return "English";
}

export function useLibrarySettings(
  externalHisnLanguage?: HisnLanguage | null,
  uiLanguage?: string,
) {
  const { i18n } = useTranslation();
  // Language source of truth is now provided by Library page props/state.
  const defaultHisnLanguage = externalHisnLanguage;

  const effectiveLanguage: HisnLanguage = useMemo(() => {
    if (defaultHisnLanguage != null) return defaultHisnLanguage;
    return resolveSupportedLibraryLanguage(
      uiLanguage || i18n.language,
    );
  }, [defaultHisnLanguage, i18n.language, uiLanguage]);

  // S=14, M=24, L=34 (Medium is default)
  const [fontSize, setFontSize] = useState(() => {
    const savedUnified = safeParseInt(StorageService.getItem(FONT_SIZE_KEY), 0);
    if (savedUnified > 0) return savedUnified;
    const legacyArabic = safeParseInt(StorageService.getItem(ARABIC_FONT_KEY), 0);
    const legacyTranslation = safeParseInt(
      StorageService.getItem(TRANSLATION_FONT_KEY),
      0,
    );
    return legacyArabic || legacyTranslation || 24;
  });

  const [showFontSettings, setShowFontSettings] = useState(false);

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    try {
      StorageService.setItem(FONT_SIZE_KEY, size.toString());
      StorageService.setItem(ARABIC_FONT_KEY, size.toString());
      StorageService.setItem(TRANSLATION_FONT_KEY, size.toString());
    } catch {
      // ignore
    }
  };

  const isRtlNavigation = effectiveLanguage === "ar";
  const getLanguageLabel = (lang: HisnLanguage): string => {
    if (lang === "ar") return "العربية";
    return "English";
  };

  const toggleFontSize = () => {
    // Cycle: Medium (24) -> Large (34) -> Small (14) -> Medium
    if (fontSize === 24) {
      handleFontSizeChange(34);
    } else if (fontSize === 34) {
      handleFontSizeChange(14);
    } else {
      handleFontSizeChange(24);
    }
  };

  const languageLabel = getLanguageLabel(effectiveLanguage);

  return {
    effectiveLanguage,
    isRtlNavigation,
    fontSize,
    handleFontSizeChange,
    toggleFontSize,
    showFontSettings,
    setShowFontSettings,
    languageLabel,
  };
}
