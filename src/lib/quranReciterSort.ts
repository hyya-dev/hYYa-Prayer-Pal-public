import type { QuranAudioReciter } from "@/services/quranAudioService";

/** First whitespace-delimited token (conventional "first name" for sorting). */
export function reciterFirstNameSortKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function nameHasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

export function compareReciterFirstNames(
  a: QuranAudioReciter,
  b: QuranAudioReciter,
  locale: string,
): number {
  const sortLocale =
    nameHasArabicScript(a.name) || nameHasArabicScript(b.name) ? "ar" : locale;
  try {
    const collator = new Intl.Collator(sortLocale, { sensitivity: "base", numeric: true });
    return collator.compare(reciterFirstNameSortKey(a.name), reciterFirstNameSortKey(b.name));
  } catch {
    return reciterFirstNameSortKey(a.name).localeCompare(reciterFirstNameSortKey(b.name), sortLocale);
  }
}

export function sortRecitersByFirstName(
  reciters: readonly QuranAudioReciter[],
  locale: string,
): QuranAudioReciter[] {
  return [...reciters].sort((a, b) => compareReciterFirstNames(a, b, locale));
}

/** Sort by UI label (e.g. translated Arabic name), whole string, Arabic collation when labels use Arabic script. */
export function sortRecitersByDisplayLabel(
  reciters: readonly QuranAudioReciter[],
  getLabel: (r: QuranAudioReciter) => string,
  latinLocale: string,
): QuranAudioReciter[] {
  return [...reciters].sort((a, b) => {
    const la = getLabel(a);
    const lb = getLabel(b);
    const sortLocale = nameHasArabicScript(la) || nameHasArabicScript(lb) ? "ar" : latinLocale;
    try {
      const collator = new Intl.Collator(sortLocale, { sensitivity: "base", numeric: true });
      return collator.compare(la, lb);
    } catch {
      return la.localeCompare(lb, sortLocale);
    }
  });
}
