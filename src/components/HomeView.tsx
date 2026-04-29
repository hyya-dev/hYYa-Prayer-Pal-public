import { useRef, useState, useEffect, type TouchEvent } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import { Prayer } from "@/hooks/usePrayerTimes";
import { PrayerCard } from "@/components/PrayerCard";
import { QiblaButton, CounterButton } from "@/components/NextPrayerCard";

interface HomeViewProps {
  timeFormatKey: string;
  prayerTimes: Prayer[];
  nextPrayer: Prayer | null;
  locationTimeZone?: string | null;
  onQiblaClick: () => void;
  onCounterClick: () => void;
  onPullRefresh?: () => void;
  onSetLocationClick?: () => void;
  showLocationGate?: boolean;
}

export function HomeView({
  timeFormatKey,
  prayerTimes,
  nextPrayer,
  locationTimeZone,
  onQiblaClick,
  onCounterClick,
  onPullRefresh,
  onSetLocationClick,
  showLocationGate,
}: Readonly<HomeViewProps>) {
  const { t, i18n } = useTranslation();
  isRtlLanguage(i18n.language);
  const pullStartYRef = useRef<number | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const PULL_TRIGGER = 80;

  const handleTouchStart = (event: TouchEvent) => {
    // Only start tracking if we're scrolled to the top
    const container = containerRef.current;
    if (container && container.scrollTop > 0) return;

    const touch = event.touches?.[0];
    if (!touch) return;
    pullStartYRef.current = touch.clientY;
    setPullDistance(0);
  };

  const handleTouchMove = (event: TouchEvent) => {
    const startY = pullStartYRef.current;
    if (startY === null) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    const deltaY = Math.max(0, touch.clientY - startY);
    // Damped pull distance to keep movement controlled
    setPullDistance(Math.min(120, deltaY * 0.5));
  };

  const resetPullState = () => {
    pullStartYRef.current = null;
    setPullDistance(0);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const startY = pullStartYRef.current;
    if (startY === null) {
      resetPullState();
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) {
      resetPullState();
      return;
    }

    const deltaY = touch.clientY - startY;
    resetPullState();

    // Require significant downward pull
    if (deltaY < PULL_TRIGGER) return;

    const now = Date.now();
    if (now - lastRefreshRef.current < 1500) return;
    lastRefreshRef.current = now;
    setIsRefreshing(true);
    onPullRefresh?.();
    if (refreshTimerRef.current !== null) {
      globalThis.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = globalThis.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = null;
    }, 650);
  };

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        globalThis.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="home-screen-container flex-1 flex flex-col overflow-hidden min-h-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetPullState}
      style={{
        justifyContent: "flex-end",
        overflow: "hidden",
      }}
    >
      <div
        className="pointer-events-none flex items-center justify-center"
        style={{
          height: isRefreshing || pullDistance > 0 ? 28 : 0,
          opacity: isRefreshing || pullDistance > 0 ? 1 : 0,
          color: "var(--pp-text-secondary)",
        }}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span>
            {isRefreshing
              ? t("common.refreshing")
              : t("common.pullToRefresh")}
          </span>
        </div>
      </div>

      {/* Content wrapper - mascot and prayer cards */}
      <div
        style={{
          flexShrink: 0,
          overflow: "hidden",
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {/* Mascot space - reserved area at top for mascot visibility */}
        <div className="home-mascot-space home-mascot-spacer flex-shrink-0 flex items-end justify-center pb-4" />

        {/* Prayer times - reserve space for nav + safe area */}
        <div
          className="home-prayer-cards-container px-3 sm:px-4 animate-fade-in-up"
          style={{
            paddingBottom:
              "calc(var(--pp-bottom-nav-height) + 5mm + var(--pp-bottom-safe))",
          }}
        >
          {showLocationGate ? (
            <div className="rounded-2xl border p-4 pp-glass-surface-strong">
              <p className="text-sm font-semibold pp-text-primary">
                {t("location.setLocationTitle")}
              </p>
              <p className="text-xs pp-text-secondary mt-1">
                {t("location.setLocationBody")}
              </p>
              <button
                type="button"
                onClick={onSetLocationClick}
                className="mt-3 w-full rounded-xl border px-4 py-3 text-sm font-semibold pp-glass-surface-button"
              >
                {t("location.setLocationCta")}
              </button>
            </div>
          ) : null}

          <div
            className="animate-scale-in"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <QiblaButton onClick={onQiblaClick} />
          </div>

          {/* Spacing between Qibla button and prayer cards */}
          <div className="h-4 sm:h-6" />

          <div
            className="grid grid-cols-2 gap-1.5 sm:gap-2"
          >
            {prayerTimes.map((prayer, index) => (
              <div
                key={prayer.name}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${0.1 + index * 0.05}s`,
                  animationFillMode: "both",
                }}
              >
                <PrayerCard
                  timeFormatKey={timeFormatKey}
                  prayer={prayer}
                  isNext={nextPrayer ? prayer.name === nextPrayer.name : false}
                  locationTimeZone={locationTimeZone}
                />
              </div>
            ))}
          </div>

          {/* Spacing between prayer cards and Counter button */}
          <div className="h-4 sm:h-6" />

          <div
            className="animate-scale-in"
            style={{ animationDelay: "0.3s", animationFillMode: "both" }}
          >
            <CounterButton onClick={onCounterClick} />
          </div>
        </div>
      </div>
      {/* End content wrapper */}
    </div>
  );
}
