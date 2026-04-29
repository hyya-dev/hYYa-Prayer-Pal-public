import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { dbService } from "@/services/db"; // kept as fallback for web blob caching if needed

const SURAH_COUNT = 114;

function buildAudioCachePath(reciterId: number, surahNumber: number): string {
  // Use a dedicated folder in the Documents directory
  return `hYYa_Quran_Audio/reciter_${reciterId}/surah_${surahNumber.toString().padStart(3, '0')}.mp3`;
}

// Fallback for Web/PWA since Filesystem is limited or uses IndexedDB base64 strings
function buildAudioCacheKey(reciterId: number, surahNumber: number): string {
  return `quran-audio:${reciterId}:${surahNumber}`;
}

function readdirEntryName(entry: string | { name: string }): string {
  return typeof entry === 'string' ? entry : entry.name;
}

function fullMissingSurahList(): number[] {
  const missing: number[] = [];
  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    missing.push(surah);
  }
  return missing;
}

type SurahCountResult = { downloaded: number; missing: number[] };

function countSurahMp3sInSet(fileSet: Set<string>): SurahCountResult {
  let downloaded = 0;
  const missing: number[] = [];
  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    const filename = `surah_${surah.toString().padStart(3, '0')}.mp3`;
    if (fileSet.has(filename)) {
      downloaded += 1;
    } else {
      missing.push(surah);
    }
  }
  return { downloaded, missing };
}

export type OfflineSurahPlaybackTarget = "nativeAv" | "webview";

/**
 * On native, returns a URL for offline surah MP3.
 * - `nativeAv`: raw `file://` URI for AVPlayer / Android MediaPlayer (Capacitor bridge URLs often fail here).
 * - `webview`: `convertFileSrc` URL for `Audio()` / `fetch` inside the WebView.
 */
export async function getOfflineSurahNativePlaybackUrl(
  reciterId: number,
  surahNumber: number,
  target: OfflineSurahPlaybackTarget = "webview",
): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }
  try {
    const path = buildAudioCachePath(reciterId, surahNumber);
    const stat = await Filesystem.stat({ path, directory: Directory.Data });
    if (!stat?.uri) return undefined;
    return target === "nativeAv" ? stat.uri : Capacitor.convertFileSrc(stat.uri);
  } catch {
    return undefined;
  }
}

export async function getOfflineSurahAudio(
  reciterId: number,
  surahNumber: number,
): Promise<Blob | undefined> {
  if (Capacitor.isNativePlatform()) {
    try {
      const path = buildAudioCachePath(reciterId, surahNumber);
      const stat = await Filesystem.stat({ path, directory: Directory.Data });
      if (stat) {
        // Instead of reading the whole multi-MB file into RAM as a base64 string,
        // we can fetch it via the URL!
        const url = Capacitor.convertFileSrc(stat.uri);
        const res = await fetch(url);
        return await res.blob();
      }
    } catch {
      return undefined;
    }
  } else {
    // Web fallback
    return dbService.get("audio_cache", buildAudioCacheKey(reciterId, surahNumber));
  }
}

export async function isReciterFullyDownloaded(reciterId: number): Promise<boolean> {
  const progress = await getReciterOfflineProgress(reciterId);
  return progress.downloaded === SURAH_COUNT;
}

// High-performance cache to prevent spamming Filesystem.readdir and generating OS-PLUG-FILE-0008 logs for missing dirs
let parentDirStatus: 'unknown' | 'exists' | 'missing' = 'unknown';

async function ensureParentAudioRootKnown(): Promise<void> {
  if (parentDirStatus !== 'unknown') return;
  try {
    const rootFiles = await Filesystem.readdir({ path: '', directory: Directory.Data });
    const hasParent = rootFiles.files.some((f) => readdirEntryName(f) === 'hYYa_Quran_Audio');
    parentDirStatus = hasParent ? 'exists' : 'missing';
  } catch {
    parentDirStatus = 'missing';
  }
}

