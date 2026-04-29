import { StorageService } from "@/services/StorageService";
type QuranAudioDownloadEvent = "download_start" | "download_pause" | "download_resume" | "download_cancel" | "download_clear";

type QuranAudioTelemetryEntry = {
  reciterId: number;
  event: QuranAudioDownloadEvent;
  timestamp: number;
};

const QURAN_AUDIO_TELEMETRY_KEY = "quran_audio_download_telemetry_v1";
const MAX_TELEMETRY_ENTRIES = 200;

export function trackQuranAudioDownloadEvent(reciterId: number, event: QuranAudioDownloadEvent): void {
  try {
    const raw = StorageService.getItem(QURAN_AUDIO_TELEMETRY_KEY);
    const existing = raw ? (JSON.parse(raw) as QuranAudioTelemetryEntry[]) : [];
    const next = [...existing, { reciterId, event, timestamp: Date.now() }].slice(-MAX_TELEMETRY_ENTRIES);
    StorageService.setItem(QURAN_AUDIO_TELEMETRY_KEY, JSON.stringify(next));
  } catch {
    // Ignore telemetry persistence errors.
  }
}
