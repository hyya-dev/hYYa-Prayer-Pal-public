import React, { useEffect, useState } from "react";
import { getVerseTransliteration } from "@/services/quranTransliterationService";

interface TransliterationDisplayProps {
  surahNumber: number;
  verseNumber: number;
  showTransliteration: boolean;
  translationFontSize: number;
}

export const TransliterationDisplay = React.memo(function TransliterationDisplay({
  surahNumber,
  verseNumber,
  showTransliteration,
  translationFontSize,
}: TransliterationDisplayProps) {
  const [transliteration, setTransliteration] = useState<string | null>(null);

  useEffect(() => {
    if (showTransliteration) {
      getVerseTransliteration(surahNumber, verseNumber).then(
        setTransliteration,
      );
    }
  }, [showTransliteration, surahNumber, verseNumber]);

  if (!showTransliteration || !transliteration) return null;

  return (
    <p
      className="leading-relaxed text-left italic mb-3"
      style={{
        fontSize: `${translationFontSize * 0.9}px`,
        direction: "ltr",
        color: "var(--pp-text-secondary)",
      }}
    >
      {transliteration}
    </p>
  );
});
