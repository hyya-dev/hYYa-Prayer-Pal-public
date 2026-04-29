import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { type TFunction } from "i18next";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  fetchQuranAudioReciters,
  getBundledReciters,
  type QuranAudioReciter,
  resolveQdcRecitationId,
  getVerseAudioUrl,
  fetchChapterVerseTimings,
  findActiveVerseFromTimings,
  type ChapterAudioTimings,
} from "@/services/quranAudioService";
import { SYNC_ENABLED_RECITER_IDS } from "@/lib/quranAudioTier";
import { sortRecitersByFirstName } from "@/lib/quranReciterSort";
import { getOfflineSurahAudio, getOfflineSurahNativePlaybackUrl } from "@/services/quranAudioOfflineService";
import { QuranReaderNativeAudio } from "@/plugins/quranReaderNativeAudio";
import { hasOffline114Surahs } from "@/lib/quranReaderAudioEligibility";
import { clearQuranReaderNowPlaying, setQuranReaderNowPlaying } from "@/services/quranReaderMediaSession";
import { logQuranReaderAudio } from "@/lib/quranReaderTelemetry";
import { getVerseCountForSurah } from "@/lib/quranSurahVerseCounts";
import { hasBundledTimings, loadBundledTimings } from "@/data/quranVerseTimings";

export type VerseAudioScope = "verse-only" | "from-verse" | "full-surah";
export type QuranAudioUiPrompt = "go_online" | "go_library" | null;

const MISHARI_RECITER_ID = 5;

export type ReaderAudioSession = {
  surahNumber: number;
  verseNumber: number;
};

interface UseQuranAudioProps {
  t: TFunction;
  selectedVerseAction: {
    surahNumber: number;
    verseNumber: number;
    verseText: string;
  } | null;
  /** Ayah count for the open surah (offline seek within surah MP3). */
  surahVerseCount: number;
  /** Settings UI language — status lines in the reader modal follow UI copy direction. */
  uiLanguage: string;
  /** Curated translations language — used for lockscreen / mini-player Surah titles. */
  displayLanguage?: string;
  /** Optional surah metadata map for resolving localized surah names. */
  surahNameByNumber?: (surahNumber: number) => string | null;
}

function getMishariReciter(): QuranAudioReciter | null {
  return getBundledReciters().find((r) => r.id === MISHARI_RECITER_ID) ?? null;
}

function waitForEndedOrAbort(
  audio: HTMLAudioElement,
  nonceAtStart: number,
  playbackNonceRef: MutableRefObject<number>,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearInterval(poll);
      audio.onended = null;
      resolve();
    };

    const poll = globalThis.setInterval(() => {
      if (playbackNonceRef.current !== nonceAtStart) {
        finish();
      }
    }, 120);

    audio.onended = () => finish();
  });
}

type NowPlayingMeta = { title: string; artist?: string };

type PlayUrlQueueOpts = {
  firstFileStartFraction?: number;
  nowPlaying?: NowPlayingMeta;
  /** Per-surah lockscreen metadata for multi-surah queues. */
  nowPlayingForSurah?: (surahNumber: number) => NowPlayingMeta;
  /** Parallel to `urls`: which surah each clip belongs to (native lock-screen navigation). */
  surahNumbers?: number[];
  remoteSurahCommands?: boolean;
};

type ActiveQuranReaderPlayback = {
  scope: VerseAudioScope;
  reciterId: number;
  reciterName: string;
  anchorSurahNumber: number;
  anchorVerseNumber: number;
  anchorVerseCount: number;
  currentSurah: number;
};

function verseFromLinearProgress(currentTime: number, duration: number, verseCount: number): number {
  if (verseCount < 1) return 1;
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const t = Math.min(Math.max(0, currentTime), duration);
  const idx = Math.floor((t / duration) * verseCount) + 1;
  return Math.min(verseCount, Math.max(1, idx));
}

/** Maps file position to ayah using linear subdivision (best-effort without per-ayah timestamps). */
function computeHighlightVerseFromPlayback(
  currentTime: number,
  duration: number,
  ctx: ActiveQuranReaderPlayback | null,
  session: ReaderAudioSession,
  fallbackVerseCount: number,
): number {
  if (!ctx) {
    return session.verseNumber;
  }

  const surah = ctx.currentSurah;
  const verseCount =
    surah === ctx.anchorSurahNumber ? ctx.anchorVerseCount : getVerseCountForSurah(surah);

  if (ctx.scope === "verse-only") {
    return ctx.anchorVerseNumber;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return ctx.scope === "full-surah" ? 1 : ctx.anchorVerseNumber;
  }

  const t = Math.min(Math.max(0, currentTime), duration);

  if (ctx.scope === "full-surah") {
    return verseFromLinearProgress(t, duration, verseCount);
  }

  if (surah === ctx.anchorSurahNumber) {
    const f = Math.min(
      1,
      Math.max(0, ((ctx.anchorVerseNumber - 1) / Math.max(1, ctx.anchorVerseCount)) * 0.92),
    );
    const startT = f * duration;
    const span = Math.max(duration - startT, 1e-6);
    const rel = Math.min(1, Math.max(0, (t - startT) / span));
    const remaining = verseCount - ctx.anchorVerseNumber + 1;
    const off = Math.floor(rel * remaining);
    return Math.min(verseCount, Math.max(ctx.anchorVerseNumber, ctx.anchorVerseNumber + off));
  }

  return verseFromLinearProgress(t, duration, verseCount);
}

function computeRemoteSurahStepStartFraction(
  ctx: ActiveQuranReaderPlayback,
  nextSurah: number,
): number | undefined {
  if (ctx.scope !== "from-verse" || nextSurah !== ctx.anchorSurahNumber) {
    return undefined;
  }
  const verseFrac = (ctx.anchorVerseNumber - 1) / Math.max(1, ctx.anchorVerseCount);
  return Math.min(1, Math.max(0, verseFrac * 0.92));
}

function buildRemoteSurahStepNowPlaying(
  ctx: ActiveQuranReaderPlayback,
  nextSurah: number,
  formatSurahTitle: (surahNumber: number, verseNumber?: number) => string,
): NowPlayingMeta {
  if (ctx.scope === "verse-only") {
    return { title: formatSurahTitle(nextSurah, 1), artist: ctx.reciterName };
  }
  return { title: formatSurahTitle(nextSurah), artist: ctx.reciterName };
}

function setRemoteSurahStepStatusLine(
  scope: VerseAudioScope,
  t: TFunction,
  uiLanguage: string,
  setAudioStatusMessage: (msg: string) => void,
): void {
  if (scope === "full-surah") {
    setAudioStatusMessage(
      t("quran.playingOfflineSurah", { lng: uiLanguage }),
    );
    return;
  }
  if (scope === "verse-only") {
    setAudioStatusMessage(t("quran.playingSelectedVerse", { lng: uiLanguage }));
    return;
  }
  setAudioStatusMessage(
    t("quran.playingFromSelectedVerse", {
      lng: uiLanguage,
    }),
  );
}

type SelectedVerseActionState = {
  surahNumber: number;
  verseNumber: number;
  verseText: string;
};

