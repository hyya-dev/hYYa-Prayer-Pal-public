/**
 * Returns Arabic text size class: large when size >= 30, small when size <= 16, otherwise medium.
 * @param size Numeric Arabic font size preference.
 * @returns CSS class name for Arabic text size.
 */
export function getArabicSizeClass(size: number): string {
  if (size >= 30) return "pp-quran-arabic-size-lg";
  if (size <= 16) return "pp-quran-arabic-size-sm";
  return "pp-quran-arabic-size-md";
}

/**
 * Returns translation text size class: large when size >= 20, small when size <= 12, otherwise medium.
 * @param size Numeric translation font size preference.
 * @returns CSS class name for translation text size.
 */
export function getTranslationSizeClass(size: number): string {
  if (size >= 20) return "pp-quran-translation-size-lg";
  if (size <= 12) return "pp-quran-translation-size-sm";
  return "pp-quran-translation-size-md";
}

/**
 * Returns Arabic verse-number size class: large when size >= 30, small when size <= 16, otherwise medium.
 * @param size Numeric Arabic font size preference.
 * @returns CSS class name for Arabic verse number size.
 */
export function getArabicVerseNumberSizeClass(size: number): string {
  if (size >= 30) return "pp-quran-arabic-verse-num-lg";
  if (size <= 16) return "pp-quran-arabic-verse-num-sm";
  return "pp-quran-arabic-verse-num-md";
}

/**
 * Returns translation verse-number size class: large when size >= 20, small when size <= 12, otherwise medium.
 * @param size Numeric translation font size preference.
 * @returns CSS class name for translation verse number size.
 */
export function getTranslationVerseNumberSizeClass(size: number): string {
  if (size >= 20) return "pp-quran-translation-verse-num-lg";
  if (size <= 12) return "pp-quran-translation-verse-num-sm";
  return "pp-quran-translation-verse-num-md";
}