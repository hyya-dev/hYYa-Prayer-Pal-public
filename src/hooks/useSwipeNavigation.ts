import { useEffect, useRef, useCallback } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  edgeWidth?: number;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  edgeWidth = 30,
}: SwipeConfig) {
  const touchStartRef = useRef<{ x: number; y: number; time: number; fromEdge: 'left' | 'right' | null } | null>(null);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const screenWidth = window.innerWidth;
    
    // Check if touch started from edge (preferred) or anywhere on screen
    let fromEdge: 'left' | 'right' | null = null;
    if (touch.clientX < edgeWidth) {
      fromEdge = 'left';
    } else if (touch.clientX > screenWidth - edgeWidth) {
      fromEdge = 'right';
    } else {
      // Allow swiping from anywhere, but track direction
      fromEdge = touch.clientX < screenWidth / 2 ? 'left' : 'right';
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      fromEdge,
    };
    isSwipingRef.current = false;
  }, [edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // If horizontal movement is greater than vertical, prevent scroll
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
      isSwipingRef.current = true;
      e.preventDefault(); // Prevent scrolling during horizontal swipe
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Check if it's a valid swipe (horizontal, fast enough)
    const isValidSwipe = 
      Math.abs(deltaX) > threshold && 
      Math.abs(deltaX) > deltaY * 1.5 &&
      deltaTime < 500;

    if (isValidSwipe) {
      if (deltaX > 0) {
        // Swipe right
        onSwipeRight?.();
      } else {
        // Swipe left
        onSwipeLeft?.();
      }
    }

    touchStartRef.current = null;
    isSwipingRef.current = false;
  }, [threshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    // Use passive: false for touchmove to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}