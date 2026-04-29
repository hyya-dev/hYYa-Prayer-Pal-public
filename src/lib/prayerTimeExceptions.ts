import { toWesternDigits } from '@/lib/toWesternDigits';

export interface ExceptionLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  countryCode?: string;
}

export interface DailyPrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export interface PrayerExceptionContext {
  date: Date;
  location?: ExceptionLocation;
}

interface PrayerExceptionRule {
  id: string;
  applies: (context: PrayerExceptionContext) => boolean;
  apply: (times: DailyPrayerTimes, context: PrayerExceptionContext) => DailyPrayerTimes;
}

function getHijriMonthNumber(date: Date): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });

    const parts = formatter.formatToParts(date);
    const monthPart = parts.find((part) => part.type === 'month')?.value;
    if (!monthPart) return null;

    const month = Number.parseInt(toWesternDigits(monthPart), 10);
    return Number.isFinite(month) ? month : null;
  } catch {
    return null;
  }
}

function isSaudiArabia(location?: ExceptionLocation): boolean {
  if (!location) return false;

  const country = (location.country || '').trim().toLowerCase();
  const countryCode = (location.countryCode || '').trim().toUpperCase();
  const city = (location.city || '').trim().toLowerCase();

  // Coordinate-based fallback for cases where reverse-geocoding metadata
  // (countryCode/city/country) isn't available yet at scheduling time.
  // Bounds are intentionally conservative to cover KSA without depending on strings.
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  const withinSaudiBounds =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 16 &&
    lat <= 33.5 &&
    lon >= 34 &&
    lon <= 56.5;

  if (countryCode === 'SA') {
    return true;
  }

  if (
    country.includes('saudi') ||
    country.includes('ksa') ||
    country.includes('السعود') ||
    country.includes('المملكة')
  ) {
    return true;
  }

  if (city.includes('riyadh') || city.includes('jeddah') || city.includes('makkah') || city.includes('madinah')) {
    return true;
  }

  if (withinSaudiBounds) {
    return true;
  }

  return false;
}

function isRamadan(date: Date): boolean {
  return getHijriMonthNumber(date) === 9;
}

const SAUDI_RAMADAN_ISHA_RULE: PrayerExceptionRule = {
  id: 'saudi-ramadan-isha-plus-2h',
  /**
   * KSA Ramadan timing:
   * - Trigger Ramadan using the device `Intl` islamic calendar month (month 9).
   * - Apply ONLY when the user is in Saudi Arabia (prefer ISO `countryCode: SA`, otherwise string/coordinate fallbacks).
   */
  applies: ({ date, location }) => isSaudiArabia(location) && isRamadan(date),
  apply: (times) => ({
    ...times,
    isha: new Date(times.maghrib.getTime() + 2 * 60 * 60 * 1000),
  }),
};

const EXCEPTION_RULES: PrayerExceptionRule[] = [SAUDI_RAMADAN_ISHA_RULE];

export function applyRegionalPrayerTimeExceptions(
  times: DailyPrayerTimes,
  context: PrayerExceptionContext,
): DailyPrayerTimes {
  return EXCEPTION_RULES.reduce((adjusted, rule) => {
    if (!rule.applies(context)) return adjusted;
    return rule.apply(adjusted, context);
  }, times);
}

export function getPrayerExceptionRules(): string[] {
  return EXCEPTION_RULES.map((rule) => rule.id);
}

export function isSaudiRamadanIshaExceptionActive(context: PrayerExceptionContext): boolean {
  return SAUDI_RAMADAN_ISHA_RULE.applies(context);
}
