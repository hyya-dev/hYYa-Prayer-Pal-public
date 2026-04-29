/**
 * Bundled Mushaf layout: verses + per-word line positions from SQLite (sql.js).
 * Built by scripts/build-mushaf-db.cjs; validated in prebuild via scripts/qa-mushaf-db.cjs.
 */

import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const MUSHAF_DB_PATH = '/data/quran/mushaf/mushaf_layout.sqlite3';

type SqlDatabase = {
  prepare: (sql: string) => {
    bind: (values: Record<string, string | number>) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  close: () => void;
};

type SqlJs = {
  Database: new (data?: ArrayBufferView | ArrayBuffer) => SqlDatabase;
};

let sqlFactory: SqlJs | null = null;
let dbInstance: SqlDatabase | null = null;
let initPromise: Promise<SqlDatabase | null> | null = null;

async function getSqlFactory(): Promise<SqlJs | null> {
  if (sqlFactory) return sqlFactory;
  try {
    const factory = await initSqlJs({
      locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
    });
    sqlFactory = factory as SqlJs;
    return sqlFactory;
  } catch (e) {
    console.error('[MushafDb] sql.js init failed:', e);
    return null;
  }
}

/**
 * Opens the bundled DB once (read-only copy in memory). Safe to call multiple times.
 */
export async function initMushafLayoutDb(): Promise<SqlDatabase | null> {
  if (dbInstance) return dbInstance;
  if (initPromise !== null) return initPromise;

  initPromise = (async () => {
    const SQL = await getSqlFactory();
    if (!SQL) return null;
    try {
      const res = await fetch(MUSHAF_DB_PATH);
      if (!res.ok) {
        console.warn('[MushafDb] Missing DB asset:', MUSHAF_DB_PATH, res.status);
        return null;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      dbInstance = new SQL.Database(buf);
      return dbInstance;
    } catch (e) {
      console.error('[MushafDb] Failed to load DB:', e);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Raw page bundle `{ verses: [...] }` as stored in SQLite.
 * Returns `null` when the page is out of range, the DB failed to open, or the row/JSON is invalid.
 */
export async function fetchMushafPageBundleJson(pageNumber: number): Promise<unknown> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    return null;
  }
  const db = await initMushafLayoutDb();
  if (!db) return null;

  const stmt = db.prepare('SELECT verses_json FROM mushaf_page WHERE page = :p');
  stmt.bind({ ':p': pageNumber });
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  const raw = row.verses_json;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
