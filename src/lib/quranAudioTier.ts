export type QuranAudioTier = "tier1" | "tier2";

// Tier-1 from the verified ranking list.
export const TIER1_RECITER_IDS = new Set<number>([
  3, 4, 5, 6, 7, 8, 16, 20, 27, 37, 41, 50, 51, 54, 57, 58, 78, 97, 
  114, 159, 164
]);

// Reciters for which we ship precise per-verse timings (sourced from QDC's
// `audio_files?segments=true` endpoint and bundled under
// `src/data/quranVerseTimings/<id>/<surah>.json`). Every id here is verified
// to have a corresponding entry in QDC's /resources/recitations catalog —
// see `QDC_RECITATION_ID_BY_OUR_ID` in `quranAudioService.ts` for the exact
// mapping. Reciters NOT in this set are intentionally listen-only: they play
// audio but display no per-verse highlight (and no "sync" badge in the UI).
export const SYNC_ENABLED_RECITER_IDS = new Set<number>([
  3,   // Abu Bakr al-Shatri
  4,   // Sa`ud ash-Shuraym
  5,   // Mishari Rashid al-`Afasy
  6,   // Muhammad Siddiq al-Minshawi (Murattal)
  7,   // Abdur-Rahman as-Sudais
  16,  // Mahmoud Khaleel Al-Husary
  27,  // Hani ar-Rifai
  37,  // AbdulBaset AbdulSamad (Murattal)
  41,  // Muhammad Siddiq al-Minshawi (Mujawwad)
  50,  // AbdulBaset AbdulSamad (Mujawwad)
]);


export function getReciterTier(id: number): QuranAudioTier {
  return TIER1_RECITER_IDS.has(id) ? "tier1" : "tier2";
}

export function detectAudioLanguages(name: string, sectionId: number): string[] {
  const label = (name || "").toLowerCase();
  const output = new Set<string>();

  // Almost all recitation tracks are Arabic by default.
  output.add("Arabic");

  if (sectionId === 4 || /translation|pickthall|saheeh|muhsin|urdu|english/.test(label)) {
    if (/urdu/.test(label)) output.add("Urdu");
    if (/english|pickthall|saheeh|muhsin/.test(label)) output.add("English");
  }

  return Array.from(output);
}
