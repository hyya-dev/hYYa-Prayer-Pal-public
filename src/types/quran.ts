/**
 * Quran Data Types
 * Based on Phase 1 requirements from QURAN_IMPLEMENTATION_PLAN.md
 */

/** All 60 verified Sunni Quran translations + Arabic original */
export type QuranLanguageCode = 
  | 'ar' | 'en' | 'sq' | 'ber' | 'am' | 'as' | 'az' | 'bm' | 'bn' | 'bs' 
  | 'bg' | 'km' | 'zh' | 'prs' | 'dv' | 'nl' | 'fr' | 'de' 
  | 'gu' | 'ha' | 'he' | 'hi' | 'id' | 'it' | 'ja' | 'kk' | 'rw' 
  | 'ko' | 'ku' | 'ms' | 'ml' | 'mrw' | 'mr' | 'ne' | 'om' | 'ps' | 'fa' 
  | 'pl' | 'pt' | 'ro' | 'ru' | 'sd' | 'si' | 'so' | 'es' | 'sw' | 'sv' 
  | 'tl' | 'tg' | 'ta' | 'te' | 'th' | 'tr' | 'uk' | 'ur' | 'ug' | 'uz' 
  | 'vi' | 'yau' | 'yo';

/** UI languages — same as QuranLanguageCode so every content language can also be the app language */
export type Language = QuranLanguageCode;

export type RevelationType = 'meccan' | 'medinan';

export interface Surah {
  number: number;
  nameArabic: string;
  nameTransliterated: string;
  nameTranslated: Record<QuranLanguageCode, string>;
  verseCount: number;
  revelationType: RevelationType;
  startPage: number;
  endPage: number;
}

export interface Verse {
  id: number;
  surahNumber: number;
  verseNumber: number;
  arabicText: string;
  pageNumber: number;
  juzNumber: number;
  isSajdah?: boolean;
  /** Verse translations in all 63 languages */
  translations: Record<QuranLanguageCode | Language, string | undefined>;
}

export interface Juz {
  number: number;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
}

export interface SurahMetadata {
  surahs: Surah[];
}

export interface JuzMapping {
  juzs: Juz[];
}

export interface QuranData {
  surahs: Surah[];
  verses: Verse[];
  juzs: Juz[];
}
