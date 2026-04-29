import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ExternalLink } from "lucide-react";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import {
  QURAN_ARABIC_TEXT,
  QURAN_FOUNDATION,
  QURAN_TRANSLATIONS,
  ISLAMHOUSE,
} from "@/lib/quranAttribution";
import { Language, QuranLanguageCode } from "@/hooks/useAppSettings";
import { ALL_QURAN_LANGUAGES } from "@/lib/quranLanguages";
import { QURAN_TRANSLATION_ID_BY_LANGUAGE } from "@/lib/quranTranslationIdMap";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

// Define a type for the translation attributions if not exposed
export interface TranslationAttributionRecord {
  language: string;
  translation_name?: string;
  author?: string;
  source?: string;
  link?: string;
}

interface QuranSourcesPanelProps {
  onBack: () => void;
}

const openExternal = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank");
  }
};

export function QuranSourcesPanel({ onBack }: Readonly<QuranSourcesPanelProps>) {
  const { t } = useTranslation();
  const [translationAttributions, setTranslationAttributions] = useState<
    TranslationAttributionRecord[]
  >([]);
  const [translationsLoaded, setTranslationsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/translation-verification-machine-readable/translations.json")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setTranslationAttributions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setTranslationAttributions([]);
      })
      .finally(() => {
        if (!active) return;
        setTranslationsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizeKey = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    
  const attributionMap = new Map(
    translationAttributions.map((entry) => [
      normalizeKey(entry.language),
      entry,
    ]),
  );
  
  const getLangLabel = (code: string) => {
    const entry = ALL_QURAN_LANGUAGES.find((l) => l.code === code);
    if (!entry) return code;
    return entry.nativeName && entry.nativeName !== entry.name
      ? `${entry.nativeName} (${entry.name})`
      : entry.name;
  };
  
  const translationItems = ALL_QURAN_LANGUAGES.filter(
    (lang) => lang.code !== "ar",
  ).map((lang) => {
    const normalized = normalizeKey(lang.name);
    const attr = attributionMap.get(normalized);
    const legacy = QURAN_TRANSLATIONS.find(
      (t) => t.language === (lang.code as Language),
    );

    return {
      code: lang.code,
      label: getLangLabel(lang.code),
      translator: attr?.author || legacy?.translator || "",
      translationName:
        attr?.translation_name || legacy?.translationName || "",
      quranComId:
        QURAN_TRANSLATION_ID_BY_LANGUAGE[lang.code as QuranLanguageCode],
    };
  });

  return (
    <SettingsSubScreen
      title={t("settings.quran.sourcesShortTitle")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-white/70" />
          <h2 className="text-xl font-bold" style={{ color: "var(--pp-header-title-color)" }}>
            {t("nav.quran")}
          </h2>
          <div className="mt-2 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
            <p className="text-sm text-white font-medium">
              {t(
                "settings.quran.sourcesSubtitle",
              )}
            </p>
          </div>
        </div>

        {/* References summary */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.referencesTitle")}
          </h3>
          <div className="space-y-2 text-sm text-white/70">
            <p>
              {t("settings.quran.referenceQuranFoundation", {
                provider: QURAN_FOUNDATION.providerName,
              })}
            </p>
            <p>
              {t("settings.quran.referenceArabicText", {
                script: QURAN_ARABIC_TEXT.script,
              })}
            </p>
            <p>
              {t("settings.quran.referenceHisn", {
                source: "sunnah.com/hisn",
              })}
            </p>
            <p>
              {t("settings.quran.referenceIslamHouse")}
            </p>
            <p>
              {t("settings.quran.referenceKingFahad")}
            </p>
            <p>
              {t(
                "settings.quran.referenceTafsir",
                "Tafsir content and metadata are sourced from Quran Foundation (Quran.com) tafsir resources.",
              )}
            </p>
            <p>
              {t("settings.quran.referenceAudio")}
            </p>
            <p>
              {t("settings.quran.referenceManasik")}
            </p>
            <p>
              {t("settings.quran.referenceUiTranslation")}
            </p>
          </div>
        </div>

        {/* Curated translation */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.curatedTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.quran.curatedDesc",
            )}
          </p>
        </div>

        {/* Arabic text */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.arabicTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-white/90 font-medium">
              {QURAN_ARABIC_TEXT.script}
            </span>
            <span className="text-white/60">
              {" "}
              —{" "}
              {t("settings.quran.arabicScriptNote")}
            </span>
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-white/55 leading-relaxed">
              {t("settings.quran.arabicTextNote1")}
            </p>
            <p className="text-xs text-white/55 leading-relaxed">
              {t("settings.quran.arabicTextNote2", {
                provider: QURAN_FOUNDATION.providerName,
              })}
            </p>
            <p className="text-xs text-white/55 leading-relaxed">
              <span className="text-white/70">
                {t("settings.quran.sourceLabel")}:
              </span>{" "}
              {QURAN_FOUNDATION.providerName}
            </p>
          </div>
        </div>

        {/* Translations list */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-3">
            {t("settings.quran.translationsTitle")}
          </h3>

          {!translationsLoaded && (
            <div className="text-center text-white/60 text-sm">
              {t("quran.loading")}
            </div>
          )}

          {translationsLoaded && (
            <div className="space-y-3">
              {translationItems.map((tr) => (
                <div
                  key={tr.code}
                  className="rounded-lg bg-black/30 border border-white/15 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        {tr.label}
                      </div>
                      {tr.translationName && (
                        <div className="text-xs text-white/70 mt-0.5">
                          {tr.translationName}
                        </div>
                      )}
                      {tr.translator && (
                        <div className="text-xs text-white/60 mt-1">
                          {t("settings.quran.translatorLabel")}:{" "}
                          {tr.translator}
                        </div>
                      )}
                      {typeof tr.quranComId === "number" &&
                        tr.quranComId > 0 && (
                          <div className="text-xs text-white/50 mt-1">
                            {t(
                              "settings.quran.translationIdLabel",
                            )}
                            : {tr.quranComId}
                          </div>
                        )}
                    </div>
                    <div className="text-xs text-white/60 text-end">
                      {tr.code}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provider / Terms */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.providerTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {QURAN_FOUNDATION.providerName}
          </p>
          <p className="text-xs text-white/55 mt-2">
            <span className="text-white/70">
              {t("settings.quran.apiBaseUrlLabel")}:
            </span>{" "}
            {QURAN_FOUNDATION.apiBaseUrl}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() =>
                openExternal(QURAN_FOUNDATION.developerPortalUrl)
              }
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">
                {t("settings.quran.developerPortal")}
              </span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={() => openExternal(QURAN_FOUNDATION.developerTermsUrl)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">
                {t("settings.quran.terms")}
              </span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-white/45 leading-relaxed">
          {t(
            "settings.quran.disclaimer",
          )}
        </p>

        {/* Hisn Muslim attribution */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.hisn.attributionTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {t(
              "settings.hisn.attributionDesc",
            )}
          </p>
          <div className="mt-3">
            <button
              onClick={() => openExternal("https://sunnah.com/hisn")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">sunnah.com/hisn</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Manasik attribution */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.manasikAttributionTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {t("settings.quran.manasikAttributionDesc")}
          </p>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => openExternal("https://haj.gov.sa/en")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">haj.gov.sa</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={() => openExternal("https://www.nusuk.sa/")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">nusuk.sa</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={() => openExternal(ISLAMHOUSE.url)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">islamhouse.com</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Quran audio attribution */}
        <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/15">
          <h3 className="font-semibold text-white mb-2">
            {t("settings.quran.audioAttributionTitle")}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {t("settings.quran.audioAttributionDesc")}
          </p>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => openExternal("https://quran.com/")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">quran.com</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={() => openExternal("https://quranicaudio.com/")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border border-white/15 active:bg-black/35"
            >
              <span className="text-sm text-white/70">quranicaudio.com</span>
              <ExternalLink className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </div>
    </SettingsSubScreen>
  );
}
