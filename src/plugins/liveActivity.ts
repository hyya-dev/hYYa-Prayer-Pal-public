import { registerPlugin } from '@capacitor/core';

export interface LiveActivityPlugin {
    startActivity(options: { prayerName: string; nextPrayerName: string; endTime: number }): Promise<{ id: string }>;
    stopActivity(): Promise<void>;
    updateActivity(options: { nextPrayerName: string; endTime: number }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

export default LiveActivity;
