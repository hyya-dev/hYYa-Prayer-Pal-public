import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { migrateStoredAppSettings } from "../useAppSettings";

describe("migrateStoredAppSettings", () => {
  beforeEach(() => {
    (StorageService as unknown as { __reset?: () => void }).__reset?.();
    vi.clearAllMocks();
  });

  it("returns defaults with detected language when no saved settings", () => {
    const settings = migrateStoredAppSettings(null, "ar");
    expect(settings.language).toBe("ar");
    expect(settings.schemaVersion).toBeGreaterThan(0);
    expect(settings.notifications.soundType).toBe("discreet");
  });

  it("logs and falls back to defaults when JSON is corrupt (no silent reset)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const settings = migrateStoredAppSettings("{not-json", "en");
    expect(settings.language).toBe("en");
    expect(settings.schemaVersion).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("migrates legacy soundType bell/adhan -> discreet", () => {
    const raw = JSON.stringify({
      schemaVersion: 0,
      notifications: { soundType: "bell" },
    });
    const settings = migrateStoredAppSettings(raw, "en");
    expect(settings.notifications.soundType).toBe("discreet");
    expect(settings.schemaVersion).toBeGreaterThan(0);
  });

  it("migrates legacy defaultTranslationLanguage to defaultQuranLanguage and conditionally Hisn", () => {
    StorageService.setItem("v3_1_0_defaults_set", "true");
    const raw = JSON.stringify({
      schemaVersion: 0,
      defaultTranslationLanguage: "en",
    });
    const settings = migrateStoredAppSettings(raw, "en");
    expect(settings.defaultQuranLanguage).toBe("en");
    expect(settings.defaultHisnLanguage).toBe("en");
  });

  it("imports legacy reader keys from StorageService during migration", () => {
    StorageService.setItem("v3_1_0_defaults_set", "true");
    StorageService.setItem("quran_secondary_language", "ur");
    const raw = JSON.stringify({ schemaVersion: 1 });
    const settings = migrateStoredAppSettings(raw, "en");
    expect(settings.defaultQuranLanguage).toBe("ur");
    // Hisn only supports ar/en
    expect(settings.defaultHisnLanguage).toBeNull();
    expect(StorageService.removeItem).toHaveBeenCalledWith("quran_secondary_language");
    expect(StorageService.removeItem).toHaveBeenCalledWith("quran_hide_arabic");
  });

  it("applies existing-install defaults once via v2->v3 migration", () => {
    const raw = JSON.stringify({ schemaVersion: 2 });
    const settings = migrateStoredAppSettings(raw, "en");
    expect(settings.defaultQuranLanguage).toBe("ar");
    expect(settings.defaultHisnLanguage).toBe("ar");
    expect(StorageService.setItem).toHaveBeenCalledWith("v3_1_0_defaults_set", "true");
  });
});

