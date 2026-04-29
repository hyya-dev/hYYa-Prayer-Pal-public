import { useEffect, useSyncExternalStore } from 'react';

/**
 * Detects if the device is an iPad or Android tablet
 *
 * Detection methods (in order):
 * 1. iPad user agent (/ipad/ in UA)
 * 2. iPadOS on Mac (MacIntel platform + maxTouchPoints > 1)
 * 3. Android tablets (Android UA without 'mobile')
 * 4. Fallback: aspect ratio >= 0.6 AND min screen dimension >= 600px
 */
function detectIsIpad(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  
  // 1. iPad user agent (older iPads)
  const isIPadUA = /ipad/.test(userAgent);
  if (isIPadUA) return true;
  
  // 2. iPadOS on Mac (modern iPads report as MacIntel)
  const isMacIntel = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (isMacIntel) return true;
  
  // 3. Android tablets (Android without 'mobile' in UA)
  const isAndroid = /android/.test(userAgent);
  const hasNoMobile = !/mobile/.test(userAgent);
  if (isAndroid && hasNoMobile) return true;
  
  // 4. Fallback: aspect ratio and screen size check
  // Tablets typically have aspect ratio >= 0.6 (3:4 = 0.75, 16:10 = 0.625)
  // and minimum dimension >= 600px
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  const minDimension = Math.min(width, height);
  
  // Not an iPhone but meets tablet criteria
  const isIPhone = /iphone/.test(userAgent);
  if (!isIPhone && aspectRatio >= 0.6 && minDimension >= 600) return true;
  
  return false;
}

// Module-level state for iPad detection (singleton pattern)
let isIpadValue = detectIsIpad();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return isIpadValue;
}

function getServerSnapshot(): boolean {
  return false;
}

function updateIsIpad(): void {
  const newValue = detectIsIpad();
  if (newValue !== isIpadValue) {
    isIpadValue = newValue;
    listeners.forEach(listener => listener());
  }
}

// Initialize event listeners once at module load
if (typeof window !== 'undefined') {
  window.addEventListener('orientationchange', updateIsIpad);
  window.addEventListener('resize', updateIsIpad);
}

/**
 * Hook that returns whether the device is an iPad.
 * Uses useSyncExternalStore for optimal performance and consistency.
 * Also adds 'is-ipad' class to body for CSS targeting.
 *
 * PERFORMANCE FIX: This replaces duplicate iPad detection logic across components.
 * All components should use this single hook instead of implementing their own detection.
 */
export function useIsIpad(): boolean {
  const isIpad = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sync CSS class with state
  useEffect(() => {
    if (isIpad) {
      document.body.classList.add('is-ipad');
      document.documentElement.classList.add('is-ipad');
    } else {
      document.body.classList.remove('is-ipad');
      document.documentElement.classList.remove('is-ipad');
    }
  }, [isIpad]);

  return isIpad;
}

/**
 * @deprecated Use useIsIpad() which now returns a boolean directly.
 * This export is kept for backward compatibility with existing code.
 */
export function useIsIpadEffect(): void {
  useIsIpad();
}
