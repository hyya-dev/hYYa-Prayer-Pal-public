import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUpToLine, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { LibrarySubpageShell } from "@/components/Library/LibrarySubpageShell";
import { GlassButton } from "@/components/Library/GlassButton";
import { TafsirSourceTile } from "@/components/Library/TafsirSourceTile";
import { BookmarkButton } from "@/components/Quran/BookmarkButton";
import { formatLocalizedNumber } from "@/lib/formatUtils";
import { sanitizeTafsirHtml, stripDuplicateBasmalaPrefix } from "@/lib/tafsirHtmlUtils";
import { loadSurahMetadata, loadSurahVerses } from "@/services/quranService";
import {
  getAllTafsirBookmarks,
  toggleTafsirVerseBookmark,
} from "@/services/tafsirBookmarkService";
import {
  getTafsirReadingStateForWork,
  saveTafsirReadingState,
} from "@/services/tafsirReadingStateService";
import {
  TAFSIR_CATALOG,
  getTafsirDisplayName,
  loadTafsirByResourceId,
  type TafsirCatalogItem,
  type TafsirLanguage,
  type TafsirResourceRow,
} from "@/lib/tafsirCatalog";
import type { QuranLanguageCode, Surah } from "@/types/quran";
import { StorageService } from "@/services/StorageService";


type TafsirSubpageProps = {
  onBackToLibraryHome: () => void;
  libraryLanguage: QuranLanguageCode;
  uiLanguage: string;
  uiIsRtl: boolean;
  sessionKey?: number;
};

type BundledTafsirRow = TafsirResourceRow & {
  surahName: string;
};

type VerseTextMap = Map<number, string>;

const tafsirToQuranLanguage: Record<TafsirLanguage, QuranLanguageCode> = {
  arabic: "ar",
  bengali: "bn",
  english: "en",
  russian: "ru",
  urdu: "ur",
};

const quranToTafsirLanguage: Partial<Record<QuranLanguageCode, TafsirLanguage>> = {
  ar: "arabic",
  bn: "bengali",
  en: "english",
  ru: "russian",
  ur: "urdu",
};


const TAFSIR_VERSE_FONT_PRESETS = [16, 22, 28] as const;
const TAFSIR_FONT_PRESETS = [14, 17, 21] as const;

function formatSurahName(surah: Surah | undefined, language: TafsirLanguage, row: TafsirResourceRow): string {
  if (language === "arabic") {
    return surah?.nameArabic || row.sura_name_ar || row.sura_name_en || `${row.sura_no}`;
  }

  const translatedName = surah?.nameTranslated[tafsirToQuranLanguage[language]];
  return translatedName || surah?.nameTranslated.en || surah?.nameTransliterated || row.sura_name_en || row.sura_name_ar || `${row.sura_no}`;
}

function formatSurahNameFromMetadata(surah: Surah | undefined, language: TafsirLanguage): string {
  if (!surah) return "";
  if (language === "arabic") return surah.nameArabic || surah.nameTransliterated;
  return (
    surah.nameTranslated[tafsirToQuranLanguage[language]] ||
    surah.nameTranslated.en ||
    surah.nameTransliterated ||
    surah.nameArabic
  );
}

function safeParseAya(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").replace(/[٠-٩۰-۹]/g, (char) => {
    const charCode = char.charCodeAt(0);
    if (charCode >= 0x0660 && charCode <= 0x0669) return String(charCode - 0x0660);
    if (charCode >= 0x06F0 && charCode <= 0x06F9) return String(charCode - 0x06F0);
    return char;
  });
  const match = normalized.match(/^(\d{1,3})$/);
  if (!match) return null;
  const ayaNo = Number(match[1]);
  if (!Number.isFinite(ayaNo) || ayaNo < 1) return null;
  return ayaNo;
}

