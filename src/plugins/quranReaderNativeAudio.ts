import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type QuranReaderNativeAudioEndedPayload = Record<string, unknown>;
export type QuranReaderNativeAudioErrorPayload = { message?: string };
export type QuranReaderNativeAudioSurahStepPayload = { direction?: number };
export type QuranReaderNativeAudioPlaybackTickPayload = {
  currentTime?: number;
  duration?: number;
};

export interface QuranReaderNativeAudioPlugin {
  playOne(options: {
    url: string;
    /** 0–1 fraction within the clip (verse seek in surah MP3). */
    startFraction?: number;
    title?: string;
    artist?: string;
    /**
     * When true, lock-screen / headset previous & next map to surah navigation
     * (previous: seek to start of current surah if not near start, else previous surah).
     */
    remoteSurahCommands?: boolean;
  }): Promise<void>;
  /** Pause the currently loaded clip, preserving playback position. No-op if nothing is loaded. */
  pause(): Promise<void>;
  /** Resume playback from the current position. No-op if nothing is loaded or already playing. */
  resume(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "ended" | "error" | "aborted" | "surahStep" | "playbackTick" | "paused" | "resumed",
    listener: (
      payload: QuranReaderNativeAudioEndedPayload &
        QuranReaderNativeAudioErrorPayload &
        QuranReaderNativeAudioSurahStepPayload &
        QuranReaderNativeAudioPlaybackTickPayload,
    ) => void,
  ): Promise<PluginListenerHandle>;
}

export const QuranReaderNativeAudio = registerPlugin<QuranReaderNativeAudioPlugin>("QuranReaderNativeAudio", {
  web: () => ({
    async playOne(_options: {
      url: string;
      startFraction?: number;
      title?: string;
      artist?: string;
      remoteSurahCommands?: boolean;
    }) {
      /* Web uses HTMLAudioElement in useQuranAudio */
    },
    async pause() {},
    async resume() {},
    async stop() {},
    async addListener() {
      return { remove: async () => {} };
    },
  }),
});
