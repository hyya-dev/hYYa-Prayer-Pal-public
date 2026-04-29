import type { QuranLanguageCode } from "@/types/quran";
import { toWesternDigits } from "@/lib/toWesternDigits";

/**
 * Formats a number using locale-aware formatting, then enforces Western Arabic numerals.
 *
 * RULES.md §1: "Always Enforce Western Arabic numerals (0, 1, 2, 3...) for all numbers
 * in any language, no exceptions."
 *
 * Intl.NumberFormat('ar').format(5) returns '٥' (Arabic-Indic digit) by default.
 * toWesternDigits() converts all Arabic-Indic and Extended Arabic-Indic digits to
 * Western Arabic numerals (0-9) to comply with the above rule.
 */
export function formatLocalizedNumber(value: number, languageCode: QuranLanguageCode): string {
  try {
    const formatted = new Intl.NumberFormat(languageCode).format(value);
    return toWesternDigits(formatted);
  } catch {
    return `${value}`;
  }
}
