import { memo } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { cn } from "@/lib/utils";
import { formatTime, Prayer } from "@/hooks/usePrayerTimes";

interface PrayerCardProps {
  timeFormatKey: string;
  prayer: Prayer;
  isNext: boolean;
  locationTimeZone?: string | null;
}

export const PrayerCard = memo(function PrayerCard({
  timeFormatKey,
  prayer,
  isNext,
  locationTimeZone,
}: PrayerCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = isRtlLanguage(i18n.language);
  const prayerKey = prayer.name.toLowerCase();
  const translatedName = t(`prayers.${prayerKey}`);

  return (
    <div
      className={cn(
        "rounded-xl py-1.5 px-2 sm:py-2 sm:px-3 text-center backdrop-blur-sm transition-all duration-300 relative overflow-hidden border hover:scale-105 hover:-translate-y-1",
        isNext && "ring-2 ring-white/40",
      )}
      data-time-format={timeFormatKey}
      style={{
        background: isNext
          ? "var(--pp-home-card-next-bg)"
          : "var(--pp-home-card-bg)",
        borderColor: "var(--pp-border-soft)",
        boxShadow: isNext
          ? "0 8px 24px rgba(255, 255, 255, 0.15), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)"
          : "0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)",
        transform: "perspective(800px) rotateX(3deg)",
      }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative z-10 text-base sm:text-lg font-bold text-shadow" style={{ color: "var(--pp-text-primary)" }}>
        {formatTime(prayer.time, locationTimeZone)}
      </div>
      <div 
        className="relative z-10 text-xs sm:text-sm font-semibold mt-0.5 capitalize notranslate" 
        style={{
          color: "var(--pp-text-secondary)",
          textRendering: "optimizeLegibility",
          WebkitFontSmoothing: "antialiased",
        }}
        translate="no"
      >
        {translatedName}
      </div>
    </div>
  );
});
