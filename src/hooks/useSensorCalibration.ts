import { useState, useEffect, useRef } from 'react';
import {
  requestOrientationPermission,
  requiresOrientationPermission,
} from '@/utils/orientationPermission';

export interface SensorStatus {
  isSupported: boolean;
  isCalibrated: boolean;
  accuracy: 'high' | 'medium' | 'low' | 'unreliable' | 'unknown';
  errorMessage: string | null;
}

export function useSensorCalibration() {
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    isSupported: true,
    isCalibrated: true,
    accuracy: 'medium',
    errorMessage: null,
  });

  const hasReceivedDataRef = useRef(false);
  const calibrationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if DeviceOrientationEvent is supported
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorStatus({
        isSupported: false,
        isCalibrated: false,
        accuracy: 'unknown',
        errorMessage: 'Compass sensor not supported on this device',
      });
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // We received data, so sensor is working
      if (event.alpha !== null || event.webkitCompassHeading !== undefined) {
        hasReceivedDataRef.current = true;

        // Check accuracy for iOS
        const webkitAccuracy = event.webkitCompassAccuracy;
        
        if (webkitAccuracy !== undefined) {
          // Only show calibration warning for very poor accuracy
          if (webkitAccuracy < 0 || webkitAccuracy > 60) {
            setSensorStatus({
              isSupported: true,
              isCalibrated: false,
              accuracy: 'low',
              errorMessage: null, // Don't spam with error messages
            });
          } else {
            setSensorStatus({
              isSupported: true,
              isCalibrated: true,
              accuracy: webkitAccuracy > 30 ? 'medium' : 'high',
              errorMessage: null,
            });
          }
        } else {
          // Android/other - just mark as working
          setSensorStatus({
            isSupported: true,
            isCalibrated: true,
            accuracy: 'medium',
            errorMessage: null,
          });
        }
      }
    };

    // Add listener
    window.addEventListener('deviceorientation', handleOrientation, true);

    // Check after 3 seconds if we've received any data
    calibrationTimeoutRef.current = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        // Still mark as supported, just unknown accuracy
        setSensorStatus(prev => ({
          ...prev,
          accuracy: 'unknown',
        }));
      }
    }, 3000);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
    };
  }, []);

  const requestCalibration = async () => {
    // For iOS 13+, request permission
    if (requiresOrientationPermission) {
      const permission = await requestOrientationPermission();
      return permission === 'granted';
    }
    return true;
  };

  return {
    sensorStatus,
    requestCalibration,
  };
}
