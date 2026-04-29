import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Play, Loader2, Share2 } from "lucide-react";
import type { VerseAudioScope } from "@/hooks/quran/useQuranAudio";
import type { QuranAudioReciter } from "@/services/quranAudioService";
import type { TafsirSource } from "@/hooks/quran/useQuranTafsir";
import { getTafsirDisplayName, tafsirCatalogLanguageToHtmlLang } from "@/lib/tafsirCatalog";
import { isRtlLanguage } from "@/lib/rtlLanguages";

export type VerseActionModalProps = Readonly<{
  selectedVerseAction: {
    surahNumber: number;
    verseNumber: number;
    verseText: string;
  } | null;
  onClose: () => void;
  handleToggleSelectedVerseBookmark: () => void;
  selectedVerseIsBookmarked: boolean;
  audioReciters: QuranAudioReciter[];
  selectedAudioReciterId: number | null;
  setSelectedAudioReciterId: (id: number | null) => void;
  selectedAudioReciter: QuranAudioReciter | null;
  showReciterMenu: boolean;
  setShowReciterMenu: React.Dispatch<React.SetStateAction<boolean>>;
  audioScope: VerseAudioScope;
  setAudioScope: (scope: VerseAudioScope) => void;
  handlePlaySelectedVerseAudio: (scope?: VerseAudioScope) => Promise<void>;
  audioLoading: boolean;
  audioStatusMessage: string;
  audioError: string | null;
  audioUiPrompt: "go_online" | "go_library" | null;
  clearAudioUiPrompt: () => void;
  onOpenQuranAudio?: () => void;
  networkOnline: boolean;
  uiLanguage: string;
  selectedTafsirSource: TafsirSource | null;
  tafsirLoading: boolean;
  tafsirError: string | null;
  tafsirPreview: string;
  handleShareSelectedTafsir: () => Promise<void>;
  contentLanguage: string;
}>;

type SelectedVerse = NonNullable<VerseActionModalProps["selectedVerseAction"]>;

type VerseActionModalHeaderProps = Readonly<{
  verse: SelectedVerse;
  onClose: () => void;
  contentLanguage: string;
  uiLanguage: string;
}>;

