import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { QuranReaderNativeAudio } from "@/plugins/quranReaderNativeAudio";
import {
  CloudDownload,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
  XCircle,
} from "lucide-react";
import { LibrarySubpageShell } from "@/components/Library/LibrarySubpageShell";

import { isRtlLanguage } from "@/lib/rtlLanguages";
import { sortRecitersByDisplayLabel } from "@/lib/quranReciterSort";
import { trackQuranAudioDownloadEvent } from "@/lib/quranAudioTelemetry";
import { StorageService } from "@/services/StorageService";

import {
  fetchQuranAudioReciters,
  getBundledReciters,
  buildQuranicaudioSurahUrl,
  type QuranAudioReciter,
} from "@/services/quranAudioService";
import { loadSurahMetadata } from "@/services/quranService";
import type { QuranLanguageCode, Surah } from "@/types/quran";
import {
  clearReciterOfflineAudio,
  downloadReciterForOffline,
  getAllRecitersDownloadState,
  getOfflineSurahAudio,
  getOfflineSurahNativePlaybackUrl,
} from "@/services/quranAudioOfflineService";

type QuranAudioLibrarySubpageProps = {
  onBackToLibraryHome: () => void;
  libraryLanguage: string;
  uiLanguage: string;
  uiIsRtl: boolean;
  sessionKey?: number;
};

type DownloadState = {
  running: boolean;
  paused: boolean;
  completed: number;
  total: number;
  error: string | null;
  fullyDownloaded: boolean;
  currentSurah: number;
  lastUpdatedAt: number;
};

const DOWNLOAD_STATE_STORAGE_KEY = "quran_audio_download_state_v2";

/** Latin exonyms on reciter cards only (Settings keeps native script via `settings.language.*`). */
const RECITER_LANGUAGE_CHIP_LATIN = {
  arabic: "Arabic",
  english: "English",
  urdu: "Urdu",
} as const;

type PendingConsent = {
  reciterId: number;
};

