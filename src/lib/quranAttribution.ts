import type { Language } from '@/types/quran';

/**
 * Quran Sources & Attribution
 *
 * Goal: make it explicit that Quran translations are curated sources
 * (not machine translation), and provide the required source disclosure.
 *
 * Policy:
 * - ALL Quran content (Arabic text + 60 curated translations) is bundled
 *   locally inside the app. No remote API is contacted at runtime.
 * - Build-time scripts sourced translations from the Quran Foundation API
 *   (quran.com) and the quran-json open-source package. Those scripts are
 *   not part of the shipping app.
 */

export const QURAN_FOUNDATION = {
  providerName: 'Quran Foundation (Quran.com)',
  apiBaseUrl: 'https://api.quran.com/api/v4',
  developerPortalUrl: 'https://quran.com/en/developers',
  developerTermsUrl: 'https://api-docs.quran.foundation/legal/developer-terms/',
} as const;

export const ISLAMHOUSE = {
  providerName: 'Islam House',
  url: 'https://islamhouse.com/',
  notes: [
    'Islam House provides localized Islamic resources and content in multiple languages.',
    'Used for sourcing localized translations and educational materials.',
  ],
} as const;

export const KING_FAHAD_COMPLEX = {
  providerName: 'King Fahad Complex for the Printing of the Holy Quran',
  url: 'https://qurancomplex.gov.sa/quran-dev/',
  notes: [
    'Official Quran Complex in Medina provides authentic Quranic resources and metadata.',
    'API access for Quran text, translations, and recitations.',
  ],
} as const;

export const QURAN_ARABIC_TEXT = {
  label: 'Arabic text',
  script: 'Uthmani (Hafs)',
  notes: [
    'Arabic text is displayed in the Uthmani script (Hafs).',
    'All Arabic text is bundled locally within the app.',
  ],
} as const;

export type QuranTranslationAttribution = {
  language: Language;
  translationName: string;
  translator: string;
  /** Quran.com translation ID used during the build-time download process. */
  quranComTranslationId?: number;
};

export const QURAN_TRANSLATIONS: QuranTranslationAttribution[] = [
  {
    language: 'en',
    translationName: 'Sahih International',
    translator: 'Saheeh International',
    quranComTranslationId: 20,
  },
  {
    language: 'ur',
    translationName: 'Fateh Muhammad Jalandhari',
    translator: 'Fateh Muhammad Jalandhari',
    quranComTranslationId: 234,
  },
  {
    language: 'fr',
    translationName: "Muhammad Hamidullah (Le Saint Coran)",
    translator: 'Muhammad Hamidullah',
    quranComTranslationId: 31,
  },
  {
    language: 'tr',
    translationName: 'Diyanet İşleri',
    translator: 'Diyanet İşleri Başkanlığı',
    quranComTranslationId: 77,
  },
  {
    language: 'id',
    translationName: 'Kemenag (Ministry of Religious Affairs)',
    translator: 'Kementerian Agama RI (Kemenag)',
    quranComTranslationId: 33,
  },
  {
    language: 'ms',
    translationName: 'Abdullah Muhammad Basmeih',
    translator: 'Abdullah Muhammad Basmeih',
    quranComTranslationId: 39,
  },
];

export function getTranslationAttribution(language: Language): QuranTranslationAttribution | null {
  if (language === 'ar') return null;
  return QURAN_TRANSLATIONS.find((t) => t.language === language) ?? null;
}

