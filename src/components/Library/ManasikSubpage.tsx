import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LibrarySubpageShell } from "@/components/Library/LibrarySubpageShell";
import type { QuranLanguageCode } from "@/types/quran";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { StorageService } from "@/services/StorageService";
import { sanitizeManasikHtml } from "@/lib/manasikHtmlUtils";


type ManasikType = "umrah" | "hajj";
type ManasikSourceType = "ministry" | "islamhouse";

type ManasikStepData = {
  title: string;
  details: string;
  evidence: string;
  referenceLabel: string;
};

type ManasikFileData = {
  source: ManasikSourceType;
  umrah: { steps: ManasikStepData[] };
  hajj: { steps: ManasikStepData[] };
};

async function loadManasikData(language: QuranLanguageCode): Promise<ManasikFileData | null> {
  try {
    const res = await fetch(`/data/manasik/${language}.json`);
    if (!res.ok) throw new Error('not found');
    return await res.json() as ManasikFileData;
  } catch (error) {
    console.error(`[ManasikSubpage] Missing manasik bundle for language ${language}. No fallback is permitted.`, error);
    return null;
  }
}

type StepCard = {
  id: string;
  title: string;
  details: string;
  evidence: string;
  referenceLabel: string;
  hasTawafCounter?: boolean;
  hasSaieCounter?: boolean;
};

type StepMeta = {
  id: string;
  hasTawafCounter?: boolean;
  hasSaieCounter?: boolean;
};

type ManasikSubpageProps = {
  type: ManasikType;
  language: QuranLanguageCode;
  onBackToLibraryHome: () => void;
  uiLanguage: string;
  uiIsRtl: boolean;
  sessionKey?: number;
};

const UMRAH_STEP_META: Record<ManasikSourceType, StepMeta[]> = {
  ministry: [
    {
      id: "umrah-1",
    },
    {
      id: "umrah-2",
    },
    {
      id: "umrah-3",
      hasTawafCounter: true,
    },
    {
      id: "umrah-4",
    },
    {
      id: "umrah-5",
      hasSaieCounter: true,
    },
    {
      id: "umrah-6",
    },
  ],
  islamhouse: [
    {
      id: "umrah-1",
    },
    {
      id: "umrah-2",
    },
    {
      id: "umrah-3",
      hasTawafCounter: true,
    },
    {
      id: "umrah-4",
    },
    {
      id: "umrah-5",
      hasSaieCounter: true,
    },
    {
      id: "umrah-6",
    },
  ],
};

const HAJJ_STEP_META: Record<ManasikSourceType, StepMeta[]> = {
  ministry: [
    {
      id: "hajj-1",
    },
    {
      id: "hajj-2",
    },
    {
      id: "hajj-3",
    },
    {
      id: "hajj-4",
    },
    {
      id: "hajj-5",
    },
    {
      id: "hajj-6",
      hasTawafCounter: true,
    },
    {
      id: "hajj-7",
      hasSaieCounter: true,
    },
    {
      id: "hajj-8",
    },
  ],
  islamhouse: [
    {
      id: "hajj-1",
    },
    {
      id: "hajj-2",
    },
    {
      id: "hajj-3",
    },
    {
      id: "hajj-4",
    },
    {
      id: "hajj-5",
    },
    {
      id: "hajj-6",
      hasTawafCounter: true,
    },
    {
      id: "hajj-7",
      hasSaieCounter: true,
    },
    {
      id: "hajj-8",
    },
  ],
};

function clampCounter(value: number): number {
  return Math.min(7, Math.max(0, value));
}

function readScopedCounter(key: string): number {
  if (globalThis.window === undefined) return 0;
  try {
    const raw = StorageService.getItem(key);
    const parsed = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(parsed) ? clampCounter(parsed) : 0;
  } catch {
    return 0;
  }
}

function writeScopedCounter(key: string, value: number) {
  if (globalThis.window === undefined) return;
  try {
    StorageService.setItem(key, String(value));
  } catch {
    // Ignore storage failures in restricted/private contexts.
  }
}

function readStepCheckedState(type: ManasikType, stepId: string): boolean {
  if (globalThis.window === undefined) return false;
  try {
    const raw = StorageService.getItem(`manasik:${type}:checked:${stepId}`);
    return raw === "true";
  } catch {
    return false;
  }
}

