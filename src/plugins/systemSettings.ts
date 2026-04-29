import { registerPlugin } from '@capacitor/core';

export interface SystemSettingsPlugin {
  openExactAlarmSettings(): Promise<{ success: boolean }>;
  checkExactAlarmPermission(): Promise<{ success: boolean; granted: boolean }>;
}

const SystemSettings = registerPlugin<SystemSettingsPlugin>('SystemSettings');

export default SystemSettings;
