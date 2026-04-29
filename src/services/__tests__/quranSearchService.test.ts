import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Surah } from '@/types/quran';

vi.mock('../quranService', () => ({
  loadSurahMetadata: vi.fn(),
  loadSurahVerses: vi.fn(),
}));

import { searchSurahs } from '../quranSearchService';
import { loadSurahMetadata } from '../quranService';

const mockLoadSurahMetadata = vi.mocked(loadSurahMetadata);

function makeSurah(overrides: Partial<Surah>): Surah {
  return {
    number: 1,
    nameArabic: 'الفاتحة',
    nameTransliterated: 'Al-Fatihah',
    nameTranslated: { en: 'The Opening' } as Surah['nameTranslated'],
    verseCount: 7,
    revelationType: 'meccan',
    startPage: 1,
    endPage: 1,
    ...overrides,
  };
}

describe('quranSearchService.searchSurahs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty list for blank search term without loading metadata', async () => {
    await expect(searchSurahs('   ', 'en')).resolves.toEqual([]);
    expect(mockLoadSurahMetadata).not.toHaveBeenCalled();
  });

  it('matches only within the selected curated language', async () => {
    mockLoadSurahMetadata.mockResolvedValue([
      makeSurah({
        number: 1,
        nameArabic: 'الفَاتِحَة',
        nameTransliterated: 'Al-Fatihah',
        nameTranslated: { en: 'The Opening' } as Surah['nameTranslated'],
      }),
      makeSurah({
        number: 2,
        nameArabic: 'البقرة',
        nameTransliterated: 'Al-Baqarah',
        nameTranslated: { en: 'The Cow' } as Surah['nameTranslated'],
      }),
    ]);

    // For non-Arabic curated languages, match only the selected translation's surah name.
    const translatedNameResults = await searchSurahs('opening', 'en');
    expect(translatedNameResults.map((s) => s.number)).toEqual([1]);

    const shouldNotMatchArabicWhenEnglishSelected = await searchSurahs('الفاتحة', 'en');
    expect(shouldNotMatchArabicWhenEnglishSelected.map((s) => s.number)).toEqual([]);

    const shouldNotMatchTransliterationWhenEnglishSelected = await searchSurahs('baqar', 'en');
    expect(shouldNotMatchTransliterationWhenEnglishSelected.map((s) => s.number)).toEqual([]);

    // For Arabic curated language, match Arabic name only (normalized + raw).
    const arabicResults = await searchSurahs('الفاتحة', 'ar');
    expect(arabicResults.map((s) => s.number)).toEqual([1]);
  });

  it('returns empty list and logs warning when metadata load fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockLoadSurahMetadata.mockRejectedValue(new Error('metadata failed'));

    await expect(searchSurahs('fatihah', 'en')).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
