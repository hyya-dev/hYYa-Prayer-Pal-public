/**
 * Shared types for prayer times, location, and calculation settings.
 * Extracted from usePrayerTimes.ts for reuse across the codebase.
 */

export type PrayerName = 'fajr' | 'shurooq' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type Theme = 'sunrise' | 'afternoon' | 'sunset';
export type CalculationMethodName = 'MuslimWorldLeague' | 'Egyptian' | 'Karachi' | 'UmmAlQura' | 'Dubai' | 'MoonsightingCommittee' | 'NorthAmerica' | 'Kuwait' | 'Qatar' | 'Singapore' | 'Tehran' | 'Turkey';

export interface Prayer {
  name: PrayerName;
  displayName: string;
  time: Date;
}

export interface Location {
  latitude: number;
  longitude: number;
  city: string;
  displayName?: string;
  country?: string; // Country name from geocoding
  countryCode?: string; // ISO country code from geocoding (locale-agnostic)
}

export interface PrayerSettings {
  calculationMethod: CalculationMethodName;
  madhab: 'shafi' | 'hanafi';
}

export interface ManualCorrections {
  fajr: number;
  shurooq: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface ExtendedCalculationSettings {
  method: CalculationMethodName;
  madhab: 'shafi' | 'hanafi';
  highLatitudeMode?: 'off' | 'auto' | 'middle' | 'seventh' | 'twilight';
  manualCorrections?: ManualCorrections;
  daylightSaving?: 'auto' | 'manual';
  daylightSavingOffset?: number;
}

export type LocationSource = 'gps' | 'ip' | 'cache' | 'manual' | 'default';

export interface LocationConfidence {
  source: LocationSource;
  accuracyMeters?: number;
  label: string;
}
