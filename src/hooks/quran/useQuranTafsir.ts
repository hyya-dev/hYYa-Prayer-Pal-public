import { useState, useCallback, useEffect, useRef } from "react";
import { type TFunction } from "i18next";
import {
  getTafsirDisplayName,
  loadTafsirByResourceId,
  type TafsirCatalogItem,
  type TafsirLanguage,
  type TafsirResourceRow,
} from "@/lib/tafsirCatalog";
import { resolveReaderSheetDefaultTafsirSource } from "@/lib/readerTafsirDefaults";
import type { Surah, QuranLanguageCode } from "@/types/quran";

interface UseQuranTafsirProps {
  t: TFunction;
  displayLanguage: QuranLanguageCode;
  selectedSurah: Surah | null;
  selectedVerseAction: {
    surahNumber: number;
    verseNumber: number;
    verseText: string;
  } | null;
}

export type TafsirSource = {
  item: TafsirCatalogItem;
  language: TafsirLanguage;
  resourceId: number;
};

export function getLocalizedSurahName(
  surah: {
    nameArabic: string;
    nameTranslated: Record<string, string>;
    nameTransliterated: string;
  },
  language: string,
): string {
  if (language === "ar") {
    return surah.nameArabic || surah.nameTransliterated;
  }

  const translated = surah.nameTranslated[language];
  if (translated && translated.trim().length > 0) {
    return translated;
  }

  return (
    surah.nameTranslated.en || surah.nameTransliterated || surah.nameArabic
  );
}

function sanitizeTafsirPreview(input: string): string {
  return (input || "")
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<a\s+class=["']sup["'][^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeTafsirResourceRows(data: unknown): Array<{
  sura_no: number;
  aya_no: number;
  aya_tafseer: string;
}> {
  if (!Array.isArray(data)) return [];

  return data
    .filter((row): row is TafsirResourceRow => {
      return (
        !!row &&
        typeof row === "object" &&
        "sura_no" in row &&
        "aya_no" in row &&
        "aya_tafseer" in row
      );
    })
    .map((row) => ({
      sura_no: Number(row.sura_no),
      aya_no: Number(row.aya_no),
      aya_tafseer: String(row.aya_tafseer ?? ""),
    }));
}

function pickTafsirRowForVerse(
  rows: Array<{ sura_no: number; aya_no: number; aya_tafseer: string }>,
  surahNumber: number,
  verseNumber: number,
) {
  const exact = rows.find((row) => row.sura_no === surahNumber && row.aya_no === verseNumber);
  if (exact) return exact;

  const sameSurah = rows.filter((row) => row.sura_no === surahNumber).sort((a, b) => a.aya_no - b.aya_no);
  return (
    sameSurah.find((row) => row.aya_no > verseNumber) ||
    [...sameSurah].reverse().find((row) => row.aya_no < verseNumber) ||
    null
  );
}

/** Clipboard-only copy (no deprecated `document.execCommand`). */
async function copyTextViaClipboardApi(text: string): Promise<boolean> {
  const clip = navigator.clipboard;

  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      // Try alternate Clipboard API path below.
    }
  }

  if (!clip?.write || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    await clip.write([
      new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function tryNavigatorShare(title: string, text: string): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({ title, text });
    return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return true;
    }
    return false;
  }
}

async function copyTextWithUiFeedback(shareText: string, t: TFunction): Promise<void> {
  const copied = await copyTextViaClipboardApi(shareText);
  if (copied) {
    alert(t("common.copySuccess"));
    return;
  }
  alert(t("common.copyFailed"));
}

