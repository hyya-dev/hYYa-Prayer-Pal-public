import { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useIsIpad } from '@/hooks/useIsIpad';
import { cn } from '@/lib/utils';

interface SettingsCategoryProps {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Skip 3D perspective transform — use for tall/scrollable lists where perspective creates visible top-edge displacement */
  noTransform?: boolean;
}

export function SettingsCategory({ children, className, noTransform }: SettingsCategoryProps) {
  const isIpad = useIsIpad();

  return (
    <div className={cn(isIpad ? "mb-4" : "mb-2", className)}>
      <div
        className="backdrop-blur-sm rounded-xl mx-2 overflow-hidden border relative"
        style={{
          // Darker menu card for readability - matching Library style
          background: 'var(--pp-surface-gradient)',
          borderColor: 'var(--pp-border-soft)',
          boxShadow: 'var(--pp-surface-shadow-lg)',
          // Remove rotateX perspective on iPad, Android, or when noTransform is set (prevents zoom animation issues on Android)
          transform: (isIpad || noTransform || Capacitor.getPlatform() === 'android') ? 'none' : 'perspective(800px) rotateX(2deg)',
        }}
      >
        {/* Glass highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
