import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { memo, useCallback } from "react";
import { BookmarkButton } from "@/components/Quran/BookmarkButton";
import { toggleTafsirVerseBookmark } from "@/services/tafsirBookmarkService";
import type { TafsirLanguage, TafsirResourceRow } from "@/lib/tafsirCatalog";
import type { QuranLanguageCode } from "@/types/quran";
import { formatLocalizedNumber } from "@/lib/formatUtils";
import { sanitizeTafsirHtml, stripDuplicateBasmalaPrefix } from "@/lib/tafsirHtmlUtils";

type TafsirVerseCardProps = {
  row: TafsirResourceRow;
  verseText: string;
  uiLanguageForTafsir: QuranLanguageCode;
  tafsirContentIsRtl: boolean;
  selectedAyaNo: number | null;
  localizedVerseWord: string;
  selectedLanguage: TafsirLanguage;
  selectedSurahNo: number;
  selectedItemId: string | null;
  selectedResourceId: number | null;
  bookmarkedAyaNumbers: Set<number>;
  verseFontSize: number;
  tafsirFontSize: number;
  onSelectAyaNo: (ayaNo: number) => void;
  onBookmarkChanged: () => void;
};

export const TafsirVerseCard = memo(function TafsirVerseCard({
  row,
  verseText,
  uiLanguageForTafsir,
  tafsirContentIsRtl,
  selectedAyaNo,
  localizedVerseWord,
  selectedLanguage,
  selectedSurahNo,
  selectedItemId,
  selectedResourceId,
  bookmarkedAyaNumbers,
  verseFontSize,
  tafsirFontSize,
  onSelectAyaNo,
  onBookmarkChanged,
}: TafsirVerseCardProps) {
  const localizedAyaNo = formatLocalizedNumber(row.aya_no, uiLanguageForTafsir);
  const isSelected = selectedAyaNo === row.aya_no;
  const isBookmarked =
    !!selectedItemId &&
    !!selectedResourceId &&
    bookmarkedAyaNumbers.has(row.aya_no);
  const isBasmalaLine = row.aya_no === 1 && (
    /^\s*بِسْمِ\s*الل/i.test(verseText) ||
    /^\s*بسم\s*الله/i.test(verseText) ||
    /^\s*in the name of/i.test(verseText)
  );
  const tafsirHtml = sanitizeTafsirHtml(
    stripDuplicateBasmalaPrefix(row.aya_tafseer, row.aya_no),
  );
  const normalizedTafsirHtml = tafsirHtml.trim();
  const collapsedPreview = normalizedTafsirHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const previewWords = collapsedPreview ? collapsedPreview.split(/\s+/).length : 0;
  // Smart-justify: avoid ugly spacing for very short snippets.
  const shouldJustifyTafsirText = collapsedPreview.length >= 180 && previewWords >= 25;
  let bismillahTypographyClass = "text-base font-semibold";
  if (isBasmalaLine) {
    const isArabicOrUrdu = uiLanguageForTafsir === "ar" || uiLanguageForTafsir === "ur";
    bismillahTypographyClass = isArabicOrUrdu ? "pp-tafsir-bismillah-ar" : "pp-tafsir-bismillah-l10n";
  }

  const handleSelect = useCallback(() => {
    onSelectAyaNo(row.aya_no);
  }, [onSelectAyaNo, row.aya_no]);

  const handleToggleBookmark = useCallback(() => {
    if (!selectedItemId || !selectedResourceId) return;
    toggleTafsirVerseBookmark(
      selectedItemId,
      selectedResourceId,
      selectedLanguage,
      selectedSurahNo,
      row.aya_no,
    );
    onBookmarkChanged();
    onSelectAyaNo(row.aya_no);
  }, [
    onBookmarkChanged,
    onSelectAyaNo,
    row.aya_no,
    selectedItemId,
    selectedLanguage,
    selectedResourceId,
    selectedSurahNo,
  ]);

  const selectVerseLabel = `${localizedVerseWord} ${localizedAyaNo}`;

  return (
    <article
      data-aya-no={row.aya_no}
      className={cn(
        "pp-tafsir-verse rounded-xl p-4 border relative overflow-hidden transition-all text-start",
        isSelected && "ring-2 ring-white/30",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-[1] m-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 text-start shadow-none outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label={selectVerseLabel}
        aria-pressed={isSelected}
        onClick={handleSelect}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
      <div className="relative z-[2] pointer-events-none">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="pp-tafsir-note text-xs font-semibold">
            {localizedVerseWord} {localizedAyaNo}
          </p>
          {selectedItemId && selectedResourceId && (
            <div className="pointer-events-auto shrink-0">
              <BookmarkButton
                shape="square"
                size="sm"
                hideBorder
                isBookmarked={isBookmarked}
                onToggle={handleToggleBookmark}
              />
            </div>
          )}
        </div>
        {verseText && (
          <p
            /*
             * UX Logic Layer 2 Exception — Content direction override.
             * Tafsir verse text direction follows the CONTENT language (tafsirContentIsRtl),
             * not the UI language. Arabic/Urdu tafsir is always RTL regardless of UI language.
             * Documented exception per UX_LOGIC.md Layer 2 (line 33).
             */
            dir={tafsirContentIsRtl ? "rtl" : "ltr"}
            className={`mb-3 ${bismillahTypographyClass} ${isBasmalaLine ? "text-center" : "text-start"}`}
            style={{ fontSize: `${verseFontSize}px`, lineHeight: 1.8 }}
          >
            {verseText}
          </p>
        )}
        {isSelected ? (
          <div
            /*
             * UX Logic Layer 2 Exception — Content direction override.
             * Tafsir body text direction follows the CONTENT language (tafsirContentIsRtl),
             * not the UI language. Documented exception per UX_LOGIC.md Layer 2 (line 33).
             */
            dir={tafsirContentIsRtl ? "rtl" : "ltr"}
            className={cn(
              "text-[0.94rem] leading-7 space-y-3",
              shouldJustifyTafsirText ? "pp-tafsir-justify" : "text-start",
              "[&_blockquote]:border-s-2 [&_blockquote]:border-white/20 [&_blockquote]:ps-4 [&_br]:block [&_br]:content-[''] [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ps-5",
            )}
            style={{ fontSize: `${tafsirFontSize}px`, lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(normalizedTafsirHtml) }}
          />
        ) : (
          <p
            /*
             * UX Logic Layer 2 Exception — Content direction override.
             * Tafsir preview text direction follows the CONTENT language (tafsirContentIsRtl),
             * not the UI language. Documented exception per UX_LOGIC.md Layer 2 (line 33).
             */
            dir={tafsirContentIsRtl ? "rtl" : "ltr"}
            className={cn(
              "text-sm leading-6 opacity-90",
              shouldJustifyTafsirText ? "pp-tafsir-justify" : "text-start",
            )}
            style={{ fontSize: `${Math.max(12, tafsirFontSize - 2)}px`, lineHeight: 1.8 }}
          >
            {collapsedPreview.slice(0, 220)}{collapsedPreview.length > 220 ? "..." : ""}
          </p>
        )}
      </div>
    </article>
  );
});