/** Strip trailing English-style variant tags only (e.g. "[Mujawwad]"), keep Arabic tags like "[مجود]". */
function stripReciterVariantSuffix(label: string): string {
  return label.replace(/\s*\[[\sA-Za-z0-9.,+\-/'()]+\]\s*$/, "").trim();
}

function resolveI18nOrFallback(
  tFn: (key: string, opts?: Record<string, unknown>) => string,
  key: string,
  fallback: string,
  opts?: Record<string, unknown>,
): string {
  const translated = tFn(key, opts);
  return typeof translated === "string" && translated !== key ? translated : fallback;
}

function buildCombinedLanguageChip(
  reciter: QuranAudioReciter,
  tContent: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (!reciter.languages?.length) return null;
  const sep = tContent("settings.language.listSeparator");
  const parts = reciter.languages.map((raw) => {
    const lang = raw.trim().toLowerCase();
    if (lang === "english") {
      return `🇺🇸 ${RECITER_LANGUAGE_CHIP_LATIN.english}`;
    }
    if (lang === "arabic") {
      return `🇸🇦 ${RECITER_LANGUAGE_CHIP_LATIN.arabic}`;
    }
    if (lang === "urdu") {
      return `🌍 ${RECITER_LANGUAGE_CHIP_LATIN.urdu}`;
    }
    return `🌍 ${raw.trim()}`;
  });
  return parts.join(sep);
}

type ReciterCardProps = {
  reciter: QuranAudioReciter;
  entryState: DownloadState | undefined;
  selectedReciters: Set<number>;
  setSelectedReciters: React.Dispatch<React.SetStateAction<Set<number>>>;
  startDownload: (reciter: QuranAudioReciter) => void;
  toggleSample: (reciter: QuranAudioReciter) => void;
  pauseDownload: (id: number) => void;
  resumeDownload: (reciter: QuranAudioReciter) => void;
  cancelDownload: (id: number) => void;
  sampleAudioLoading: number | null;
  playingSampleId: number | null;
  queueBusy: boolean;
  tContent: (key: string, opts?: Record<string, unknown>) => string;
  tUi: (key: string, opts?: Record<string, unknown>) => string;
  offlineActiveReciterId: number | null;
  offlineSurah: number;
  offlinePlaying: boolean;
  offlineLoading: boolean;
  onOfflinePlayPause: (reciterId: number) => void;
  onOfflineNextSurah: (reciterId: number) => void;
  onOfflinePrevSurah: (reciterId: number) => void;
  /** Localized surah name for the *currently active* reciter row; null when this row is inactive. */
  activeSurahName: string | null;
};

/**
 * Resolves the Surah name shown on the lockscreen / mini-player, in the user's
 * curated translation language. Falls back gracefully through ar → translation
 * → en → transliteration → arabic → "Surah N".
 */
function resolveLocalizedSurahNameForPlayback(
  surahs: readonly Surah[],
  surah: number,
  lng: QuranLanguageCode,
): string {
  const fallback = `Surah ${surah}`;
  const surahMeta = surahs.find((s) => s.number === surah);
  if (!surahMeta) return fallback;
  if (lng === "ar") {
    return surahMeta.nameArabic || surahMeta.nameTransliterated || fallback;
  }
  const translated = surahMeta.nameTranslated[lng];
  if (translated && translated.trim().length > 0) return translated;
  return surahMeta.nameTranslated.en
    || surahMeta.nameTransliterated
    || surahMeta.nameArabic
    || fallback;
}

function pickOfflinePlayButtonIcon(
  isOfflineActive: boolean,
  offlineLoading: boolean,
  offlinePlaying: boolean,
): ReactNode {
  if (offlineLoading && isOfflineActive) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
  }
  if (isOfflineActive && offlinePlaying) {
    return <Pause className="w-3.5 h-3.5" />;
  }
  return <Play className="w-3.5 h-3.5" />;
}

function ReciterDownloadActionRow({
  reciter,
  entryState,
  selectedReciters,
  setSelectedReciters,
  startDownload,
  toggleSample,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  sampleAudioLoading,
  playingSampleId,
  queueBusy,
  tContent,
  tUi,
}: Readonly<
  Pick<
    ReciterCardProps,
    | "reciter"
    | "entryState"
    | "selectedReciters"
    | "setSelectedReciters"
    | "startDownload"
    | "toggleSample"
    | "pauseDownload"
    | "resumeDownload"
    | "cancelDownload"
    | "sampleAudioLoading"
    | "playingSampleId"
    | "queueBusy"
    | "tContent"
    | "tUi"
  >
>) {
  function getSampleButtonContent() {
    if (sampleAudioLoading === reciter.id) {
      return (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tContent("quran.loading")}
        </>
      );
    }
    if (playingSampleId === reciter.id) {
      return (
        <>
          <Pause className="w-3.5 h-3.5" /> {tContent("quran.pause")}
        </>
      );
    }
    return (
      <>
        <Play className="w-3.5 h-3.5" /> {tContent("library.audio.sample")}
      </>
    );
  }

  function getProgressLabel() {
    if (entryState?.fullyDownloaded) {
      return tContent("library.audio.downloadedProgress");
    }
    if (entryState?.running) {
      return tContent("library.audio.downloadingProgress", {
        completed: entryState.completed,
        total: entryState.total,
      });
    }
    if (entryState?.paused) {
      return tContent("library.audio.pausedProgress", {
        completed: entryState.completed,
        total: entryState.total,
      });
    }
    return tContent("library.audio.idleProgress", {
      completed: entryState?.completed ?? 0,
    });
  }

  const fullyDownloaded = entryState?.fullyDownloaded === true;
  const showProgress =
    !fullyDownloaded &&
    (entryState?.running ||
      entryState?.paused ||
      (entryState?.completed ?? 0) > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {fullyDownloaded ? null : (
        <button
          type="button"
          onClick={() => toggleSample(reciter)}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 min-w-[96px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          {getSampleButtonContent()}
        </button>
      )}

      {!entryState?.running && !entryState?.paused && !fullyDownloaded ? (
        <button
          type="button"
          onClick={() => startDownload(reciter)}
          disabled={queueBusy}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-60 min-w-[132px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          <CloudDownload className="w-4 h-4" /> {tContent("library.audio.downloadOffline")}
        </button>
      ) : null}

      {entryState?.running ? (
        <button
          type="button"
          onClick={() => pauseDownload(reciter.id)}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 min-w-[96px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          <Pause className="w-4 h-4" /> {tContent("quran.pause")}
        </button>
      ) : null}

      {entryState?.paused && !fullyDownloaded ? (
        <button
          type="button"
          onClick={() => resumeDownload(reciter)}
          disabled={queueBusy}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-60 min-w-[96px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          <Play className="w-4 h-4" /> {tContent("common.resume")}
        </button>
      ) : null}

      {entryState?.running || entryState?.paused ? (
        <button
          type="button"
          onClick={() => cancelDownload(reciter.id)}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 min-w-[96px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          <X className="w-4 h-4" /> {tContent("quran.cancel")}
        </button>
      ) : null}

      {fullyDownloaded ? (
        <button
          type="button"
          onClick={() => cancelDownload(reciter.id)}
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 min-w-[72px] justify-center"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
        >
          <X className="w-4 h-4" /> {tUi("library.audio.deleteOfflineShort")}
        </button>
      ) : null}

      {showProgress ? (
        <span
          className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center ms-2"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-card-bg-soft)",
          }}
        >
          {getProgressLabel()}
        </span>
      ) : null}
    </div>
  );
}

function ReciterOfflineTransportRow({
  reciter,
  tUi,
  offlineActiveReciterId,
  offlineSurah,
  offlinePlaying,
  offlineLoading,
  onOfflinePlayPause,
  onOfflineNextSurah,
  onOfflinePrevSurah,
  activeSurahName,
}: Readonly<
  Pick<
    ReciterCardProps,
    | "reciter"
    | "tUi"
    | "offlineActiveReciterId"
    | "offlineSurah"
    | "offlinePlaying"
    | "offlineLoading"
    | "onOfflinePlayPause"
    | "onOfflineNextSurah"
    | "onOfflinePrevSurah"
    | "activeSurahName"
  >
>) {
  const isOfflineActive = offlineActiveReciterId === reciter.id;
  const offlineTransportDisabled = !isOfflineActive || offlineLoading;
  const playAriaLabel =
    isOfflineActive && offlinePlaying
      ? tUi("library.audio.offlinePauseSurah")
      : tUi("library.audio.offlinePlaySurah");

  return (
    <div className="flex flex-col items-center w-full">
      {isOfflineActive && activeSurahName ? (
        <div className="text-xs font-semibold pp-text-primary mb-1 text-center" aria-live="polite">
          {activeSurahName}
        </div>
      ) : null}
      <div dir="ltr" className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onOfflinePrevSurah(reciter.id)}
          disabled={offlineTransportDisabled || (isOfflineActive && offlineSurah <= 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-40"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
          aria-label={tUi("library.audio.offlinePrevSurah")}
        >
          <SkipBack className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onOfflinePlayPause(reciter.id)}
          disabled={offlineLoading && isOfflineActive}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border disabled:opacity-60"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
          aria-label={playAriaLabel}
        >
          {pickOfflinePlayButtonIcon(isOfflineActive, offlineLoading, offlinePlaying)}
        </button>
        <button
          type="button"
          onClick={() => onOfflineNextSurah(reciter.id)}
          disabled={offlineTransportDisabled || (isOfflineActive && offlineSurah >= 114)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-40"
          style={{
            color: "var(--pp-text-primary)",
            borderColor: "var(--pp-border-soft)",
            background: "var(--pp-button-bg)",
          }}
          aria-label={tUi("library.audio.offlineNextSurah")}
        >
          <SkipForward className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ReciterCard({
  reciter,
  entryState,
  selectedReciters,
  setSelectedReciters,
  startDownload,
  toggleSample,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  sampleAudioLoading,
  playingSampleId,
  queueBusy,
  tContent,
  tUi,
  offlineActiveReciterId,
  offlineSurah,
  offlinePlaying,
  offlineLoading,
  onOfflinePlayPause,
  onOfflineNextSurah,
  onOfflinePrevSurah,
  activeSurahName,
}: Readonly<ReciterCardProps>) {
  const isSelected =
    selectedReciters.has(reciter.id) ||
    entryState?.fullyDownloaded === true ||
    entryState?.running === true;
  const reciterLabel = stripReciterVariantSuffix(
    resolveI18nOrFallback(tContent, `library.reciters.${reciter.id}`, reciter.name),
  );
  const reciterLabelLen = reciterLabel.length;
  let reciterLabelSizeClass = "text-[clamp(14px,3.2vw,18px)]";
  if (reciterLabelLen >= 36) {
    reciterLabelSizeClass = "text-[clamp(10px,2.8vw,13px)]";
  } else if (reciterLabelLen >= 26) {
    reciterLabelSizeClass = "text-[clamp(11px,3.0vw,14px)]";
  } else if (reciterLabelLen >= 20) {
    reciterLabelSizeClass = "text-[clamp(13px,3.2vw,16px)]";
  }
  const languageChip = useMemo(
    () => buildCombinedLanguageChip(reciter, tContent),
    [reciter, tContent],
  );

  return (
    <article
      key={reciter.id}
      className="rounded-xl border p-3 relative overflow-hidden pp-quran-reading-card pp-white-border-glow"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none" />
      <div className="relative z-10 space-y-2">
        {languageChip ? (
          <div className="flex justify-end">
            <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-white/10 text-white/70 border border-white/5 whitespace-nowrap max-w-full truncate">
              {languageChip}
            </span>
          </div>
        ) : null}
        <div className="flex items-start gap-2 w-full">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={entryState?.running ?? false}
            onChange={(e) => {
              if (e.target.checked && !selectedReciters.has(reciter.id)) {
                setSelectedReciters((prev) => new Set([...prev, reciter.id]));
                startDownload(reciter);
              } else if (!e.target.checked && selectedReciters.has(reciter.id)) {
                setSelectedReciters((prev) => {
                  const next = new Set(prev);
                  next.delete(reciter.id);
                  return next;
                });
              }
            }}
            className={`mt-1 flex-shrink-0 ${entryState?.fullyDownloaded ? "accent-emerald-400" : "accent-white/50"}`}
            aria-label={tContent("library.audio.selectReciter", { name: reciter.name })}
          />
          <h3
            className={`font-semibold text-white leading-tight flex-1 min-w-0 pt-0.5 whitespace-nowrap tracking-tight overflow-hidden text-ellipsis ${reciterLabelSizeClass}`}
          >
            {reciterLabel}
          </h3>
        </div>

        <ReciterDownloadActionRow
          reciter={reciter}
          entryState={entryState}
          selectedReciters={selectedReciters}
          setSelectedReciters={setSelectedReciters}
          startDownload={startDownload}
          toggleSample={toggleSample}
          pauseDownload={pauseDownload}
          resumeDownload={resumeDownload}
          cancelDownload={cancelDownload}
          sampleAudioLoading={sampleAudioLoading}
          playingSampleId={playingSampleId}
          queueBusy={queueBusy}
          tContent={tContent}
          tUi={tUi}
        />

        {entryState?.fullyDownloaded ? (
          <div
            className="w-full rounded-xl border-2 border-white/40 p-2 sm:p-3 relative overflow-hidden backdrop-blur-sm mt-1"
            style={{
              borderColor: "var(--pp-home-cta-border)",
              boxShadow:
                "0 8px 32px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25 pointer-events-none rounded-xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <ReciterOfflineTransportRow
                reciter={reciter}
                tUi={tUi}
                offlineActiveReciterId={offlineActiveReciterId}
                offlineSurah={offlineSurah}
                offlinePlaying={offlinePlaying}
                offlineLoading={offlineLoading}
                onOfflinePlayPause={onOfflinePlayPause}
                onOfflineNextSurah={onOfflineNextSurah}
                onOfflinePrevSurah={onOfflinePrevSurah}
                activeSurahName={activeSurahName}
              />
            </div>
          </div>
        ) : null}

        {entryState?.error ? <div className="text-xs text-red-300">{entryState.error}</div> : null}
      </div>
    </article>
  );
}

export function QuranAudioLibrarySubpage({
  onBackToLibraryHome,
  libraryLanguage,
  uiLanguage,
  uiIsRtl,
  sessionKey,
}: Readonly<QuranAudioLibrarySubpageProps>) {
  const { t, i18n } = useTranslation();

  const navigationLanguage = libraryLanguage;
  const isContentRTL = isRtlLanguage(navigationLanguage);
  const tContent = i18n.getFixedT(navigationLanguage);
  const tContentRef = useRef(tContent);
  tContentRef.current = tContent;
  const tUi = i18n.getFixedT(uiLanguage);

  const prevSessionKey = useRef(sessionKey);
  useEffect(() => {
    if (sessionKey === undefined || sessionKey === prevSessionKey.current) return;
    prevSessionKey.current = sessionKey;
    onBackToLibraryHome();
  }, [sessionKey, onBackToLibraryHome]);

  const [reciters, setReciters] = useState<QuranAudioReciter[]>(() => getBundledReciters());
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadStateByReciter, setDownloadStateByReciter] = useState<Record<number, DownloadState>>(() => {
    const bundledIds = new Set(getBundledReciters().map((r) => r.id));
    try {
      const raw = StorageService.getItem(DOWNLOAD_STATE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, DownloadState>;
      const filtered: Record<number, DownloadState> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const id = Number(key);
        if (!Number.isFinite(id)) continue;
        if (!bundledIds.has(id)) continue;
        filtered[id] = value;
      }
      return filtered;
    } catch {
      return {};
    }
  });
  const [pendingConsent, setPendingConsent] = useState<PendingConsent | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [isWifiConnection, setIsWifiConnection] = useState<boolean | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState(0); // 0–1 ratio when user is pulling to refresh
  const [selectedReciters, setSelectedReciters] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"sync" | "nosync">("sync");
  const [sampleAudioLoading, setSampleAudioLoading] = useState<number | null>(null);
  const [playingSampleId, setPlayingSampleId] = useState<number | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const offlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const offlineObjectUrlRef = useRef<string | null>(null);
  const [offlineActiveReciterId, setOfflineActiveReciterId] = useState<number | null>(null);
  const [offlineSurah, setOfflineSurah] = useState(1);
  const [offlinePlaying, setOfflinePlaying] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const offlineUiRef = useRef({
    activeId: null as number | null,
    surah: 1,
    playing: false,
  });
  const offlineAutoAdvanceRef = useRef(false);
  // Refs for values needed inside callbacks that run before their React state deps stabilize.
  const surahsRef = useRef<Surah[]>([]);
  const libraryLanguageRef = useRef<string>(libraryLanguage);

  const controllerByReciterRef = useRef<Record<number, AbortController>>({});
  const touchStartYRef = useRef(0);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const consentModalRef = useRef<HTMLDialogElement>(null);
  const consentCancelButtonRef = useRef<HTMLButtonElement>(null);

  const detectWifiConnection = useCallback(() => {
    const connection = (navigator as Navigator & {
      connection?: { type?: string; effectiveType?: string; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
      mozConnection?: { type?: string; effectiveType?: string; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
      webkitConnection?: { type?: string; effectiveType?: string; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
    }).connection
      || (navigator as Navigator & { mozConnection?: { type?: string; effectiveType?: string; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void } }).mozConnection
      || (navigator as Navigator & { webkitConnection?: { type?: string; effectiveType?: string; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void } }).webkitConnection;

    if (!connection) {
      // No Network Information API — cannot prove unmetered Wi‑Fi; Wi‑Fi-only mode must ask or wait.
      setIsWifiConnection(null);
      return;
    }

    if (typeof connection.type === "string" && connection.type.length > 0) {
      const link = connection.type.toLowerCase();
      if (link === "wifi" || link === "ethernet") {
        setIsWifiConnection(true);
        return;
      }
      if (link === "cellular" || link === "wimax") {
        setIsWifiConnection(false);
        return;
      }
      // e.g. "unknown", "none", "mixed" — do not assume Wi‑Fi (iOS often reports ambiguous values).
      setIsWifiConnection(null);
      return;
    }

    // iOS WebKit commonly omits `type` while still exposing `effectiveType`; the latter is not a Wi‑Fi indicator.
    setIsWifiConnection(null);
  }, []);

  useEffect(() => {
    offlineUiRef.current = {
      activeId: offlineActiveReciterId,
      surah: offlineSurah,
      playing: offlinePlaying,
    };
  }, [offlineActiveReciterId, offlineSurah, offlinePlaying]);

  useEffect(() => { surahsRef.current = surahs; }, [surahs]);
  useEffect(() => { libraryLanguageRef.current = libraryLanguage; }, [libraryLanguage]);

  const releaseOfflineAudioEngine = useCallback(() => {
    if (offlineAudioRef.current) {
      offlineAudioRef.current.pause();
      offlineAudioRef.current = null;
    }
    if (offlineObjectUrlRef.current) {
      URL.revokeObjectURL(offlineObjectUrlRef.current);
      offlineObjectUrlRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      void QuranReaderNativeAudio.stop();
    }
  }, []);

  const stopOfflinePlayback = useCallback(() => {
    offlineAutoAdvanceRef.current = false;
    releaseOfflineAudioEngine();
    setOfflinePlaying(false);
    setOfflineLoading(false);
    setOfflineActiveReciterId(null);
    setOfflineSurah(1);
  }, [releaseOfflineAudioEngine]);

  const pauseSamplePlayback = useCallback(() => {
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current.currentTime = 0;
      sampleAudioRef.current = null;
    }
    setPlayingSampleId(null);
    setSampleAudioLoading(null);
  }, []);

  const resolveOfflinePlaybackUrl = useCallback(
    async (reciterId: number, surah: number): Promise<string | null> => {
      // On native we hand the URL to AVPlayer / Android MediaPlayer via the
      // QuranReaderNativeAudio plugin, so we MUST request the raw `file://` URI
      // ("nativeAv"). The default "webview" target returns a `capacitor://` URL
      // that AVPlayer cannot load (silently fails, producing no audio).
      const target: "nativeAv" | "webview" = Capacitor.isNativePlatform() ? "nativeAv" : "webview";
      const directUrl = await getOfflineSurahNativePlaybackUrl(reciterId, surah, target);
      if (directUrl) return directUrl;
      const blob = await getOfflineSurahAudio(reciterId, surah);
      if (!blob) return null;
      const objectUrl = URL.createObjectURL(blob);
      offlineObjectUrlRef.current = objectUrl;
      return objectUrl;
    },
    [],
  );

  const loadOfflineSurah = useCallback(
    async (reciterId: number, surah: number) => {
      pauseSamplePlayback();
      releaseOfflineAudioEngine();
      setOfflineActiveReciterId(reciterId);
      setOfflineSurah(surah);
      setOfflineLoading(true);
      setOfflinePlaying(false);
      try {
        const url = await resolveOfflinePlaybackUrl(reciterId, surah);
        if (!url) {
          setNetworkError(tContentRef.current("library.audio.loadFailed"));
          stopOfflinePlayback();
          return;
        }

        if (Capacitor.isNativePlatform()) {
          // Route through the native plugin so the lockscreen gets artwork,
          // title/artist metadata, and Play/Pause + Prev/Next-surah remote commands.
          const reciterName = reciters.find((r) => r.id === reciterId)?.name ?? "";
          const surahName = resolveLocalizedSurahNameForPlayback(
            surahsRef.current,
            surah,
            libraryLanguageRef.current as QuranLanguageCode,
          );
          await QuranReaderNativeAudio.playOne({
            url,
            title: surahName,
            artist: reciterName,
            remoteSurahCommands: true,
          });
          // When the user starts Quran Audio playback from the library, we treat it as a
          // continuous surah session (auto-advance to the next surah on end).
          offlineAutoAdvanceRef.current = true;
          setOfflinePlaying(true);
          return;
        }

        const audio = new Audio(url);
        offlineAudioRef.current = audio;
        audio.onended = () => setOfflinePlaying(false);
        audio.onerror = () => {
          setNetworkError(tContentRef.current("library.audio.loadFailed"));
          stopOfflinePlayback();
        };
        await audio.play();
        offlineAutoAdvanceRef.current = true;
        setOfflinePlaying(true);
      } catch (e) {
        console.error(e);
        setNetworkError(tContentRef.current("library.audio.loadFailed"));
        stopOfflinePlayback();
      } finally {
        setOfflineLoading(false);
      }
    },
    [
      pauseSamplePlayback,
      releaseOfflineAudioEngine,
      resolveOfflinePlaybackUrl,
      stopOfflinePlayback,
      reciters,
    ],
  );

  const handleOfflinePlayPause = useCallback(
    (reciterId: number) => {
      pauseSamplePlayback();
      const { activeId, playing } = offlineUiRef.current;

      if (activeId === reciterId) {
        if (Capacitor.isNativePlatform()) {
          if (playing) {
            void QuranReaderNativeAudio.pause();
            setOfflinePlaying(false);
          } else {
            void QuranReaderNativeAudio.resume();
            setOfflinePlaying(true);
          }
          return;
        }
        if (offlineAudioRef.current) {
          if (playing) {
            offlineAudioRef.current.pause();
            setOfflinePlaying(false);
            return;
          }
          void offlineAudioRef.current.play().then(() => setOfflinePlaying(true)).catch((err) => {
            console.error(err);
            setNetworkError(tContentRef.current("library.audio.loadFailed"));
          });
          return;
        }
      }
      void loadOfflineSurah(reciterId, 1);
    },
    [loadOfflineSurah, pauseSamplePlayback],
  );

  const handleOfflineNextSurah = useCallback(
    (reciterId: number) => {
      if (offlineUiRef.current.activeId !== reciterId) return;
      const next = offlineUiRef.current.surah + 1;
      if (next > 114) return;
      void loadOfflineSurah(reciterId, next);
    },
    [loadOfflineSurah],
  );

  const handleOfflinePrevSurah = useCallback(
    (reciterId: number) => {
      if (offlineUiRef.current.activeId !== reciterId) return;
      const prev = offlineUiRef.current.surah - 1;
      if (prev < 1) return;
      void loadOfflineSurah(reciterId, prev);
    },
    [loadOfflineSurah],
  );

  // On native, the lockscreen / headset / notification can drive state.
  // Mirror those events into React state so the in-app mini-player stays in sync.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: PluginListenerHandle[] = [];
    void (async () => {
      handles.push(
        await QuranReaderNativeAudio.addListener("paused", () => setOfflinePlaying(false)),
        await QuranReaderNativeAudio.addListener("resumed", () => setOfflinePlaying(true)),
        await QuranReaderNativeAudio.addListener("ended", () => {
          const { activeId, surah } = offlineUiRef.current;
          // If the user intentionally paused/stopped, do not auto-advance.
          if (!offlineAutoAdvanceRef.current) {
            setOfflinePlaying(false);
            return;
          }
          if (activeId == null) {
            setOfflinePlaying(false);
            return;
          }
          if (surah >= 114) {
            offlineAutoAdvanceRef.current = false;
            setOfflinePlaying(false);
            return;
          }
          // Advance to the next surah.
          void loadOfflineSurah(activeId, surah + 1);
        }),
        await QuranReaderNativeAudio.addListener("aborted", () => {
          offlineAutoAdvanceRef.current = false;
          setOfflinePlaying(false);
          setOfflineActiveReciterId(null);
          setOfflineSurah(1);
        }),
        await QuranReaderNativeAudio.addListener("surahStep", (payload) => {
          const { activeId, surah } = offlineUiRef.current;
          if (activeId == null) return;
          // User initiated navigation: keep auto-advance on.
          offlineAutoAdvanceRef.current = true;
          const dir =
            payload && typeof payload === "object" && "direction" in payload && typeof payload.direction === "number"
              ? payload.direction
              : 0;
          if (dir === -1 && surah > 1) {
            void loadOfflineSurah(activeId, surah - 1);
          } else if (dir === 1 && surah < 114) {
            void loadOfflineSurah(activeId, surah + 1);
          }
        }),
      );
    })();
    return () => {
      for (const h of handles) void h.remove();
    };
  }, [loadOfflineSurah]);

  // Debounce persistence of download state to prevent flooding native Preferences bridge
  useEffect(() => {
    const timer = setTimeout(() => {
      const bundledIds = new Set(getBundledReciters().map((r) => r.id));
      const filtered: Record<number, DownloadState> = {};
      for (const [key, value] of Object.entries(downloadStateByReciter)) {
        const id = Number(key);
        if (!Number.isFinite(id)) continue;
        if (!bundledIds.has(id)) continue;
        filtered[id] = value;
      }
      StorageService.setItem(
        DOWNLOAD_STATE_STORAGE_KEY,
        JSON.stringify(filtered),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [downloadStateByReciter]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const connection = (navigator as Navigator & {
      connection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
      mozConnection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
      webkitConnection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
    }).connection
      || (navigator as Navigator & { mozConnection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void } }).mozConnection
      || (navigator as Navigator & { webkitConnection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void } }).webkitConnection;
    const handleConnectionChange = () => detectWifiConnection();

    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    connection?.addEventListener?.("change", handleConnectionChange);
    detectWifiConnection();

    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
      connection?.removeEventListener?.("change", handleConnectionChange);
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
      }
      stopOfflinePlayback();
    };
  }, [detectWifiConnection, stopOfflinePlayback]);

  // Load surah metadata once for localized name display in the mini-player.
  // loadSurahMetadata() caches the JSON in module memory, so subsequent calls are free.
  useEffect(() => {
    let cancelled = false;
    void loadSurahMetadata().then((list) => {
      if (!cancelled) setSurahs(list);
    }).catch(() => { /* mini-player just falls back to no caption */ });
    return () => { cancelled = true; };
  }, []);

  const getLocalizedSurahName = useCallback(
    (n: number): string | null => {
      const surah = surahs.find((s) => s.number === n);
      if (!surah) return null;
      const lng = libraryLanguage as QuranLanguageCode;
      if (lng === "ar") return surah.nameArabic || surah.nameTransliterated;
      const translated = surah.nameTranslated[lng];
      if (translated && translated.trim().length > 0) return translated;
      return surah.nameTranslated.en || surah.nameTransliterated || surah.nameArabic;
    },
    [surahs, libraryLanguage],
  );

  const activeSurahName =
    offlineActiveReciterId === null ? null : getLocalizedSurahName(offlineSurah);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Bundled reciters are already in state — show them immediately.
      // All bundled reciters are curated & verified to exist in R2 — no HEAD-check needed.
      setLoading(false);
      setError(null);
      setNetworkError(null);

      try {
        // Load the authoritative reciter list (bundled, no network)
        const loaded = await fetchQuranAudioReciters();
        if (cancelled) return;

        const relevant = loaded
          .filter((entry) => entry.id <= 170)
          .filter((entry) => entry.sectionId === 1 || entry.sectionId === 3 || entry.sectionId === 4);

        setReciters(relevant);

        // Single batch call reads filesystem once instead of 46 sequential native bridge calls.
        // On native: 1 readdir(root) + 1 readdir(parent) + 1 readdir per downloaded reciter.
        // On web: 1 IndexedDB getAllKeys call total.
        const allStates = await getAllRecitersDownloadState(relevant.map(r => r.id));
        if (cancelled) return;

        const batchState: Record<number, DownloadState> = {};
        for (const reciter of relevant) {
          const state = allStates[reciter.id] ?? { downloaded: 0, total: 114, fullyDownloaded: false };
          batchState[reciter.id] = {
            running: false,
            paused: false,
            completed: state.fullyDownloaded ? 114 : state.downloaded,
            total: 114,
            error: null,
            fullyDownloaded: state.fullyDownloaded,
            currentSurah: state.fullyDownloaded ? 114 : state.downloaded + 1,
            lastUpdatedAt: Date.now(),
          };
        }

        if (!cancelled) {
          setDownloadStateByReciter((prev) => ({ ...prev, ...batchState }));
        }
      } catch (err) {
        if (cancelled) return;
        // Show a non-blocking network error — the bundled reciter list stays visible.
        const errorMessage = err instanceof Error ? err.message : tContentRef.current("quran.retry");
        setNetworkError(errorMessage);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const completeReciters = useMemo(() => {
    const tabFiltered = reciters.filter((entry) =>
      activeTab === "sync" ? entry.hasSync : !entry.hasSync,
    );
    return sortRecitersByDisplayLabel(
      tabFiltered,
      (r) => stripReciterVariantSuffix(
        resolveI18nOrFallback(tContent, `library.reciters.${r.id}`, r.name),
      ),
      libraryLanguage,
    );
  }, [reciters, libraryLanguage, activeTab, tContent]);

  const toggleSample = useCallback((reciter: QuranAudioReciter) => {
    if (playingSampleId === reciter.id || sampleAudioLoading === reciter.id) {
      pauseSamplePlayback();
      return;
    }
    stopOfflinePlayback();
    pauseSamplePlayback();
    const url = buildQuranicaudioSurahUrl(reciter.id, reciter.relativePath, 1);
    const audio = new Audio(url);
    setSampleAudioLoading(reciter.id);
    audio.onended = () => {
      sampleAudioRef.current = null;
      setPlayingSampleId(null);
      setSampleAudioLoading(null);
    };
    audio.onerror = () => {
      setNetworkError(tContentRef.current("library.audio.loadFailed"));
      sampleAudioRef.current = null;
      setPlayingSampleId(null);
      setSampleAudioLoading(null);
    };
    audio.oncanplay = () => {
      setSampleAudioLoading(null);
    };
    audio
      .play()
      .then(() => {
        sampleAudioRef.current = audio;
        setPlayingSampleId(reciter.id);
        setSampleAudioLoading(null);
      })
      .catch((err) => {
        console.error("Audio play failed:", err);
        setNetworkError(tContentRef.current("library.audio.loadFailed"));
        sampleAudioRef.current = null;
        setPlayingSampleId(null);
        setSampleAudioLoading(null);
      });
  }, [playingSampleId, sampleAudioLoading, pauseSamplePlayback, stopOfflinePlayback]);

  const startDownload = useCallback(async (
    reciter: QuranAudioReciter,
    startSurah?: number,
    bypassWifiGate?: boolean,
  ) => {
    if (!isOnline) {
      setDownloadStateByReciter((prev) => ({
        ...prev,
        [reciter.id]: {
          running: false,
          paused: true,
          completed: prev[reciter.id]?.completed ?? 0,
          total: 114,
          error: tContentRef.current("library.audio.offlineError"),
          fullyDownloaded: false,
          currentSurah: prev[reciter.id]?.currentSurah ?? 1,
          lastUpdatedAt: Date.now(),
        },
      }));
      return;
    }

    if (isWifiConnection !== true && !bypassWifiGate) {
      setPendingConsent({ reciterId: reciter.id });
      return;
    }

    if (queueBusy) {
      return;
    }

    setQueueBusy(true);
    try {
      const controller = new AbortController();
      controllerByReciterRef.current[reciter.id] = controller;
      trackQuranAudioDownloadEvent(reciter.id, startSurah ? "download_resume" : "download_start");

      setDownloadStateByReciter((prev) => {
        const existing = prev[reciter.id];
        const initialCompleted = existing?.completed ?? 0;
        return {
          ...prev,
          [reciter.id]: {
            running: true,
            paused: false,
            completed: initialCompleted,
            total: 114,
            error: null,
            fullyDownloaded: false,
            currentSurah: startSurah ?? Math.max(1, initialCompleted + 1),
            lastUpdatedAt: Date.now(),
          },
        };
      });

      await downloadReciterForOffline(
        reciter.id,
        (surahNo) => buildQuranicaudioSurahUrl(reciter.id, reciter.relativePath, surahNo),
        {
          startSurah,
          signal: controller.signal,
          onProgress: (completed, total, currentSurah) => {
            setDownloadStateByReciter((prev) => ({
              ...prev,
              [reciter.id]: {
                running: true,
                paused: false,
                completed,
                total,
                error: null,
                fullyDownloaded: completed >= total,
                currentSurah,
                lastUpdatedAt: Date.now(),
              },
            }));
          },
        },
      );

      setDownloadStateByReciter((prev) => ({
        ...prev,
        [reciter.id]: {
          running: false,
          paused: false,
          completed: 114,
          total: 114,
          error: null,
          fullyDownloaded: true,
          currentSurah: 114,
          lastUpdatedAt: Date.now(),
        },
      }));
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      let errorMessage: string | null = null;
      if (!isAbort) {
        errorMessage = err instanceof Error ? err.message : tContentRef.current("library.audio.downloadFailed");
      }
      setDownloadStateByReciter((prev) => ({
        ...prev,
        [reciter.id]: {
          running: false,
          paused: isAbort,
          completed: prev[reciter.id]?.completed ?? 0,
          total: 114,
          error: errorMessage,
          fullyDownloaded: false,
          currentSurah: prev[reciter.id]?.currentSurah ?? Math.max(1, (prev[reciter.id]?.completed ?? 0) + 1),
          lastUpdatedAt: Date.now(),
        },
      }));
      if (errorMessage) {
        setNetworkError(tContentRef.current("library.audio.loadFailed"));
      }
    } finally {
      delete controllerByReciterRef.current[reciter.id];
      setQueueBusy(false);
    }
  }, [isOnline, isWifiConnection, queueBusy]);

  const pauseDownload = useCallback((reciterId: number) => {
    trackQuranAudioDownloadEvent(reciterId, "download_pause");
    controllerByReciterRef.current[reciterId]?.abort();
  }, []);

  const cancelDownload = useCallback(async (reciterId: number) => {
    if (offlineActiveReciterId === reciterId) {
      stopOfflinePlayback();
    }
    const state = downloadStateByReciter[reciterId];
    trackQuranAudioDownloadEvent(reciterId, state?.fullyDownloaded ? "download_clear" : "download_cancel");
    controllerByReciterRef.current[reciterId]?.abort();
    await clearReciterOfflineAudio(reciterId);
    setDownloadStateByReciter((prev) => ({
      ...prev,
      [reciterId]: {
        running: false,
        paused: false,
        completed: 0,
        total: 114,
        error: null,
        fullyDownloaded: false,
        currentSurah: 1,
        lastUpdatedAt: Date.now(),
      },
    }));
  }, [downloadStateByReciter, offlineActiveReciterId, stopOfflinePlayback]);

  const resumeDownload = useCallback(async (reciter: QuranAudioReciter) => {
    const current = downloadStateByReciter[reciter.id];
    const startSurah = current?.currentSurah ?? Math.max(1, (current?.completed ?? 0) + 1);
    await startDownload(reciter, startSurah);
  }, [downloadStateByReciter, startDownload]);

  useEffect(() => {
    if (!isOnline || queueBusy) return;
    if (isWifiConnection !== true) return;

    const pausedReciter = completeReciters.find((reciter) => {
      const state = downloadStateByReciter[reciter.id];
      return state?.paused && !state?.fullyDownloaded;
    });

    if (pausedReciter) {
      void resumeDownload(pausedReciter);
    }
  }, [completeReciters, downloadStateByReciter, isOnline, isWifiConnection, queueBusy, resumeDownload]);



  useEffect(() => {
    if (!pendingConsent) return;

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    requestAnimationFrame(() => {
      consentCancelButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pendingConsent) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setPendingConsent(null);
        return;
      }

      if (event.key !== "Tab") return;

      const modal = consentModalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      lastFocusedElementRef.current?.focus();
      lastFocusedElementRef.current = null;
    };
  }, [pendingConsent]);

  const handlePullToRefresh = useCallback(() => {
    const scrollContainer = document.querySelector(".page-scroll-content");
    if (!scrollContainer) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (scrollContainer.scrollTop === 0) {
        const startTouch = e.touches?.[0];
        if (!startTouch || typeof startTouch.clientY !== "number") {
          return;
        }
        touchStartYRef.current = startTouch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === 0) return;
      if (scrollContainer.scrollTop > 0) {
        touchStartYRef.current = 0;
        setPullProgress(0);
        return;
      }
      const moveTouch = e.touches?.[0];
      if (!moveTouch || typeof moveTouch.clientY !== "number") {
        return;
      }
      const diff = moveTouch.clientY - touchStartYRef.current;
      if (diff > 0) {
        setPullProgress(Math.min(1, diff / 80));
      } else {
        setPullProgress(0);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = 0;
      setPullProgress(0);
      if (!startY) {
        return;
      }
      const endTouch = e.changedTouches?.[0];
      if (!endTouch || typeof endTouch.clientY !== "number") {
        return;
      }
      const diff = endTouch.clientY - startY;
      if (scrollContainer.scrollTop === 0 && diff > 80) {
        setNetworkError(null);
        setError(null);
        setReloadKey((current) => current + 1);
      }
    };

    scrollContainer.addEventListener("touchstart", handleTouchStart);
    scrollContainer.addEventListener("touchmove", handleTouchMove, { passive: true });
    scrollContainer.addEventListener("touchend", handleTouchEnd);

    return () => {
      scrollContainer.removeEventListener("touchstart", handleTouchStart);
      scrollContainer.removeEventListener("touchmove", handleTouchMove);
      scrollContainer.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    const cleanup = handlePullToRefresh();
    return cleanup;
  }, [handlePullToRefresh]);

  let downloadOptionsContent: React.ReactNode = null;
  if (loading) {
    downloadOptionsContent = (
      <div className="text-sm pp-text-secondary flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{tContent("library.loading")}</span>
      </div>
    );
  } else if (error) {
    downloadOptionsContent = (
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-300 flex-1">{tContent("library.audio.loadFailed")}</span>
        <button
          onClick={() => { setError(null); setNetworkError(null); setReloadKey((c) => c + 1); }}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold pp-text-primary"
          style={{ background: 'var(--pp-button-bg)', borderColor: 'var(--pp-border-soft)' }}
        >
          {tContent("quran.retry")}
        </button>
      </div>
    );
  } else if (networkError) {
    downloadOptionsContent = (
      <div className="rounded-xl border px-3 py-2 pp-quran-bookmark-row text-xs space-y-1.5">
        <div className="text-red-400 font-semibold flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          {networkError}
        </div>
      </div>
    );
  }

  return (
    <LibrarySubpageShell
      title={t("library.audioLibraryTitle", { lng: navigationLanguage })}
      uiLanguage={uiLanguage}
      uiIsRtl={uiIsRtl}
      contentLanguage={navigationLanguage}
      contentIsRtl={isContentRTL}
      contentClassName="pb-4 space-y-2 mt-2"
      controlsRow={
        // Download options card shares the back-button row.
        // Loading/error states and tab buttons are rendered inside the content area.
        <div className="flex-1 min-w-0">
          {downloadOptionsContent}
        </div>
      }
    >
      <div className="w-full md:max-w-2xl md:mx-auto">
        {/* Pull-to-refresh visual indicator */}
        {pullProgress > 0 && (
          <div className="flex justify-center py-2">
            <div
              className="rounded-full border p-1.5 pp-glass-surface-strong"
              style={{ opacity: pullProgress }}
            >
              <Loader2
                className="w-4 h-4 pp-text-secondary"
                style={{ transform: `rotate(${pullProgress * 360}deg)`, transition: "none" }}
              />
            </div>
          </div>
        )}

        {/* Tab buttons — Content-Immersive Zone: use tContent (Curated Translations language) */}
        <div className="flex rounded-xl overflow-hidden border p-1 mb-2" style={{ borderColor: 'var(--pp-border-soft)' }}>
          <button
            onClick={() => setActiveTab("sync")}
            aria-pressed={activeTab === "sync"}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all border`}
            style={{
              background: activeTab === "sync" ? 'var(--pp-button-bg)' : 'var(--pp-button-bg-soft)',
              color: activeTab === "sync" ? 'var(--pp-text-primary)' : 'var(--pp-text-secondary)',
              borderColor: activeTab === "sync" ? 'var(--pp-border-strong)' : 'transparent'
            }}
          >
            {tContent("library.audio.textHighlightSync")}
          </button>
          <button
            onClick={() => setActiveTab("nosync")}
            aria-pressed={activeTab === "nosync"}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all border`}
            style={{
              background: activeTab === "nosync" ? 'var(--pp-button-bg)' : 'var(--pp-button-bg-soft)',
              color: activeTab === "nosync" ? 'var(--pp-text-primary)' : 'var(--pp-text-secondary)',
              borderColor: activeTab === "nosync" ? 'var(--pp-border-strong)' : 'transparent'
            }}
          >
            {tContent("library.audio.listeningOnly")}
          </button>
        </div>

        <div className="space-y-3">
          {completeReciters.map((reciter) => (
            <ReciterCard
              key={reciter.id}
              reciter={reciter}
              entryState={downloadStateByReciter[reciter.id]}
              selectedReciters={selectedReciters}
              setSelectedReciters={setSelectedReciters}
              startDownload={startDownload}
              toggleSample={toggleSample}
              pauseDownload={pauseDownload}
              resumeDownload={resumeDownload}
              cancelDownload={cancelDownload}
              sampleAudioLoading={sampleAudioLoading}
              playingSampleId={playingSampleId}
              queueBusy={queueBusy}
              tContent={tContent}
              tUi={tUi}
              offlineActiveReciterId={offlineActiveReciterId}
              offlineSurah={offlineSurah}
              offlinePlaying={offlinePlaying}
              offlineLoading={offlineLoading}
              onOfflinePlayPause={handleOfflinePlayPause}
              onOfflineNextSurah={handleOfflineNextSurah}
              onOfflinePrevSurah={handleOfflinePrevSurah}
              activeSurahName={activeSurahName}
            />
          ))}
        </div>

      {pendingConsent ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <dialog
            ref={consentModalRef}
            open
            className="w-full max-w-md rounded-2xl border p-4 pp-quran-bookmark-row space-y-3 bg-transparent"
            aria-label={tUi("library.audio.cellularConsentTitle")}
          >
            <h3 className="font-semibold pp-text-primary">{tUi("library.audio.cellularConsentTitle")}</h3>
            <p className="text-sm pp-text-secondary">
              {tUi("library.audio.cellularConsentBody", {
                name: stripReciterVariantSuffix(
                  resolveI18nOrFallback(
                    tUi,
                    `library.reciters.${pendingConsent.reciterId}`,
                    completeReciters.find((r) => r.id === pendingConsent.reciterId)?.name ?? "",
                  ),
                ),
              })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                ref={consentCancelButtonRef}
                onClick={() => setPendingConsent(null)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--pp-border-soft)', color: 'var(--pp-text-primary)' }}
              >
                {tUi("library.audio.waitForWifi")}
              </button>
              <button
                onClick={() => {
                  const reciter = completeReciters.find((item) => item.id === pendingConsent.reciterId);
                  setPendingConsent(null);
                  if (reciter) {
                    void startDownload(reciter, undefined, true);
                  }
                }}
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--pp-border-soft)', color: 'var(--pp-text-primary)' }}
              >
                {tUi("library.audio.downloadNow")}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
      </div>
    </LibrarySubpageShell>
  );
}

export const QURANICAUDIO_ATTRIBUTION = "Quran Audio databases provided by the open-source Quran.com and QuranicAudio.com networks.";