type PlayUrlQueueCtx = Readonly<{
  playbackNonceRef: MutableRefObject<number>;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  setAudioIsPlaying: (v: boolean) => void;
  endPlaybackLocally: () => void;
  setAudioStatusMessage: (msg: string) => void;
  t: TFunction;
  uiLanguage: string;
  stopAudioPlayback: () => void;
  onPlaybackTick?: (currentTime: number, duration: number) => void;
  /**
   * Called immediately before each clip in `surahNumbers` is played, with that
   * clip's surah number. Used to refresh QDC verse_timings for the new surah
   * so highlight tracking stays precise across multi-surah from-verse queues.
   */
  onSurahTransition?: (surahNumber: number) => void | Promise<void>;
}>;

/** Runs one clip in the native queue. Returns false when the session was cancelled. */
async function playOneClipInNativeQueue(
  ctx: PlayUrlQueueCtx,
  url: string,
  index: number,
  sessionNonce: number,
  opts: PlayUrlQueueOpts | undefined,
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>,
): Promise<boolean> {
  ctx.setAudioIsPlaying(true);
  const trackSurah = opts?.surahNumbers?.[index];
  const nowPlayingForClip =
    typeof trackSurah === "number"
      ? (opts?.nowPlayingForSurah?.(trackSurah) ?? opts?.nowPlaying)
      : opts?.nowPlaying;
  if (typeof trackSurah === "number") {
    if (activeReaderPlaybackRef.current) {
      activeReaderPlaybackRef.current = {
        ...activeReaderPlaybackRef.current,
        currentSurah: trackSurah,
      };
    }
    await ctx.onSurahTransition?.(trackSurah);
    if (ctx.playbackNonceRef.current !== sessionNonce) return false;
  }
  const startFraction = index === 0 ? opts?.firstFileStartFraction : undefined;
  await playNativeOneClip({
    url,
    startFraction,
    sessionNonce,
    playbackNonceRef: ctx.playbackNonceRef,
    nowPlaying: nowPlayingForClip,
    t: ctx.t,
    onSystemAbort: ctx.stopAudioPlayback,
    remoteSurahCommands: opts?.remoteSurahCommands ?? false,
    onPlaybackTick: ctx.onPlaybackTick,
  });
  return ctx.playbackNonceRef.current === sessionNonce;
}

async function runPlayUrlQueueNative(
  ctx: PlayUrlQueueCtx,
  urls: string[],
  sessionNonce: number,
  opts: PlayUrlQueueOpts | undefined,
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>,
): Promise<void> {
  for (let i = 0; i < urls.length; i += 1) {
    if (ctx.playbackNonceRef.current !== sessionNonce) return;
    const url = urls[i];
    if (url === undefined) continue;
    const ok = await playOneClipInNativeQueue(ctx, url, i, sessionNonce, opts, activeReaderPlaybackRef);
    if (!ok) return;
  }
  if (ctx.playbackNonceRef.current === sessionNonce) {
    ctx.endPlaybackLocally();
    ctx.setAudioStatusMessage(
      ctx.t("quran.playbackComplete", { lng: ctx.uiLanguage }),
    );
  }
}

/** Loads the next URL into the shared <audio> and (on first clip) seeks to the requested startFraction. */
function loadAudioSrcAwaitingMetadata(
  audio: HTMLAudioElement,
  url: string,
  isFirst: boolean,
  opts: PlayUrlQueueOpts | undefined,
  errorMessage: string,
): Promise<void> {
  audio.src = url;
  return new Promise<void>((resolve, reject) => {
    const onMeta = () => {
      if (
        isFirst &&
        opts?.firstFileStartFraction != null &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        const frac = Math.min(1, Math.max(0, opts.firstFileStartFraction));
        audio.currentTime = Math.min(
          Math.max(0, frac * audio.duration),
          Math.max(0, audio.duration - 0.25),
        );
      }
      audio.removeEventListener("loadedmetadata", onMeta);
      resolve();
    };
    const onErr = () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      reject(new Error(errorMessage));
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("error", onErr, { once: true });
  });
}

/** Plays one clip on the web <audio> element. Returns false when the session was cancelled. */
async function playOneClipInWebQueue(
  ctx: PlayUrlQueueCtx,
  audio: HTMLAudioElement,
  url: string,
  index: number,
  isFirst: boolean,
  sessionNonce: number,
  opts: PlayUrlQueueOpts | undefined,
): Promise<boolean> {
  const trackSurah = opts?.surahNumbers?.[index];
  if (typeof trackSurah === "number") {
    await ctx.onSurahTransition?.(trackSurah);
    if (ctx.playbackNonceRef.current !== sessionNonce) return false;
  }

  if (opts?.nowPlaying) {
    const meta =
      typeof trackSurah === "number"
        ? (opts.nowPlayingForSurah?.(trackSurah) ?? opts.nowPlaying)
        : opts.nowPlaying;
    setQuranReaderNowPlaying({
      title: meta.title,
      artist: meta.artist ?? "",
    });
  }

  await loadAudioSrcAwaitingMetadata(
    audio,
    url,
    isFirst,
    opts,
    ctx.t("quran.unableToPlayAudio"),
  );

  if (ctx.playbackNonceRef.current !== sessionNonce) return false;

  try {
    await audio.play();
  } catch {
    throw new Error(ctx.t("quran.unableToPlayAudio"));
  }

  ctx.setAudioIsPlaying(true);

  const onTick = () => {
    if (ctx.playbackNonceRef.current !== sessionNonce) return;
    ctx.onPlaybackTick?.(audio.currentTime, audio.duration);
  };
  audio.addEventListener("timeupdate", onTick);
  onTick();

  try {
    await waitForEndedOrAbort(audio, sessionNonce, ctx.playbackNonceRef);
  } finally {
    audio.removeEventListener("timeupdate", onTick);
  }

  return ctx.playbackNonceRef.current === sessionNonce;
}

async function runPlayUrlQueueWeb(
  ctx: PlayUrlQueueCtx,
  urls: string[],
  sessionNonce: number,
  opts?: PlayUrlQueueOpts,
): Promise<void> {
  const audio = ctx.audioRef.current ?? new Audio();
  ctx.audioRef.current = audio;

  let isFirst = true;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    if (url === undefined) continue;
    if (ctx.playbackNonceRef.current !== sessionNonce) return;

    const ok = await playOneClipInWebQueue(ctx, audio, url, i, isFirst, sessionNonce, opts);
    isFirst = false;
    if (!ok) return;
  }

  if (ctx.playbackNonceRef.current === sessionNonce) {
    ctx.endPlaybackLocally();
    ctx.setAudioStatusMessage(
      ctx.t("quran.playbackComplete", { lng: ctx.uiLanguage }),
    );
  }
}

type ReaderOfflineSurahDeps = Readonly<{
  t: TFunction;
  uiLanguage: string;
  selectedVerseAction: SelectedVerseActionState;
  startFraction: number;
  sessionNonce: number;
  audioScope: VerseAudioScope;
  hasCompliantOffline: boolean;
  reciter: QuranAudioReciter | null;
  setAudioUiPrompt: (p: QuranAudioUiPrompt) => void;
  setAudioStatusMessage: (m: string) => void;
  setAudioError: (m: string) => void;
  setReaderAudioSession: Dispatch<SetStateAction<ReaderAudioSession | null>>;
  playbackNonceRef: MutableRefObject<number>;
  playUrlQueue: (
    urls: string[],
    opts?: PlayUrlQueueOpts,
    onSurahTransition?: (surahNumber: number) => void | Promise<void>,
  ) => Promise<void>;
  resolveOfflineSurahPlaybackUrl: (reciterId: number, surahNumber: number) => Promise<string>;
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>;
  anchorVerseCount: number;
  /** QDC timings already fetched for the START surah; used for precise start position. */
  initialTimings: ChapterAudioTimings | null;
  /** Refetches QDC timings for surah S; awaited between clips during multi-surah queues. */
  prepareTimingsForSurah: (reciter: QuranAudioReciter, surahNumber: number) => Promise<ChapterAudioTimings | null>;
  /** Localizes "Al-Fatihah", "البقرة", etc. for the lockscreen title; falls back to "Surah N". */
  formatSurahTitle: (surahNumber: number, verseNumber?: number) => string;
}>;

