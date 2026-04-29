/**
 * Render Quran translation text.
 * Strips any residual HTML tags (fallback safety net) and collapses whitespace.
 * Primary HTML stripping happens in quranService.normalizeTranslationTextForDisplay().
 */
export function TranslationText({ text }: { text: string }) {
  if (!text) return null;

  // Safety net: strip any residual HTML tags not caught by the data layer
  let cleaned = text.replace(/<[^>]+>/g, '');
  // Collapse multiple whitespace into single spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return <>{cleaned}</>;
}

