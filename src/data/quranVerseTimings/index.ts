/**
 * Pre-computed forced-alignment verse timings for bundled reciters.
 *
 * Files live at `./<reciterId>/<surahNumber>.json` and are produced by
 * `scripts/quran-alignment/align.py` against the EXACT MP3s we ship via R2.
 * That guarantees the timings line up with the audio AVPlayer plays — unlike
 * QDC's `verse_timings`, which are computed against a different recording.
 *
 * Files are loaded lazily via `import.meta.glob`, so the initial JS bundle
 * stays small even when all 17 sync-enabled reciters × 114 surahs are
 * present. Each bundle file is only fetched the first time
 * `loadBundledTimings(reciterId, surahNumber)` is called for that pair.
 */
import type { ChapterAudioTimings, VerseTiming } from "@/services/quranAudioService";

/** Format we persist on disk; identical shape to ChapterAudioTimings. */
type BundledTimingsFile = {
  audioUrl: string;
  totalDurationMs: number;
  timings: VerseTiming[];
};

// Vite-only: this glob is statically analysed at build time and produces a
// map of dynamic importers. Files added under this directory are picked up
// automatically the next time `vite build` runs — no manual registration.
const TIMING_LOADERS = import.meta.glob<BundledTimingsFile>(
  "./*/*.json",
  { import: "default" },
) as Record<string, () => Promise<BundledTimingsFile>>;

const PATH_INDEX = new Map<string, () => Promise<BundledTimingsFile>>();
for (const [path, loader] of Object.entries(TIMING_LOADERS)) {
  // path looks like "./5/1.json" → key is "5/1"
  const match = /^\.\/(\d+)\/(\d+)\.json$/.exec(path);
  if (!match) continue;
  PATH_INDEX.set(`${match[1]}/${match[2]}`, loader);
}

const memoryCache = new Map<string, Promise<ChapterAudioTimings | null>>();

function indexKey(reciterId: number, surahNumber: number): string {
  return `${reciterId}/${surahNumber}`;
}

/** True when a bundled alignment exists for the given pair. */
export function hasBundledTimings(reciterId: number, surahNumber: number): boolean {
  return PATH_INDEX.has(indexKey(reciterId, surahNumber));
}

/**
 * Load the bundled alignment for (reciterId, surahNumber).
 * Returns null when no alignment is bundled for that pair (the runtime is
 * expected to fall back to QDC or to the character-weighted approximation).
 */
export function loadBundledTimings(
  reciterId: number,
  surahNumber: number,
): Promise<ChapterAudioTimings | null> {
  const key = indexKey(reciterId, surahNumber);

  const cached = memoryCache.get(key);
  if (cached !== undefined) return cached;

  const loader = PATH_INDEX.get(key);
  if (!loader) {
    const empty = Promise.resolve<ChapterAudioTimings | null>(null);
    memoryCache.set(key, empty);
    return empty;
  }

  const promise = loader()
    .then((file): ChapterAudioTimings | null => {
      if (!file?.timings?.length) return null;
      // Defensive copy + sort, in case a hand-edited bundle is out of order.
      const timings = [...file.timings].sort((a, b) => a.verseNumber - b.verseNumber);
      return {
        audioUrl: file.audioUrl ?? "",
        totalDurationMs: typeof file.totalDurationMs === "number" ? file.totalDurationMs : 0,
        timings,
      };
    })
    .catch(() => null);

  memoryCache.set(key, promise);
  return promise;
}