async function tryNativeReciterSurahProgress(reciterId: number): Promise<SurahCountResult | null> {
  try {
    if (parentDirStatus === 'missing') {
      throw new Error('Skip spamming native logs');
    }

    await ensureParentAudioRootKnown();

    if (parentDirStatus === 'missing') {
      throw new Error('Skip spamming native logs');
    }

    const parentContents = await Filesystem.readdir({ path: 'hYYa_Quran_Audio', directory: Directory.Data });
    const hasReciter = parentContents.files.some(
      (f) => readdirEntryName(f) === `reciter_${reciterId}`,
    );
    if (!hasReciter) {
      throw new Error('Skip spamming native logs for missing reciter dir');
    }

    const dir = `hYYa_Quran_Audio/reciter_${reciterId}`;
    const { files } = await Filesystem.readdir({ path: dir, directory: Directory.Data });
    const fileSet = new Set(files.map(readdirEntryName));
    return countSurahMp3sInSet(fileSet);
  } catch {
    return null;
  }
}

async function webReciterOfflineProgress(reciterId: number): Promise<SurahCountResult> {
  const keys = await dbService.getAllKeys("audio_cache");
  const keySet = new Set(keys);
  let downloaded = 0;
  const missing: number[] = [];
  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    if (keySet.has(buildAudioCacheKey(reciterId, surah))) {
      downloaded += 1;
    } else {
      missing.push(surah);
    }
  }
  return { downloaded, missing };
}

export async function getReciterOfflineProgress(
  reciterId: number,
): Promise<{ downloaded: number; total: number; missing: number[] }> {
  if (!Capacitor.isNativePlatform()) {
    const w = await webReciterOfflineProgress(reciterId);
    return { downloaded: w.downloaded, total: SURAH_COUNT, missing: w.missing };
  }

  const native = await tryNativeReciterSurahProgress(reciterId);
  if (native) {
    return { downloaded: native.downloaded, total: SURAH_COUNT, missing: native.missing };
  }
  return { downloaded: 0, total: SURAH_COUNT, missing: fullMissingSurahList() };
}

type ReciterDownloadState = {
  downloaded: number;
  total: number;
  fullyDownloaded: boolean;
};

function emptyReciterStateMap(
  reciterIds: number[],
): Record<number, ReciterDownloadState> {
  const result: Record<number, ReciterDownloadState> = {};
  for (const id of reciterIds) {
    result[id] = { downloaded: 0, total: SURAH_COUNT, fullyDownloaded: false };
  }
  return result;
}

async function fillNativeAllReciterStates(
  result: Record<number, ReciterDownloadState>,
  reciterIds: number[],
): Promise<void> {
  await ensureParentAudioRootKnown();
  if (parentDirStatus === 'missing') {
    return;
  }

  let existingReciterDirs: Set<string>;
  try {
    const parentContents = await Filesystem.readdir({ path: 'hYYa_Quran_Audio', directory: Directory.Data });
    existingReciterDirs = new Set(parentContents.files.map(readdirEntryName));
  } catch {
    return;
  }

  const reciterIdsToCheck = reciterIds.filter((id) => existingReciterDirs.has(`reciter_${id}`));

  for (const id of reciterIdsToCheck) {
    try {
      const dir = `hYYa_Quran_Audio/reciter_${id}`;
      const { files } = await Filesystem.readdir({ path: dir, directory: Directory.Data });
      const fileSet = new Set(files.map(readdirEntryName));
      const { downloaded } = countSurahMp3sInSet(fileSet);
      result[id] = {
        downloaded,
        total: SURAH_COUNT,
        fullyDownloaded: downloaded === SURAH_COUNT,
      };
    } catch {
      // Dir listed but unreadable — leave as 0
    }
  }
}

function fillWebAllReciterStates(
  result: Record<number, ReciterDownloadState>,
  reciterIds: number[],
  keySet: Set<string>,
): void {
  for (const id of reciterIds) {
    let downloaded = 0;
    for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
      if (keySet.has(buildAudioCacheKey(id, surah))) {
        downloaded += 1;
      }
    }
    result[id] = {
      downloaded,
      total: SURAH_COUNT,
      fullyDownloaded: downloaded === SURAH_COUNT,
    };
  }
}

/**
 * Batch-reads download state for ALL reciters in a single pass.
 * On native: 1 readdir on parent + 1 readdir per existing reciter dir.
 * On web: 1 getAllKeys call total.
 * This replaces the old pattern of calling getReciterOfflineProgress per-reciter
 * which caused 92+ sequential native bridge calls and froze the UI.
 */
