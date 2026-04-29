export type HisnLanguage = 'ar' | 'en';

export interface HisnChapter {
  /** Website index used by https://hisnmuslim.com/i/{lang}/{index} */
  index: number;
  title: Record<HisnLanguage, string>;
  itemCount: number;
}

export interface HisnItem {
  /**
   * Stable ID for persistence (bookmark/progress):
   * `${chapterIndex}:${itemId}`
   */
  id: string;
  chapterIndex: number;
  /**
   * HisnMuslim item id (from audio URL like .../75.mp3)
   * Used to align across languages.
   */
  itemId: number;
  arabicText: string;
  translations: {
    en: string;
  };
}

export interface HisnChapterData {
  chapter: HisnChapter;
  items: HisnItem[];
}

export interface HisnSearchResult {
  chapterIndex: number;
  item: HisnItem;
  matchType: 'arabic' | 'translation' | 'chapterTitle';
  matchText: string;
}

export interface HisnBookmark {
  id: string; // `${chapterIndex}:${itemId}`
  chapterIndex: number;
  itemId: number;
  timestamp: number;
  note?: string;
}