export function useQuranTafsir({
  t,
  displayLanguage,
  selectedSurah,
  selectedVerseAction,
}: UseQuranTafsirProps) {
  const [selectedTafsirSource, setSelectedTafsirSource] = useState<TafsirSource | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState<string | null>(null);
  const [tafsirPreview, setTafsirPreview] = useState<string>("");

  const lastAutoLoadedTafsirKeyRef = useRef("");
  const tafsirLoadGenerationRef = useRef(0);

  const handleLoadVerseTafsir = useCallback(
    async (source: TafsirSource) => {
      if (!selectedVerseAction) return;

      const generation = ++tafsirLoadGenerationRef.current;
      const verseSnapshot = selectedVerseAction;

      setSelectedTafsirSource(source);
      setTafsirLoading(true);
      setTafsirError(null);
      setTafsirPreview("");

      try {
        const data = await loadTafsirByResourceId<unknown>(source.resourceId);
        if (generation !== tafsirLoadGenerationRef.current) return;
        const rows = normalizeTafsirResourceRows(data);
        const picked = pickTafsirRowForVerse(rows, verseSnapshot.surahNumber, verseSnapshot.verseNumber);

        if (!picked) {
          if (generation !== tafsirLoadGenerationRef.current) return;
          setTafsirError(t("library.noContent"));
          return;
        }

        const cleaned = sanitizeTafsirPreview(picked.aya_tafseer);
        if (!cleaned) {
          if (generation !== tafsirLoadGenerationRef.current) return;
          setTafsirError(t("library.noContent"));
          return;
        }
        if (generation !== tafsirLoadGenerationRef.current) return;
        setTafsirPreview(cleaned);
      } catch (error) {
        if (generation !== tafsirLoadGenerationRef.current) return;
        setTafsirError(
          error instanceof Error
            ? error.message
            : t("library.noContent"),
        );
      } finally {
        if (generation === tafsirLoadGenerationRef.current) {
          setTafsirLoading(false);
        }
      }
    },
    [selectedVerseAction, t],
  );

  useEffect(() => {
    if (!selectedVerseAction) {
      lastAutoLoadedTafsirKeyRef.current = "";
      tafsirLoadGenerationRef.current += 1;
      setSelectedTafsirSource(null);
      setTafsirLoading(false);
      setTafsirError(null);
      setTafsirPreview("");
      return;
    }

    const key = `${displayLanguage}:${selectedVerseAction.surahNumber}:${selectedVerseAction.verseNumber}`;
    if (lastAutoLoadedTafsirKeyRef.current === key) return;
    lastAutoLoadedTafsirKeyRef.current = key;

    const source = resolveReaderSheetDefaultTafsirSource(displayLanguage);
    void handleLoadVerseTafsir(source);
  }, [selectedVerseAction, displayLanguage, handleLoadVerseTafsir]);

  const handleShareSelectedTafsir = useCallback(async () => {
    if (!selectedVerseAction || !selectedTafsirSource || !tafsirPreview) return;

    const surahName = selectedSurah
      ? getLocalizedSurahName(selectedSurah, displayLanguage)
      : t("nav.quran");
    const shareText = [
      `${surahName} ${t("quran.verse")} ${selectedVerseAction.verseNumber}`,
      selectedVerseAction.verseText,
      `${t("library.tafsir.title")}: ${getTafsirDisplayName(
        selectedTafsirSource.item,
        selectedTafsirSource.language,
      )}`,
      tafsirPreview,
    ]
      .filter(Boolean)
      .join("\n\n");

    const shareTitle = `${surahName} ${t("quran.verse")} ${selectedVerseAction.verseNumber}`;
    const shared = await tryNavigatorShare(shareTitle, shareText);
    if (shared) return;

    await copyTextWithUiFeedback(shareText, t);
  }, [
    displayLanguage,
    selectedSurah,
    selectedTafsirSource,
    selectedVerseAction,
    tafsirPreview,
    t,
  ]);

  return {
    selectedTafsirSource,
    setSelectedTafsirSource,
    tafsirLoading,
    tafsirError,
    setTafsirError,
    tafsirPreview,
    setTafsirPreview,
    handleLoadVerseTafsir,
    handleShareSelectedTafsir,
  };
}