export async function getAllRecitersDownloadState(
  reciterIds: number[],
): Promise<Record<number, ReciterDownloadState>> {
  const result = emptyReciterStateMap(reciterIds);

  if (Capacitor.isNativePlatform()) {
    await fillNativeAllReciterStates(result, reciterIds);
    return result;
  }

  const allKeys = await dbService.getAllKeys("audio_cache");
  const keySet = new Set(allKeys);
  fillWebAllReciterStates(result, reciterIds, keySet);
  return result;
}

export async function clearReciterOfflineAudio(reciterId: number): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const parentDir = `hYYa_Quran_Audio/reciter_${reciterId}`;
      await Filesystem.rmdir({
        path: parentDir,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // Ignore if directory doesn't exist
    }
  } else {
    for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
      await dbService.delete("audio_cache", buildAudioCacheKey(reciterId, surah));
    }
  }
}

async function blobToBase64ForWrite(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/** Native download without deprecated {@link Filesystem.downloadFile}. */
async function fetchAndWriteNativeSurah(
  url: string,
  relativePath: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const base64 = await blobToBase64ForWrite(blob);
  await Filesystem.writeFile({
    path: relativePath,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
}

async function prepareNativeReciterDirAndListMp3s(reciterId: number): Promise<Set<string>> {
  const dir = `hYYa_Quran_Audio/reciter_${reciterId}`;
  try {
    await Filesystem.mkdir({
      path: dir,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Directory may already exist (OS-PLUG-FILE-0010); still try to read it below.
  }
  try {
    parentDirStatus = 'exists';
    const { files } = await Filesystem.readdir({ path: dir, directory: Directory.Data });
    return new Set(files.map(readdirEntryName));
  } catch {
    return new Set();
  }
}

function nativeSurahFilename(surah: number): string {
  return `surah_${surah.toString().padStart(3, '0')}.mp3`;
}

async function shouldSkipSurahDownload(
  reciterId: number,
  surah: number,
  isNative: boolean,
  existingFiles: Set<string>,
): Promise<boolean> {
  if (isNative) {
    return existingFiles.has(nativeSurahFilename(surah));
  }
  try {
    const key = buildAudioCacheKey(reciterId, surah);
    const cached = await dbService.get("audio_cache", key);
    return cached instanceof Blob;
  } catch {
    return false;
  }
}

async function downloadSurahToStorage(
  reciterId: number,
  surah: number,
  isNative: boolean,
  existingFiles: Set<string>,
  resolveUrl: (surahNumber: number) => string,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (isNative) {
    const path = buildAudioCachePath(reciterId, surah);
    try {
      await fetchAndWriteNativeSurah(resolveUrl(surah), path, signal);
    } catch (nativeErr) {
      console.error(`Native download failed for Surah ${surah}:`, nativeErr);
      throw new Error(`Failed natively downloading Surah ${surah} (Native Error)`);
    }
    existingFiles.add(nativeSurahFilename(surah));
    return;
  }

  const response = await fetch(resolveUrl(surah), { signal });
  if (!response.ok) {
    throw new Error(`Failed downloading Surah ${surah} (HTTP ${response.status} ${response.statusText})`);
  }
  const blob = await response.blob();
  await dbService.put("audio_cache", buildAudioCacheKey(reciterId, surah), blob);
}

export async function downloadReciterForOffline(
  reciterId: number,
  resolveUrl: (surahNumber: number) => string,
  options?: {
    onProgress?: (completed: number, total: number, currentSurah: number) => void;
    startSurah?: number;
    signal?: AbortSignal;
  },
): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  const startSurah = Math.min(SURAH_COUNT, Math.max(1, options?.startSurah ?? 1));

  const existingFiles = isNative
    ? await prepareNativeReciterDirAndListMp3s(reciterId)
    : new Set<string>();

  for (let surah = startSurah; surah <= SURAH_COUNT; surah += 1) {
    if (options?.signal?.aborted) {
      throw new DOMException("Download aborted", "AbortError");
    }
    const completed = surah - startSurah + 1;

    if (await shouldSkipSurahDownload(reciterId, surah, isNative, existingFiles)) {
      options?.onProgress?.(surah, SURAH_COUNT, completed);
      continue;
    }

    await downloadSurahToStorage(
      reciterId,
      surah,
      isNative,
      existingFiles,
      resolveUrl,
      options?.signal,
    );
    options?.onProgress?.(surah, SURAH_COUNT, completed);
  }
}
