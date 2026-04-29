import {
  TAFSIR_CATALOG,
  hasBundledTafsirContent,
  type TafsirCatalogItem,
  type TafsirLanguage,
} from "@/lib/tafsirCatalog";
import type { QuranLanguageCode } from "@/types/quran";

export type ReaderSheetTafsirSource = {
  item: TafsirCatalogItem;
  language: TafsirLanguage;
  resourceId: number;
};

/**
 * Default bundled tafsir resource for the Holy Quran verse sheet (Library Quran reader only).
 * Arabic: always Muyassar (stakeholder). Russian: single bundled work. EN/UR/BN: researched defaults
 * (see inline rationale — Library Tafsir subpage catalog unchanged).
 */
export const READER_DEFAULT_TAFSIR_RESOURCE: Record<TafsirLanguage, number> = {
  arabic: 16, // Tafsir Muyassar
  russian: 170, // Al-Sa'di (only bundled Russian work)
  // Ibn Kathir Abridged is the most widely circulated English tafsir in app bundles of this shape.
  english: 169,
  // Ibn Kathir Urdu remains the common default alongside dedicated Urdu commentaries.
  urdu: 160,
  // Ibn Kathir (Tawheed Publication) is a standard reference in Bengali-speaking circles for bundled sets.
  bengali: 164,
};

export function getReaderDefaultTafsirResourceId(language: TafsirLanguage): number {
  return READER_DEFAULT_TAFSIR_RESOURCE[language];
}

const QURAN_DISPLAY_TO_TAFSIR_LANGUAGE: Partial<Record<QuranLanguageCode, TafsirLanguage>> = {
  ar: "arabic",
  bn: "bengali",
  en: "english",
  ru: "russian",
  ur: "urdu",
};

function findBundledSource(
  language: TafsirLanguage,
  resourceId: number,
): ReaderSheetTafsirSource | null {
  for (const item of TAFSIR_CATALOG) {
    const source = item.sources.find((s) => s.language === language && s.resourceId === resourceId);
    if (!source) continue;
    if (!hasBundledTafsirContent(item, language)) continue;
    return { item, language, resourceId: source.resourceId };
  }
  return null;
}

function bundledMuyassarArabic(): ReaderSheetTafsirSource {
  const match = findBundledSource("arabic", 16);
  if (!match) {
    throw new Error("Bundled Tafsir Muyassar (arabic, resource 16) is missing from TAFSIR_CATALOG");
  }
  return match;
}

/**
 * Single tafsir shown on the verse action sheet: Arabic → Muyassar; each bundled tafsir language →
 * its researched default work; any other Quran display language → Muyassar (Arabic).
 */
export function resolveReaderSheetDefaultTafsirSource(
  displayLanguage: QuranLanguageCode,
): ReaderSheetTafsirSource {
  const tafsirLang = QURAN_DISPLAY_TO_TAFSIR_LANGUAGE[displayLanguage];

  if (tafsirLang === "arabic") {
    return bundledMuyassarArabic();
  }

  if (tafsirLang) {
    const preferredId = getReaderDefaultTafsirResourceId(tafsirLang);
    const preferred = findBundledSource(tafsirLang, preferredId);
    if (preferred) return preferred;
  }

  return bundledMuyassarArabic();
}
