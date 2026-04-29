import {
  type QuranAudioTier,
} from "@/lib/quranAudioTier";
import { BUNDLED_RECITERS } from "@/data/bundledReciters";
import { StorageService } from "@/services/StorageService";


const QURANICAUDIO_QARIS_API = "https://quranicaudio.com/api/qaris";
const HY_LIBRARY_ROOT = "https://pub-ec086546d4bd484d9518e7dad253ff6e.r2.dev";

// REPO_MAPPING obsolete. Replaced securely with global Cloudflare R2 Storage Bucket integration.

const QDC_BY_AYAH_API = "https://api.quran.com/api/v4/recitations";
const QDC_AUDIO_HOST = "https://verses.quran.com";
// QDC chapter-level audio_files endpoint that returns per-verse timings (timestamps in ms).
// Returns: { audio_files: [{ duration, audio_url, verse_timings: [{ verse_key, timestamp_from, timestamp_to, ... }] }] }
const QDC_CHAPTER_AUDIO_FILES_API = "https://api.quran.com/api/qdc/audio/reciters";
const CHECK_SURAH_TIMEOUT_MS = 5000;

const SURAH_COUNT = 114;
const COMPLETENESS_CACHE_KEY = "quran_audio_completeness_v1";
const COMPLETENESS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RECITER_SNAPSHOT_KEY = "quran_audio_reciters_snapshot_v1";

type QuranicaudioRawReciter = {
  id: number;
  name: string;
  relative_path: string;
  section_id: number;
};

/**
 * One-way map from OUR reciter id → QDC `/api/v4/resources/recitations` id.
 *
 * Only reciters in `SYNC_ENABLED_RECITER_IDS` appear here. Every entry is
 * verified against QDC's live catalog so that:
 *   1. We always pick the correct STYLE (Murattal vs Mujawwad), which the
 *      old fuzzy `normalizeName` resolver could not do (e.g. it would map
 *      both AbdulBaset Murattal and Mujawwad to whichever QDC entry
 *      happened to come back first).
 *   2. We don't depend on a network round-trip to `/recitations` at runtime.
 *
 * If we add a reciter to `SYNC_ENABLED_RECITER_IDS`, we MUST add an entry
 * here too — otherwise the runtime will silently fall back to no timings.
 */
const QDC_RECITATION_ID_BY_OUR_ID: Readonly<Record<number, number>> = {
  3: 4,    // Abu Bakr al-Shatri
  4: 10,   // Sa`ud ash-Shuraym
  5: 7,    // Mishari Rashid al-`Afasy
  6: 9,    // Mohamed (=Muhammad) Siddiq al-Minshawi — Murattal
  7: 3,    // Abdur-Rahman as-Sudais
  16: 6,   // Mahmoud Khalil (=Khaleel) Al-Husary
  27: 5,   // Hani ar-Rifai
  37: 2,   // AbdulBaset AbdulSamad — Murattal
  41: 8,   // Mohamed Siddiq al-Minshawi — Mujawwad
  50: 1,   // AbdulBaset AbdulSamad — Mujawwad
};

export type QuranAudioReciter = {
  id: number;
  name: string;
  relativePath: string;
  sectionId: number;
  tier: QuranAudioTier;
  hasSync: boolean;
  languages: string[];
};

export type ReciterCompletenessStatus = {
  complete: boolean;
  missingSurah?: number;
  checkedAt: number;
};

function getCompletenessCache(): Record<string, ReciterCompletenessStatus> {
  try {
    const raw = StorageService.getItem(COMPLETENESS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReciterCompletenessStatus>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function setCompletenessCache(cache: Record<string, ReciterCompletenessStatus>): void {
  try {
    StorageService.setItem(COMPLETENESS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures.
  }
}

function getCacheKey(reciterId: number): string {
  return `reciter:${reciterId}`;
}

function normalizeRelativePath(relativePath: string): string {
  const cleaned = (relativePath || "").replace(/^\/+/, "");
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function padSurah(surahNumber: number): string {
  return String(surahNumber).padStart(3, "0");
}

async function checkSingleSurahUrl(url: string): Promise<boolean> {
  const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(CHECK_SURAH_TIMEOUT_MS)
    : undefined;

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: timeoutSignal,
    });
    if (headResponse.ok) return true;
  } catch {
    // HEAD may fail due to server or proxy limitations.
  }

  try {
    const rangeResponse = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      cache: "no-store",
      signal: timeoutSignal,
    });
    return rangeResponse.ok;
  } catch {
    return false;
  }
}

export function buildQuranicaudioSurahUrl(reciterId: number, relativePath: string, surahNumber: number): string {
  // STRICT REQUIREMENT: No fallbacks to public CDNs.
  // We only serve audio that we have archived in our own Cloudflare R2 object storage.
  const isSupported = BUNDLED_RECITERS.some(r => r.id === reciterId);
  if (!isSupported) {
    console.error(`ERROR: Reciter ID ${reciterId} is not in hYYa Public Library mapping.`);
    return "";
  }

  return `${HY_LIBRARY_ROOT}/${normalizeRelativePath(relativePath)}${padSurah(surahNumber)}.mp3`;
}


