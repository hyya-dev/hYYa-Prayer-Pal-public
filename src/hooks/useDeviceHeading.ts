import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { StorageService } from "@/services/StorageService";
import { createLogger } from '@/utils/logger';

import {
  requestOrientationPermission,
  requiresOrientationPermission,
} from '@/utils/orientationPermission';

const PERMISSION_STORAGE_KEY = 'prayerpal_compass_permission';
const log = createLogger('[DeviceHeading]');

interface DeviceHeadingState {
  heading: number | null;
  accuracy: 'high' | 'medium' | 'low' | 'unreliable' | 'unknown';
  isSupported: boolean;
  permissionGranted: boolean;
  permissionRequested: boolean;
  error: string | null;
}

// Detect iOS - LESSON LEARNED: Use Capacitor.getPlatform() for reliable platform detection
const isIOS = Capacitor.getPlatform() === 'ios';

// Helper: Calculate circular mean (for compass headings that wrap at 360)
function circularMean(angles: number[]): number {
  if (angles.length === 0) return 0;
  
  let sinSum = 0;
  let cosSum = 0;
  
  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  
  const meanRad = Math.atan2(sinSum / angles.length, cosSum / angles.length);
  let meanDeg = (meanRad * 180) / Math.PI;
  
  // Normalize to 0-360
  if (meanDeg < 0) meanDeg += 360;
  
  return meanDeg;
}

