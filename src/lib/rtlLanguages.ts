/**
 * Languages with right-to-left script direction.
 * Used for layout direction decisions across the app.
 */
export const RTL_LANGUAGES = ['ar', 'ur', 'fa', 'ps', 'prs', 'he', 'sd', 'dv', 'ug', 'ku'] as const;

/**
 * Check if a language code uses right-to-left script.
 */
export function isRtlLanguage(code: string): boolean {
  return (RTL_LANGUAGES as readonly string[]).includes(code);
}
