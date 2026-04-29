import React from 'react';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NavigationControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onBackToList: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  showBackToList?: boolean;
  language?: string;
  /**
   * When true, invert left/right icon semantics for RTL reading
   * (Arabic/Urdu): Previous button shows ChevronRight (→), Next button shows ChevronLeft (←).
   *
   * UX Logic Layer 2 — Navigation Arrow Rule:
   * Arrows must ALWAYS face AWAY from each other (never toward each other).
   * - LTR: Previous = ← (ChevronLeft),  Next = → (ChevronRight)  → arrows face outward ✓
   * - RTL: Previous = → (ChevronRight), Next = ← (ChevronLeft)   → arrows face outward ✓
   *
   * DO NOT use rtl-mirror (CSS scaleX flip) for navigation arrows — mirroring causes
   * arrows to face TOWARD each other in RTL, which violates the UX specification.
   */
  isRTL?: boolean;
}

export function NavigationControls({
  onPrevious,
  onNext,
  onBackToList,
  canGoPrevious,
  canGoNext,
  showBackToList = true,
  language,
  isRTL = false,
}: Readonly<NavigationControlsProps>) {
  const { t } = useTranslation();

  // UX Logic Layer 2 — Logical icon selection based on reading direction.
  // In RTL, the "previous" item is to the right and "next" is to the left.
  // We select the icon explicitly rather than relying on CSS mirroring,
  // which would cause arrows to face toward each other.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="w-full px-4 py-4 z-30">
      <div className="max-w-2xl mx-auto flex justify-between items-center gap-4">
        {/* Previous Button */}
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="p-3 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 active:scale-95 transition-all flex-shrink-0 relative overflow-hidden backdrop-blur-sm border disabled:hover:scale-100"
          style={{
            background: 'var(--pp-button-bg)',
            borderColor: 'var(--pp-border-soft)',
            color: 'var(--pp-text-primary)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
          aria-label={t('quran.previous', { lng: language })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-full" />
          {/* No rtl-mirror — icon is selected logically above */}
          <PrevIcon className="w-6 h-6 relative z-10" />
        </button>
        
        {/* Center Controls */}
        <div className="flex gap-2 flex-1 justify-center">
          {showBackToList && (
            <button
              onClick={onBackToList}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 relative overflow-hidden backdrop-blur-sm border"
              style={{
                background: 'var(--pp-button-bg)',
                borderColor: 'var(--pp-border-soft)',
                color: 'var(--pp-text-primary)',
                boxShadow: 'var(--pp-surface-shadow)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
              <List className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{t('quran.backToList', { lng: language })}</span>
            </button>
          )}
        </div>
        
        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="p-3 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 active:scale-95 transition-all flex-shrink-0 relative overflow-hidden backdrop-blur-sm border disabled:hover:scale-100"
          style={{
            background: 'var(--pp-button-bg)',
            borderColor: 'var(--pp-border-soft)',
            color: 'var(--pp-text-primary)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
          aria-label={t('quran.next', { lng: language })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-full" />
          {/* No rtl-mirror — icon is selected logically above */}
          <NextIcon className="w-6 h-6 relative z-10" />
        </button>
      </div>
    </div>
  );
}
