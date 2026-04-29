/**
 * Geolocation Service - Native-first approach
 * 
 * LESSON LEARNED: WebView Geolocation "localhost" Dialog Issue
 * - Using browser's navigator.geolocation in Capacitor's WebView causes
 *   a confusing "localhost would like to use your current location" dialog on iOS
 * - Native iOS location permission (CLLocationManager) is separate from WebView geolocation
 * - This service uses @capacitor/geolocation for native apps (proper CLLocationManager)
 *   and falls back to browser API for web builds
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

// Permission status from Capacitor
export type GeolocationPermissionStatus = 'granted' | 'denied' | 'prompt';

/**
 * Check geolocation permission status
 */
export async function checkGeolocationPermission(): Promise<GeolocationPermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    // Web: Use navigator.permissions if available
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'prompt';
      }
    }
    return 'prompt';
  }

  // Native: Use Capacitor Geolocation
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return 'granted';
    }
    if (status.location === 'denied') {
      return 'denied';
    }
    return 'prompt';
  } catch (error) {
    console.warn('[GeolocationService] Error checking permissions:', error);
    return 'prompt';
  }
}

/**
 * Request geolocation permission
 */
export async function requestGeolocationPermission(): Promise<GeolocationPermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    // Web: Requesting permission happens when we call getCurrentPosition
    return 'prompt';
  }

  // Native: Request permission explicitly
  try {
    const status = await Geolocation.requestPermissions();
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return 'granted';
    }
    if (status.location === 'denied') {
      return 'denied';
    }
    return 'prompt';
  } catch (error) {
    console.warn('[GeolocationService] Error requesting permissions:', error);
    return 'denied';
  }
}

/**
 * Get current position - uses native API on iOS/Android, browser API on web
 * 
 * LESSON LEARNED: Use watchPosition for initial location after fresh permission grant
 * getCurrentPosition can fail immediately after permission is granted because
 * iOS needs time to start CLLocationManager
 */
export async function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  const defaultOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...options,
  };

  if (!Capacitor.isNativePlatform()) {
    // Web: Use browser geolocation
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 2, message: 'Geolocation not supported' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          reject({ code: error.code, message: error.message });
        },
        {
          enableHighAccuracy: defaultOptions.enableHighAccuracy,
          timeout: defaultOptions.timeout,
          maximumAge: defaultOptions.maximumAge,
        }
      );
    });
  }

  // Native: Use Capacitor Geolocation (proper CLLocationManager on iOS)
  try {
    const position = await Geolocation.getCurrentPosition(defaultOptions);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    const e = new Error(err.message || 'Failed to get position');
    (e as Error & { code?: number }).code = err.code ?? 2;
    throw e;
  }
}

/**
 * Watch position - more reliable than getCurrentPosition after fresh permission grant
 * 
 * LESSON LEARNED: Use watchPosition for initial location
 * - Event-driven: Receives location as soon as iOS provides it
 * - No timing assumptions: Doesn't rely on hardcoded delays
 * - Handles cold GPS start: Works even when GPS needs time to get a fix
 */
export async function watchPosition(
  onSuccess: (position: GeolocationPosition) => void,
  onError: (error: GeolocationError) => void,
  options?: PositionOptions
): Promise<() => void> {
  const defaultOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
    ...options,
  };

  if (!Capacitor.isNativePlatform()) {
    // Web: Use browser geolocation
    if (!navigator.geolocation) {
      onError({ code: 2, message: 'Geolocation not supported' });
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        onSuccess({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        onError({ code: error.code, message: error.message });
      },
      {
        enableHighAccuracy: defaultOptions.enableHighAccuracy,
        timeout: defaultOptions.timeout,
        maximumAge: defaultOptions.maximumAge,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }

  // Native: Use Capacitor Geolocation watch
  try {
    const watchId = await Geolocation.watchPosition(defaultOptions, (position: Position | null, err?: unknown) => {
      if (err) {
        const error = err as { code?: number; message?: string };
        onError({
          code: error.code || 2,
          message: error.message || 'Watch position error',
        });
        return;
      }

      if (position) {
        onSuccess({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      }
    });

    return () => {
      Geolocation.clearWatch({ id: watchId });
    };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    onError({
      code: err.code || 2,
      message: err.message || 'Failed to watch position',
    });
    return () => {};
  }
}

/**
 * Get position using watchPosition (more reliable for fresh installs)
 * Automatically stops watching once a GOOD ACCURACY position is received
 * 
 * ANDROID FIX: Wait for accurate reading instead of accepting first reading
 * - Android often returns cell-tower based location first (accuracy 500-2000m)
 * - GPS fix takes a few seconds and provides much better accuracy (<50m)
 * - iOS typically provides accurate readings immediately
 * 
 * Strategy:
 * 1. Wait for a reading with accuracy < 100m (GPS-quality)
 * 2. If no good reading within timeout, use best reading we got
 * 3. Never accept readings with accuracy > 1000m (cell tower noise)
 */
export async function getPositionWithWatch(
  options?: PositionOptions,
  timeoutMs: number = 20000
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let cleanup: (() => void) | null = null;
    let resolved = false;
    let fallbackTimeoutId: ReturnType<typeof setTimeout>;
    
    // Track best position received so far (for fallback)
    let bestPosition: GeolocationPosition | null = null;
    
    // Accuracy thresholds
    const GOOD_ACCURACY_THRESHOLD = 100; // meters - GPS quality, resolve immediately
    const ACCEPTABLE_ACCURACY_THRESHOLD = 500; // meters - acceptable for city detection
    const MAX_ACCURACY_THRESHOLD = 1000; // meters - reject anything worse than this

    // Helper to resolve with best available position
    const resolveWithBest = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
      if (cleanup) cleanup();
      
      if (bestPosition) {
        resolve(bestPosition);
      } else {
        reject({ code: 3, message: 'Timeout waiting for position' });
      }
    };

    // Set main timeout
    const timeoutId = setTimeout(() => {
      resolveWithBest();
    }, timeoutMs);

    // Start watching
    watchPosition(
      (position) => {
        if (resolved) return;
        
        const accuracy = position.accuracy;
        
        // Reject very inaccurate readings (cell tower noise)
        if (accuracy > MAX_ACCURACY_THRESHOLD) {
          return; // Keep waiting for better reading
        }
        
        // Track best position so far
        if (!bestPosition || accuracy < bestPosition.accuracy) {
          bestPosition = position;
        }
        
        // If we get a good accuracy reading, resolve immediately
        if (accuracy <= GOOD_ACCURACY_THRESHOLD) {
          resolved = true;
          clearTimeout(timeoutId);
          if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
          if (cleanup) cleanup();
          resolve(position);
          return;
        }
        
        // If we get an acceptable reading, set a short fallback timeout
        // This gives Android time to get a better GPS fix, but doesn't wait forever
        if (accuracy <= ACCEPTABLE_ACCURACY_THRESHOLD && !fallbackTimeoutId) {
          fallbackTimeoutId = setTimeout(() => {
            resolveWithBest();
          }, 3000); // Wait up to 3 more seconds for better accuracy
        }
      },
      (error) => {
        // Only reject on permission denied
        // Temporary errors during GPS warmup should be ignored
        if (error.code === 1) { // Permission denied
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
            if (cleanup) cleanup();
            reject(error);
          }
        }
        // Other errors: keep watching, might recover
      },
      options
    ).then((cleanupFn) => {
      cleanup = cleanupFn;
      // If already resolved (e.g., by timeout), clean up immediately
      if (resolved && cleanup) {
        cleanup();
      }
    });
  });
}
