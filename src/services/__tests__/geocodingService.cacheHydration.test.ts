import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/StorageService", () => {
  const store = new Map<string, string>();
  return {
    StorageService: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      __reset: () => store.clear(),
    },
  };
});

import { StorageService } from "@/services/StorageService";
import { resolveIanaTimezone } from "../geocodingService";

describe("geocodingService cache hydration", () => {
  const CACHE_KEY = "prayerpal_geocoding_cache_v1";

  beforeEach(() => {
    (StorageService as unknown as { __reset?: () => void }).__reset?.();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the geocoding cache key when persisted JSON is corrupt", async () => {
    // Put corrupt JSON under the cache key
    StorageService.setItem(CACHE_KEY, "{not-json");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Avoid real network: resolveIanaTimezone will call fetch; we stub it to return a valid timezone.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ timeZone: "Etc/UTC" }),
        } as unknown as Response;
      }),
    );

    const tz = await resolveIanaTimezone(25.2048, 55.2708, { allowDeviceFallback: false });
    expect(tz).toBe("Etc/UTC");

    // Hydration should detect parse failure and clear ONLY the cache key.
    expect(StorageService.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