// Helper: Calculate angular difference (handles wrap-around)
function angularDifference(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Module-level flag: tracks if we've received orientation events in this browser session
// This persists across component re-mounts (page switches)
let sessionPermissionGranted = false;

// Check if permission was previously granted (stored in localStorage with sessionStorage fallback)
// PERFORMANCE FIX: Removed excessive logging - this function is called on every render
function getStoredPermissionState(): { granted: boolean; requested: boolean } {
  try {
    // Try localStorage first
    let stored = StorageService.getItem(PERMISSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Fallback to sessionStorage
    stored = sessionStorage.getItem(PERMISSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    log.warn('Failed to read stored compass permission state', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
  }
  return { granted: false, requested: false };
}

// PERFORMANCE FIX: Removed excessive logging - this function is called frequently
function storePermissionState(granted: boolean, requested: boolean) {
  const data = JSON.stringify({ granted, requested });
  try {
    StorageService.setItem(PERMISSION_STORAGE_KEY, data);
  } catch (e) {
    log.warn('Failed to persist compass permission state (StorageService)', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
  }
  try {
    sessionStorage.setItem(PERMISSION_STORAGE_KEY, data);
  } catch (e) {
    log.warn('Failed to persist compass permission state (sessionStorage)', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
  }
}

export function useDeviceHeading() {
  const storedPermission = getStoredPermissionState();
  
  // On iOS: If permission was previously granted (stored in localStorage) AND we're in a native app,
  // trust that permission is still valid. The native app persists permissions across restarts.
  // On web/iOS Safari: Still need to check sessionPermissionGranted for browser sessions
  // On Android (no permission required), use stored permission
  const isNativeApp = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
  const shouldTrustStoredPermission = isNativeApp && storedPermission.granted;
  
  const initialGranted = sessionPermissionGranted || shouldTrustStoredPermission || (!requiresOrientationPermission && storedPermission.granted);
  const initialRequested = sessionPermissionGranted || shouldTrustStoredPermission || (!requiresOrientationPermission && storedPermission.requested);
  
  const [state, setState] = useState<DeviceHeadingState>({
    heading: null,
    accuracy: 'unknown',
    isSupported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
    permissionGranted: initialGranted,
    permissionRequested: initialRequested,
    error: null,
  });

  const headingRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const hasReceivedEventRef = useRef(false);
  const eventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Android smoothing: rolling average buffer
  const headingBufferRef = useRef<number[]>([]);
  const smoothedHeadingRef = useRef<number | null>(null);
  const ANDROID_BUFFER_SIZE = 8; // Rolling average of last 8 readings
  const ANDROID_MOVEMENT_THRESHOLD = 3; // Ignore movements smaller than 3 degrees

  const requestPermission = useCallback(async () => {
    storePermissionState(false, true);
    setState(prev => ({ ...prev, permissionRequested: true }));
    
    if (requiresOrientationPermission) {
      const permission = await requestOrientationPermission();
      if (permission === 'granted') {
        sessionPermissionGranted = true; // Mark session as granted
        storePermissionState(true, true);
        setState(prev => ({ ...prev, permissionGranted: true, error: null }));
        // Reset the event received flag so we can detect new events
        hasReceivedEventRef.current = false;
        return true;
      }

      if (permission === 'denied') {
        storePermissionState(false, true);
        setState(prev => ({
          ...prev,
          permissionGranted: false,
          error: 'Permission denied. Please enable motion access in Settings.'
        }));
        return false;
      }
    }

    // Android doesn't require permission
    sessionPermissionGranted = true; // Mark session as granted
    storePermissionState(true, true);
    setState(prev => ({ ...prev, permissionGranted: true }));
    return true;
  }, []);

  useEffect(() => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Compass not supported on this device' }));
      return;
    }

    let isActive = true;
    const isAndroid = Capacitor.getPlatform() === 'android';
    
    // Reset event received flag when effect runs (app restart or component remount)
    hasReceivedEventRef.current = false;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!isActive) return;

      // If we receive events, permission is granted
      if (!hasReceivedEventRef.current) {
        hasReceivedEventRef.current = true;
        // Set module-level flag so permission persists across page switches
        sessionPermissionGranted = true;
        storePermissionState(true, true);
        setState(prev => ({ ...prev, permissionGranted: true, permissionRequested: true }));
        
        // Clear the timeout since we got events
        if (eventTimeoutRef.current) {
          clearTimeout(eventTimeoutRef.current);
          eventTimeoutRef.current = null;
        }
      }

      // Throttle updates to ~30fps for smoother performance
      const now = Date.now();
      if (now - lastUpdateRef.current < 33) return;
      lastUpdateRef.current = now;

      let heading: number | null = null;
      let accuracy: DeviceHeadingState['accuracy'] = 'medium';

      // iOS: Use webkitCompassHeading (gives true north directly)
      if (event.webkitCompassHeading !== undefined) {
        heading = event.webkitCompassHeading;
        
        // iOS provides accuracy
        const webkitAccuracy = event.webkitCompassAccuracy;
        if (webkitAccuracy !== undefined) {
          if (webkitAccuracy < 0) {
            accuracy = 'unreliable';
          } else if (webkitAccuracy > 45) {
            accuracy = 'low';
          } else if (webkitAccuracy > 20) {
            accuracy = 'medium';
          } else {
            accuracy = 'high';
          }
        }
      } 
      // Android: Use alpha from absolute orientation event
      else if (event.alpha !== null) {
        // On Android with deviceorientationabsolute event (or when absolute is true),
        // alpha is measured counter-clockwise from north
        // Convert to compass heading (clockwise from north)
        // CRITICAL: If both deviceorientation and deviceorientationabsolute listeners are active,
        // ignore events where absolute is false (relative orientation) to avoid wrong readings
        if (isAndroid && event.absolute === false && 'ondeviceorientationabsolute' in window) {
          // We have deviceorientationabsolute available, so ignore relative deviceorientation events
          return;
        }
        // deviceorientationabsolute alpha: 0–360 around Z; opposite sense to compass.
        // Alpha is opposite sense to compass (W3C); (360 - alpha) gives compass heading. Matches PrayerPal.
        // Note: We only listen to deviceorientationabsolute on Android when available, so we
        // avoid deviceorientation’s relative alpha (event.absolute=false) which would be wrong.
        let rawHeading = (360 - event.alpha) % 360;
        if (rawHeading < 0) rawHeading += 360;
        
        // Apply rolling average smoothing for Android
        headingBufferRef.current.push(rawHeading);
        if (headingBufferRef.current.length > ANDROID_BUFFER_SIZE) {
          headingBufferRef.current.shift();
        }
        
        // Calculate smoothed heading using circular mean
        const smoothed = circularMean(headingBufferRef.current);
        
        // Apply movement threshold: only update if change is significant
        if (smoothedHeadingRef.current !== null) {
          const diff = angularDifference(smoothed, smoothedHeadingRef.current);
          if (diff < ANDROID_MOVEMENT_THRESHOLD) {
            // Movement too small, keep current heading
            heading = smoothedHeadingRef.current;
          } else {
            // Apply additional exponential smoothing for even smoother transitions
            const prevSmoothed = smoothedHeadingRef.current;
            let angleDiff = smoothed - prevSmoothed;
            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;
            
            // Slower interpolation for Android (0.15 factor)
            heading = prevSmoothed + angleDiff * 0.15;
            if (heading < 0) heading += 360;
            if (heading >= 360) heading -= 360;
            
            smoothedHeadingRef.current = heading;
          }
        } else {
          // First reading
          heading = smoothed;
          smoothedHeadingRef.current = smoothed;
        }
        
        // Android doesn't provide accuracy the same way, assume medium if absolute
        accuracy = event.absolute ? 'high' : 'medium';
      }

      if (heading !== null) {
        headingRef.current = heading;

        setState(prev => ({
          ...prev,
          heading,
          accuracy,
          permissionGranted: true,
          error: accuracy === 'unreliable' ? 'Move device in figure-8 to calibrate' : null,
        }));
      }
    };

    // Try to start listening
    const startListening = async () => {
      // Android: Use deviceorientationabsolute for true north heading
      // This event provides absolute orientation relative to Earth's coordinate frame
      if (isAndroid && 'ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      }
      
      // Also listen to regular deviceorientation as fallback (and for iOS)
      window.addEventListener('deviceorientation', handleOrientation, true);
      
      // For non-iOS devices (no permission required), mark permission as granted
      if (!requiresOrientationPermission) {
        sessionPermissionGranted = true; // Mark session as granted
        storePermissionState(true, true);
        setState(prev => ({ ...prev, permissionGranted: true, permissionRequested: true }));
      } else {
        // On iOS: Check if we're in a native app and permission was previously granted
        const isNativeApp = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
        const storedPermission = getStoredPermissionState();
        
        if (isNativeApp && storedPermission.granted) {
          // In native app, if permission was previously granted, we need to re-request it
          // iOS requires explicit permission request after app restart, but if already granted,
          // requestPermission() will return 'granted' immediately without showing dialog
          sessionPermissionGranted = true;
          
          // Silently re-request permission (won't show dialog if already granted)
          (async () => {
            try {
              const permission = await requestOrientationPermission();
              if (permission === 'granted') {
                setState(prev => ({ ...prev, permissionGranted: true, permissionRequested: true }));
                // Reset flag so we can detect new events
                hasReceivedEventRef.current = false;
              } else {
                setState(prev => ({ ...prev, permissionGranted: false }));
              }
            } catch (e) {
              setState(prev => ({ ...prev, permissionGranted: false }));
            }
          })();
          
          // Set a timeout to verify events are actually coming
          eventTimeoutRef.current = setTimeout(() => {
            if (!hasReceivedEventRef.current) {
              // Reset state if no events received - user will need to tap button again
              setState(prev => ({ ...prev, permissionGranted: false }));
            }
          }, 2000);
        } else {
          // On iOS web/Safari, set a timeout to detect if we're not getting events
          // This means permission hasn't been granted in this session
          eventTimeoutRef.current = setTimeout(() => {
            if (!hasReceivedEventRef.current) {
              // Don't mark as granted - user needs to tap button
            }
          }, 1000);
        }
      }
    };

    startListening();

    const rafIdAtEffectScope = rafRef.current;

    return () => {
      isActive = false;
      if (isAndroid && 'ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      }
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (rafIdAtEffectScope) {
        cancelAnimationFrame(rafIdAtEffectScope);
      }
      if (eventTimeoutRef.current) {
        clearTimeout(eventTimeoutRef.current);
      }
    };
  }, [state.isSupported]);

  return {
    ...state,
    requestPermission,
    // Expose session flag for components that need to know if permission was granted this session
    sessionGranted: sessionPermissionGranted,
  };
}