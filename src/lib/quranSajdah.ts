const SAJDAH_VERSE_KEYS = new Set<string>([
  '7:206',
  '13:15',
  '16:50',
  '17:109',
  '19:58',
  '22:18',
  '22:77',
  '25:60',
  '27:26',
  '32:15',
  '38:24',
  '41:38',
  '53:62',
  '84:21',
  '96:19',
]);

export function isSajdahVerse(surahNumber: number, verseNumber: number): boolean {
  return SAJDAH_VERSE_KEYS.has(`${surahNumber}:${verseNumber}`);
}

export function isSajdahVerseKey(verseKey: string): boolean {
  return SAJDAH_VERSE_KEYS.has(verseKey);
}

export function getSajdahVerseKeys(): string[] {
  return Array.from(SAJDAH_VERSE_KEYS);
}