export async function fetchQuranAudioReciters(): Promise<QuranAudioReciter[]> {
  // STRICT REQUIREMENT: No fallbacks to public CDNs.
  // We completely bypass quranicaudio.com's remote /api/qaris endpoint to prevent
  // their external payload from overwriting our standardized Cloudflare R2 paths and custom names.
  const sorted = [...BUNDLED_RECITERS].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "tier1" ? -1 : 1;
    if (a.hasSync !== b.hasSync) return a.hasSync ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  setCachedRecitersSnapshot(sorted);
  return sorted;
}

/**
 * Returns the bundled reciter list immediately (no network needed).
 * Used as the initial state so the Audio Library subpage is never blank.
 */
export function getBundledReciters(): QuranAudioReciter[] {
  return BUNDLED_RECITERS;
}

export function getCachedRecitersSnapshot(): { reciters: QuranAudioReciter[]; cachedAt: number } | null {
  try {
    const raw = StorageService.getItem(RECITER_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reciters?: QuranAudioReciter[]; cachedAt?: number };
    if (!Array.isArray(parsed?.reciters) || typeof parsed?.cachedAt !== "number") {
      return null;
    }
    return {
      reciters: parsed.reciters,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

export function setCachedRecitersSnapshot(reciters: QuranAudioReciter[]): void {
  try {
    StorageService.setItem(
      RECITER_SNAPSHOT_KEY,
      JSON.stringify({ reciters, cachedAt: Date.now() }),
    );
  } catch {
    // Ignore persistence errors.
  }
}

export function getCachedCompletenessStatus(reciterId: number): ReciterCompletenessStatus | null {
  const cache = getCompletenessCache();
  const status = cache[getCacheKey(reciterId)];
  if (!status) return null;
  if (Date.now() - status.checkedAt > COMPLETENESS_CACHE_TTL_MS) return null;
  return status;
}

export async function validateReciterCompleteness(
  reciter: Pick<QuranAudioReciter, "id" | "relativePath">,
  onProgress?: (checked: number, total: number) => void,
): Promise<ReciterCompletenessStatus> {
  const cached = getCachedCompletenessStatus(reciter.id);
  if (cached) {
    onProgress?.(SURAH_COUNT, SURAH_COUNT);
    return cached;
  }

  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    const surahUrl = buildQuranicaudioSurahUrl(reciter.id, reciter.relativePath, surah);
    if (!surahUrl) {
      throw new Error(`Reciter ID ${reciter.id} is unmapped or has an invalid URL configuration.`);
    }
    const ok = await checkSingleSurahUrl(surahUrl);
    onProgress?.(surah, SURAH_COUNT);

    if (!ok) {
      const missing: ReciterCompletenessStatus = {
        complete: false,
        missingSurah: surah,
        checkedAt: Date.now(),
      };
      const cache = getCompletenessCache();
      cache[getCacheKey(reciter.id)] = missing;
      setCompletenessCache(cache);
      return missing;
    }
  }

  const complete: ReciterCompletenessStatus = {
    complete: true,
    checkedAt: Date.now(),
  };
  const cache = getCompletenessCache();
  cache[getCacheKey(reciter.id)] = complete;
  setCompletenessCache(cache);
  return complete;
}

/**
 * Returns the QDC recitation id for one of OUR reciters, or `null` if the
 * reciter is not in the curated sync list (and therefore has no precise
 * timings — playback works, highlighting falls through to nothing).
 *
 * This is intentionally synchronous: every supported pairing is hardcoded
 * in `QDC_RECITATION_ID_BY_OUR_ID` so we don't need a runtime API call,
 * and so style ambiguity (Murattal vs Mujawwad) cannot cause a wrong-style
 * resolution at runtime.
 */
export function resolveQdcRecitationId(reciterId: number): number | null {
  return QDC_RECITATION_ID_BY_OUR_ID[reciterId] ?? null;
}

type QdcAudioFile = { verse_key: string; url: string };

function toAbsoluteQdcUrl(relativeUrl: string): string {
  return `${QDC_AUDIO_HOST}/${relativeUrl.replace(/^\/+/, "")}`;
}

export async function getVerseAudioUrl(
  qdcRecitationId: number,
  surahNumber: number,
  verseNumber: number,
): Promise<string | null> {
  const response = await fetch(
    `${QDC_BY_AYAH_API}/${qdcRecitationId}/by_ayah/${surahNumber}:${verseNumber}`,
    { cache: "no-store" },
  );

  if (!response.ok) return null;
  const payload = (await response.json()) as { audio_files?: QdcAudioFile[] };
  const first = payload.audio_files?.[0];
  if (!first?.url) return null;
  return toAbsoluteQdcUrl(first.url);
}

/**
 * Per-verse timing pulled from QDC's `audio_files?segments=true` endpoint.
 * `timestampFromMs` / `timestampToMs` are milliseconds from the START of the FULL surah audio file.
 */
export type VerseTiming = {
  verseNumber: number;
  timestampFromMs: number;
  timestampToMs: number;
};

export type ChapterAudioTimings = {
  /** Full surah audio URL the timings refer to (so callers can stream it if needed). */
  audioUrl: string;
  /** Total surah audio duration in milliseconds (from QDC; may be 0 if unavailable). */
  totalDurationMs: number;
  /** Sorted (ascending verseNumber) per-verse timings. */
  timings: VerseTiming[];
};

const verseTimingsMemoryCache = new Map<string, Promise<ChapterAudioTimings | null>>();

function verseTimingsCacheKey(qdcRecitationId: number, surahNumber: number): string {
  return `qdc_verse_timings_v1:${qdcRecitationId}:${surahNumber}`;
}

function readVerseTimingsFromStorage(key: string): ChapterAudioTimings | null {
  try {
    const raw = StorageService.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChapterAudioTimings;
    if (!parsed?.timings?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeVerseTimingsToStorage(key: string, value: ChapterAudioTimings): void {
  try {
    StorageService.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors — memory cache still wins for the session.
  }
}

/**
 * Fetch per-verse timings for a given (reciter, surah). Cached per session
 * in memory and persisted via StorageService so we never refetch the same
 * (reciter, surah) twice. Returns null when QDC has no segment data.
 */
export async function fetchChapterVerseTimings(
  qdcRecitationId: number,
  surahNumber: number,
): Promise<ChapterAudioTimings | null> {
  const key = verseTimingsCacheKey(qdcRecitationId, surahNumber);

  const inflight = verseTimingsMemoryCache.get(key);
  if (inflight) return inflight;

  const persisted = readVerseTimingsFromStorage(key);
  if (persisted) {
    verseTimingsMemoryCache.set(key, Promise.resolve(persisted));
    return persisted;
  }

  const promise = (async (): Promise<ChapterAudioTimings | null> => {
    try {
      const response = await fetch(
        `${QDC_CHAPTER_AUDIO_FILES_API}/${qdcRecitationId}/audio_files?chapter=${surahNumber}&segments=true`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        audio_files?: Array<{
          audio_url?: string;
          duration?: number;
          verse_timings?: Array<{
            verse_key?: string;
            timestamp_from?: number;
            timestamp_to?: number;
          }>;
        }>;
      };

      const file = payload.audio_files?.[0];
      const rawTimings = file?.verse_timings ?? [];

      const timings: VerseTiming[] = [];
      for (const entry of rawTimings) {
        const verseKey = entry.verse_key ?? "";
        const [, versePart] = verseKey.split(":");
        const verseNumber = Number(versePart);
        const from = Number(entry.timestamp_from);
        const to = Number(entry.timestamp_to);
        if (!Number.isFinite(verseNumber) || !Number.isFinite(from) || !Number.isFinite(to)) continue;
        timings.push({ verseNumber, timestampFromMs: from, timestampToMs: to });
      }

      if (timings.length === 0) return null;
      timings.sort((a, b) => a.verseNumber - b.verseNumber);

      const result: ChapterAudioTimings = {
        audioUrl: file?.audio_url ?? "",
        totalDurationMs: typeof file?.duration === "number" ? file.duration : 0,
        timings,
      };

      writeVerseTimingsToStorage(key, result);
      return result;
    } catch {
      // Drop the cached failure so a later online retry can succeed.
      verseTimingsMemoryCache.delete(key);
      return null;
    }
  })();

  verseTimingsMemoryCache.set(key, promise);
  return promise;
}

/**
 * Look up the verse currently being recited at `playbackTimeMs`
 * (millisecond offset into the FULL surah file).
 * Returns the highest-numbered verse whose `timestampFromMs <= playbackTimeMs`.
 */
export function findActiveVerseFromTimings(
  timings: VerseTiming[],
  playbackTimeMs: number,
): number | null {
  if (timings.length === 0) return null;
  let active: number | null = null;
  for (const entry of timings) {
    if (playbackTimeMs >= entry.timestampFromMs && playbackTimeMs < entry.timestampToMs) {
      return entry.verseNumber;
    }
    if (playbackTimeMs >= entry.timestampFromMs) {
      active = entry.verseNumber;
    }
  }
  return active;
}

export async function getChapterAudioUrlsFromVerse(
  qdcRecitationId: number,
  surahNumber: number,
  startVerseNumber: number,
): Promise<string[]> {
  const response = await fetch(
    `${QDC_BY_AYAH_API}/${qdcRecitationId}/by_chapter/${surahNumber}?per_page=300`,
    { cache: "no-store" },
  );

  if (!response.ok) return [];
  const payload = (await response.json()) as { audio_files?: QdcAudioFile[] };
  const files = Array.isArray(payload.audio_files) ? payload.audio_files : [];

  return files
    .filter((item) => {
      const verseKey = item.verse_key || "";
      const [, versePart] = verseKey.split(":");
      const verse = Number(versePart);
      return Number.isFinite(verse) && verse >= startVerseNumber;
    })
    .map((item) => toAbsoluteQdcUrl(item.url));
}
