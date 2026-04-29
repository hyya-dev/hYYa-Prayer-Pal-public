/**
 * Complete list of Quran language options: Arabic + 59 verified Sunni translations
 * Ordered by popularity/use (Arabic, English, then most common languages)
 * 
 * All translations verified from:
 * - Quran.com QDC API
 * - QuranEnc.com (Ahlus-Sunnah methodology)
 * - Tanzil.net
 * - King Fahd Quran Printing Complex
 * - Verified Sunni sources only
 */

export interface QuranLanguage {
  code: string;
  name: string;
  nativeName?: string;
  isArabic?: boolean;
}

export const ALL_QURAN_LANGUAGES: QuranLanguage[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isArabic: true },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
  { code: 'prs', name: 'Dari', nativeName: 'دری' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'ug', name: 'Uyghur', nativeName: 'ئۇيغۇرچە' },
  { code: 'az', name: 'Azeri', nativeName: 'Azərbaycanca' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'om', name: 'Oromo', nativeName: 'Afan Oromo' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Kinyarwanda' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'bm', name: 'Bambara', nativeName: 'Bamanankan' },
  { code: 'ber', name: 'Amazigh', nativeName: 'Tamazight' },
  { code: 'dv', name: 'Divehi', nativeName: 'ދިވެހި' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog' },
  { code: 'mrw', name: 'Maranao', nativeName: 'Maranao' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'km', name: 'Central Khmer', nativeName: 'ខ្មែរ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'yau', name: 'Yau/Yuw', nativeName: 'Yau' },
];

/**
 * Get language display name for settings dropdown
 */
export function getQuranLanguageName(code: string): string {
  const lang = ALL_QURAN_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
}

/**
 * Get language native name (if available)
 */
export function getQuranLanguageNativeName(code: string): string | undefined {
  const lang = ALL_QURAN_LANGUAGES.find(l => l.code === code);
  return lang?.nativeName;
}

/**
 * Check if code is Arabic
 */
export function isArabic(code: string): boolean {
  return code === 'ar';
}