/**
 * Returns the precise fraction (0..0.999) at which to start playback of the
 * full surah audio so we land at `verseNumber`'s exact begin. Falls back to a
 * conservative linear approximation when timings are missing.
 */
function computePreciseStartFraction(
  timings: ChapterAudioTimings | null,
  verseNumber: number,
  fallbackLinearFraction: number,
): number {
  if (timings && timings.totalDurationMs > 0) {
    const target = timings.timings.find((entry) => entry.verseNumber === verseNumber);
    if (target) {
      // Subtract a tiny fudge so we don't accidentally start past the verse boundary
      // due to encoder rounding; clamp to [0, ~1).
      const raw = (target.timestampFromMs - 30) / timings.totalDurationMs;
      return Math.min(0.999, Math.max(0, raw));
    }
  }
  return fallbackLinearFraction;
}

async function runOfflineSurahScopesIfNeeded(deps: ReaderOfflineSurahDeps): Promise<boolean> {
  if (deps.audioScope !== "full-surah" && deps.audioScope !== "from-verse") {
    return false;
  }

  if (!deps.hasCompliantOffline || !deps.reciter) {
    logQuranReaderAudio("reader_audio_prompt", { reason: "library", scope: deps.audioScope });
    deps.setAudioUiPrompt("go_library");
    deps.setAudioStatusMessage(
      deps.t("quran.audioOpenLibraryBody", {
        lng: deps.uiLanguage,
      }),
    );
    return true;
  }

  const reciter = deps.reciter;
  // Only refetch timings for surahs that are NOT the initial one (already fetched).
  const onSurahTransition = async (surahNumber: number) => {
    if (surahNumber === deps.selectedVerseAction.surahNumber) return;
    await deps.prepareTimingsForSurah(reciter, surahNumber);
  };

  if (deps.audioScope === "full-surah") {
    logQuranReaderAudio("reader_audio_branch", { scope: "full-surah", offline: true });
    const url = await deps.resolveOfflineSurahPlaybackUrl(
      reciter.id,
      deps.selectedVerseAction.surahNumber,
    );
    deps.setReaderAudioSession({
      surahNumber: deps.selectedVerseAction.surahNumber,
      verseNumber: 1,
    });
    deps.activeReaderPlaybackRef.current = {
      scope: deps.audioScope,
      reciterId: reciter.id,
      reciterName: reciter.name,
      anchorSurahNumber: deps.selectedVerseAction.surahNumber,
      anchorVerseNumber: deps.selectedVerseAction.verseNumber,
      anchorVerseCount: deps.anchorVerseCount,
      currentSurah: deps.selectedVerseAction.surahNumber,
    };
  await deps.playUrlQueue(
    [url],
    {
      nowPlaying: {
        title: deps.formatSurahTitle(deps.selectedVerseAction.surahNumber),
        artist: reciter.name,
      },
      nowPlayingForSurah: (s) => ({ title: deps.formatSurahTitle(s), artist: reciter.name }),
      surahNumbers: [deps.selectedVerseAction.surahNumber],
      // Quran Reader lockscreen: do not expose next/previous-surah controls.
      // Reader requires Play/Pause + Rewind only (Forward disabled on iOS).
      remoteSurahCommands: false,
    },
    onSurahTransition,
  );
  if (deps.playbackNonceRef.current === deps.sessionNonce) {
    deps.setAudioStatusMessage(
      deps.t("quran.playingOfflineSurah", { lng: deps.uiLanguage }),
    );
  }
  return true;
  }

  if (!deps.initialTimings) {
    deps.setAudioError(
      deps.t(
        "quran.audioVerseTimingsMissing",
        "Verse-accurate timings for this surah are not in this app build yet. Use Full Surah for now, or update after timings are generated for every surah.",
        { lng: deps.uiLanguage },
      ),
    );
    return true;
  }

  logQuranReaderAudio("reader_audio_branch", { scope: "from-verse", offline: true });
  const urls: string[] = [];
  const surahNumbers: number[] = [];
  for (let s = deps.selectedVerseAction.surahNumber; s <= 114; s += 1) {
    urls.push(await deps.resolveOfflineSurahPlaybackUrl(reciter.id, s));
    surahNumbers.push(s);
  }
  deps.setReaderAudioSession({
    surahNumber: deps.selectedVerseAction.surahNumber,
    verseNumber: deps.selectedVerseAction.verseNumber,
  });
  deps.activeReaderPlaybackRef.current = {
    scope: deps.audioScope,
    reciterId: reciter.id,
    reciterName: reciter.name,
    anchorSurahNumber: deps.selectedVerseAction.surahNumber,
    anchorVerseNumber: deps.selectedVerseAction.verseNumber,
    anchorVerseCount: deps.anchorVerseCount,
    currentSurah: deps.selectedVerseAction.surahNumber,
  };
  // Use precise verse-start position when QDC timings are available; fall back
  // to the linear approximation otherwise.
  const preciseFromFraction = computePreciseStartFraction(
    deps.initialTimings,
    deps.selectedVerseAction.verseNumber,
    deps.startFraction,
  );
  await deps.playUrlQueue(
    urls,
    {
      firstFileStartFraction: preciseFromFraction,
      nowPlaying: {
        title: deps.formatSurahTitle(deps.selectedVerseAction.surahNumber),
        artist: reciter.name,
      },
      nowPlayingForSurah: (s) => ({ title: deps.formatSurahTitle(s), artist: reciter.name }),
      surahNumbers,
      // Quran Reader lockscreen: do not expose next/previous-surah controls.
      remoteSurahCommands: false,
    },
    onSurahTransition,
  );
  if (deps.playbackNonceRef.current === deps.sessionNonce) {
    deps.setAudioStatusMessage(
      deps.t("quran.playingFromSelectedVerse", { lng: deps.uiLanguage }),
    );
  }
  return true;
}

type VerseOnlyOfflineDeps = Readonly<{
  selectedVerseAction: SelectedVerseActionState;
  sessionNonce: number;
  playbackNonceRef: MutableRefObject<number>;
  playUrlQueue: (
    urls: string[],
    opts?: PlayUrlQueueOpts,
    onSurahTransition?: (surahNumber: number) => void | Promise<void>,
  ) => Promise<void>;
  setReaderAudioSession: Dispatch<SetStateAction<ReaderAudioSession | null>>;
  setAudioStatusMessage: (m: string) => void;
  t: TFunction;
  uiLanguage: string;
  reciter: QuranAudioReciter;
  resolveOfflineSurahPlaybackUrl: (reciterId: number, surahNumber: number) => Promise<string>;
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>;
  anchorVerseCount: number;
  /** QDC timings for the verse's surah; required to enable verse-end auto-stop. */
  initialTimings: ChapterAudioTimings | null;
  /** Setter for the JS-side auto-stop watchdog (timestamp_to in ms, or null to disable). */
  setVerseAutoStopMs: (ms: number | null) => void;
  formatSurahTitle: (surahNumber: number, verseNumber?: number) => string;
}>;

