import { StorageService } from "@/services/StorageService";
export interface HisnReadItem {
  id: string; // `${chapterIndex}:${itemId}`
  chapterIndex: number;
  itemId: number;
  timestamp: number;
}

const STORAGE_KEY = 'hisn_read_progress_v1';

function load(): HisnReadItem[] {
  try {
    const raw = StorageService.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HisnReadItem[];
  } catch {
    return [];
  }
}

function save(items: HisnReadItem[]): void {
  try {
    StorageService.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function markHisnItemAsRead(chapterIndex: number, itemId: number): void {
  const items = load();
  const id = `${chapterIndex}:${itemId}`;
  if (items.some((x) => x.id === id)) return;
  items.push({ id, chapterIndex, itemId, timestamp: Date.now() });
  save(items);
}

export function isHisnItemRead(chapterIndex: number, itemId: number): boolean {
  const id = `${chapterIndex}:${itemId}`;
  return load().some((x) => x.id === id);
}

export function getHisnReadCount(): number {
  return load().length;
}

export function clearHisnReadingProgress(): void {
  try {
    StorageService.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

