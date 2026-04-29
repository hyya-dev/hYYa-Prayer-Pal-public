import type { QuranLanguageCode } from "@/types/quran";

export type LibrarySectionKey =
  | "quran"
  | "quran-audio"
  | "hisn"
  | "tafsir"
  | "manasik-umrah"
  | "manasik-hajj";

const HISN_SUPPORTED_LANGUAGES = new Set<QuranLanguageCode>(["ar", "en"]);
const TAFSIR_SUPPORTED_LANGUAGES = new Set<QuranLanguageCode>([
  "ar",
  "en",
  "bn",
  "ru",
  "ur",
]);

const MANASIK_UMRAH_LANGUAGES = new Set<QuranLanguageCode>(["am","ar","as","bm","bn","bs","de","dv","en","es","fa","fr","gu","ha","hi","id","it","ja","kk","km","ku","ml","ne","om","prs","ps","pt","ro","ru","rw","si","so","sq","sw","ta","te","tg","th","tl","tr","ug","uk","ur","uz","vi","yau","zh"]);

const MANASIK_HAJJ_LANGUAGES = new Set<QuranLanguageCode>(["am","ar","as","az","bg","bm","bn","bs","de","en","es","fa","fr","gu","ha","he","hi","id","it","ja","kk","km","ko","ku","ml","ms","ne","nl","om","prs","ps","pt","ru","rw","si","so","sq","sv","sw","ta","te","tg","th","tl","tr","ug","uk","ur","uz","vi","yau","yo","zh"]);

export function getLibrarySectionAvailability(language: QuranLanguageCode): Record<LibrarySectionKey, boolean> {
  return {
    "quran": true,
    // Quran Audio must remain visible for all curated languages.
    "quran-audio": true,
    "hisn": HISN_SUPPORTED_LANGUAGES.has(language),
    "tafsir": TAFSIR_SUPPORTED_LANGUAGES.has(language),
    "manasik-umrah": MANASIK_UMRAH_LANGUAGES.has(language),
    "manasik-hajj": MANASIK_HAJJ_LANGUAGES.has(language),
  };
}

export function isLibrarySectionAvailable(
  section: LibrarySectionKey,
  language: QuranLanguageCode,
): boolean {
  return getLibrarySectionAvailability(language)[section];
}

export function resolveManasikSourceForLanguage(
  language: QuranLanguageCode,
): "ministry" | "islamhouse" {
  if (language === "ar" || language === "en" || language === "fr") {
    return "ministry";
  }
  return "islamhouse";
}
