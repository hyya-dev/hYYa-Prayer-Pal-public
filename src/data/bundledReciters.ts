/**
 * Bundled Quran Audio reciter list.
 *
 * This list is the app's source of truth for reciters we expose in the UI and
 * for which we have archived audio in our own Cloudflare R2 storage.
 *
 * Note: we intentionally do **not** fetch reciters from `quranicaudio.com/api/qaris`
 * at runtime. `fetchQuranAudioReciters()` returns this bundled list.
 */

import {
  getReciterTier,
  SYNC_ENABLED_RECITER_IDS,
  detectAudioLanguages,
} from "@/lib/quranAudioTier";
import type { QuranAudioReciter } from "@/services/quranAudioService";

type BundledEntry = {
  id: number;
  name: string;
  relativePath: string;
  sectionId: number;
};

const RAW_BUNDLED: BundledEntry[] = [
  { id: 3, name: "Abu Bakr al-Shatri", relativePath: "03-shatri-murattal-ar/", sectionId: 1 },
  { id: 4, name: "Sa`ud ash-Shuraym", relativePath: "04-shuraym-murattal-ar/", sectionId: 1 },
  { id: 5, name: "Mishari Rashid al-`Afasy", relativePath: "05-alafasy-murattal-ar/", sectionId: 1 },
  { id: 6, name: "Muhammad Siddiq al-Minshawi", relativePath: "06-minshawi-murattal-ar/", sectionId: 1 },
  { id: 7, name: "Abdur-Rahman as-Sudais", relativePath: "07-sudais-murattal-ar/", sectionId: 1 },
  { id: 8, name: "Ali Abdur-Rahman al-Huthaify", relativePath: "08-huthaify-murattal-ar/", sectionId: 1 },
  { id: 16, name: "Mahmoud Khaleel Al-Husary", relativePath: "16-husary-murattal-ar/", sectionId: 1 },
  { id: 20, name: "Sudais and Shuraym", relativePath: "20-sudais-shuraym-murattal-ar/", sectionId: 1 },
  { id: 27, name: "Hani ar-Rifai", relativePath: "27-rifai-murattal-ar/", sectionId: 1 },
  { id: 37, name: "AbdulBaset AbdulSamad [Murattal]", relativePath: "37-abdulbaset-murattal-ar/", sectionId: 1 },
  { id: 41, name: "Muhammad Siddiq al-Minshawi [Mujawwad]", relativePath: "41-minshawi-mujawwad-ar/", sectionId: 1 },
  { id: 50, name: "AbdulBaset AbdulSamad [Mujawwad]", relativePath: "50-abdulbaset-mujawwad-ar/", sectionId: 1 },
  { id: 51, name: "Maher al-Muaiqly [Assorted]", relativePath: "51-maher-murattal-ar/", sectionId: 1 },
  { id: 54, name: "AbdulBaset AbdulSamad [Warsh]", relativePath: "54-abdulbaset-warsh-ar/", sectionId: 3 },
  { id: 57, name: "AbdulBaset [Saheeh Intl Translation]", relativePath: "57-abdulbaset-bilingual-en/", sectionId: 4 },
  { id: 58, name: "Mishari al-`Afasy [Saheeh Intl Translation]", relativePath: "58-alafasy-bilingual-en/", sectionId: 4 },
  { id: 78, name: "Mahmoud Khalil Al-Husary [Doori]", relativePath: "78-husary-doori-ar/", sectionId: 3 },
  { id: 97, name: "Yasser ad-Dussary", relativePath: "97-dussary-murattal-ar/", sectionId: 1 },
  { id: 114, name: "Ali al-Huthaify [Qaloon]", relativePath: "114-huthaify-qaloon-ar/", sectionId: 3 },
  { id: 159, name: "Maher al-Muaiqly", relativePath: "159-maher-studio-ar/", sectionId: 1 },
  { id: 164, name: "Mahmoud Khaleel Al-Husary [Mujawwad]", relativePath: "164-husary-mujawwad-ar/", sectionId: 1 },
];


export const BUNDLED_RECITERS: QuranAudioReciter[] = RAW_BUNDLED.map((entry) => ({
  id: entry.id,
  name: entry.name,
  relativePath: entry.relativePath,
  sectionId: entry.sectionId,
  tier: getReciterTier(entry.id),
  hasSync: SYNC_ENABLED_RECITER_IDS.has(entry.id),
  languages: detectAudioLanguages(entry.name, entry.sectionId),
}));

/**
 * Returns the bundled reciter list immediately (no network needed).
 * Used as a fallback when the remote API is unreachable.
 */
export function getBundledReciters(): QuranAudioReciter[] {
  return [...BUNDLED_RECITERS];
}
