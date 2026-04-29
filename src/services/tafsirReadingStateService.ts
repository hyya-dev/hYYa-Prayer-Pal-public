import type { TafsirLanguage } from "@/lib/tafsirCatalog";
import { StorageService } from "@/services/StorageService";

export interface TafsirReadingState {
  tafsirId: string;
  language: TafsirLanguage;
  surahNo: number;
  ayaNo: number;
  /**
   * Optional scroll offset within the tafsir scroll container.
   * Stored as a best-effort fallback when ayah-based anchoring is unreliable
   * (e.g. fast back-taps during momentum scrolling).
   */
  scrollTop?: number;
  /**
   * Pixel offset from the top of the stored ayah card to the user's "reading line".
   * Used to restore more precisely within very tall cards (e.g. Ibn Kathir intros),
   * and to avoid drift when `scrollTop` is noisy.
   */
  anchorOffsetPx?: number;
  timestamp: number;
}

const POSITIONS_KEY = "tafsir_reading_positions_v1";
/** Legacy single-slot key (pre–per-work storage). Migrated into `POSITIONS_KEY` on read. */
const LEGACY_LAST_KEY = "tafsir_last_reading_state_v1";
/** Separates work id from language inside `POSITIONS_KEY` object keys (one anchor per work *and* tafsir language). */
const STORAGE_KEY_SEP = "::";

const TAFSIR_LANGUAGES = new Set<TafsirLanguage>([
  "arabic",
  "bengali",
  "english",
  "russian",
  "urdu",
]);

function isTafsirLanguage(value: unknown): value is TafsirLanguage {
  return typeof value === "string" && TAFSIR_LANGUAGES.has(value as TafsirLanguage);
}

type PositionsBlob = Record<
  string,
  {
    language: TafsirLanguage;
    surahNo: number;
    ayaNo: number;
    scrollTop?: number;
    anchorOffsetPx?: number;
    timestamp: number;
  }
>;

function compositeStorageKey(tafsirId: string, language: TafsirLanguage): string {
  return `${tafsirId}${STORAGE_KEY_SEP}${language}`;
}

function parseCompositeStorageKey(key: string): { tafsirId: string; language: TafsirLanguage } | null {
  const idx = key.indexOf(STORAGE_KEY_SEP);
  if (idx <= 0) return null;
  const tafsirId = key.slice(0, idx);
  const lang = key.slice(idx + STORAGE_KEY_SEP.length);
  if (!isTafsirLanguage(lang)) return null;
  return { tafsirId, language: lang };
}

type PositionsRow = PositionsBlob[string];

function normalizeReadingState(raw: unknown): TafsirReadingState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tafsirId = o.tafsirId;
  const language = o.language;
  const surahNo = Number(o.surahNo);
  const ayaNo = Number(o.ayaNo);
  const scrollTop = o.scrollTop === undefined ? undefined : Number(o.scrollTop);
  const anchorOffsetPx = o.anchorOffsetPx === undefined ? undefined : Number(o.anchorOffsetPx);
  const timestamp = Number(o.timestamp);
  if (typeof tafsirId !== "string" || tafsirId.length === 0) return null;
  if (!isTafsirLanguage(language)) return null;
  if (!Number.isFinite(surahNo) || surahNo < 1 || surahNo > 114) return null;
  if (!Number.isFinite(ayaNo) || ayaNo < 1) return null;
  if (scrollTop !== undefined && (!Number.isFinite(scrollTop) || scrollTop < 0)) return null;
  if (anchorOffsetPx !== undefined && (!Number.isFinite(anchorOffsetPx))) return null;
  if (!Number.isFinite(timestamp)) return null;
  return {
    tafsirId,
    language,
    surahNo,
    ayaNo,
    scrollTop,
    anchorOffsetPx,
    timestamp,
  };
}

/**
 * Coerce a stored value into a valid row, or return null. Uses the same rules as
 * `normalizeReadingState` so `surahNo`/`ayaNo` as strings (some JSON decoders) still work.
 */
function coercedPositionsRow(
  key: string,
  raw: unknown,
): { compositeKey: string; row: PositionsRow; wasLegacyFlat: boolean } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const withComposite = parseCompositeStorageKey(key);
  if (withComposite) {
    const n = normalizeReadingState({ ...raw, tafsirId: withComposite.tafsirId });
    if (!n) return null;
    return {
      compositeKey: key,
      row: { language: n.language, surahNo: n.surahNo, ayaNo: n.ayaNo, timestamp: n.timestamp },
      wasLegacyFlat: false,
    };
  }

  const n = normalizeReadingState({ ...raw, tafsirId: key });
  if (!n) return null;
  return {
    compositeKey: compositeStorageKey(n.tafsirId, n.language),
    row: { language: n.language, surahNo: n.surahNo, ayaNo: n.ayaNo, timestamp: n.timestamp },
    wasLegacyFlat: true,
  };
}

