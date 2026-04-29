/**
 * Lock-screen / OS "Now Playing" metadata for Quran reader audio (Web Media Session).
 * Tier C native decode may replace transport later; metadata still applies where supported.
 */
export function setQuranReaderNowPlaying(meta: { title: string; artist?: string }): void {
  try {
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist ?? "",
      });
    }
  } catch {
    // Ignore unsupported environments.
  }
}

export function clearQuranReaderNowPlaying(): void {
  try {
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
    }
  } catch {
    // Ignore.
  }
}
