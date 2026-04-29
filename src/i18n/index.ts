import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { RTL_LANGUAGES as RTL_LANGS, isRtlLanguage } from '@/lib/rtlLanguages';

// ── All 60 locale bundles ──────────────────────────────────────────────────────
import am from './locales/am.json';
import ar from './locales/ar.json';
import as_ from './locales/as.json';
import az from './locales/az.json';
import ber from './locales/ber.json';
import bg from './locales/bg.json';
import bm from './locales/bm.json';
import bn from './locales/bn.json';
import bs from './locales/bs.json';
import de from './locales/de.json';
import dv from './locales/dv.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fa from './locales/fa.json';
import fr from './locales/fr.json';
import gu from './locales/gu.json';
import ha from './locales/ha.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import kk from './locales/kk.json';
import km from './locales/km.json';
import ko from './locales/ko.json';
import ku from './locales/ku.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import mrw from './locales/mrw.json';
import ms from './locales/ms.json';
import ne from './locales/ne.json';
import nl from './locales/nl.json';
import om from './locales/om.json';
import pl from './locales/pl.json';
import prs from './locales/prs.json';
import ps from './locales/ps.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import rw from './locales/rw.json';
import sd from './locales/sd.json';
import si from './locales/si.json';
import so from './locales/so.json';
import sq from './locales/sq.json';
import sv from './locales/sv.json';
import sw from './locales/sw.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import tg from './locales/tg.json';
import th from './locales/th.json';
import tl from './locales/tl.json';
import tr from './locales/tr.json';
import ug from './locales/ug.json';
import uk from './locales/uk.json';
import ur from './locales/ur.json';
import uz from './locales/uz.json';
import vi from './locales/vi.json';
import yau from './locales/yau.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import { StorageService } from "@/services/StorageService";


// All 60 supported UI languages (matches ALL_QURAN_LANGUAGES codes).
// Ordered by popularity/use (Arabic, English, then most common languages).
// Every language has a bundled locale file — falls back to English/Arabic for missing keys via i18next.
const SUPPORTED_LANGUAGES = [
  'ar','en','ur','tr','id','bn','fa','fr','ha','sw','ru','ms','so','de','es',
  'pt','hi','zh','te','ta','gu','mr','ml','ne','si','th','vi','ja','ko',
  'nl','it','pl','ro','bg','uk','sq','bs','ku','ps','prs','uz','kk','tg','ug',
  'az','am','om','rw','yo','bm','ber','dv','tl','mrw','sd','he','sv',
  'km','as','yau',
] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

// RTL script languages (re-exported from shared utility)
const RTL_LANGUAGES = RTL_LANGS;

/**
 * Update document language attribute and direction
 * Setting dir="rtl" on document enables native flexbox reversing for RTL UI languages.
 */
function updateDocumentDirection(language: string) {
  if (typeof document === 'undefined') return;
  
  document.documentElement.lang = language;
  document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
}

const resources: Record<string, { translation: Record<string, unknown> }> = {
  am: { translation: am },
  ar: { translation: ar },
  as: { translation: as_ },
  az: { translation: az },
  ber: { translation: ber },
  bg: { translation: bg },
  bm: { translation: bm },
  bn: { translation: bn },
  bs: { translation: bs },
  de: { translation: de },
  dv: { translation: dv },
  en: { translation: en },
  es: { translation: es },
  fa: { translation: fa },
  fr: { translation: fr },
  gu: { translation: gu },
  ha: { translation: ha },
  he: { translation: he },
  hi: { translation: hi },
  id: { translation: id },
  it: { translation: it },
  ja: { translation: ja },
  kk: { translation: kk },
  km: { translation: km },
  ko: { translation: ko },
  ku: { translation: ku },
  ml: { translation: ml },
  mr: { translation: mr },
  mrw: { translation: mrw },
  ms: { translation: ms },
  ne: { translation: ne },
  nl: { translation: nl },
  om: { translation: om },
  pl: { translation: pl },
  prs: { translation: prs },
  ps: { translation: ps },
  pt: { translation: pt },
  ro: { translation: ro },
  ru: { translation: ru },
  rw: { translation: rw },
  sd: { translation: sd },
  si: { translation: si },
  so: { translation: so },
  sq: { translation: sq },
  sv: { translation: sv },
  sw: { translation: sw },
  ta: { translation: ta },
  te: { translation: te },
  tg: { translation: tg },
  th: { translation: th },
  tl: { translation: tl },
  tr: { translation: tr },
  ug: { translation: ug },
  uk: { translation: uk },
  ur: { translation: ur },
  uz: { translation: uz },
  vi: { translation: vi },
  yau: { translation: yau },
  yo: { translation: yo },
  zh: { translation: zh },
};

