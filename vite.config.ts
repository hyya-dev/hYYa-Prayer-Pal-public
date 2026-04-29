/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";

const DEFAULT_MAX_CACHE_BYTES = 10 * 1024 * 1024;

function parseMaxCacheBytes(rawValue: string | undefined): number {
  if (!rawValue) return DEFAULT_MAX_CACHE_BYTES;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CACHE_BYTES;
  return parsed;
}

// Capacitor native app configuration
// Service workers disabled - Capacitor handles native caching
export default defineConfig(({ mode }) => {
  const maxCacheBytes = parseMaxCacheBytes(process.env.VITE_MAX_CACHE_BYTES);

  return {
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      // This app ships primarily via Capacitor (iOS/Android) where SW is unnecessary.
      // SW generation has also proven flaky in this build (workbox/terser early-exit),
      // so keep it disabled to avoid breaking production builds.
      disable: true,
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'favicon-32x32.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'hYYa Prayer Pal',
        short_name: 'hYYa Prayer Pal',
        description: 'Your cute companion for spiritual moments, prayer reminders, and a blessed life.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          }
        ]
      },
      workbox: {
        // Current main bundle exceeds 4MB, so allow larger precache assets.
        maximumFileSizeToCacheInBytes: maxCacheBytes,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['assets/locale-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/quran\/mushaf\/mushaf_layout\.sqlite3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mushaf-layout-db',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /assets\/locale-.*\.js$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'locale-chunk-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.quran\.com\/api\/v4\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/everyayah\.com\/data\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              rangeRequests: true
            }
          }
        ]
      }
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Capacitor builds from dist folder
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Generate sourcemaps for debugging in native apps
    sourcemap: mode === "development",
    // Capacitor apps bundle everything locally - larger chunks are fine
    // Manual chunking to keep entry chunk sizes manageable.
    // Locale bundles can exceed 1000 kB for content-heavy languages.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const isJson = id.endsWith(".json");
          const hasLocalePathHint = /[\\/]locales?[\\/]/i.test(id) || /[\\/]i18n[\\/]/i.test(id);
          const localeName = path.basename(id, ".json");
          const localeNamePattern = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

          if (isJson && hasLocalePathHint && localeNamePattern.test(localeName)) {
            // Keep locale payload split into predictable lightweight chunks.
            return `locale-${localeName}`;
          }

          if (id.includes("/node_modules/")) {
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }

            if (id.includes("/react-router/") || id.includes("/react-router-dom/")) {
              return "vendor-router";
            }

            if (id.includes("/i18next/") || id.includes("/react-i18next/")) {
              return "vendor-i18n";
            }

            if (id.includes("/lucide-react/")) {
              return "vendor-ui";
            }

            if (id.includes("/sql.js/")) {
              return "vendor-sqljs";
            }

            return "vendor-misc";
          }

          return undefined;
        },
      },
    },
    // PERFORMANCE: Strip console.log/warn in production builds
    // This removes 135+ debug statements that slow down the app
    minify: 'esbuild',
    esbuildOptions: {
      drop: mode === "production" ? ['console', 'debugger'] : [],
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
  };
});