/**
 * Normalizes blob keys to `tafsirId::language` (legacy builds used bare `tafsirId` only,
 * which overwrote Arabic vs Urdu anchors for the same catalog item).
 */
function normalizePositionsBlobKeys(blob: PositionsBlob): PositionsBlob {
  const next: PositionsBlob = {};
  let sawKeyShapeChange = false;
  const rawEntries = Object.entries(blob);

  for (const [key, raw] of rawEntries) {
    const out = coercedPositionsRow(key, raw);
    if (!out) continue;
    if (out.wasLegacyFlat) {
      sawKeyShapeChange = true;
    } else {
      if (out.compositeKey !== key) {
        sawKeyShapeChange = true;
      }
    }

    const { compositeKey, row } = out;
    const existing = next[compositeKey];
    if (!existing || row.timestamp >= existing.timestamp) {
      next[compositeKey] = row;
    }
  }

  if (sawKeyShapeChange) {
    try {
      if (Object.keys(next).length > 0) {
        StorageService.setItem(POSITIONS_KEY, JSON.stringify(next));
      }
    } catch {
      // keep in-memory shape for this read; next successful save may persist
    }
  }

  return Object.keys(next).length > 0 ? next : blob;
}

function readPositionsBlob(): PositionsBlob {
  try {
    const raw = StorageService.getItem(POSITIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return normalizePositionsBlobKeys(parsed as PositionsBlob);
      }
    }
  } catch {
    // fall through to migration / empty
  }

  try {
    const legacyRaw = StorageService.getItem(LEGACY_LAST_KEY);
    if (!legacyRaw) return {};
    const parsed = JSON.parse(legacyRaw) as unknown;
    const n = normalizeReadingState(parsed);
    if (n) {
      const blob: PositionsBlob = {
        [compositeStorageKey(n.tafsirId, n.language)]: {
          language: n.language,
          surahNo: n.surahNo,
          ayaNo: n.ayaNo,
          timestamp: n.timestamp,
        },
      };
      StorageService.setItem(POSITIONS_KEY, JSON.stringify(blob));
      return blob;
    }
  } catch {
    // ignore
  }
  return {};
}

/** Last reading anchor for a catalog work in a specific tafsir content language. */
export function getTafsirReadingStateForWork(
  tafsirId: string,
  language: TafsirLanguage,
): TafsirReadingState | null {
  const blob = readPositionsBlob();
  const row = blob[compositeStorageKey(tafsirId, language)];
  if (!row) return null;
  return normalizeReadingState({ tafsirId, ...row });
}

/**
 * @deprecated Prefer `getTafsirReadingStateForWork`. Returns the newest entry across all works.
 */
export function getTafsirReadingState(): TafsirReadingState | null {
  const blob = readPositionsBlob();
  let best: TafsirReadingState | null = null;
  for (const [storageKey, row] of Object.entries(blob)) {
    const parsed = parseCompositeStorageKey(storageKey);
    if (!parsed) continue;
    const normalized = normalizeReadingState({ tafsirId: parsed.tafsirId, ...row });
    if (!normalized) continue;
    if (!best || normalized.timestamp > best.timestamp) {
      best = normalized;
    }
  }
  return best;
}

export function saveTafsirReadingState(state: TafsirReadingState): void {
  try {
    const normalized = normalizeReadingState(state);
    if (!normalized) return;

    const blob = readPositionsBlob();
    blob[compositeStorageKey(normalized.tafsirId, normalized.language)] = {
      language: normalized.language,
      surahNo: normalized.surahNo,
      ayaNo: normalized.ayaNo,
      scrollTop: normalized.scrollTop,
      anchorOffsetPx: normalized.anchorOffsetPx,
      timestamp: normalized.timestamp,
    };
    StorageService.setItem(POSITIONS_KEY, JSON.stringify(blob));
    // Keep legacy key in sync so older builds / diagnostics still see a “last read” snapshot.
    StorageService.setItem(LEGACY_LAST_KEY, JSON.stringify(normalized));
  } catch {
    // no-op
  }
}

export function clearTafsirReadingState(): void {
  try {
    StorageService.removeItem(POSITIONS_KEY);
    StorageService.removeItem(LEGACY_LAST_KEY);
  } catch {
    // no-op
  }
}
