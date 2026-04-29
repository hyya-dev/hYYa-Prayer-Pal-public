import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type LocaleJson = {
  locationConfidence?: {
    gps?: string;
    gpsWithAccuracy?: string;
    ipApproximate?: string;
    cached?: string;
    manual?: string;
    default?: string;
    nearTemplate?: string;
  };
  location?: {
    source?: {
      gps?: string;
      gpsWeak?: string;
      network?: string;
      offline?: string;
      manual?: string;
    };
  };
};

describe('location locale parity', () => {
  it('has required locationConfidence fallback keys in every locale file', () => {
    const localesDir = join(process.cwd(), 'src', 'i18n', 'locales');
    const localeFiles = readdirSync(localesDir).filter((name) => name.endsWith('.json'));

    const requiredFallbackKeys = [
      'gps',
      'gpsWithAccuracy',
      'ipApproximate',
      'cached',
      'manual',
      'default',
      'nearTemplate',
    ] as const;

    const missing: string[] = [];

    for (const file of localeFiles) {
      const fullPath = join(localesDir, file);
      const json = JSON.parse(readFileSync(fullPath, 'utf8')) as LocaleJson;
      for (const key of requiredFallbackKeys) {
        if (!json.locationConfidence?.[key]) {
          missing.push(`${file}:locationConfidence.${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('supports either locationConfidence.manual or locationConfidence.manual in every locale', () => {
    const localesDir = join(process.cwd(), 'src', 'i18n', 'locales');
    const localeFiles = readdirSync(localesDir).filter((name) => name.endsWith('.json'));

    const missingManualLabel: string[] = [];

    for (const file of localeFiles) {
      const fullPath = join(localesDir, file);
      const json = JSON.parse(readFileSync(fullPath, 'utf8')) as LocaleJson;
      const hasManualInSource = Boolean(json.location?.source?.manual);
      const hasManualFallback = Boolean(json.locationConfidence?.manual);
      if (!hasManualInSource && !hasManualFallback) {
        missingManualLabel.push(file);
      }
    }

    expect(missingManualLabel).toEqual([]);
  });
});
