import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import compassIcon from "@/assets/Icon Compass.png";
import counterIcon from "@/assets/Icon Counter.png";

interface QiblaButtonProps {
  onClick: () => void;
}

export function QiblaButton({ onClick }: QiblaButtonProps) {
  const { t, i18n } = useTranslation();
  const isRTL = isRtlLanguage(i18n.language);

  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-2 sm:p-3 flex items-center justify-center backdrop-blur-sm mb-2 sm:mb-3 border-2 border-white/40 relative overflow-hidden group hover:scale-[1.02] hover:border-white/60 active:scale-[0.98] transition-all duration-300 w-full cursor-pointer"
      style={{
        background: "var(--pp-home-cta-bg)",
        borderColor: "var(--pp-home-cta-border)",
        boxShadow:
          "0 8px 32px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2)",
        transform: "perspective(1000px) rotateX(2deg)",
      }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      {/* Centered content */}
      <div
        className="relative z-10 flex items-center justify-center gap-2 sm:gap-3"
      >
        <img
          src={compassIcon}
          alt={t("nav.qibla")}
          className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
        />
        <div className="text-lg sm:text-xl font-bold text-shadow" style={{ color: "var(--pp-text-primary)" }}>
          {t("nav.qibla")}
        </div>
      </div>
    </button>
  );
}

interface CounterButtonProps {
  onClick: () => void;
}

export function CounterButton({ onClick }: CounterButtonProps) {
  const { t, i18n } = useTranslation();
  const isRTL = isRtlLanguage(i18n.language);

  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-2 sm:p-3 flex items-center justify-center backdrop-blur-sm mb-2 sm:mb-3 border-2 border-white/40 relative overflow-hidden group hover:scale-[1.02] hover:border-white/60 active:scale-[0.98] transition-all duration-300 w-full cursor-pointer"
      style={{
        background: "var(--pp-home-cta-bg)",
        borderColor: "var(--pp-home-cta-border)",
        boxShadow:
          "0 8px 32px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2)",
        transform: "perspective(1000px) rotateX(2deg)",
      }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      {/* Centered content */}
      <div
        className="relative z-10 flex items-center justify-center gap-2 sm:gap-3"
      >
        <img
          src={counterIcon}
          alt={t("nav.counter")}
          className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
        />
        <div className="text-lg sm:text-xl font-bold text-shadow" style={{ color: "var(--pp-text-primary)" }}>
          {t("nav.counter")}
        </div>
      </div>
    </button>
  );
}
