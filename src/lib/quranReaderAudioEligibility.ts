import { getReciterOfflineProgress } from "@/services/quranAudioOfflineService";

/** Reader treats offline audio as available only when all 114 surah files exist on disk. */
export async function hasOffline114Surahs(reciterId: number): Promise<boolean> {
  const progress = await getReciterOfflineProgress(reciterId);
  return progress.downloaded === 114;
}
