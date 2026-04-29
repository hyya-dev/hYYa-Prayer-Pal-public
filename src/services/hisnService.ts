import type { HisnChapter, HisnChapterData } from '@/types/hisn';

const cache = {
  chapters: null as HisnChapter[] | null,
  chapterItems: new Map<number, HisnChapterData>(),
};

export async function loadHisnChapters(): Promise<HisnChapter[]> {
  if (cache.chapters) return cache.chapters;

  const res = await fetch('/data/hisn/metadata/chapters.json');
  if (!res.ok) {
    throw new Error('[HisnService] Missing chapters metadata. Run the HisnMuslim import script.');
  }
  const data = (await res.json()) as { chapters: HisnChapter[] };
  if (!data?.chapters?.length) {
    throw new Error('[HisnService] Invalid chapters metadata.');
  }

  cache.chapters = data.chapters;
  return data.chapters;
}

export async function loadHisnChapter(index: number): Promise<HisnChapterData> {
  const cached = cache.chapterItems.get(index);
  if (cached) return cached;

  const res = await fetch(`/data/hisn/chapters/chapter_${index}.json`);
  if (!res.ok) {
    throw new Error(`[HisnService] Missing chapter data for index ${index}.`);
  }
  const data = (await res.json()) as HisnChapterData;
  cache.chapterItems.set(index, data);
  return data;
}

export function clearHisnCache(): void {
  cache.chapters = null;
  cache.chapterItems.clear();
}