/**
 * Plays a single verse from the user's offline 114-set, jumping to the verse's
 * exact start (QDC verse_timings) and arming a JS watchdog that stops the audio
 * the moment we cross the verse's `timestamp_to`.
 *
 * Returns false (without starting playback) when QDC timings aren't available
 * for this (reciter, surah) so the caller can fall back to online streaming.
 */
async function tryVerseOnlyOfflinePlayback(deps: VerseOnlyOfflineDeps): Promise<boolean> {
  const target = deps.initialTimings?.timings.find(
    (entry) => entry.verseNumber === deps.selectedVerseAction.verseNumber,
  );
  if (!deps.initialTimings || !target || deps.initialTimings.totalDurationMs <= 0) {
    // No precise timings → we can't stop at the verse boundary, so let the caller
    // fall through to online verse streaming (which is single-ayah and self-stopping).
    return false;
  }

  try {
    logQuranReaderAudio("reader_audio_branch", { scope: "verse-only", offline: true });
    const url = await deps.resolveOfflineSurahPlaybackUrl(
      deps.reciter.id,
      deps.selectedVerseAction.surahNumber,
    );

    const startFraction = Math.min(
      0.999,
      Math.max(0, (target.timestampFromMs - 30) / deps.initialTimings.totalDurationMs),
    );

    deps.setReaderAudioSession({
      surahNumber: deps.selectedVerseAction.surahNumber,
      verseNumber: deps.selectedVerseAction.verseNumber,
    });
    deps.activeReaderPlaybackRef.current = {
      scope: "verse-only",
      reciterId: deps.reciter.id,
      reciterName: deps.reciter.name,
      anchorSurahNumber: deps.selectedVerseAction.surahNumber,
      anchorVerseNumber: deps.selectedVerseAction.verseNumber,
      anchorVerseCount: deps.anchorVerseCount,
      currentSurah: deps.selectedVerseAction.surahNumber,
    };

    // Arm the verse-end watchdog BEFORE play begins so the playbackTick handler
    // can stop the moment we cross timestamp_to. Cleared by endPlaybackLocally().
    deps.setVerseAutoStopMs(target.timestampToMs);

    await deps.playUrlQueue([url], {
      firstFileStartFraction: startFraction,
      nowPlaying: {
        title: deps.formatSurahTitle(deps.selectedVerseAction.surahNumber),
        artist: deps.reciter.name,
      },
      nowPlayingForSurah: (s) => ({ title: deps.formatSurahTitle(s), artist: deps.reciter.name }),
      surahNumbers: [deps.selectedVerseAction.surahNumber],
      // Verse-only intentionally suppresses prev/next surah remote commands —
      // the user is listening to ONE verse, not navigating the mushaf.
      remoteSurahCommands: false,
    });
    if (deps.playbackNonceRef.current === deps.sessionNonce) {
      deps.setAudioStatusMessage(
        deps.t("quran.playingSelectedVerse", { lng: deps.uiLanguage }),
      );
    }
    return true;
  } catch {
    deps.setVerseAutoStopMs(null);
    return false;
  }
}

async function handleVerseOnlyOfflineBranch(args: Readonly<{
  selectedHasOffline114: boolean;
  reciter: QuranAudioReciter | null;
  scope: VerseAudioScope;
  verseSnap: SelectedVerseActionState;
  sessionNonce: number;
  playbackNonceRef: MutableRefObject<number>;
  playUrlQueue: (urls: string[], opts?: PlayUrlQueueOpts) => Promise<void>;
  setReaderAudioSession: Dispatch<SetStateAction<ReaderAudioSession | null>>;
  setAudioStatusMessage: (m: string) => void;
  setAudioError: (m: string) => void;
  t: TFunction;
  uiLanguage: string;
  resolveOfflineSurahPlaybackUrl: (reciterId: number, surahNumber: number) => Promise<string>;
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>;
  anchorVerseCount: number;
  initialTimings: ChapterAudioTimings | null;
  setVerseAutoStopMs: (ms: number | null) => void;
  formatSurahTitle: (surahNumber: number) => string;
}>): Promise<boolean> {
  const {
    selectedHasOffline114,
    reciter,
    scope,
    verseSnap,
    sessionNonce,
    playbackNonceRef,
    playUrlQueue,
    setReaderAudioSession,
    setAudioStatusMessage,
    setAudioError,
    t,
    uiLanguage,
    resolveOfflineSurahPlaybackUrl,
    activeReaderPlaybackRef,
    anchorVerseCount,
    initialTimings,
    setVerseAutoStopMs,
    formatSurahTitle,
  } = args;

  if (!selectedHasOffline114 || !reciter) return false;

  const verseOnlyDone = await tryVerseOnlyOfflinePlayback({
    selectedVerseAction: verseSnap,
    sessionNonce,
    playbackNonceRef,
    playUrlQueue,
    setReaderAudioSession,
    setAudioStatusMessage,
    t,
    uiLanguage,
    reciter,
    resolveOfflineSurahPlaybackUrl,
    activeReaderPlaybackRef,
    anchorVerseCount,
    initialTimings,
    setVerseAutoStopMs,
    formatSurahTitle,
  });
  if (verseOnlyDone) return true;

  if (scope === "verse-only" && !initialTimings) {
    setAudioError(
      t(
        "quran.audioVerseTimingsMissing",
        "Verse-accurate timings for this surah are not in this app build yet. Use Full Surah for now, or update after timings are generated for every surah.",
        { lng: uiLanguage },
      ),
    );
    return true;
  }

  return false;
}

type MishariStreamDeps = Readonly<{
  selectedVerseAction: SelectedVerseActionState;
  sessionNonce: number;
  playbackNonceRef: MutableRefObject<number>;
  playUrlQueue: (urls: string[], opts?: PlayUrlQueueOpts) => Promise<void>;
  setReaderAudioSession: Dispatch<SetStateAction<ReaderAudioSession | null>>;
  setAudioStatusMessage: (m: string) => void;
  setAudioError: (e: string) => void;
  t: TFunction;
  uiLanguage: string;
  mishari: QuranAudioReciter;
  activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>;
  formatSurahTitle: (surahNumber: number, verseNumber?: number) => string;
}>;

async function runMishariVerseStreamIfPossible(deps: MishariStreamDeps): Promise<boolean> {
  deps.activeReaderPlaybackRef.current = null;
  logQuranReaderAudio("reader_audio_branch", { scope: "verse-only", stream: "mishari" });
  const qdcId = resolveQdcRecitationId(deps.mishari.id);
  if (!qdcId) {
    deps.setAudioError(deps.t("quran.unableToLoadVerseAudio"));
    return true;
  }

  const verseUrl = await getVerseAudioUrl(
    qdcId,
    deps.selectedVerseAction.surahNumber,
    deps.selectedVerseAction.verseNumber,
  );
  if (!verseUrl) {
    logQuranReaderAudio("reader_audio_play_error", { scope: "verse-only", qdc: "empty" });
    deps.setAudioError(
      deps.t(
        "quran.audioVerseUrlUnavailable",
        "Verse audio is not available right now. Check your connection and try again.",
      ),
    );
    return true;
  }

  deps.setReaderAudioSession({
    surahNumber: deps.selectedVerseAction.surahNumber,
    verseNumber: deps.selectedVerseAction.verseNumber,
  });
  await deps.playUrlQueue([verseUrl], {
    nowPlaying: {
      title: deps.formatSurahTitle(deps.selectedVerseAction.surahNumber),
      artist: deps.mishari.name,
    },
  });
  if (deps.playbackNonceRef.current === deps.sessionNonce) {
    deps.setAudioStatusMessage(
      deps.t("quran.readerAudioMishariStream", {
        lng: deps.uiLanguage,
      }),
    );
  }
  return true;
}