function VerseActionModalHeader({
  verse,
  onClose,
  contentLanguage,
  uiLanguage,
}: VerseActionModalHeaderProps) {
  const { t } = useTranslation();
  const verseWord = t("quran.verse", { lng: contentLanguage });
  const isContentRtl = isRtlLanguage(contentLanguage);
  return (
    <div className="relative z-10 shrink-0 space-y-2 border-b border-white/10 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-base font-semibold pp-text-primary"
            dir={isContentRtl ? "rtl" : "ltr"}
            lang={contentLanguage}
          >
            {verseWord} {verse.verseNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 shrink-0 rounded-full border flex items-center justify-center hover:scale-110 active:scale-95 transition-all pp-glass-surface-button"
          aria-label={t("quran.close", { lng: uiLanguage })}
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

type VerseActionModalPromptsProps = Readonly<{
  audioUiPrompt: "go_online" | "go_library" | null;
  clearAudioUiPrompt: () => void;
  onOpenQuranAudio?: () => void;
  uiLanguage: string;
}>;

function VerseActionModalPrompts({
  audioUiPrompt,
  clearAudioUiPrompt,
  onOpenQuranAudio,
  uiLanguage,
}: VerseActionModalPromptsProps) {
  const { t } = useTranslation();
  if (audioUiPrompt === "go_online") {
    return (
      <div lang={uiLanguage} className="rounded-xl border px-2.5 py-2 space-y-1.5 pp-quran-bookmark-row">
        <p className="text-xs font-semibold pp-text-primary sm:text-sm">
          {t("quran.audioNeedWifiTitle", { lng: uiLanguage })}
        </p>
        <p className="text-xs pp-text-secondary">{t("quran.audioNeedWifiBody", { lng: uiLanguage })}</p>
        <button
          type="button"
          onClick={clearAudioUiPrompt}
          className="rounded-lg border px-3 py-2 text-xs font-semibold pp-glass-surface-button"
        >
          {t("quran.dismiss", { lng: uiLanguage })}
        </button>
      </div>
    );
  }
  if (audioUiPrompt === "go_library") {
    return (
      <div lang={uiLanguage} className="rounded-xl border px-2.5 py-2 space-y-1.5 pp-quran-bookmark-row">
        <p className="text-xs font-semibold pp-text-primary sm:text-sm">
          {t("quran.audioOpenLibraryTitle", { lng: uiLanguage })}
        </p>
        <p className="text-xs pp-text-secondary">{t("quran.audioOpenLibraryBody", { lng: uiLanguage })}</p>
        <div className="flex flex-wrap gap-2">
          {onOpenQuranAudio ? (
            <button
              type="button"
              onClick={onOpenQuranAudio}
              className="rounded-lg border px-3 py-2 text-xs font-semibold pp-glass-surface-button"
            >
              {t("quran.openQuranAudio", { lng: uiLanguage })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearAudioUiPrompt}
            className="rounded-lg border px-3 py-2 text-xs font-semibold pp-glass-surface-button"
          >
            {t("quran.dismiss", { lng: uiLanguage })}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

type VerseActionModalAudioPanelProps = Readonly<{
  audioReciters: VerseActionModalProps["audioReciters"];
  selectedAudioReciter: VerseActionModalProps["selectedAudioReciter"];
  showReciterMenu: boolean;
  setShowReciterMenu: VerseActionModalProps["setShowReciterMenu"];
  setSelectedAudioReciterId: VerseActionModalProps["setSelectedAudioReciterId"];
  audioScope: VerseActionModalProps["audioScope"];
  setAudioScope: VerseActionModalProps["setAudioScope"];
  handlePlaySelectedVerseAudio: VerseActionModalProps["handlePlaySelectedVerseAudio"];
  audioLoading: boolean;
  audioStatusMessage: string;
  audioError: string | null;
  networkOnline: boolean;
  contentLanguage: string;
  uiLanguage: string;
  onClose: VerseActionModalProps["onClose"];
}>;

type VerseActionModalReciterPickerProps = Readonly<{
  audioReciters: VerseActionModalProps["audioReciters"];
  selectedAudioReciter: VerseActionModalProps["selectedAudioReciter"];
  showReciterMenu: boolean;
  setShowReciterMenu: VerseActionModalProps["setShowReciterMenu"];
  setSelectedAudioReciterId: VerseActionModalProps["setSelectedAudioReciterId"];
  hasOfflineReciters: boolean;
  contentLanguage: string;
}>;

/**
 * Strip trailing English-style variant tags only (e.g. "[Mujawwad]"); keep
 * Arabic tags such as "[مجود]". Mirrors the helper used by the Library Audio
 * page so the same reciter renders the same label in both surfaces.
 */
function stripReciterVariantSuffix(label: string): string {
  return label.replace(/\s*\[[\sA-Za-z0-9.,+\-/'()]+\]\s*$/, "").trim();
}

/** Localizes the reciter's display name using the Curated Translations language. */
function localizeReciterName(
  reciter: { id: number; name: string } | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
  contentLanguage: string,
): string {
  if (!reciter) return "";
  const localized = t(`library.reciters.${reciter.id}`, {
    lng: contentLanguage,
    defaultValue: reciter.name,
  });
  return stripReciterVariantSuffix(typeof localized === "string" ? localized : reciter.name);
}

type ReciterButtonProps = Readonly<{
  selectedAudioReciterName: string;
  onToggle: () => void;
  isOpen: boolean;
  isContentRtl: boolean;
  contentLanguage: string;
}>;

function ReciterButton({ selectedAudioReciterName, onToggle, isOpen, isContentRtl, contentLanguage }: ReciterButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      dir={isContentRtl ? "rtl" : "ltr"}
      className={`flex w-full items-center gap-2 rounded-lg border bg-transparent px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm justify-between ${isContentRtl ? "flex-row-reverse" : "flex-row"}`}
      aria-label={t("quran.reciter", { lng: contentLanguage })}
      aria-expanded={isOpen}
    >
      <span className="truncate" lang={contentLanguage}>{selectedAudioReciterName}</span>
      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

type ReciterMenuProps = Readonly<{
  audioReciters: VerseActionModalProps["audioReciters"];
  onSelect: (id: number) => void;
  contentLanguage: string;
  isContentRtl: boolean;
}>;

function ReciterMenu({ audioReciters, onSelect, contentLanguage, isContentRtl }: ReciterMenuProps) {
  const { t } = useTranslation();
  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-52 overflow-y-auto rounded-lg border bg-black/80 backdrop-blur-sm">
      {audioReciters.map((reciter) => (
        <button
          key={reciter.id}
          type="button"
          onClick={() => onSelect(reciter.id)}
          dir={isContentRtl ? "rtl" : "ltr"}
          lang={contentLanguage}
          className={`w-full px-3 py-2 text-sm hover:bg-white/10 ${isContentRtl ? "text-right" : "text-left"}`}
        >
          {localizeReciterName(reciter, t, contentLanguage)}
        </button>
      ))}
    </div>
  );
}

function VerseActionModalReciterPicker({
  audioReciters,
  selectedAudioReciter,
  showReciterMenu,
  setShowReciterMenu,
  setSelectedAudioReciterId,
  hasOfflineReciters,
  contentLanguage,
}: VerseActionModalReciterPickerProps) {
  const { t } = useTranslation();
  const isContentRtl = isRtlLanguage(contentLanguage);
  const localizedName = localizeReciterName(selectedAudioReciter, t, contentLanguage);
  const selectedName = localizedName || t("quran.reciter", { lng: contentLanguage });

  return (
    <div className="relative space-y-1">
      {hasOfflineReciters ? (
        <ReciterButton
          selectedAudioReciterName={selectedName}
          onToggle={() => setShowReciterMenu((prev) => !prev)}
          isOpen={showReciterMenu}
          isContentRtl={isContentRtl}
          contentLanguage={contentLanguage}
        />
      ) : null}

      {showReciterMenu ? (
        <ReciterMenu
          audioReciters={audioReciters}
          onSelect={(id) => {
            setSelectedAudioReciterId(id);
            setShowReciterMenu(false);
          }}
          contentLanguage={contentLanguage}
          isContentRtl={isContentRtl}
        />
      ) : null}
    </div>
  );
}

type VerseActionModalAudioScopeProps = Readonly<{
  hasOfflineReciters: boolean;
  audioScope: VerseActionModalProps["audioScope"];
  handlePlaySelectedVerseAudio: VerseActionModalProps["handlePlaySelectedVerseAudio"];
  audioLoading: boolean;
  networkOnline: boolean;
  contentLanguage: string;
  onClose: VerseActionModalProps["onClose"];
}>;

function VerseActionModalAudioScope({
  hasOfflineReciters,
  audioScope,
  handlePlaySelectedVerseAudio,
  audioLoading,
  networkOnline,
  contentLanguage,
  onClose,
}: VerseActionModalAudioScopeProps) {
  const { t } = useTranslation();
  const isCuratedRtl = isRtlLanguage(contentLanguage);

  const verseDisabled = audioLoading || (!hasOfflineReciters && !networkOnline);
  const offlineModesDisabled = audioLoading || !hasOfflineReciters;

  const labelVerse = t("quran.audioVerseOnly", { lng: contentLanguage });
  const labelFrom = t("quran.audioFromVerse", { lng: contentLanguage });
  const labelFull = t("quran.audioFullSurah", { lng: contentLanguage });

  const onScope = (scope: VerseAudioScope) => {
    void handlePlaySelectedVerseAudio(scope);
    onClose();
  };

  const scopeBtnClass = (active: boolean, disabled: boolean) =>
    `flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs transition-colors ${
      active
        ? "border-white/80 bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] ring-2 ring-sky-300/90"
        : "border-white/25 bg-black/15 text-white/90 hover:border-white/45 hover:bg-white/10"
    } ${disabled ? "opacity-50 pointer-events-none" : ""} ${isCuratedRtl ? "flex-row-reverse" : "flex-row"}`;

  return (
    <div dir={isCuratedRtl ? "rtl" : "ltr"} className="flex w-full gap-1.5 sm:gap-2">
      <button
        type="button"
        disabled={verseDisabled}
        onClick={() => {
          if (!verseDisabled) onScope("verse-only");
        }}
        className={scopeBtnClass(audioScope === "verse-only", verseDisabled)}
      >
        <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-center leading-tight">{labelVerse}</span>
      </button>
      <button
        type="button"
        disabled={offlineModesDisabled}
        onClick={() => {
          if (!offlineModesDisabled) onScope("from-verse");
        }}
        className={scopeBtnClass(audioScope === "from-verse", offlineModesDisabled)}
      >
        <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-center leading-tight">{labelFrom}</span>
      </button>
      <button
        type="button"
        disabled={offlineModesDisabled}
        onClick={() => {
          if (!offlineModesDisabled) onScope("full-surah");
        }}
        className={scopeBtnClass(audioScope === "full-surah", offlineModesDisabled)}
      >
        <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-center leading-tight">{labelFull}</span>
      </button>
    </div>
  );
}

type VerseActionModalAudioStatusProps = Readonly<{
  audioStatusMessage: string;
  audioError: string | null;
  /** Settings UI language — status copy is resolved with this locale; `lang` drives font stack. */
  uiLanguage: string;
}>;

function VerseActionModalAudioStatus({ audioStatusMessage, audioError, uiLanguage }: VerseActionModalAudioStatusProps) {
  return (
    <>
      {audioStatusMessage ? (
        <p lang={uiLanguage} className="text-xs pp-text-secondary">
          {audioStatusMessage}
        </p>
      ) : null}
      {audioError ? (
        <p lang={uiLanguage} className="text-xs text-red-300">
          {audioError}
        </p>
      ) : null}
    </>
  );
}

function VerseActionModalAudioPanel({
  audioReciters,
  selectedAudioReciter,
  showReciterMenu,
  setShowReciterMenu,
  setSelectedAudioReciterId,
  audioScope,
  setAudioScope,
  handlePlaySelectedVerseAudio,
  audioLoading,
  audioStatusMessage,
  audioError,
  networkOnline,
  contentLanguage,
  uiLanguage,
  onClose,
}: VerseActionModalAudioPanelProps) {
  const hasOfflineReciters = audioReciters.length > 0;

  React.useEffect(() => {
    if (!hasOfflineReciters && audioScope !== "verse-only") {
      setAudioScope("verse-only");
    }
  }, [audioScope, hasOfflineReciters, setAudioScope]);

  return (
    <div className="space-y-1.5">
      <div className="rounded-xl border px-2.5 py-2 space-y-2 pp-quran-bookmark-row">
        <div lang={contentLanguage} dir={isRtlLanguage(contentLanguage) ? "rtl" : "ltr"}>
          <VerseActionModalReciterPicker
            audioReciters={audioReciters}
            selectedAudioReciter={selectedAudioReciter}
            showReciterMenu={showReciterMenu}
            setShowReciterMenu={setShowReciterMenu}
            setSelectedAudioReciterId={setSelectedAudioReciterId}
            hasOfflineReciters={hasOfflineReciters}
            contentLanguage={contentLanguage}
          />
          <div className="mt-3">
          <VerseActionModalAudioScope
            hasOfflineReciters={hasOfflineReciters}
            audioScope={audioScope}
            handlePlaySelectedVerseAudio={handlePlaySelectedVerseAudio}
            audioLoading={audioLoading}
            networkOnline={networkOnline}
            contentLanguage={contentLanguage}
            onClose={onClose}
          />
          </div>
          {audioLoading ? (
            <div className="flex items-center gap-2 text-xs pp-text-secondary">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            </div>
          ) : null}
        </div>
        <VerseActionModalAudioStatus
          audioStatusMessage={audioStatusMessage}
          audioError={audioError}
          uiLanguage={uiLanguage}
        />
      </div>
    </div>
  );
}

type VerseActionModalTafsirPanelProps = Readonly<{
  selectedTafsirSource: VerseActionModalProps["selectedTafsirSource"];
  tafsirLoading: boolean;
  tafsirError: string | null;
  tafsirPreview: string;
  handleShareSelectedTafsir: () => Promise<void>;
  contentLanguage: string;
  uiLanguage: string;
}>;

const TAFSIR_PREVIEW_TEXT_STEPS = [
  "text-start text-xs leading-6 pp-text-primary whitespace-pre-wrap sm:leading-7",
  "text-start text-sm leading-7 pp-text-primary whitespace-pre-wrap sm:text-base sm:leading-8",
  "text-start text-base leading-8 pp-text-primary whitespace-pre-wrap sm:text-lg sm:leading-9",
] as const;

function VerseActionModalTafsirPanel({
  selectedTafsirSource,
  tafsirLoading,
  tafsirError,
  tafsirPreview,
  handleShareSelectedTafsir,
  contentLanguage,
  uiLanguage,
}: VerseActionModalTafsirPanelProps) {
  const { t } = useTranslation();
  const [tafsirTextStep, setTafsirTextStep] = useState(0);
  const isCuratedRtl = isRtlLanguage(contentLanguage);
  const isUiRtl = isRtlLanguage(uiLanguage);
  const previewClass = TAFSIR_PREVIEW_TEXT_STEPS[Math.min(tafsirTextStep, TAFSIR_PREVIEW_TEXT_STEPS.length - 1)];

  const tafsirHtmlLang = selectedTafsirSource
    ? tafsirCatalogLanguageToHtmlLang(selectedTafsirSource.language)
    : contentLanguage;

  return (
    <>
      {selectedTafsirSource ? (
        <div
          dir={isCuratedRtl ? "rtl" : "ltr"}
          className="flex items-start justify-between gap-2"
        >
          <p
            lang={tafsirHtmlLang}
            className="min-w-0 flex-1 text-xs pp-text-secondary sm:text-sm"
            dir="auto"
          >
            {getTafsirDisplayName(selectedTafsirSource.item, selectedTafsirSource.language)}
          </p>
          <button
            type="button"
            onClick={() =>
              setTafsirTextStep((s) => (s + 1 >= TAFSIR_PREVIEW_TEXT_STEPS.length ? 0 : s + 1))
            }
            className="flex shrink-0 items-center justify-center rounded-lg border px-2 py-1 pp-glass-surface-button sm:px-2.5 sm:py-1.5"
            aria-label={t("quran.tafsirTextSize", { lng: uiLanguage })}
          >
            <div
              className={[
                "flex items-end justify-center gap-0.5 px-0.5",
                isUiRtl ? "flex-row-reverse" : "flex-row",
              ].join(" ")}
            >
              <span className="text-xs font-bold leading-none mb-0.5">T</span>
              <span className="text-lg font-bold leading-none">T</span>
            </div>
          </button>
        </div>
      ) : null}

      {tafsirLoading ? (
        <div lang={contentLanguage} className="text-sm pp-text-secondary">
          {t("library.loading", { lng: contentLanguage })}
        </div>
      ) : null}
      {tafsirError ? (
        <div lang={contentLanguage} className="text-sm text-red-300">
          {tafsirError}
        </div>
      ) : null}
      {!tafsirLoading && tafsirPreview ? (
        <>
          <div className="max-h-[min(22vh,200px)] overflow-y-auto rounded-xl border px-2.5 py-2 pp-quran-bookmark-row sm:px-3 sm:py-2.5">
            <p lang={tafsirHtmlLang} dir="auto" className={previewClass}>
              {tafsirPreview}
            </p>
          </div>
          <button
            type="button"
            lang={uiLanguage}
            onClick={() => void handleShareSelectedTafsir()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold pp-glass-surface-button sm:px-3 sm:py-2 sm:text-sm"
          >
            <Share2 className="h-4 w-4" />
            {t("common.share", { lng: uiLanguage })}
          </button>
        </>
      ) : null}
    </>
  );
}

export function VerseActionModal(props: VerseActionModalProps) {
  const {
    selectedVerseAction,
    onClose,
    audioReciters,
    setSelectedAudioReciterId,
    selectedAudioReciter,
    showReciterMenu,
    setShowReciterMenu,
    audioScope,
    setAudioScope,
    handlePlaySelectedVerseAudio,
    audioLoading,
    audioStatusMessage,
    audioError,
    audioUiPrompt,
    clearAudioUiPrompt,
    onOpenQuranAudio,
    networkOnline,
    uiLanguage,
    selectedTafsirSource,
    tafsirLoading,
    tafsirError,
    tafsirPreview,
    handleShareSelectedTafsir,
    contentLanguage,
  } = props;

  if (!selectedVerseAction) {
    return null;
  }

  const isUiRtl = isRtlLanguage(uiLanguage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        dir={isUiRtl ? "rtl" : "ltr"}
        lang={uiLanguage}
        className="relative z-10 m-0 flex w-full max-w-lg max-h-[min(88dvh,520px)] flex-col overflow-hidden rounded-2xl border backdrop-blur-md pp-quran-modal-card bg-transparent text-inherit"
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-black/40" />
        <VerseActionModalHeader
          verse={selectedVerseAction}
          onClose={onClose}
          contentLanguage={contentLanguage}
          uiLanguage={uiLanguage}
        />
        <div className="relative z-10 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2 sm:px-4 sm:py-3">
          <VerseActionModalPrompts
            audioUiPrompt={audioUiPrompt}
            clearAudioUiPrompt={clearAudioUiPrompt}
            onOpenQuranAudio={onOpenQuranAudio}
            uiLanguage={uiLanguage}
          />
          <VerseActionModalAudioPanel
            audioReciters={audioReciters}
            selectedAudioReciter={selectedAudioReciter}
            showReciterMenu={showReciterMenu}
            setShowReciterMenu={setShowReciterMenu}
            setSelectedAudioReciterId={setSelectedAudioReciterId}
            audioScope={audioScope}
            setAudioScope={setAudioScope}
            handlePlaySelectedVerseAudio={handlePlaySelectedVerseAudio}
            audioLoading={audioLoading}
            audioStatusMessage={audioStatusMessage}
            audioError={audioError}
            networkOnline={networkOnline}
            contentLanguage={contentLanguage}
            uiLanguage={uiLanguage}
            onClose={onClose}
          />
          <VerseActionModalTafsirPanel
            selectedTafsirSource={selectedTafsirSource}
            tafsirLoading={tafsirLoading}
            tafsirError={tafsirError}
            tafsirPreview={tafsirPreview}
            handleShareSelectedTafsir={handleShareSelectedTafsir}
            contentLanguage={contentLanguage}
            uiLanguage={uiLanguage}
          />
        </div>
      </dialog>
    </div>
  );
}
