/**
 * Format a Date as a localized time string, respecting device's 24-hour preference.
 * Extracted from usePrayerTimes.ts for reuse.
 *
 * Includes post-processing to replace English "AM"/"PM" with locale-specific
 * markers when the platform's Intl implementation doesn't localize them.
 */
import i18n from '@/i18n';
import { AMPM_LOCALE_MAP } from '@/lib/ampmLocaleMap';
import { StorageService } from "@/services/StorageService";


function resolveUiLocale(languageCode: string | undefined): string {
  const code = (languageCode || 'en').toLowerCase();

  switch (code) {
    case 'zh':
      return 'zh-CN';
    case 'prs':
      return 'fa-AF';
    case 'tl':
      return 'fil';
    default:
      return code;
  }
}

/**
 * If the platform returned English "AM"/"PM" for a non-English locale,
 * replace it with the locale's own day-period marker from our CLDR map.
 */
function localizeAmPm(formatted: string, langCode: string): string {
  const entry = AMPM_LOCALE_MAP[langCode];
  if (!entry) return formatted;

  // Only replace if the output contains a literal English "AM" or "PM".
  // Some platforms output lowercase "am"/"pm" — handle both cases.
  if (/\bAM\b/i.test(formatted)) {
    return formatted.replace(/\bAM\b/i, entry.am);
  }
  if (/\bPM\b/i.test(formatted)) {
    return formatted.replace(/\bPM\b/i, entry.pm);
  }
  return formatted;
}

export function formatTime(date: Date, timeZone?: string | null): string {
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase();

  // Respect device's 24-hour time preference.
  // On Android WebView, Intl hour12 can remain stale after system setting changes,
  // so prefer the native-refreshed cache written by Index.tsx.
  let uses24Hour: boolean;
  const cachedClockFormat = typeof window !== 'undefined'
    ? StorageService.getItem('prayerpal-clock-format')
    : null;

  if (cachedClockFormat === '24' || cachedClockFormat === '12') {
    uses24Hour = cachedClockFormat === '24';
  } else {
    const resolved = Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    const hour12 = resolved.hour12 ?? false;
    uses24Hour = !hour12;
  }

  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !uses24Hour, // Use device preference
  };

  // FIX A (v3.1.3): When a remote IANA timezone is provided (e.g., user manually
  // selected a city in a different timezone), use Intl.DateTimeFormat to format
  // the time in that timezone. This is the adhan-recommended approach:
  // "format the times for the correct timezone" — never shift the Date object.
  if (timeZone) {
    options.timeZone = timeZone;
  }

  const locale = resolveUiLocale(i18n.resolvedLanguage || i18n.language);
  let result = date.toLocaleTimeString(locale, options);

  // Post-process: replace English AM/PM with locale-specific markers when
  // the platform's ICU didn't localize them (common on mobile WebViews).
  if (!uses24Hour && currentLanguage !== 'en') {
    result = localizeAmPm(result, currentLanguage);
  }

  return result;
}