/** @returns true when the handler should stop (error or offline prompt); false to continue to Mishari streaming. */
function blockOrPromptBeforeMishariStream(
  online: boolean,
  selectedHasOffline114: boolean,
  t: TFunction,
  uiLanguage: string,
  setAudioError: (message: string) => void,
  setAudioUiPrompt: (p: QuranAudioUiPrompt) => void,
  setAudioStatusMessage: (msg: string) => void,
): boolean {
  if (!online) {
    if (selectedHasOffline114) {
      setAudioError(t("quran.unableToPlayAudio"));
      return true;
    }
    logQuranReaderAudio("reader_audio_prompt", { reason: "offline", scope: "verse-only" });
    setAudioUiPrompt("go_online");
    setAudioStatusMessage(
      t("quran.audioNeedWifiBody", {
        lng: uiLanguage,
      }),
    );
    return true;
  }
  if (selectedHasOffline114) {
    setAudioError(t("quran.unableToPlayAudio"));
    return true;
  }
  return false;
}

type PlayNativeOneClipInput = Readonly<{
  url: string;
  startFraction: number | undefined;
  sessionNonce: number;
  playbackNonceRef: MutableRefObject<number>;
  nowPlaying: NowPlayingMeta | undefined;
  t: TFunction;
  onSystemAbort: () => void;
  remoteSurahCommands: boolean;
  onPlaybackTick?: (currentTime: number, duration: number) => void;
}>;

function playNativeOneClip(input: PlayNativeOneClipInput): Promise<void> {
  const {
    url,
    startFraction,
    sessionNonce,
    playbackNonceRef,
    nowPlaying,
    t,
    onSystemAbort,
    remoteSurahCommands,
    onPlaybackTick,
  } = input;
  return new Promise((resolve, reject) => {
    let settled = false;
    let endedL: PluginListenerHandle | undefined;
    let errL: PluginListenerHandle | undefined;
    let abortL: PluginListenerHandle | undefined;
    let tickL: PluginListenerHandle | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      if (poll) {
        globalThis.clearInterval(poll);
        poll = undefined;
      }
      void endedL?.remove();
      void errL?.remove();
      void abortL?.remove();
      void tickL?.remove();
      endedL = undefined;
      errL = undefined;
      abortL = undefined;
      tickL = undefined;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    void (async () => {
      try {
        endedL = await QuranReaderNativeAudio.addListener("ended", () => {
          finish();
        });
        errL = await QuranReaderNativeAudio.addListener("error", (payload) => {
          if (settled) return;
          settled = true;
          cleanup();
          const msg =
            payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
              ? payload.message
              : t("quran.unableToPlayAudio");
          reject(new Error(msg));
        });

        abortL = await QuranReaderNativeAudio.addListener("aborted", () => {
          if (settled) return;
          settled = true;
          cleanup();
          onSystemAbort();
          resolve();
        });

        if (onPlaybackTick) {
          tickL = await QuranReaderNativeAudio.addListener("playbackTick", (payload) => {
            if (playbackNonceRef.current !== sessionNonce) return;
            const cur =
              payload && typeof payload === "object" && "currentTime" in payload && typeof payload.currentTime === "number"
                ? payload.currentTime
                : 0;
            const dur =
              payload && typeof payload === "object" && "duration" in payload && typeof payload.duration === "number"
                ? payload.duration
                : 0;
            onPlaybackTick(cur, dur);
          });
        }

        poll = globalThis.setInterval(() => {
          if (playbackNonceRef.current !== sessionNonce) {
            void QuranReaderNativeAudio.stop();
            finish();
          }
        }, 120);

        await QuranReaderNativeAudio.playOne({
          url,
          startFraction,
          title: nowPlaying?.title,
          artist: nowPlaying?.artist,
          remoteSurahCommands,
        });
      } catch (e) {
        if (!settled) {
          settled = true;
          cleanup();
          reject(e instanceof Error ? e : new Error(t("quran.unableToPlayAudio")));
        }
      }
    })();
  });
}

