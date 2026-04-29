import React from "react";
import { useTranslation } from "react-i18next";
import type { HisnItem } from "@/types/hisn";
import { Heart } from "lucide-react";

export type HisnItemCardProps = Readonly<{
  item: HisnItem;
  indexLabel: number;
  showArabic: boolean;
  translation: string;
  showTranslation: boolean;
  arabicFontSize: number;
  translationFontSize: number;
  bookmarked: boolean;
  effectiveLanguage: string;
  onToggleBookmark: () => void;
  onClick?: () => void;
}>;

export function HisnItemCard({
  item,
  indexLabel,
  showArabic,
  translation,
  showTranslation,
  arabicFontSize,
  translationFontSize,
  bookmarked,
  effectiveLanguage,
  onToggleBookmark,
  onClick,
}: HisnItemCardProps) {
  const { t } = useTranslation();
  const cardShellStyle: React.CSSProperties = {
    background: "var(--pp-reading-surface)",
    borderColor: "var(--pp-border-soft)",
    color: "var(--pp-text-primary)",
    boxShadow: "var(--pp-surface-shadow-lg)",
  };

  return (
    <div
      data-item-id={item.itemId}
      className="relative overflow-hidden rounded-xl border p-6 transition-all"
      style={cardShellStyle}
    >
      <div className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-gradient-to-br from-white/8 via-transparent to-black/30" />
      {onClick ? (
        <button
          type="button"
          className="absolute inset-0 z-[1] m-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 text-start shadow-none outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label={t("library.openDhikr", { lng: effectiveLanguage })}
          onClick={onClick}
        />
      ) : null}
      <div
        className={`relative z-[2] flex flex-col items-center gap-4 ${onClick ? "pointer-events-none" : ""}`}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold"
          style={{ color: "var(--pp-text-primary)" }}
        >
          {indexLabel}
        </div>
        <div className="w-full flex-1">
          {showArabic && (
            <p
              className="notranslate mb-3 text-lg pp-quran-arabic-optimized"
              /*
               * UX Logic Layer 2 Exception — Content direction override.
               * Hisn Muslim content is ALWAYS Arabic (RTL) regardless of UI language.
               * This is a documented exception per UX_LOGIC.md Layer 2 (line 33):
               * "No per-component overrides unless there is an explicit, documented exception."
               */
              dir="rtl"
              style={{
                fontSize: `${arabicFontSize}px`,
                textAlign: "justify",
                textJustify: "inter-word",
                color: "var(--pp-text-primary)",
                lineHeight: "2.8",
                letterSpacing: "0.03em",
                wordSpacing: "0.15em",
                textRendering: "optimizeLegibility",
                WebkitFontSmoothing: "antialiased",
                fontWeight: "600",
              }}
              translate="no"
            >
              {item.arabicText}
            </p>
          )}

          {showTranslation && (
            <p
              className="notranslate text-left leading-relaxed"
              dir="auto"
              style={{
                fontSize: `${translationFontSize}px`,
                textAlign: "start",
                color: "var(--pp-text-secondary)",
              }}
              translate="no"
            >
              {translation}
            </p>
          )}

          <div
            className={`mt-4 flex items-center justify-between ${onClick ? "pointer-events-auto" : ""}`}
          >
            <div className="text-xs" style={{ color: "var(--pp-text-secondary)" }}>
              ID: {item.itemId}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit opacity-90 shadow-none transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-95"
              aria-label={
                bookmarked
                  ? t("library.favorited", { lng: effectiveLanguage })
                  : t("library.favorite", { lng: effectiveLanguage })
              }
            >
              <Heart className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
