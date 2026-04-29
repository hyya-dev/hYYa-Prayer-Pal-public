import { describe, expect, it } from 'vitest';
import { applyRegionalPrayerTimeExceptions } from '@/lib/prayerTimeExceptions';
import { toWesternDigits } from '@/lib/toWesternDigits';

function buildTimes(base: Date) {
  return {
    fajr: new Date(base.getTime() - 6 * 60 * 60 * 1000),
    sunrise: new Date(base.getTime() - 5 * 60 * 60 * 1000),
    dhuhr: new Date(base.getTime() - 1 * 60 * 60 * 1000),
    asr: new Date(base.getTime() + 2 * 60 * 60 * 1000),
    maghrib: new Date(base.getTime() + 5 * 60 * 60 * 1000),
    isha: new Date(base.getTime() + 6.5 * 60 * 60 * 1000),
  };
}

function getHijriMonthNumber(date: Date): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const monthPart = formatter.formatToParts(date).find((part) => part.type === 'month')?.value;
    if (!monthPart) return null;
    const month = Number.parseInt(toWesternDigits(monthPart), 10);
    return Number.isFinite(month) ? month : null;
  } catch {
    return null;
  }
}

function findDateForHijriMonth(targetMonth: number): Date {
  const start = new Date('2025-01-01T00:00:00Z');
  for (let i = 0; i < 800; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    if (getHijriMonthNumber(date) === targetMonth) return date;
  }
  throw new Error(`Could not find Hijri month ${targetMonth} in search window`);
}

function findRamadanToShawwalTransition(): { ramadanDate: Date; shawwalDate: Date } {
  const start = new Date('2025-01-01T00:00:00Z');
  for (let i = 0; i < 800; i++) {
    const ramadanDate = new Date(start);
    ramadanDate.setUTCDate(start.getUTCDate() + i);
    const shawwalDate = new Date(ramadanDate);
    shawwalDate.setUTCDate(ramadanDate.getUTCDate() + 1);

    if (getHijriMonthNumber(ramadanDate) === 9 && getHijriMonthNumber(shawwalDate) === 10) {
      return { ramadanDate, shawwalDate };
    }
  }
  throw new Error('Could not find Ramadan → Shawwal transition in search window');
}

describe('prayerTimeExceptions', () => {
  it('sets Saudi Ramadan isha to exactly +2 hours from maghrib', () => {
    const dateInRamadan = new Date('2026-02-20T12:00:00Z');
    const baseTimes = buildTimes(dateInRamadan);

    const adjusted = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: dateInRamadan,
      location: {
        latitude: 24.7136,
        longitude: 46.6753,
        city: 'Riyadh',
        country: 'Saudi Arabia',
      },
    });

    expect(adjusted.isha.getTime() - adjusted.maghrib.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('does not alter non-Saudi locations', () => {
    const dateInRamadan = new Date('2026-02-20T12:00:00Z');
    const baseTimes = buildTimes(dateInRamadan);

    const adjusted = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: dateInRamadan,
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        city: 'New York',
        country: 'United States',
      },
    });

    expect(adjusted.isha.getTime()).toBe(baseTimes.isha.getTime());
  });

  it('applies Saudi Ramadan exception with ISO country code only', () => {
    const dateInRamadan = findDateForHijriMonth(9);
    const baseTimes = buildTimes(dateInRamadan);

    const adjusted = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: dateInRamadan,
      location: {
        latitude: 24.7136,
        longitude: 46.6753,
        countryCode: 'SA',
      },
    });

    expect(adjusted.isha.getTime() - adjusted.maghrib.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('does not alter Saudi location outside Ramadan', () => {
    const dateOutsideRamadan = findDateForHijriMonth(8);
    const baseTimes = buildTimes(dateOutsideRamadan);

    const adjusted = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: dateOutsideRamadan,
      location: {
        latitude: 24.7136,
        longitude: 46.6753,
        city: 'Riyadh',
        country: 'Saudi Arabia',
      },
    });

    expect(adjusted.isha.getTime()).toBe(baseTimes.isha.getTime());
  });

  it('does not alter coordinate-only locations outside Saudi bounds', () => {
    const dateInRamadan = findDateForHijriMonth(9);
    const baseTimes = buildTimes(dateInRamadan);

    const adjusted = applyRegionalPrayerTimeExceptions(baseTimes, {
      date: dateInRamadan,
      location: {
        // New York, USA (outside KSA) — coordinate-only location should not trigger KSA rule.
        latitude: 40.7128,
        longitude: -74.006,
      },
    });

    expect(adjusted.isha.getTime()).toBe(baseTimes.isha.getTime());
  });

  it('applies in Ramadan and stops on first day of Shawwal', () => {
    const { ramadanDate, shawwalDate } = findRamadanToShawwalTransition();
    const ramadanTimes = buildTimes(ramadanDate);
    const shawwalTimes = buildTimes(shawwalDate);

    const location = {
      latitude: 24.7136,
      longitude: 46.6753,
      city: 'Riyadh',
      country: 'Saudi Arabia',
    };

    const adjustedRamadan = applyRegionalPrayerTimeExceptions(ramadanTimes, {
      date: ramadanDate,
      location,
    });
    const adjustedShawwal = applyRegionalPrayerTimeExceptions(shawwalTimes, {
      date: shawwalDate,
      location,
    });

    expect(adjustedRamadan.isha.getTime() - adjustedRamadan.maghrib.getTime()).toBe(2 * 60 * 60 * 1000);
    expect(adjustedShawwal.isha.getTime()).toBe(shawwalTimes.isha.getTime());
  });
});