function writeStepCheckedState(type: ManasikType, stepId: string, checked: boolean) {
  if (globalThis.window === undefined) return;
  try {
    StorageService.setItem(`manasik:${type}:checked:${stepId}`, String(checked));
  } catch {
    // Ignore storage failures in restricted/private contexts.
  }
}

const MANASIK_TEXT_STEPS = [
  "text-xs leading-6 sm:text-sm sm:leading-7",
  "text-sm leading-7 sm:text-base sm:leading-8",
  "text-base leading-8 sm:text-lg sm:leading-9",
] as const;

export function ManasikSubpage({
  type,
  language,
  onBackToLibraryHome,
  uiLanguage,
  uiIsRtl,
  sessionKey,
}: Readonly<ManasikSubpageProps>) {
  const { t } = useTranslation();
  const platformForManasik = useMemo(
    () => (globalThis.document?.documentElement?.classList?.contains("is-android") ? "android" : "other") as const,
    [],
  );

  const prevSessionKey = useRef(sessionKey);
  useEffect(() => {
    if (sessionKey === undefined || sessionKey === prevSessionKey.current) return;
    prevSessionKey.current = sessionKey;
    onBackToLibraryHome();
  }, [sessionKey, onBackToLibraryHome]);

  const contentLanguage = language;
  const isContentRTL = isRtlLanguage(contentLanguage);

  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(() => new Set());
  const [manasikData, setManasikData] = useState<ManasikFileData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [textStep, setTextStep] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDataLoading(true);
    loadManasikData(contentLanguage).then((data) => {
      setManasikData(data);
      setDataLoading(false);
    });
  }, [contentLanguage]);

  const steps = useMemo<StepCard[]>(() => {
    if (!manasikData) return [];
    const source = manasikData.source;
    const meta = type === "umrah" ? UMRAH_STEP_META[source] : HAJJ_STEP_META[source];
    const dataSteps = type === "umrah" ? manasikData.umrah.steps : manasikData.hajj.steps;
    if (import.meta.env.DEV && dataSteps.length !== meta.length) {
      console.error("[ManasikSubpage] Step metadata length mismatch", {
        source,
        type,
        dataStepsLength: dataSteps.length,
        metaLength: meta.length,
      });
    }
    return dataSteps
      .filter((s) => s.title.trim().length > 0)
      .map((s, i) => ({
        id: meta[i]?.id ?? `${type}-${i + 1}`,
        title: s.title,
        details: s.details,
        evidence: s.evidence,
        referenceLabel: s.referenceLabel,
        hasTawafCounter: meta[i]?.hasTawafCounter,
        hasSaieCounter: meta[i]?.hasSaieCounter,
      }));
  }, [manasikData, type]);

  // Load checked state from localStorage on mount
  useEffect(() => {
    const loaded = new Set<string>();
    for (const step of steps) {
      if (readStepCheckedState(type, step.id)) {
        loaded.add(step.id);
      }
    }
    setCheckedSteps(loaded);
  }, [type, steps]);

  const title = type === "umrah"
    ? t("library.manasikUmrahTitle", { lng: language })
    : t("library.manasikHajjTitle", { lng: language });

  const handleToggleStep = (stepId: string) => {
    const newChecked = new Set(checkedSteps);
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isNowChecked = !newChecked.has(stepId);

    if (type === "umrah" && isNowChecked && stepIndex !== -1) {
      for (let i = 0; i <= stepIndex; i++) {
        const idToProp = steps[i].id;
        newChecked.add(idToProp);
        writeStepCheckedState(type, idToProp, true);
      }
    } else if (isNowChecked) {
      newChecked.add(stepId);
      writeStepCheckedState(type, stepId, true);
    } else {
      newChecked.delete(stepId);
      writeStepCheckedState(type, stepId, false);
    }
    setCheckedSteps(newChecked);
  };

  const handleUncheckAll = () => {
    setCheckedSteps(new Set());
    for (const step of steps) {
      writeStepCheckedState(type, step.id, false);
    }
  };

  const detailsClass =
    MANASIK_TEXT_STEPS[Math.min(textStep, MANASIK_TEXT_STEPS.length - 1)];

  return (
    <LibrarySubpageShell
      title={title}
      uiLanguage={uiLanguage}
      uiIsRtl={uiIsRtl}
      contentLanguage={contentLanguage}
      contentIsRtl={isContentRTL}
      contentClassName="pb-32 space-y-3"
      contentRef={contentRef}
      controlsRow={
        // UX Logic: Controls placement follows Curated Translations direction (contentLanguage).
        <div className={`flex flex-1 ${isContentRTL ? "justify-end" : "justify-start"}`}>
          <div className="flex items-center gap-2">
            {isContentRTL ? (
              <>
                <button
                  type="button"
                  onClick={() => setTextStep((s) => (s + 1 >= MANASIK_TEXT_STEPS.length ? 0 : s + 1))}
                  className="flex shrink-0 items-center justify-center rounded-lg border px-2 py-2 pp-glass-surface-button"
                  style={{ borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}
                  aria-label={t("quran.textSize", { lng: language })}
                >
                  <div className={["flex items-end justify-center gap-0.5 px-0.5", "flex-row-reverse"].join(" ")}>
                    <span className="text-xs font-bold leading-none mb-0.5">T</span>
                    <span className="text-lg font-bold leading-none">T</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleUncheckAll}
                  className="px-3 py-2 rounded-lg border text-sm font-semibold"
                  style={{ background: "var(--pp-button-bg)", borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}
                  aria-label={t("library.manasik.uncheckAll", { lng: language })}
                >
                  {t("library.manasik.uncheckAll", { lng: language })}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleUncheckAll}
                  className="px-3 py-2 rounded-lg border text-sm font-semibold"
                  style={{ background: "var(--pp-button-bg)", borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}
                  aria-label={t("library.manasik.uncheckAll", { lng: language })}
                >
                  {t("library.manasik.uncheckAll", { lng: language })}
                </button>
                <button
                  type="button"
                  onClick={() => setTextStep((s) => (s + 1 >= MANASIK_TEXT_STEPS.length ? 0 : s + 1))}
                  className="flex shrink-0 items-center justify-center rounded-lg border px-2 py-2 pp-glass-surface-button"
                  style={{ borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}
                  aria-label={t("quran.textSize", { lng: language })}
                >
                  <div className={["flex items-end justify-center gap-0.5 px-0.5", "flex-row"].join(" ")}>
                    <span className="text-xs font-bold leading-none mb-0.5">T</span>
                    <span className="text-lg font-bold leading-none">T</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="w-full md:max-w-2xl md:mx-auto">
        {dataLoading && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--pp-card-bg)', borderColor: 'var(--pp-border-soft)' }}>
            <p className="text-sm pp-text-primary">{t("library.loading", { lng: language })}</p>
          </div>
        )}
        {!dataLoading && steps.length === 0 && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--pp-card-bg)', borderColor: 'var(--pp-border-soft)' }}>
            <p className="text-sm pp-text-primary">{t("library.noContent", { lng: language })}</p>
          </div>
        )}

        {!dataLoading && steps.length > 0 ? (
          <div className="pp-view-enter space-y-3">
            {steps.map((step) => (
              <article
                key={step.id}
                lang={contentLanguage}
                /*
                 * UX Logic Layer 2 Exception — Content direction override.
                 * Manasik step content direction follows the CONTENT language (isContentRTL),
                 * not the UI language. Arabic content is always RTL regardless of UI language.
                 * Documented exception per UX_LOGIC.md Layer 2 (line 33).
                 */
                dir={isContentRTL ? "rtl" : "ltr"}
                className={`rounded-xl border p-4 transition-all overflow-hidden relative ${checkedSteps.has(step.id) ? "opacity-70" : ""}`}
                style={{ 
                  background: 'var(--pp-button-bg)', 
                  borderColor: 'var(--pp-border-soft)', 
                  color: 'var(--pp-text-primary)' 
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none rounded-xl" />
                <div className="relative z-10 flex items-start gap-4 mb-3">
                  <input
                    type="checkbox"
                    checked={checkedSteps.has(step.id)}
                    onChange={() => handleToggleStep(step.id)}
                    className="mt-1 w-5 h-5 rounded cursor-pointer accent-white/50"
                    aria-label={`${t("library.manasik.markAsComplete", { lng: language })}: ${step.title}`}
                  />
                  <div className="flex-1">
                    <h3 className="text-base font-bold mb-2 pp-text-primary">{step.title}</h3>
                    <div
                      className={`${detailsClass} mb-3 pp-text-primary text-justify [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-0 [&_ul]:space-y-1 [&_li]:marker:text-current`}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sanitizeManasikHtml(step.details, platformForManasik)) }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </LibrarySubpageShell>
  );
}
