import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StorageService } from "@/services/StorageService";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";


const COUNTER_STORAGE_KEY = 'prayerPal_counter';

export default function Counter() {
  const { t } = useTranslation();
  const [count, setCount] = useState(() => {
    const saved = StorageService.getItem(COUNTER_STORAGE_KEY);
    return saved ? Number.parseInt(saved, 10) : 0;
  });

  const hapticClick = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style: ImpactStyle.Light });
  }, []);

  const hapticReset = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.notification({ type: NotificationType.Success });
  }, []);

  // Save count to StorageService whenever it changes
  useEffect(() => {
    StorageService.setItem(COUNTER_STORAGE_KEY, count.toString());
  }, [count]);

  const increment = () => {
    setCount((prev) => Math.min(999, prev + 1));
    hapticClick();
  };

  const decrement = () => {
    setCount((prev) => Math.max(0, prev - 1));
    hapticClick();
  };

  const reset = () => {
    setCount(0);
    hapticReset();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Counter page title - same revised position as other pages */}
      <header className="sticky top-0 z-20 flex-shrink-0 px-4 pb-4" style={{ paddingTop: 'calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))' }}>
        <h1 className={`text-3xl font-bold title-3d text-start`} style={{ marginTop: 'calc(0.25rem - 1mm)' }}>
          {t('screens.counter')}
        </h1>
      </header>
      <div className="flex-1 flex flex-col items-center justify-end px-4 animate-fade-in-up" style={{ paddingBottom: 'calc(var(--pp-bottom-nav-height) + 10mm + var(--pp-bottom-safe))' }}>
      {/* Counter Display */}
      <div 
        className="rounded-3xl p-8 sm:p-12 mb-8 backdrop-blur-sm border relative overflow-hidden animate-scale-in"
        style={{
          background: 'var(--pp-card-bg)',
          borderColor: 'var(--pp-border-strong)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 var(--pp-border-strong), inset 0 -2px 0 rgba(0,0,0,0.15)',
          minWidth: '200px',
        }}
      >
        {/* Glass highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        
        {/* Counter Number */}
        <div className="relative z-10 text-center">
          <div 
            className="text-7xl sm:text-9xl font-bold text-shadow"
            style={{
              letterSpacing: '0.05em',
              color: 'var(--pp-text-primary)',
            }}
          >
            {count.toString().padStart(3, '0')}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4 items-center animate-fade-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
        {/* Decrement Button */}
        <button
          onClick={decrement}
          disabled={count === 0}
          className="rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center backdrop-blur-sm border relative overflow-hidden group hover:scale-110 active:scale-95 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pp-button-bg)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 var(--pp-border-strong), inset 0 -2px 0 rgba(0,0,0,0.15)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
          <div className="relative z-10 text-3xl sm:text-4xl font-bold text-shadow" style={{ color: 'var(--pp-text-primary)' }}>−</div>
        </button>

        {/* Reset Button */}
        <button
          onClick={reset}
          disabled={count === 0}
          className="rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center backdrop-blur-sm border relative overflow-hidden group hover:scale-110 active:scale-95 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pp-button-bg)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 var(--pp-border-strong), inset 0 -2px 0 rgba(0,0,0,0.15)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
          <div className="relative z-10 text-xl sm:text-2xl font-bold text-shadow" style={{ color: 'var(--pp-text-primary)' }}>↺</div>
        </button>

        {/* Increment Button */}
        <button
          onClick={increment}
          disabled={count === 999}
          className="rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center backdrop-blur-sm border relative overflow-hidden group hover:scale-110 active:scale-95 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pp-button-bg)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 var(--pp-border-strong), inset 0 -2px 0 rgba(0,0,0,0.15)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10 pointer-events-none" />
          <div className="relative z-10 text-3xl sm:text-4xl font-bold text-shadow" style={{ color: 'var(--pp-text-primary)' }}>+</div>
        </button>
      </div>
      </div>
    </div>
  );
}