export function useQuranAudio({
  t,
  selectedVerseAction,
  surahVerseCount,
  uiLanguage,
  surahNameByNumber,
}: UseQuranAudioProps) {
  // Produce a lockscreen-friendly title: uses the localized Surah name when
  // available (e.g. "Al-Fatihah"), falling back to "Surah N" for robustness.
  const formatSurahTitle = useCallback(
    (surahNumber: number): string => {
      const name = surahNameByNumber?.(surahNumber);
      return name && name.trim().length > 0 ? name : `${t("quran.sura")} ${surahNumber}`;
    },
    [surahNameByNumber, t],
  );
  const [audioReciters, setAudioReciters] = useState<QuranAudioReciter[]>([]);
  const [selectedAudioReciterId, setSelectedAudioReciterId] = useState<number | null>(null);
  const setSelectedAudioReciterIdSafe = useCallback((id: number | null) => {
    if (id == null) {
      setSelectedAudioReciterId(null);
      return;
    }
    const ok = getBundledReciters().some((r) => r.id === id);
    if (!ok) return;
    setSelectedAudioReciterId(id);
  }, []);
  const [audioScope, setAudioScope] = useState<VerseAudioScope>("verse-only");
  const [showReciterMenu, setShowReciterMenu] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioStatusMessage, setAudioStatusMessage] = useState<string>("");
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioIsPaused, setAudioIsPaused] = useState(false);
  const [audioUiPrompt, setAudioUiPrompt] = useState<QuranAudioUiPrompt>(null);
  const [readerAudioSession, setReaderAudioSession] = useState<ReaderAudioSession | null>(null);
  const [readerHighlightVerse, setReaderHighlightVerse] = useState<number | null>(null);
  const readerAudioSessionRef = useRef<ReaderAudioSession | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobObjectUrlsRef = useRef<string[]>([]);
  const playbackNonceRef = useRef(0);
  const loadEpochRef = useRef(0);
  const activeReaderPlaybackRef = useRef<ActiveQuranReaderPlayback | null>(null);
  // Per-(reciter, surah) verse timings (ms from start of full surah audio) used
  // for both precise highlight tracking and verse-only auto-stop. null when
  // unavailable (offline-only reciter without QDC mapping, or fetch failure).
  const chapterTimingsRef = useRef<{
    reciterId: number;
    surahNumber: number;
    timings: ChapterAudioTimings;
  } | null>(null);
  // When set, JS fires stopAudioPlayback() the moment audio currentTime crosses
  // this many milliseconds. Used to auto-stop verse-only offline playback at
  // QDC verse_timings[verse].timestamp_to. Null disables auto-stop.
  const verseAutoStopMsRef = useRef<number | null>(null);
  // Latest observed playback time within the current clip (seconds), used by the
  // in-app reader mini-player's rewind button to mirror the lockscreen's
  // ">3s seeks to start of current surah, else jump to previous surah" behavior.
  const latestPlaybackTimeRef = useRef<number>(0);

  const selectedAudioReciter = useMemo(() => {
    if (!selectedAudioReciterId) return null;
    return audioReciters.find((entry) => entry.id === selectedAudioReciterId) ?? null;
  }, [audioReciters, selectedAudioReciterId]);

  useEffect(() => {
    readerAudioSessionRef.current = readerAudioSession;
  }, [readerAudioSession]);

  const revokeBlobUrls = useCallback(() => {
    for (const url of blobObjectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    blobObjectUrlsRef.current = [];
  }, []);

  const endPlaybackLocally = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void QuranReaderNativeAudio.stop();
    }
    revokeBlobUrls();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.src = "";
    }
    setAudioIsPlaying(false);
    setAudioIsPaused(false);
    setReaderAudioSession(null);
    setReaderHighlightVerse(null);
    activeReaderPlaybackRef.current = null;
    chapterTimingsRef.current = null;
    verseAutoStopMsRef.current = null;
    latestPlaybackTimeRef.current = 0;
    clearQuranReaderNowPlaying();
  }, [revokeBlobUrls]);

  const stopAudioPlayback = useCallback(() => {
    playbackNonceRef.current += 1;
    endPlaybackLocally();
  }, [endPlaybackLocally]);

  const pauseReaderAudio = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void QuranReaderNativeAudio.pause();
    } else {
      audioRef.current?.pause();
    }
    setAudioIsPlaying(false);
    setAudioIsPaused(true);
  }, []);

  const resumeReaderAudio = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void QuranReaderNativeAudio.resume();
    } else {
      const audio = audioRef.current;
      if (audio) {
        void audio.play().catch(() => {});
      }
    }
    setAudioIsPlaying(true);
    setAudioIsPaused(false);
  }, []);

  const applyPlaybackHighlight = useCallback(
    (currentTime: number, duration: number) => {
      latestPlaybackTimeRef.current = currentTime;
      const session = readerAudioSessionRef.current;
      if (!session) {
        setReaderHighlightVerse(null);
        return;
      }

      // Auto-stop for verse-only when QDC told us exactly when this verse ends.
      // currentTime is in seconds (HTMLAudioElement & native plugin both report seconds).
      const stopMs = verseAutoStopMsRef.current;
      if (stopMs != null && currentTime * 1000 >= stopMs) {
        verseAutoStopMsRef.current = null;
        stopAudioPlayback();
        setAudioStatusMessage(
          t("quran.playbackComplete", { lng: uiLanguage }),
        );
        return;
      }

      const ctxPlay = activeReaderPlaybackRef.current;
      const timingsCtx = chapterTimingsRef.current;
      // Prefer precomputed timings (bundled forced-alignment OR QDC) when they
      // belong to the surah we're hearing.
      if (
        ctxPlay &&
        timingsCtx?.surahNumber === ctxPlay.currentSurah &&
        timingsCtx.timings.timings.length > 0
      ) {
        const verse = findActiveVerseFromTimings(timingsCtx.timings.timings, currentTime * 1000);
        if (verse != null) {
          if (ctxPlay.scope === "from-verse" && verse < ctxPlay.anchorVerseNumber) {
            // Stay on the anchor until timings confirm we've crossed it (avoids momentary
            // backwards highlight when startFraction is just before the anchor's begin).
            setReaderHighlightVerse(ctxPlay.anchorVerseNumber);
          } else {
            setReaderHighlightVerse(verse);
          }
          return;
        }
      }

      setReaderHighlightVerse(
        computeHighlightVerseFromPlayback(
          currentTime,
          duration,
          ctxPlay,
          session,
          surahVerseCount,
        ),
      );
    },
    [stopAudioPlayback, surahVerseCount, t, uiLanguage],
  );

  const clearAudioUiPrompt = useCallback(() => {
    setAudioUiPrompt(null);
  }, []);

  // Resolves precise per-verse timings for (reciter, surah) and stores them
  // in chapterTimingsRef. Lookup order:
  //   1. Bundled forced-alignment JSONs under src/data/quranVerseTimings/
  //      (generated against the exact R2 MP3s we play offline).
  //   2. Live QDC `audio_files?segments=true` — **only for reciters NOT in
  //      SYNC_ENABLED_RECITER_IDS.** Reader sync reciters use R2 masterings;
  //      QDC segments are measured on different files, so using them for
  //      offline seek / verse-only auto-stop makes playback look like "full
  //      surah from the start" (wrong seek + stop never fires).
  //   3. null — coarse highlight fallback only; verse-accurate modes must not
  //      run without (1).
  //
  // Reciters NOT in `SYNC_ENABLED_RECITER_IDS` never appear in the reader
  // sync list; the QDC branch remains for any future call sites.
  const prepareTimingsForSurah = useCallback(
    async (reciter: QuranAudioReciter | null, surahNumber: number): Promise<ChapterAudioTimings | null> => {
      if (!reciter) {
        chapterTimingsRef.current = null;
        return null;
      }

      // 1. Bundled R2-aligned timings (only source of truth for sync reciters).
      if (hasBundledTimings(reciter.id, surahNumber)) {
        const bundled = await loadBundledTimings(reciter.id, surahNumber);
        if (bundled) {
          chapterTimingsRef.current = { reciterId: reciter.id, surahNumber, timings: bundled };
          return bundled;
        }
      }

      if (SYNC_ENABLED_RECITER_IDS.has(reciter.id)) {
        chapterTimingsRef.current = null;
        return null;
      }

      // 2. Live QDC fallback (non-sync reciters only).
      try {
        const qdcId = resolveQdcRecitationId(reciter.id);
        if (!qdcId) {
          chapterTimingsRef.current = null;
          return null;
        }
        const timings = await fetchChapterVerseTimings(qdcId, surahNumber);
        if (!timings) {
          chapterTimingsRef.current = null;
          return null;
        }
        chapterTimingsRef.current = { reciterId: reciter.id, surahNumber, timings };
        return timings;
      } catch {
        chapterTimingsRef.current = null;
        return null;
      }
    },
    [],
  );

  const playUrlQueue = useCallback(
    async (urls: string[], opts?: PlayUrlQueueOpts, onSurahTransition?: (s: number) => void | Promise<void>) => {
      if (!urls.length) {
        throw new Error("No audio source available");
      }

      const sessionNonce = playbackNonceRef.current;
      const ctx: PlayUrlQueueCtx = {
        playbackNonceRef,
        audioRef,
        setAudioIsPlaying,
        endPlaybackLocally,
        setAudioStatusMessage,
        t,
        uiLanguage,
        stopAudioPlayback,
        onPlaybackTick: applyPlaybackHighlight,
        onSurahTransition,
      };

      if (Capacitor.isNativePlatform()) {
        await runPlayUrlQueueNative(ctx, urls, sessionNonce, opts, activeReaderPlaybackRef);
        return;
      }
      await runPlayUrlQueueWeb(ctx, urls, sessionNonce, opts);
    },
    [applyPlaybackHighlight, endPlaybackLocally, stopAudioPlayback, t, uiLanguage],
  );

  const resolveOfflineSurahPlaybackUrl = useCallback(
    async (reciterId: number, surahNumber: number): Promise<string> => {
      if (Capacitor.isNativePlatform()) {
        const direct = await getOfflineSurahNativePlaybackUrl(reciterId, surahNumber, "nativeAv");
        if (direct) return direct;
        throw new Error(t("quran.unableToPlayAudio"));
      }
      const blob = await getOfflineSurahAudio(reciterId, surahNumber);
      if (!blob) {
        throw new Error(t("quran.unableToPlayAudio"));
      }
      const blobUrl = URL.createObjectURL(blob);
      blobObjectUrlsRef.current.push(blobUrl);
      return blobUrl;
    },
    [t],
  );

  const handleSurahRemoteStep = useCallback(
    async (direction: number) => {
      // direction: -1 = previous surah, +1 = next surah, 0 = restart current surah
      if (direction !== -1 && direction !== 1 && direction !== 0) return;
      const ctx = activeReaderPlaybackRef.current;
      if (!ctx) return;

      const nextSurah = direction === 0 ? ctx.currentSurah : ctx.currentSurah + direction;
      if (nextSurah < 1 || nextSurah > 114) return;

      stopAudioPlayback();

      try {
        const reciterEntry =
          audioReciters.find((entry) => entry.id === ctx.reciterId)
          ?? ({ id: ctx.reciterId, name: ctx.reciterName } as QuranAudioReciter);

        // Prefetch QDC timings for the new (start) surah so the highlight is
        // accurate from the very first tick after the lockscreen step.
        await prepareTimingsForSurah(reciterEntry, nextSurah);

        const urls: string[] = [];
        const surahNumbers: number[] = [];
        if (ctx.scope === "full-surah" || ctx.scope === "verse-only") {
          urls.push(await resolveOfflineSurahPlaybackUrl(ctx.reciterId, nextSurah));
          surahNumbers.push(nextSurah);
        } else {
          for (let s = nextSurah; s <= 114; s += 1) {
            urls.push(await resolveOfflineSurahPlaybackUrl(ctx.reciterId, s));
            surahNumbers.push(s);
          }
        }

        const firstFileStartFraction =
          direction === 0 ? 0 : computeRemoteSurahStepStartFraction(ctx, nextSurah);
        const nowPlaying = buildRemoteSurahStepNowPlaying(ctx, nextSurah, formatSurahTitle);

        activeReaderPlaybackRef.current = {
          ...ctx,
          currentSurah: nextSurah,
        };

        setReaderAudioSession({ surahNumber: nextSurah, verseNumber: 1 });

        const sessionNonce = playbackNonceRef.current;
        const ctxQueue: PlayUrlQueueCtx = {
          playbackNonceRef,
          audioRef,
          setAudioIsPlaying,
          endPlaybackLocally,
          setAudioStatusMessage,
          t,
          uiLanguage,
          stopAudioPlayback,
          onPlaybackTick: applyPlaybackHighlight,
          onSurahTransition: async (s) => {
            if (s === nextSurah) return; // already prefetched above
            await prepareTimingsForSurah(reciterEntry, s);
          },
        };

        await runPlayUrlQueueNative(
          ctxQueue,
          urls,
          sessionNonce,
          {
            firstFileStartFraction,
            nowPlaying,
            surahNumbers,
            // Quran Reader lockscreen: do not expose next/previous-surah controls.
            remoteSurahCommands: false,
          },
          activeReaderPlaybackRef,
        );

        if (playbackNonceRef.current === sessionNonce) {
          setRemoteSurahStepStatusLine(ctx.scope, t, uiLanguage, setAudioStatusMessage);
        }
      } catch (err) {
        setAudioError(
          err instanceof Error ? err.message : t("quran.unableToPlayAudio"),
        );
      }
    },
    [applyPlaybackHighlight, audioReciters, prepareTimingsForSurah, resolveOfflineSurahPlaybackUrl, stopAudioPlayback, t, uiLanguage, endPlaybackLocally, formatSurahTitle],
  );

  // In-app reader mini-player rewind button. Mirrors the iOS lockscreen rule:
  // if the user is >3s into the current surah, restart current surah from 0;
  // otherwise jump to the previous surah. Safe no-op when no playback is active.
  const handleReaderMiniPlayerRewind = useCallback(() => {
    if (!activeReaderPlaybackRef.current) return;
    const seconds = latestPlaybackTimeRef.current;
    if (seconds > 3) {
      void handleSurahRemoteStep(0);
      return;
    }
    void handleSurahRemoteStep(-1);
  }, [handleSurahRemoteStep]);

  const handleReaderMiniPlayerForward = useCallback(() => {
    if (!activeReaderPlaybackRef.current) return;
    void handleSurahRemoteStep(1);
  }, [handleSurahRemoteStep]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | undefined;
    void (async () => {
      handle = await QuranReaderNativeAudio.addListener("surahStep", (payload) => {
        const dir =
          payload && typeof payload === "object" && "direction" in payload && typeof payload.direction === "number"
            ? payload.direction
            : 0;
        void handleSurahRemoteStep(dir);
      });
    })();
    return () => {
      void handle?.remove();
    };
  }, [handleSurahRemoteStep]);

  // Reflect lockscreen / headset pause & play into React state so the mini-player
  // icon stays in sync with the underlying native player.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let pausedHandle: PluginListenerHandle | undefined;
    let resumedHandle: PluginListenerHandle | undefined;
    void (async () => {
      pausedHandle = await QuranReaderNativeAudio.addListener("paused", () => {
        setAudioIsPlaying(false);
        setAudioIsPaused(true);
      });
      resumedHandle = await QuranReaderNativeAudio.addListener("resumed", () => {
        setAudioIsPlaying(true);
        setAudioIsPaused(false);
      });
    })();
    return () => {
      void pausedHandle?.remove();
      void resumedHandle?.remove();
    };
  }, []);

  const loadSyncReciters = useCallback(async () => {
    setAudioStatusMessage(
      t("quran.checkingAudioSources", { lng: uiLanguage }),
    );
    setAudioError(null);

    const epoch = ++loadEpochRef.current;

    const all = await fetchQuranAudioReciters();
    const syncOnly = all
      .filter((entry) => SYNC_ENABLED_RECITER_IDS.has(entry.id))
      .filter((entry) => entry.sectionId === 1 || entry.sectionId === 3);

    const slots = await Promise.all(
      syncOnly.map(async (entry) => {
        const offline114 = await hasOffline114Surahs(entry.id);
        if (!offline114) return null;
        return resolveQdcRecitationId(entry.id) ? entry : null;
      }),
    );

    const verified = sortRecitersByFirstName(
      slots.filter((entry): entry is QuranAudioReciter => entry !== null),
      uiLanguage,
    );

    if (epoch !== loadEpochRef.current) {
      return;
    }

    if (!verified.length) {
      setAudioStatusMessage(
        t("quran.visitAudioLibrary", {
          lng: uiLanguage,
        }),
      );
      setAudioReciters([]);
      setSelectedAudioReciterId(null);
      return;
    }

    setAudioReciters(verified);
    setSelectedAudioReciterId((current) =>
      current && verified.some((r) => r.id === current) ? current : verified[0].id,
    );
    setAudioStatusMessage("");
  }, [t, uiLanguage]);

  type PlaySelectedVerseInternalDeps = Readonly<{
    verseSnap: SelectedVerseActionState;
    scope: VerseAudioScope;
    t: TFunction;
    uiLanguage: string;
    audioScope: VerseAudioScope;
    surahVerseCount: number;
    selectedAudioReciter: QuranAudioReciter | null;
    setAudioScope: (s: VerseAudioScope) => void;
    setAudioLoading: (v: boolean) => void;
    setAudioError: (m: string | null) => void;
    setAudioUiPrompt: (p: QuranAudioUiPrompt) => void;
    setAudioStatusMessage: (m: string) => void;
    stopAudioPlayback: () => void;
    endPlaybackLocally: () => void;
    playbackNonceRef: MutableRefObject<number>;
    prepareTimingsForSurah: (reciter: QuranAudioReciter | null, surahNumber: number) => Promise<ChapterAudioTimings | null>;
    playUrlQueue: (
      urls: string[],
      opts?: PlayUrlQueueOpts,
      onSurahTransition?: (surahNumber: number) => void | Promise<void>,
    ) => Promise<void>;
    resolveOfflineSurahPlaybackUrl: (reciterId: number, surahNumber: number) => Promise<string>;
    activeReaderPlaybackRef: MutableRefObject<ActiveQuranReaderPlayback | null>;
    setReaderAudioSession: Dispatch<SetStateAction<ReaderAudioSession | null>>;
    formatSurahTitle: (surahNumber: number) => string;
  }>;

  const playSelectedVerseAudioInternal = useCallback(async (deps: PlaySelectedVerseInternalDeps) => {
    const {
      verseSnap,
      scope,
      t,
      uiLanguage,
      surahVerseCount,
      selectedAudioReciter,
      setAudioLoading,
      setAudioError,
      setAudioUiPrompt,
      setAudioStatusMessage,
      stopAudioPlayback,
      endPlaybackLocally,
      playbackNonceRef,
      prepareTimingsForSurah,
      playUrlQueue,
      resolveOfflineSurahPlaybackUrl,
      activeReaderPlaybackRef,
      setReaderAudioSession,
      formatSurahTitle,
    } = deps;

    const mishari = getMishariReciter();
    if (!mishari) {
      setAudioError(t("quran.unableToPlayAudio"));
      return;
    }

    const online = typeof navigator !== "undefined" && navigator.onLine;
    const reciter = selectedAudioReciter;
    const selectedHasOffline114 =
      reciter != null && (await hasOffline114Surahs(reciter.id));

    setAudioLoading(true);
    setAudioError(null);
    setAudioUiPrompt(null);

    const verseCount = Math.max(1, surahVerseCount || 1);
    const startFraction = Math.min(1, Math.max(0, (verseSnap.verseNumber - 1) / verseCount) * 0.92);

    try {
      stopAudioPlayback();
      const sessionNonce = playbackNonceRef.current;

      const initialTimings =
        reciter ? await prepareTimingsForSurah(reciter, verseSnap.surahNumber) : null;

      const offlineHandled = await runOfflineSurahScopesIfNeeded({
        t,
        uiLanguage,
        selectedVerseAction: verseSnap,
        startFraction,
        sessionNonce,
        audioScope: scope,
        hasCompliantOffline: selectedHasOffline114,
        reciter,
        setAudioUiPrompt,
        setAudioStatusMessage,
        setAudioError,
        setReaderAudioSession,
        playbackNonceRef,
        playUrlQueue,
        resolveOfflineSurahPlaybackUrl,
        activeReaderPlaybackRef,
        anchorVerseCount: verseCount,
        initialTimings,
        prepareTimingsForSurah,
        formatSurahTitle,
      });
      if (offlineHandled) return;

      const verseOnlyHandled = await handleVerseOnlyOfflineBranch({
        selectedHasOffline114,
        reciter,
        scope,
        verseSnap,
        sessionNonce,
        playbackNonceRef,
        playUrlQueue,
        setReaderAudioSession,
        setAudioStatusMessage,
        setAudioError,
        t,
        uiLanguage,
        resolveOfflineSurahPlaybackUrl,
        activeReaderPlaybackRef,
        anchorVerseCount: verseCount,
        initialTimings,
        setVerseAutoStopMs: (ms) => {
          verseAutoStopMsRef.current = ms;
        },
        formatSurahTitle,
      });
      if (verseOnlyHandled) return;

      const stopForStreamGate = blockOrPromptBeforeMishariStream(
        online,
        selectedHasOffline114,
        t,
        uiLanguage,
        setAudioError,
        setAudioUiPrompt,
        setAudioStatusMessage,
      );
      if (stopForStreamGate) return;

      await runMishariVerseStreamIfPossible({
        selectedVerseAction: verseSnap,
        sessionNonce,
        playbackNonceRef,
        playUrlQueue,
        setReaderAudioSession,
        setAudioStatusMessage,
        setAudioError,
        t,
        uiLanguage,
        mishari,
        activeReaderPlaybackRef,
        formatSurahTitle,
      });
    } catch (err) {
      playbackNonceRef.current += 1;
      endPlaybackLocally();
      setAudioError(err instanceof Error ? err.message : t("quran.unableToPlayAudio"));
    } finally {
      setAudioLoading(false);
    }
  }, []);

  const handlePlaySelectedVerseAudio = useCallback(async (scopeOverride?: VerseAudioScope) => {
    const verseSnap = selectedVerseAction;
    if (!verseSnap) return;

    const scope = scopeOverride ?? audioScope;
    if (scopeOverride !== undefined) {
      setAudioScope(scopeOverride);
    }
    await playSelectedVerseAudioInternal({
      verseSnap,
      scope,
      t,
      uiLanguage,
      audioScope,
      surahVerseCount,
      selectedAudioReciter,
      setAudioScope,
      setAudioLoading,
      setAudioError,
      setAudioUiPrompt,
      setAudioStatusMessage,
      stopAudioPlayback,
      endPlaybackLocally,
      playbackNonceRef,
      prepareTimingsForSurah,
      playUrlQueue,
      resolveOfflineSurahPlaybackUrl,
      activeReaderPlaybackRef,
      setReaderAudioSession,
      formatSurahTitle,
    });
  }, [
    audioScope,
    endPlaybackLocally,
    formatSurahTitle,
    playSelectedVerseAudioInternal,
    playUrlQueue,
    prepareTimingsForSurah,
    resolveOfflineSurahPlaybackUrl,
    selectedAudioReciter,
    selectedVerseAction,
    setAudioScope,
    stopAudioPlayback,
    surahVerseCount,
    t,
    uiLanguage,
  ]);

  useEffect(() => {
    if (!selectedVerseAction) {
      // Closing the verse modal must not stop reader audio (user reads while listening).
      setAudioError(null);
      setAudioStatusMessage("");
      setAudioUiPrompt(null);
      return;
    }

    void loadSyncReciters();
  }, [loadSyncReciters, selectedVerseAction]);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  return {
    audioReciters,
    selectedAudioReciterId,
    setSelectedAudioReciterId: setSelectedAudioReciterIdSafe,
    selectedAudioReciter,
    audioScope,
    setAudioScope,
    showReciterMenu,
    setShowReciterMenu,
    audioLoading,
    audioError,
    setAudioError,
    audioStatusMessage,
    setAudioStatusMessage,
    audioIsPlaying,
    audioIsPaused,
    stopAudioPlayback,
    pauseReaderAudio,
    resumeReaderAudio,
    handlePlaySelectedVerseAudio,
    audioUiPrompt,
    clearAudioUiPrompt,
    readerAudioSession,
    readerHighlightVerse,
    handleSurahRemoteStep,
    handleReaderMiniPlayerRewind,
    handleReaderMiniPlayerForward,
  };
}
