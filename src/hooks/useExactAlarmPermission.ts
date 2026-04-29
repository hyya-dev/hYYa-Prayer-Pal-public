import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import SystemSettings from '@/plugins/systemSettings';

interface PermissionState {
  granted: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check exact alarm permission status on Android 12+
 * Returns granted=true on iOS and Android <12 (no permission needed)
 * On Android 12+, checks via native AlarmManager.canScheduleExactAlarms()
 */
export const useExactAlarmPermission = () => {
  const [state, setState] = useState<PermissionState>({
    granted: false,
    loading: true,
    error: null,
  });

  const checkPermission = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const platform = Capacitor.getPlatform();

      // iOS and non-Android platforms always have "permission granted" (no restriction)
      if (platform !== 'android') {
        setState({ granted: true, loading: false, error: null });
        return;
      }

      // Android: Call native checker
      const result = await SystemSettings.checkExactAlarmPermission();

      if (result.success) {
        setState({
          granted: result.granted,
          loading: false,
          error: null,
        });
      } else {
        // P0-4: Never assume granted on check failure.
        setState({
          granted: false,
          loading: false,
          error: 'check_failed',
        });
      }
    } catch (err) {
      console.error('useExactAlarmPermission error:', err);
      setState({
        granted: false,
        loading: false,
        error: 'check_failed',
      });
    }
  };

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  // Re-check when app comes to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkPermission();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    granted: state.granted,
    loading: state.loading,
    error: state.error,
    refetch: checkPermission,
  };
};