function deriveSelectLabel(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  const lowered = raw.toLowerCase();
  if (lowered === "select surah") return "Select";

  const candidates = [
    raw.replace(/\b(surah|sura)\b/gi, ""),
    raw.replace(/سورة/g, ""),
  ]
    .map((v) => v.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  return candidates[0] ?? raw;
}

export function TafsirSubpage({
  onBackToLibraryHome,
  libraryLanguage,
  uiLanguage,
  uiIsRtl,
  sessionKey,
}: Readonly<TafsirSubpageProps>) {
  const { t, i18n } = useTranslation();
  const isUiRTL = uiIsRtl;
  const navigationLanguage = libraryLanguage;
  const tContent = useMemo(
    () => i18n.getFixedT(navigationLanguage),
    [i18n, navigationLanguage],
  );
  // We use uiLanguage for UI strings (like Title), but libraryLanguage for tafsir content logic
  const curatedTafsirLanguage = quranToTafsirLanguage[libraryLanguage] ?? null;

  const [selectedLanguage, setSelectedLanguage] = useState<TafsirLanguage | null>(curatedTafsirLanguage ?? null);
  const [selectedItem, setSelectedItem] = useState<TafsirCatalogItem | null>(null);
  const [tafsirRows, setTafsirRows] = useState<BundledTafsirRow[] | null>(null);
  const [verseTextByAya, setVerseTextByAya] = useState<VerseTextMap>(new Map());
  const [surahMetadata, setSurahMetadata] = useState<Surah[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [selectedSurahNo, setSelectedSurahNo] = useState<number>(1);
  const [selectedAyaNo, setSelectedAyaNo] = useState<number | null>(null);
  // Single-mode UX: always "Browse" (list). Verse-level drill-down remains available via tap.
  const [jumpInput, setJumpInput] = useState("");
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [showReaderBox, setShowReaderBox] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [tafsirFontSize, setTafsirFontSize] = useState<number>(() => {
    try {
      const saved = StorageService.getItem("tafsir_font_size_v1");
      return saved ? Number(saved) : 17;
    } catch {
      return 17;
    }
  });
  const [tafsirVerseFontSize, setTafsirVerseFontSize] = useState<number>(() => {
    try {
      const saved = StorageService.getItem("tafsir_verse_font_size_v1");
      return saved ? Number(saved) : 22;
    } catch {
      return 22;
    }
  });
  const loadRequestRef = useRef(0);
  const pendingRestoreRef = useRef<{ tafsirId: string; surahNo: number; ayaNo: number } | null>(null);
  const pendingRestoreScrollTopRef = useRef<number | null>(null);
  const pendingRestoreAnchorOffsetRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);
  const lastComputedAnchorRef = useRef<{ ayaNo: number | null; scrollTop: number | null }>({ ayaNo: null, scrollTop: null });
  const scrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRowsCacheRef = useRef(new Map<number, TafsirResourceRow[] | null>());
  const resourceSurahIndexCacheRef = useRef(new Map<number, Map<number, TafsirResourceRow[]>>());
  const chapterRowsCacheRef = useRef(new Map<string, BundledTafsirRow[]>());
  const verseTextCacheRef = useRef(new Map<string, VerseTextMap>());
  /** Keeps latest ayah for commitLoadedRows without widening callback deps. */
  const selectedAyaNoRef = useRef<number | null>(null);
  /** Last surah/resource we committed rows for — same-chapter reload preserves selectedAyaNo. */
  const lastCommittedSurahRef = useRef<number | null>(null);
  const lastCommittedResourceIdRef = useRef<number | null>(null);
  selectedAyaNoRef.current = selectedAyaNo;

  const prevSessionKey = useRef(sessionKey);
  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;
  // Held in a ref so exit-path flushers (unmount, session-key change, pagehide)
  // always invoke the current closure, even when their effects have empty deps.
  const persistReadingAnchorRef = useRef<() => void>(() => {});

  const flushReadingAnchorSave = useCallback(() => {
    if (scrollPersistTimerRef.current) {
      globalThis.clearTimeout(scrollPersistTimerRef.current);
      scrollPersistTimerRef.current = null;
    }
    persistReadingAnchorRef.current();
  }, []);

  useEffect(() => {
    if (sessionKey === undefined || sessionKey === prevSessionKey.current) return;
    prevSessionKey.current = sessionKey;

    // Persist the current scroll position BEFORE we tear down the item/state,
    // otherwise persistReadingAnchorFromScroll() would early-return on the next call.
    flushReadingAnchorSave();

    if (selectedItemRef.current) {
        setSelectedItem(null);
        setShowReaderBox(true);
        setVerseTextByAya(new Map());
        setTafsirRows(null);
        setRowsError(null);
    } else {
        onBackToLibraryHome();
    }
  }, [sessionKey, onBackToLibraryHome, flushReadingAnchorSave]);

  const filteredTafsirItems = useMemo(() => {
    if (!curatedTafsirLanguage || !selectedLanguage) return [];
    return TAFSIR_CATALOG.filter((item) => item.languages.includes(selectedLanguage));
  }, [curatedTafsirLanguage, selectedLanguage]);

  const selectedSource = useMemo(() => {
    if (!selectedItem || !selectedLanguage) return null;
    return selectedItem.sources.find((source) => source.language === selectedLanguage) ?? null;
  }, [selectedItem, selectedLanguage]);

  const tafsirContentIsRtl = selectedLanguage === "arabic" || selectedLanguage === "urdu";

  const surahOptions = useMemo(() => {
    return surahMetadata.map((surah) => ({
      no: surah.number,
      name: formatSurahNameFromMetadata(surah, selectedLanguage ?? "english"),
    }));
  }, [selectedLanguage, surahMetadata]);

  const rowsForSelectedSurah = useMemo(() => tafsirRows ?? [], [tafsirRows]);

  const tafsirBookmarks = useMemo(() => {
    return getAllTafsirBookmarks();
    // bookmarkVersion intentionally drives refreshes after bookmark toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkVersion]);

  const bookmarkedAyaNumbers = useMemo(() => {
    if (!selectedItem || !selectedSource) return new Set<number>();

    return new Set(
      tafsirBookmarks
        .filter((entry) => (
          entry.tafsirId === selectedItem.id
          && entry.resourceId === selectedSource.resourceId
          && entry.language === selectedLanguage
          && entry.surahNo === selectedSurahNo
        ))
        .map((entry) => entry.ayaNo),
    );
  }, [selectedItem, selectedLanguage, selectedSource, selectedSurahNo, tafsirBookmarks]);

  const scholarFavorites = useMemo(() => {
    if (!selectedItem || !selectedSource) return [];
    return tafsirBookmarks
      .filter((entry) => (
        entry.tafsirId === selectedItem.id
        && entry.resourceId === selectedSource.resourceId
        && entry.language === selectedLanguage
      ))
      .sort((a, b) => {
        if (a.surahNo !== b.surahNo) return a.surahNo - b.surahNo;
        return a.ayaNo - b.ayaNo;
      });
  }, [selectedItem, selectedLanguage, selectedSource, tafsirBookmarks]);

  const persistReadingAnchorFromScroll = useCallback(() => {
    const item = selectedItem;
    const lang = selectedLanguage;
    const surah = selectedSurahNo;
    const rows = tafsirRows;
    if (!item || !lang || !rows?.length) return;
    const root = scrollContainerRef.current;
    if (!root) return;

    const rawScrollTop = root.scrollTop;
    const scrollTop = Number.isFinite(rawScrollTop) && rawScrollTop >= 0 ? rawScrollTop : undefined;

    const rootRect = root.getBoundingClientRect();
    const targetYWithin = root.scrollTop + root.clientHeight * 0.33;
    const cards = root.querySelectorAll<HTMLElement>("[data-aya-no]");
    let bestAya: number | null = null;
    let bestDist = Infinity;
    let bestAnchorOffsetPx: number | undefined;

    cards.forEach((el) => {
      const raw = el.dataset.ayaNo;
      if (!raw) return;
      const aya = Number(raw);
      if (!Number.isFinite(aya)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < rootRect.top + 2 || r.top > rootRect.bottom - 2) return;
      // Convert to a stable "within scroll container" coordinate to avoid
      // platform quirks with nested scrolling and fixed headers.
      const elTopWithin = r.top - rootRect.top + root.scrollTop;
      const dist = Math.abs(elTopWithin - targetYWithin);
      if (dist < bestDist) {
        bestDist = dist;
        bestAya = aya;
        bestAnchorOffsetPx = targetYWithin - elTopWithin;
      }
    });

    const anchor = bestAya ?? lastComputedAnchorRef.current.ayaNo ?? rows[0]?.aya_no;
    if (anchor == null) return;

    lastComputedAnchorRef.current = {
      ayaNo: anchor,
      scrollTop: typeof scrollTop === "number" ? scrollTop : null,
    };

    saveTafsirReadingState({
      tafsirId: item.id,
      language: lang,
      surahNo: surah,
      ayaNo: anchor,
      scrollTop,
      anchorOffsetPx: bestAnchorOffsetPx,
      timestamp: Date.now(),
    });
  }, [selectedItem, selectedLanguage, selectedSurahNo, tafsirRows]);

  // Keep the ref pointing at the latest closure so empty-deps cleanups
  // can still invoke the up-to-date persist logic.
  persistReadingAnchorRef.current = persistReadingAnchorFromScroll;

  useEffect(() => {
    if (curatedTafsirLanguage) {
      setSelectedLanguage(curatedTafsirLanguage);
    }
  }, [curatedTafsirLanguage]);

  const uiLanguageForTafsir = selectedLanguage ? tafsirToQuranLanguage[selectedLanguage] : "en";
  const localizedSurahWord = tContent("quran.sura", { lng: uiLanguageForTafsir });
  const localizedSelectSurah = deriveSelectLabel(tContent("quran.selectSurah", { lng: uiLanguageForTafsir }));
  const localizedVerseWord = tContent("quran.verse", { lng: uiLanguageForTafsir });
  const verseJumpPlaceholder = tContent("library.tafsir.verseNumberPlaceholder");
  const verseJumpInputAria = tContent("library.tafsir.jumpToVerse");
  const verseJumpGoAria = tContent("library.tafsir.jumpToVerseGo");

  /** Fluid type + length tiers so long localized “Verse number” labels stay inside the h-11 bar. */
  const verseJumpInputClass = useMemo(() => {
    const len = verseJumpPlaceholder.length;
    const fluid =
      len >= 36
        ? "text-[clamp(7px,1.45vw,10px)]"
        : len >= 28
          ? "text-[clamp(7px,1.65vw,11px)]"
          : len >= 22
            ? "text-[clamp(8px,1.9vw,12px)]"
            : "text-[clamp(9px,2.25vw,14px)]";
    return [
      "flex-1 min-w-0 bg-transparent border-0 outline-none tabular-nums leading-tight",
      fluid,
      "overflow-hidden text-ellipsis whitespace-nowrap",
    ].join(" ");
  }, [verseJumpPlaceholder]);

  const ensureLocalResourceRows = useCallback(async (resourceId: number): Promise<TafsirResourceRow[] | null> => {
    if (localRowsCacheRef.current.has(resourceId)) {
      return localRowsCacheRef.current.get(resourceId) ?? null;
    }

    try {
      const data = await loadTafsirByResourceId<unknown>(resourceId);
      const rows = Array.isArray(data)
        ? data
            .filter((row): row is TafsirResourceRow => {
              return !!row && typeof row === "object" && "sura_no" in row && "aya_no" in row && "aya_tafseer" in row;
            })
            .map((row) => ({
              id: Number(row.id) || 0,
              sura_no: Number(row.sura_no),
              aya_no: Number(row.aya_no),
              aya_tafseer: String(row.aya_tafseer ?? ""),
              verse_key: row.verse_key,
              resource_id: row.resource_id,
              language_id: row.language_id,
              sura_name_ar: row.sura_name_ar,
              sura_name_en: row.sura_name_en,
            }))
        : [];

      const surahIndex = new Map<number, TafsirResourceRow[]>();
      for (const row of rows) {
        const existing = surahIndex.get(row.sura_no);
        if (existing) {
          existing.push(row);
        } else {
          surahIndex.set(row.sura_no, [row]);
        }
      }
      for (const [, surahRows] of surahIndex) {
        surahRows.sort((a, b) => a.aya_no - b.aya_no);
      }

      localRowsCacheRef.current.set(resourceId, rows);
      resourceSurahIndexCacheRef.current.set(resourceId, surahIndex);
      return rows;
    } catch {
      localRowsCacheRef.current.set(resourceId, null);
      resourceSurahIndexCacheRef.current.delete(resourceId);
      return null;
    }
  }, []);

  const loadChapterRows = useCallback(async (
    resourceId: number,
    language: TafsirLanguage,
    surahNo: number,
  ): Promise<BundledTafsirRow[]> => {
    const cacheKey = `${resourceId}:${language}:${surahNo}`;
    const cached = chapterRowsCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const surahMap = new Map<number, Surah>(surahMetadata.map((surah) => [surah.number, surah]));

    const localRows = await ensureLocalResourceRows(resourceId);
    if (localRows) {
      const indexedRows = resourceSurahIndexCacheRef.current.get(resourceId)?.get(surahNo) ?? [];
      const rawChapterRows = indexedRows.map((row) => ({
        ...row,
        surahName: formatSurahName(surahMap.get(row.sura_no), language, row),
      }));
      chapterRowsCacheRef.current.set(cacheKey, rawChapterRows);
      return rawChapterRows;
    }

    chapterRowsCacheRef.current.set(cacheKey, []);
    return [];
  }, [ensureLocalResourceRows, surahMetadata]);

  const getChapterRowsFromIndexSync = useCallback((
    resourceId: number,
    language: TafsirLanguage,
    surahNo: number,
  ): BundledTafsirRow[] | null => {
    const cacheKey = `${resourceId}:${language}:${surahNo}`;
    const existing = chapterRowsCacheRef.current.get(cacheKey);
    if (existing) return existing;

    const surahRows = resourceSurahIndexCacheRef.current.get(resourceId)?.get(surahNo);
    if (!surahRows) return null;

    const surahMap = new Map<number, Surah>(surahMetadata.map((surah) => [surah.number, surah]));
    const rawChapterRows = surahRows.map((row) => ({
      ...row,
      surahName: formatSurahName(surahMap.get(row.sura_no), language, row),
    }));
    chapterRowsCacheRef.current.set(cacheKey, rawChapterRows);
    return rawChapterRows;
  }, [surahMetadata]);

  const commitLoadedRows = useCallback((
    rows: BundledTafsirRow[],
    restoredAya: number | undefined,
    loadSurahNo: number,
    resourceId: number,
  ) => {
    setTafsirRows(rows);
    const restored =
      typeof restoredAya === "number" && rows.some((row) => row.aya_no === restoredAya)
        ? restoredAya
        : undefined;
    const prefer = selectedAyaNoRef.current;
    const preferInRows = typeof prefer === "number" && rows.some((row) => row.aya_no === prefer);
    const sameWorkChapter =
      lastCommittedResourceIdRef.current === resourceId
      && lastCommittedSurahRef.current === loadSurahNo;
    let nextAya: number | null;
    if (restored !== undefined) {
      nextAya = restored;
    } else if (sameWorkChapter && preferInRows) {
      nextAya = prefer;
    } else {
      nextAya = rows[0]?.aya_no ?? null;
    }
    lastCommittedSurahRef.current = loadSurahNo;
    lastCommittedResourceIdRef.current = resourceId;
    setSelectedAyaNo(nextAya);
    setRowsError(rows.length === 0 ? tContent("library.noContent") : null);
  }, [tContent]);

  const loadBundledTafsirAsync = useCallback(async (
    resourceId: number,
    language: TafsirLanguage,
    surahNo: number,
    restoredAya: number | undefined,
  ) => {
    const requestId = ++loadRequestRef.current;
    const shouldShowLoader = !localRowsCacheRef.current.has(resourceId);
    setLoadingRows(shouldShowLoader);
    setRowsError(null);
    try {
      const data = await loadChapterRows(resourceId, language, surahNo);
      if (requestId !== loadRequestRef.current) return;
      commitLoadedRows(data, restoredAya, surahNo, resourceId);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setRowsError(err instanceof Error ? err.message : tContent("library.loadError"));
      setTafsirRows([]);
      setSelectedAyaNo(null);
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoadingRows(false);
      }
    }
  }, [commitLoadedRows, loadChapterRows, tContent]);

  const loadBundledTafsir = useCallback(async (resourceId: number, language: TafsirLanguage, surahNo: number) => {
    const restoredAya = pendingRestoreRef.current?.ayaNo;
    const syncRows = getChapterRowsFromIndexSync(resourceId, language, surahNo);
    if (syncRows) {
      setLoadingRows(false);
      commitLoadedRows(syncRows, restoredAya, surahNo, resourceId);
      return;
    }
    await loadBundledTafsirAsync(resourceId, language, surahNo, restoredAya);
  }, [commitLoadedRows, getChapterRowsFromIndexSync, loadBundledTafsirAsync]);

  const loadLocalizedVerseTexts = useCallback(async (surahNo: number, language: TafsirLanguage) => {
    const quranLanguage = tafsirToQuranLanguage[language];
    const cacheKey = `${surahNo}:${quranLanguage}`;
    const cached = verseTextCacheRef.current.get(cacheKey);
    if (cached) {
      setVerseTextByAya(cached);
      return;
    }

    try {
      const verses = await loadSurahVerses(surahNo, quranLanguage);
      const verseMap: VerseTextMap = new Map();
      for (const verse of verses) {
        const text = quranLanguage === "ar"
          ? verse.arabicText
          : (verse.translations[quranLanguage] || verse.arabicText || "");
        verseMap.set(verse.verseNumber, text || "");
      }
      verseTextCacheRef.current.set(cacheKey, verseMap);
      setVerseTextByAya(verseMap);
    } catch {
      const empty = new Map<number, string>();
      verseTextCacheRef.current.set(cacheKey, empty);
      setVerseTextByAya(empty);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const surahs = await loadSurahMetadata();
        if (!cancelled) {
          setSurahMetadata(surahs);
        }
      } catch {
        if (!cancelled) {
          setSurahMetadata([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!curatedTafsirLanguage) {
      setSelectedItem(null);
      setRowsError(tContent("library.noContent"));
      setTafsirRows([]);
      setLoadingRows(false);
      return;
    }

    if (!selectedItem) {
      loadRequestRef.current += 1;
      setTafsirRows(null);
      setVerseTextByAya(new Map());
      setRowsError(null);
      setLoadingRows(false);
      return;
    }

    if (!selectedSource || !selectedLanguage) {
      loadRequestRef.current += 1;
      setSelectedItem(null);
      setTafsirRows(null);
      setRowsError(null);
      setLoadingRows(false);
      return;
    }

    void loadBundledTafsir(selectedSource.resourceId, selectedLanguage, selectedSurahNo);
  }, [curatedTafsirLanguage, selectedItem, selectedLanguage, selectedSource, selectedSurahNo, loadBundledTafsir, tContent]);

  useEffect(() => {
    if (!selectedItem || !selectedSource || !selectedLanguage) {
      return;
    }
    void loadLocalizedVerseTexts(selectedSurahNo, selectedLanguage);
  }, [selectedItem, selectedSource, selectedSurahNo, selectedLanguage, loadLocalizedVerseTexts]);

  useEffect(() => {
    scrollTopRef.current = 0;
    setShowReaderBox(true);
    setShowBookmarkedOnly(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [selectedItem, selectedSurahNo]);

  const entryAyas = useMemo(() => {
    if (!tafsirRows?.length) return [];
    const out: number[] = [];
    for (const row of tafsirRows) {
      if (typeof row.aya_tafseer === "string" && row.aya_tafseer.trim().length > 0) {
        out.push(row.aya_no);
      }
    }
    return out;
  }, [tafsirRows]);

  const currentRow = useMemo(() => {
    if (selectedAyaNo == null) return null;
    const rows = tafsirRows ?? [];
    return rows.find((r) => r.aya_no === selectedAyaNo) ?? null;
  }, [selectedAyaNo, tafsirRows]);

  const goToNearestEntry = useCallback((ayaNo: number) => {
    if (entryAyas.length === 0) return;
    let best = entryAyas[0];
    let bestDist = Math.abs(best - ayaNo);
    for (const a of entryAyas) {
      const d = Math.abs(a - ayaNo);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    setSelectedAyaNo(best);
  }, [entryAyas]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    const hasRows = !!tafsirRows && tafsirRows.length > 0;
    const isSameItem = pending?.tafsirId === selectedItem?.id;
    const surahMatches = pending?.surahNo === selectedSurahNo;
    if (!pending || !selectedItem || !hasRows || !isSameItem) {
      return;
    }
    if (!surahMatches) {
      pendingRestoreRef.current = null;
      pendingRestoreScrollTopRef.current = null;
      pendingRestoreAnchorOffsetRef.current = null;
      isRestoringRef.current = false;
      return;
    }

    const targetAya = pending.ayaNo;
    const firstAyaInChapter = tafsirRows?.[0]?.aya_no;

    requestAnimationFrame(() => {
      const root = scrollContainerRef.current;
      if (!root) return;

      const anchorOffsetPx = pendingRestoreAnchorOffsetRef.current;
      if (typeof anchorOffsetPx === "number" && Number.isFinite(anchorOffsetPx)) {
        const el = root.querySelector<HTMLElement>(`[data-aya-no="${targetAya}"]`);
        if (el) {
          const rootRect = root.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const elTopWithin = elRect.top - rootRect.top + root.scrollTop;
          const desiredScrollTop = elTopWithin + anchorOffsetPx - root.clientHeight * 0.33;
          root.scrollTo({ top: Math.max(0, desiredScrollTop), behavior: "auto" });
          pendingRestoreAnchorOffsetRef.current = null;
          pendingRestoreScrollTopRef.current = null;
          globalThis.setTimeout(() => {
            isRestoringRef.current = false;
            persistReadingAnchorRef.current();
          }, 250);
          return;
        }
      }

      const restoreTop = pendingRestoreScrollTopRef.current;
      if (typeof restoreTop === "number" && Number.isFinite(restoreTop) && restoreTop > 0) {
        root.scrollTo({ top: restoreTop, behavior: "auto" });
        pendingRestoreScrollTopRef.current = null;
        globalThis.setTimeout(() => {
          isRestoringRef.current = false;
          persistReadingAnchorRef.current();
        }, 250);
        return;
      }

      // When the saved anchor is the first ayah of this chapter, scroll to the
      // very top instead of `scrollIntoView({block: "center"})`. Some tafsirs
      // (e.g. Ibn Kathir's Surah 1 intro) put a multi-screen-tall card on aya 1;
      // centering that card lands the user mid-card on every restore.
      if (firstAyaInChapter != null && targetAya === firstAyaInChapter) {
        root.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // For any other ayah, align the TOP of the card with the top of the
      // viewport so the user lands at the start of the tafsir text, not in
      // the middle of an arbitrarily tall card.
      root
        .querySelector<HTMLElement>(`[data-aya-no="${targetAya}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });

    pendingRestoreRef.current = null;
    pendingRestoreScrollTopRef.current = null;
    pendingRestoreAnchorOffsetRef.current = null;
    globalThis.setTimeout(() => {
      isRestoringRef.current = false;
      persistReadingAnchorRef.current();
    }, 350);
  }, [selectedItem, selectedSurahNo, tafsirRows]);

  useEffect(() => {
    const p = pendingRestoreRef.current;
    if (p && p.surahNo !== selectedSurahNo) {
      pendingRestoreRef.current = null;
      pendingRestoreScrollTopRef.current = null;
      pendingRestoreAnchorOffsetRef.current = null;
      isRestoringRef.current = false;
    }
  }, [selectedSurahNo]);

  const openItemSubpage = useCallback(
    (item: TafsirCatalogItem) => {
      const saved =
        selectedLanguage != null
          ? getTafsirReadingStateForWork(item.id, selectedLanguage)
          : null;
      if (saved) {
        isRestoringRef.current = true;
        pendingRestoreRef.current = {
          tafsirId: saved.tafsirId,
          surahNo: saved.surahNo,
          ayaNo: saved.ayaNo,
        };
        pendingRestoreScrollTopRef.current =
          typeof saved.scrollTop === "number" && Number.isFinite(saved.scrollTop) && saved.scrollTop >= 0
            ? saved.scrollTop
            : null;
        pendingRestoreAnchorOffsetRef.current =
          typeof saved.anchorOffsetPx === "number" && Number.isFinite(saved.anchorOffsetPx)
            ? saved.anchorOffsetPx
            : null;
        lastComputedAnchorRef.current = {
          ayaNo: saved.ayaNo,
          scrollTop: pendingRestoreScrollTopRef.current,
        };
        setSelectedSurahNo(saved.surahNo);
        setSelectedAyaNo(saved.ayaNo);
      } else {
        pendingRestoreRef.current = null;
        pendingRestoreScrollTopRef.current = null;
        pendingRestoreAnchorOffsetRef.current = null;
        isRestoringRef.current = false;
        lastComputedAnchorRef.current = { ayaNo: null, scrollTop: null };
        setSelectedSurahNo(1);
        setSelectedAyaNo(1);
      }
      setSelectedItem(item);
    },
    [selectedLanguage],
  );

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!selectedItem) return;
    if (isRestoringRef.current) return;

    const currentTop = event.currentTarget.scrollTop;
    const delta = currentTop - scrollTopRef.current;

    if (currentTop <= 20) {
      setShowReaderBox(true);
      setShowScrollTop(false);
    } else if (delta > 10) {
      setShowReaderBox(false);
      setShowScrollTop(true);
    } else if (delta < -10) {
      setShowReaderBox(true);
      setShowScrollTop(true);
    }

    scrollTopRef.current = currentTop;
    lastComputedAnchorRef.current.scrollTop = Number.isFinite(currentTop) && currentTop >= 0 ? currentTop : null;

    if (scrollPersistTimerRef.current) {
      globalThis.clearTimeout(scrollPersistTimerRef.current);
    }
    scrollPersistTimerRef.current = globalThis.setTimeout(() => {
      scrollPersistTimerRef.current = null;
      persistReadingAnchorFromScroll();
    }, 400);
  }, [selectedItem, persistReadingAnchorFromScroll]);

  // Unmount: flush any pending debounced save so the user's last visible
  // anchor is never lost (e.g. quick scroll-to-top + back-button within 400ms).
  useEffect(
    () => () => {
      if (scrollPersistTimerRef.current) {
        globalThis.clearTimeout(scrollPersistTimerRef.current);
        scrollPersistTimerRef.current = null;
      }
      persistReadingAnchorRef.current();
    },
    [],
  );

  useEffect(() => {
    const flush = () => flushReadingAnchorSave();
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    globalThis.window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      globalThis.window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flushReadingAnchorSave]);

  // Flush the debounced anchor-save on unmount so the last scroll position is
  // persisted when the user navigates away from Library (to Home/Settings/etc.)
  // without incrementing sessionKey.
  useEffect(() => {
    return () => {
      if (scrollPersistTimerRef.current) {
        globalThis.clearTimeout(scrollPersistTimerRef.current);
        scrollPersistTimerRef.current = null;
      }
      persistReadingAnchorRef.current();
    };
  }, []);

  const handleSelectAyaNo = useCallback((ayaNo: number) => {
    setSelectedAyaNo(ayaNo);
  }, []);

  // Persist as soon as the reader has a stable anchor (not only after scroll).
  // Scroll debouncing alone misses first paint, no-scroll reads, and quick exits.
  useEffect(() => {
    if (!selectedItem || !selectedLanguage) return;
    if (!tafsirRows?.length) return;
    if (selectedAyaNo == null) return;
    if (isRestoringRef.current) return;
    const root = scrollContainerRef.current;
    const rawTop = root?.scrollTop;
    const scrollTop = typeof rawTop === "number" && Number.isFinite(rawTop) && rawTop >= 0 ? rawTop : undefined;
    const anchorOffsetPx = pendingRestoreAnchorOffsetRef.current ?? undefined;
    saveTafsirReadingState({
      tafsirId: selectedItem.id,
      language: selectedLanguage,
      surahNo: selectedSurahNo,
      ayaNo: selectedAyaNo,
      scrollTop,
      anchorOffsetPx,
      timestamp: Date.now(),
    });
  }, [selectedItem, selectedLanguage, selectedSurahNo, tafsirRows, selectedAyaNo]);

  const handleBookmarkChanged = useCallback(() => {
    setBookmarkVersion((v) => v + 1);
  }, []);

  const toggleTafsirFontSize = useCallback(() => {
    const verseIndex = TAFSIR_VERSE_FONT_PRESETS.indexOf(tafsirVerseFontSize as (typeof TAFSIR_VERSE_FONT_PRESETS)[number]);
    const tafsirIndex = TAFSIR_FONT_PRESETS.indexOf(tafsirFontSize as (typeof TAFSIR_FONT_PRESETS)[number]);
    const nextVerse = TAFSIR_VERSE_FONT_PRESETS[(verseIndex + 1) % TAFSIR_VERSE_FONT_PRESETS.length];
    const nextTafsir = TAFSIR_FONT_PRESETS[(tafsirIndex + 1) % TAFSIR_FONT_PRESETS.length];
    setTafsirVerseFontSize(nextVerse);
    setTafsirFontSize(nextTafsir);
    try {
      StorageService.setItem("tafsir_verse_font_size_v1", String(nextVerse));
      StorageService.setItem("tafsir_font_size_v1", String(nextTafsir));
    } catch {
      // Ignore persistence failures.
    }
  }, [tafsirFontSize, tafsirVerseFontSize]);

  /** Scholar “page 1”: first ayah of the current surah + top of the scroll area (not only scroll). */
  const jumpToScholarChapterTop = useCallback(() => {
    setShowBookmarkedOnly(false);
    setShowReaderBox(true);
    setSelectedAyaNo(1);
    const root = scrollContainerRef.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root?.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }, []);

  const handleJumpSubmit = useCallback(() => {
    const ayaNo = safeParseAya(jumpInput);
    if (ayaNo == null) return;
    const verseCount = surahMetadata.find((s) => s.number === selectedSurahNo)?.verseCount;
    const boundedAya = verseCount ? Math.min(ayaNo, verseCount) : ayaNo;
    setSelectedAyaNo(boundedAya);
    setJumpInput("");
  }, [jumpInput, selectedSurahNo, surahMetadata]);

  const verseCountForSelectedSurah = useMemo(() => {
    return surahMetadata.find((s) => s.number === selectedSurahNo)?.verseCount ?? null;
  }, [selectedSurahNo, surahMetadata]);

  const goPrevAya = useCallback((currentAya: number) => {
    if (currentAya <= 1) return;
    setSelectedAyaNo(currentAya - 1);
  }, []);

  const goNextAya = useCallback((currentAya: number) => {
    const maxAya = verseCountForSelectedSurah ?? null;
    if (maxAya != null && currentAya >= maxAya) return;
    setSelectedAyaNo(currentAya + 1);
  }, [verseCountForSelectedSurah]);

  const renderBody = () => {
    if (!selectedItem) {
      return (
        <div className="max-w-2xl mx-auto w-full pt-[2.5cm] md:pt-[7.5cm] space-y-3 pb-4 pp-view-enter">
          <div className="space-y-2">
            {filteredTafsirItems.map((item, index) => (
              <TafsirSourceTile
                key={item.id}
                item={item}
                index={index}
                sectionOffset={0}
                selectedLanguage={selectedLanguage ?? "english"}
                isRTL={isUiRTL}
                noContentLabel={tContent("library.noContent")}
                onOpenItemSubpage={openItemSubpage}
              />
            ))}
            {filteredTafsirItems.length === 0 && (
              <div className="pp-tafsir-no-content rounded-xl p-4 border">
                <p className="pp-tafsir-note text-sm">
                  {tContent("library.noResults")}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    const renderFocused = () => {
      if (loadingRows) {
        return (
          <div className="pp-tafsir-status text-sm">
            {tContent("library.loading")}
          </div>
        );
      }

      if (rowsError) {
        return (
          <div className="pp-tafsir-error text-sm">
            {rowsError}
          </div>
        );
      }

      if (!currentRow) {
        return (
          <div className="pp-tafsir-no-content rounded-xl p-4 border">
            <p className="pp-tafsir-note text-sm">
              {tContent("library.noContent")}
            </p>
          </div>
        );
      }

      const localizedAyaNo = formatLocalizedNumber(currentRow.aya_no, uiLanguageForTafsir);
      const verseText = verseTextByAya.get(currentRow.aya_no) || "";
      const tafsirHtml = sanitizeTafsirHtml(stripDuplicateBasmalaPrefix(currentRow.aya_tafseer, currentRow.aya_no));
      const hasEntry = typeof currentRow.aya_tafseer === "string" && currentRow.aya_tafseer.trim().length > 0;

      const selectedAya = selectedAyaNo ?? currentRow.aya_no;
      const prevDisabled = selectedAya <= 1;
      const nextDisabled = verseCountForSelectedSurah != null ? selectedAya >= verseCountForSelectedSurah : false;
      // Arrow direction must follow the UI layout direction (RTL/LTR), not the tafsir content language.
      // Outwards chevrons: right edge points right; left edge points left.
      // In RTL we use flex-row-reverse, so "prev" sits on the right edge and "next" on the left edge.
      const navIsRtl = isUiRTL;
      const PrevChevron = navIsRtl ? ChevronRight : ChevronLeft;
      const NextChevron = navIsRtl ? ChevronLeft : ChevronRight;

      return (
        <div className="space-y-3 relative z-10">
          <article
            data-aya-no={currentRow.aya_no}
            className="pp-tafsir-verse rounded-xl p-4 border relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
            <div className="relative z-[2] space-y-3">
              <div
                dir={navIsRtl ? "rtl" : "ltr"}
                className={[
                  "flex items-center justify-between gap-3",
                  "flex-row",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex items-center gap-2",
                  ].join(" ")}
                >
                  {!navIsRtl && tafsirContentIsRtl && selectedItem?.id && selectedSource?.resourceId && (
                    <BookmarkButton
                      shape="square"
                      size="sm"
                      hideBorder
                      isBookmarked={bookmarkedAyaNumbers.has(currentRow.aya_no)}
                      onToggle={() => {
                        if (!selectedItem?.id || !selectedSource?.resourceId) return;
                        toggleTafsirVerseBookmark(
                          selectedItem.id,
                          selectedSource.resourceId,
                          selectedLanguage ?? "english",
                          selectedSurahNo,
                          currentRow.aya_no,
                        );
                        handleBookmarkChanged();
                      }}
                    />
                  )}

                  <GlassButton
                    onClick={() => goPrevAya(selectedAya)}
                    disabled={prevDisabled}
                    ariaLabel={tContent("quran.previous")}
                    className="!p-2"
                  >
                    <PrevChevron className="w-4 h-4" />
                  </GlassButton>

                  {!navIsRtl && !tafsirContentIsRtl && selectedItem?.id && selectedSource?.resourceId && (
                    <BookmarkButton
                      shape="square"
                      size="sm"
                      hideBorder
                      isBookmarked={bookmarkedAyaNumbers.has(currentRow.aya_no)}
                      onToggle={() => {
                        if (!selectedItem?.id || !selectedSource?.resourceId) return;
                        toggleTafsirVerseBookmark(
                          selectedItem.id,
                          selectedSource.resourceId,
                          selectedLanguage ?? "english",
                          selectedSurahNo,
                          currentRow.aya_no,
                        );
                        handleBookmarkChanged();
                      }}
                    />
                  )}
                </div>

                <p className="pp-tafsir-note text-xs font-semibold text-center flex-1">
                  {localizedVerseWord} {localizedAyaNo}
                  {verseCountForSelectedSurah ? ` · ${formatLocalizedNumber(selectedAya, uiLanguageForTafsir)}/${formatLocalizedNumber(verseCountForSelectedSurah, uiLanguageForTafsir)}` : ""}
                </p>

                <div
                  // Force a stable visual order for the left-edge cluster in RTL:
                  // arrow must be furthest-left, favorite immediately to its right.
                  // Grid + direction:ltr prevents RTL ancestors from reordering children.
                  dir="ltr"
                  style={{ direction: "ltr" }}
                  className="grid grid-flow-col auto-cols-max items-center gap-2"
                >
                  <GlassButton
                    onClick={() => goNextAya(selectedAya)}
                    disabled={nextDisabled}
                    ariaLabel={tContent("quran.next")}
                    className="!p-2"
                  >
                    <NextChevron className="w-4 h-4" />
                  </GlassButton>

                  {navIsRtl && selectedItem?.id && selectedSource?.resourceId && (
                    <BookmarkButton
                      shape="square"
                      size="sm"
                      hideBorder
                      isBookmarked={bookmarkedAyaNumbers.has(currentRow.aya_no)}
                      onToggle={() => {
                        if (!selectedItem?.id || !selectedSource?.resourceId) return;
                        toggleTafsirVerseBookmark(
                          selectedItem.id,
                          selectedSource.resourceId,
                          selectedLanguage ?? "english",
                          selectedSurahNo,
                          currentRow.aya_no,
                        );
                        handleBookmarkChanged();
                      }}
                    />
                  )}
                </div>
              </div>

              {verseText && (
                <p
                  dir={tafsirContentIsRtl ? "rtl" : "ltr"}
                  className="text-start"
                  style={{ fontSize: `${tafsirVerseFontSize}px`, lineHeight: 1.8 }}
                >
                  {verseText}
                </p>
              )}

              {hasEntry ? (
                <div className="text-sm leading-7" dir={tafsirContentIsRtl ? "rtl" : "ltr"} style={{ fontSize: `${tafsirFontSize}px`, lineHeight: 1.9 }}>
                  <div
                    className="[&_blockquote]:border-s-2 [&_blockquote]:border-white/20 [&_blockquote]:ps-4 [&_br]:block [&_br]:content-[''] [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ps-5"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(tafsirHtml) }}
                  />
                </div>
              ) : (
                <div className="pp-tafsir-no-content rounded-xl p-3 border">
                  <p className="pp-tafsir-note text-sm">
                    {tContent("library.noContent")}
                  </p>
                  {selectedAyaNo != null && entryAyas.length > 0 && (
                    <div className="mt-2">
                      <GlassButton onClick={() => goToNearestEntry(selectedAyaNo)} ariaLabel="Nearest entry" className="!py-2 !px-3 text-sm">
                        Nearest entry
                      </GlassButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        </div>
      );
    };

    const renderFavoritesList = () => {
      if (scholarFavorites.length === 0) {
        return (
          <div className="pp-tafsir-no-content rounded-xl p-4 border">
            <p className="pp-tafsir-note text-sm">
              {tContent("library.noContent")}
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-2 relative z-10">
          {scholarFavorites.map((fav) => {
            const surahName = surahOptions.find((s) => s.no === fav.surahNo)?.name || `Surah ${fav.surahNo}`;
            const verseLabel = `${localizedVerseWord} ${formatLocalizedNumber(fav.ayaNo, uiLanguageForTafsir)}`;

            return (
              <button
                key={`${fav.surahNo}:${fav.ayaNo}`}
                onClick={() => {
                  setSelectedSurahNo(fav.surahNo);
                  setSelectedAyaNo(fav.ayaNo);
                  setShowBookmarkedOnly(false);
                }}
                className="w-full rounded-xl px-4 py-3 border relative overflow-hidden backdrop-blur-sm hover:scale-[1.01] active:scale-[0.99] transition-all text-start"
                style={{
                  background: 'var(--pp-button-bg)',
                  borderColor: 'var(--pp-border-soft)',
                  color: 'var(--pp-text-primary)',
                  boxShadow: "var(--pp-surface-shadow-lg)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
                <div className={`relative z-10 flex items-center gap-3 ${isUiRTL ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ color: 'var(--pp-text-primary)' }}>
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate text-base" style={{ color: "var(--pp-text-primary)" }}>
                      {surahName}
                    </div>
                    <div className="text-sm opacity-80 truncate">
                      {verseLabel}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      );
    };

    return (
      <div className="w-full md:max-w-2xl md:mx-auto space-y-3 pb-4">
        <div
          className={`pp-tafsir-header sticky top-0 z-40 rounded-xl p-3 border overflow-hidden backdrop-blur-md mb-3 transition-all duration-200 ${showReaderBox ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
          <div className="relative z-10 space-y-3">
            {(() => {
              const scholarName = getTafsirDisplayName(selectedItem, selectedLanguage ?? "english");
              const scholarNameLen = scholarName.length;
              let scholarSizeClass = "text-[clamp(14px,4.2vw,18px)]";
              if (scholarNameLen >= 36) {
                scholarSizeClass = "text-[clamp(11px,3.5vw,14px)]";
              } else if (scholarNameLen >= 26) {
                scholarSizeClass = "text-[clamp(12px,3.8vw,16px)]";
              }

              const ttButton = (
                <button
                  onClick={toggleTafsirFontSize}
                  aria-label={tContent("quran.textSize")}
                  className={[
                    "w-11 h-11 rounded-lg border transition-all relative overflow-hidden backdrop-blur-sm flex items-center justify-center shrink-0",
                    "hover:scale-105 active:scale-95",
                  ].join(" ")}
                  style={{
                    background: "var(--pp-button-bg)",
                    borderColor: "var(--pp-border-soft)",
                    color: "var(--pp-text-primary)",
                    boxShadow: "var(--pp-surface-shadow)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
                  <div
                    className={[
                      "relative z-10 flex items-end gap-0.5 px-0.5",
                      isUiRTL ? "flex-row-reverse" : "flex-row",
                    ].join(" ")}
                  >
                    <span className="text-xs font-bold leading-none mb-0.5">T</span>
                    <span className="text-lg font-bold leading-none">T</span>
                  </div>
                </button>
              );

              const jumpToTopButton = (
                <button
                  onClick={jumpToScholarChapterTop}
                  aria-label={tContent("common.backToTop")}
                  className={[
                    "w-11 h-11 rounded-lg border transition-all relative overflow-hidden backdrop-blur-sm flex items-center justify-center shrink-0",
                    "hover:scale-105 active:scale-95",
                  ].join(" ")}
                  style={{
                    background: "var(--pp-button-bg)",
                    borderColor: "var(--pp-border-soft)",
                    color: "var(--pp-text-primary)",
                    boxShadow: "var(--pp-surface-shadow)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
                  <ArrowUpToLine className="w-4 h-4 relative z-10" />
                </button>
              );

              const favoriteButton = (
                <button
                  type="button"
                  onClick={() => setShowBookmarkedOnly((v) => !v)}
                  aria-pressed={showBookmarkedOnly}
                  aria-label={tContent("library.favorites")}
                  className={[
                    "w-11 h-11 rounded-lg border transition-all relative overflow-hidden backdrop-blur-sm flex items-center justify-center shrink-0",
                    "hover:scale-105 active:scale-95",
                  ].join(" ")}
                  style={{
                    background: showBookmarkedOnly ? "var(--pp-button-bg-soft)" : "var(--pp-button-bg)",
                    color: showBookmarkedOnly ? "var(--pp-text-primary)" : "var(--pp-text-secondary)",
                    borderColor: showBookmarkedOnly ? "var(--pp-border-strong)" : "var(--pp-border-soft)",
                    boxShadow: "var(--pp-surface-shadow)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
                  <Heart className={`w-5 h-5 relative z-10 ${showBookmarkedOnly ? "fill-current" : ""}`} />
                </button>
              );

              const rightGroupResolved = isUiRTL
                ? [ttButton, jumpToTopButton]
                : [favoriteButton];

              const leftGroupResolved = isUiRTL
                ? [favoriteButton]
                : [ttButton, jumpToTopButton];

              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                      {leftGroupResolved}
                    </div>
                    <p
                      className={[
                        "font-bold tracking-wide leading-relaxed truncate text-center flex-1 min-w-0",
                        scholarSizeClass,
                      ].join(" ")}
                    >
                      {scholarName}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {rightGroupResolved}
                    </div>
                  </div>

                  {!showBookmarkedOnly && (
                    <div className="pp-tafsir-surah-select w-full rounded-xl p-2 border text-center min-w-0">
                      <label
                        className="text-xs font-semibold opacity-90 text-center block"
                        htmlFor="tafsir-surah-select"
                      >
                        {localizedSelectSurah}
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-2" dir={isUiRTL ? "rtl" : "ltr"}>
                        <select
                          id="tafsir-surah-select"
                          value={selectedSurahNo}
                          onChange={(e) => setSelectedSurahNo(Number(e.target.value))}
                          dir={tafsirContentIsRtl ? "rtl" : "ltr"}
                          className="pp-tafsir-surah-native w-full h-11 rounded-lg px-3 py-2 border text-sm text-start"
                        >
                          {surahOptions.map((opt) => (
                            <option key={opt.no} value={opt.no}>
                              {opt.name}
                            </option>
                          ))}
                        </select>

                        {/*
                          Physical row is always `dir="ltr"` so left/right are unambiguous.
                          - RTL curated: Go (left, ArrowLeft) then verse field (right, RTL text/placeholder).
                          - LTR curated: verse field (left) then Go (right, ArrowRight).
                        */}
                        <div
                          dir="ltr"
                          className="rounded-lg border px-3 py-2 flex flex-row items-center gap-2 min-w-0 h-11"
                          style={{
                            background: "var(--pp-button-bg-soft)",
                            borderColor: "var(--pp-border-soft)",
                            boxShadow: "var(--pp-surface-shadow)",
                          }}
                        >
                          {tafsirContentIsRtl ? (
                            <>
                              <GlassButton onClick={handleJumpSubmit} ariaLabel={verseJumpGoAria} className="!p-2 shrink-0">
                                <ArrowLeft className="w-4 h-4" />
                              </GlassButton>
                              <input
                                value={jumpInput}
                                onChange={(e) => setJumpInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleJumpSubmit();
                                }}
                                inputMode="numeric"
                                dir="rtl"
                                className={`${verseJumpInputClass} text-start`}
                                placeholder={verseJumpPlaceholder}
                                style={{ color: "var(--pp-text-primary)" }}
                                aria-label={verseJumpInputAria}
                              />
                            </>
                          ) : (
                            <>
                              <input
                                value={jumpInput}
                                onChange={(e) => setJumpInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleJumpSubmit();
                                }}
                                inputMode="numeric"
                                dir="ltr"
                                className={`${verseJumpInputClass} text-start`}
                                placeholder={verseJumpPlaceholder}
                                style={{ color: "var(--pp-text-primary)" }}
                                aria-label={verseJumpInputAria}
                              />
                              <GlassButton onClick={handleJumpSubmit} ariaLabel={verseJumpGoAria} className="!p-2 shrink-0">
                                <ArrowRight className="w-4 h-4" />
                              </GlassButton>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {showBookmarkedOnly ? renderFavoritesList() : renderFocused()}
      </div>
    );
  };

  return (
    <LibrarySubpageShell
      title={t("library.tafsir.title", { lng: navigationLanguage })}
      uiLanguage={uiLanguage}
      uiIsRtl={uiIsRtl}
      contentLanguage={selectedLanguage ? tafsirToQuranLanguage[selectedLanguage] : "ar"}
      contentIsRtl={tafsirContentIsRtl}
      contentClassName="pp-tafsir-scroll-content"
      contentRef={scrollContainerRef}
      onScroll={handleScroll}
    >
      {renderBody()}
    </LibrarySubpageShell>
  );
}