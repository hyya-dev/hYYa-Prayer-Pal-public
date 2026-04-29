import { createRoot } from "react-dom/client";
import { StorageService } from "./services/StorageService";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./lib/silenceDebugLogs";

type PwaErrorPayload = {
  stage: "primary" | "fallback";
  scopeTried: "/" | "./";
  message: string;
  stack?: string;
  timestamp: string;
};

const PWA_QUEUE_KEY = "pp_pwa_error_queue_v1";
const PWA_GLOBAL_KEY = "__ppPwaErrors";

type PwaErrorWindow = Window & {
  [PWA_GLOBAL_KEY]?: PwaErrorPayload[];
  sendPwaErrors?: (payloads: PwaErrorPayload[]) => Promise<void> | void;
};

function isPwaErrorPayload(value: unknown): value is PwaErrorPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<PwaErrorPayload>;
  const hasValidStage = payload.stage === "primary" || payload.stage === "fallback";
  const hasValidScope = payload.scopeTried === "/" || payload.scopeTried === "./";
  const hasValidMessage = typeof payload.message === "string";
  const hasValidTimestamp = typeof payload.timestamp === "string";
  const hasValidStack = payload.stack === undefined || typeof payload.stack === "string";

  return hasValidStage && hasValidScope && hasValidMessage && hasValidTimestamp && hasValidStack;
}

function readPwaErrorQueue(win: PwaErrorWindow): PwaErrorPayload[] {
  const inMemory = Array.isArray(win[PWA_GLOBAL_KEY])
    ? win[PWA_GLOBAL_KEY].filter(isPwaErrorPayload)
    : [];
  if (inMemory.length > 0) {
    return inMemory.slice(-50);
  }

  try {
    const raw = StorageService.getItem(PWA_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPwaErrorPayload).slice(-50) : [];
  } catch {
    return [];
  }
}

function persistPwaErrorQueue(win: PwaErrorWindow, queue: PwaErrorPayload[]) {
  win[PWA_GLOBAL_KEY] = queue.slice(-50);

  try {
    StorageService.setItem(PWA_QUEUE_KEY, JSON.stringify(win[PWA_GLOBAL_KEY]));
  } catch {
    // Ignore storage failures in private/restricted modes.
  }
}

async function flushPwaErrors() {
  if (typeof window === "undefined") return;

  const win = window as PwaErrorWindow;
  const queue = readPwaErrorQueue(win);
  if (queue.length === 0) return;

  const sender = win.sendPwaErrors;
  if (typeof sender !== "function") return;

  try {
    await sender(queue);
    persistPwaErrorQueue(win, []);
  } catch {
    // Keep queue for retry when sender fails.
  }
}

function reportPwaError(payload: PwaErrorPayload) {
  if (typeof window === "undefined") return;

  const win = window as PwaErrorWindow;
  const queue = readPwaErrorQueue(win);
  queue.push(payload);
  persistPwaErrorQueue(win, queue);

  console.error("[PWA] Service worker registration error", payload);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const registerWithScope = async (scope: string) => {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope });
    return registration;
  };

  window.addEventListener('load', async () => {
    void flushPwaErrors();
    try {
      await registerWithScope('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      reportPwaError({
        stage: "primary",
        scopeTried: "/",
        message,
        stack,
        timestamp: new Date().toISOString(),
      });

      try {
        // Fallback for subdirectory/base-path deployments (for example, static hosting behind
        // reverse proxies, CDN prefix paths, or GitHub Pages-style nested paths) where '/'
        // scope registration may be rejected but './' correctly scopes to the current app path.
        await registerWithScope('./');
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
        const fallbackStack = fallbackError instanceof Error ? fallbackError.stack : undefined;
        reportPwaError({
          stage: "fallback",
          scopeTried: "./",
          message: fallbackMessage,
          stack: fallbackStack,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  const flushIntervalId = window.setInterval(() => {
    void flushPwaErrors();
  }, 60_000);

  const clearFlushInterval = () => {
    window.clearInterval(flushIntervalId);
  };

  window.addEventListener("beforeunload", clearFlushInterval, { once: true });
  window.addEventListener("unload", clearFlushInterval, { once: true });
}

// Set constraints on body and html to prevent overflow
if (typeof document !== 'undefined') {
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100vw';
  document.body.style.overflowX = 'hidden';
  document.body.style.margin = '0';
  document.body.style.padding = '0';

  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100vw';
  document.documentElement.style.overflowX = 'hidden';

  const root = document.getElementById("root");
  if (root) {
    root.style.width = '100%';
    root.style.maxWidth = '100vw';
    root.style.overflowX = 'hidden';
  }

  // Suppress native context menu (long-press copy/lookup/share) across the entire app
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

if (import.meta.env.PROD) {
  registerServiceWorker();
}

const bootstrap = async () => {
  // Suspend rendering completely until Capacitor SDK completes full offline sync
  await StorageService.init();

  createRoot(document.getElementById("root")!).render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
};

void bootstrap();
