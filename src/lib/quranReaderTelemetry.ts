type ReaderAudioEvent =
  | "reader_audio_branch"
  | "reader_audio_prompt"
  | "reader_audio_nav_library_audio"
  | "reader_audio_play_error";

export function logQuranReaderAudio(event: ReaderAudioEvent, detail?: Record<string, unknown>): void {
  // Intentional diagnostic breadcrumb (no PII); eslint allows error-only by default.
  // eslint-disable-next-line no-console -- reader audio UX diagnostics
  console.info(`[QuranReaderAudio] ${event}`, detail ?? {});
}