// Get device language and match to supported languages
// IMPORTANT: Falls back to Arabic if device language is not in the supported list
// PERFORMANCE FIX: Removed verbose logging during startup
function getDeviceLanguage(): string {
  try {
    // Get browser/device language (e.g., "en-US", "ar-SA", "fr")
    const deviceLang = navigator.language || navigator.userLanguage || 'ar';
    
    // Extract just the language code (first 2 characters)
    const langCode = deviceLang.split('-')[0].toLowerCase();
    
    // Check if this language is supported
    if (isSupportedLanguage(langCode)) {
      return langCode;
    }
    
    // Special handling for language variants
    // e.g., "id-ID" → "id", "ms-MY" → "ms"
    const fullLang = deviceLang.toLowerCase();
    for (const supported of SUPPORTED_LANGUAGES) {
      if (fullLang.startsWith(supported)) {
        return supported;
      }
    }
    
    // Fall back to Arabic if language not supported
    return 'ar';
  } catch (e) {
    return 'ar';
  }
}

// Determine initial language BEFORE i18next init:
// Priority: appSettings.language (user's explicit choice) > i18nextLng > device language
// This prevents the flash caused by i18next detecting one language, then useEffect switching to another
function getInitialLanguage(): string {
  try {
    const savedSettings = StorageService.getItem('appSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.language && isSupportedLanguage(parsed.language)) {
        return parsed.language;
      }
    }
  } catch { /* ignore parse errors */ }

  // Fall back to i18next's localStorage key
  const i18nextLng = StorageService.getItem('i18nextLng');
  if (i18nextLng) {
    const langCode = i18nextLng.split('-')[0].toLowerCase();
    if (isSupportedLanguage(langCode)) return langCode;
  }

  // Fall back to device language
  return getDeviceLanguage();
}

const initialLanguage = getInitialLanguage();

function removeDefaultValueOptions(options: unknown): unknown {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return options;
  }

  const next = { ...(options as Record<string, unknown>) };
  for (const key of Object.keys(next)) {
    if (key === 'defaultValue' || key.startsWith('defaultValue_')) {
      delete next[key];
    }
  }
  return next;
}

function enforceNoTextFallbackGuard() {
  const translator = i18n.services?.translator as
    | { translate?: (...args: unknown[]) => unknown }
    | undefined;

  if (!translator || typeof translator.translate !== 'function') {
    return;
  }

  const currentTranslate = translator.translate as (...args: unknown[]) => unknown;
  const wrapped = currentTranslate as ((...args: unknown[]) => unknown) & { __noFallbackWrapped?: boolean };
  if (wrapped.__noFallbackWrapped) {
    return;
  }

  const noFallbackTranslate = ((...args: unknown[]) => {
    const [keys, options, ...rest] = args;
    return currentTranslate(keys, removeDefaultValueOptions(options), ...rest);
  }) as ((...args: unknown[]) => unknown) & { __noFallbackWrapped?: boolean };

  noFallbackTranslate.__noFallbackWrapped = true;
  translator.translate = noFallbackTranslate;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Strict mode: no localization fallback language chain.
    fallbackLng: false,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // Strip region from language code (e.g., "en-US" → "en")
    load: 'languageOnly',
    // Use the pre-resolved language to avoid detection/flash race
    lng: initialLanguage,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Priority: localStorage (user's saved preference) > custom device detection > navigator
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Convert full locales to language codes
      // PERFORMANCE FIX: Removed logging during language detection
      convertDetectedLanguage: (lng: string) => {
        const langCode = lng.split('-')[0].toLowerCase();
        // Check if converted language is supported, otherwise use Arabic as startup language.
        if (!isSupportedLanguage(langCode)) {
          return 'ar';
        }
        return langCode;
      },
    },
  });

enforceNoTextFallbackGuard();
i18n.on('initialized', enforceNoTextFallbackGuard);

// Ensure i18nextLng stays in sync with the resolved language
if (StorageService.getItem('i18nextLng') !== initialLanguage) {
  StorageService.setItem('i18nextLng', initialLanguage);
}

// Set initial document direction based on current language
updateDocumentDirection(i18n.language);

// Listen for language changes and update document direction
// Critical for Android WebView RTL support
i18n.on('languageChanged', (lng: string) => {
  updateDocumentDirection(lng);
});

export default i18n;
