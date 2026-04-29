import React from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type BookmarkButtonProps = Readonly<{
  isBookmarked: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'lg';
  /** Square matches Holy Quran list favorites (`QuranListHeader`); circle is the compact variant. */
  shape?: 'circle' | 'square';
  /** No stroke around the control (Tafsir verse card only; keep bordered elsewhere). */
  hideBorder?: boolean;
  className?: string;
}>;

function bookmarkInteractionClass(hideBorder: boolean, isSquare: boolean): string {
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45';
  if (hideBorder) {
    const scale = isSquare ? 'hover:scale-105 active:scale-95' : 'hover:scale-110 active:scale-95';
    return `border-0 ${scale} ${focusRing}`;
  }
  if (isSquare) {
    return 'border-2 pp-glass-surface-button hover:scale-105 active:scale-95';
  }
  return 'border hover:scale-110 active:scale-95';
}

function bookmarkStateBorderClass(hideBorder: boolean, isBookmarked: boolean): string {
  if (hideBorder) {
    return '';
  }
  if (isBookmarked) {
    return 'border-white/50';
  }
  return 'border-white/25';
}

export function BookmarkButton({
  isBookmarked,
  onToggle,
  size = 'md',
  shape = 'circle',
  hideBorder = false,
  className,
}: BookmarkButtonProps) {
  const { t } = useTranslation();

  const sizeClassesCircle = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  /** Same footprint as `QuranListHeader` favorites (w-12 · rounded-xl · border-2). */
  const sizeClassesSquare = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const isSquare = shape === 'square';

  let cornerClass = 'rounded-full';
  if (isSquare) {
    cornerClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl';
  }

  let overlayGradientClass = 'from-white/10 via-transparent to-black/35';
  if (!isSquare && isBookmarked) {
    overlayGradientClass = 'from-white/20 via-transparent to-black/30';
  }

  const dimensionClass = isSquare ? sizeClassesSquare[size] : sizeClassesCircle[size];

  const interactionClass = bookmarkInteractionClass(hideBorder, isSquare);
  const stateBorderClass = bookmarkStateBorderClass(hideBorder, isBookmarked);

  if (hideBorder) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={[
          'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border-0 bg-transparent p-0 shadow-none backdrop-blur-none transition-all shrink-0 outline-none text-current',
          interactionClass,
          className,
        ].join(' ')}
        aria-label={isBookmarked ? t('quran.removeFavorite') : t('quran.addFavorite')}
      >
        <Heart className={`${iconSizes[size]} ${isBookmarked ? 'fill-current' : ''}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={[
        dimensionClass,
        'pp-quran-bookmark-btn flex items-center justify-center transition-all relative overflow-hidden backdrop-blur-sm shrink-0',
        interactionClass,
        isBookmarked ? 'pp-quran-bookmark-btn-active' : 'pp-quran-bookmark-btn-idle',
        stateBorderClass,
        className,
      ].filter(Boolean).join(' ')}
      aria-label={isBookmarked ? t('quran.removeFavorite') : t('quran.addFavorite')}
    >
      <div
        className={[
          'absolute inset-0 bg-gradient-to-br pointer-events-none',
          cornerClass,
          overlayGradientClass,
        ].join(' ')}
      />
      <div className="relative z-10">
        <Heart className={`${iconSizes[size]} ${isBookmarked ? 'fill-current' : ''}`} />
      </div>
    </button>
  );
}
