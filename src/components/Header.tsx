import { memo } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import { Location } from "@/hooks/usePrayerTimes";
import { Loader2, ArrowLeft } from "lucide-react";
import { transliterateCityToUrdu } from "@/lib/urduTransliteration";

interface HeaderProps {
  title: string;
  location?: Location;
  showDate?: boolean;
  onNotificationClick?: () => void;
  isLocating?: boolean;
  titleAlign?: "left" | "right" | "center";
  onBack?: () => void;
  backLabel?: string;
}

const localeMap: Record<string, string> = {
  en: "en-US",
  ar: "ar-SA",
  fr: "fr-FR",
  tr: "tr-TR",
  ur: "ur-PK",
  id: "id-ID",
  ms: "ms-MY",
};

function formatLocationForTwoLines(city: string): string {
  const trimmed = city.trim();
  if (!trimmed.includes(" ")) return trimmed;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return trimmed;

  const splitIndex = Math.ceil(words.length / 2);
  return `${words.slice(0, splitIndex).join(" ")}\n${words.slice(splitIndex).join(" ")}`;
}

type TitleAlign = "left" | "right" | "center";

function toolbarJustifyClass(hasSideOrBack: boolean, titleAlign: TitleAlign): string {
  if (hasSideOrBack) return "justify-between";
  if (titleAlign === "center") return "justify-center";
  if (titleAlign === "right") return "justify-end";
  return "justify-start";
}

function titleHeadingTextAlignClass(isMultiLineTitle: boolean, titleAlign: TitleAlign): string {
  if (isMultiLineTitle) return "text-center";
  if (titleAlign === "center") return "text-center";
  if (titleAlign === "right") return "text-end";
  return "text-start";
}

function titleHeadingSizeClass(isMultiLineTitle: boolean): string {
  return isMultiLineTitle ? "text-2xl" : "text-3xl";
}

interface HeaderSidePanelProps {
  readonly isRTL: boolean;
  readonly sideContentOffset: string | number;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly locationBlockText?: string;
  readonly isLocating?: boolean;
  readonly showDate: boolean;
  readonly dateStr: string;
  readonly hijriDateStr: string;
}

const HeaderSidePanel = memo(function HeaderSidePanel({
  isRTL,
  sideContentOffset,
  onBack,
  backLabel,
  locationBlockText,
  isLocating,
  showDate,
  dateStr,
  hijriDateStr,
}: HeaderSidePanelProps) {
  const sideMetaAlign = isRTL ? "text-start" : "text-end";

  return (
    <div
      className={`flex flex-col ${isRTL ? "items-start" : "items-end"} gap-2`}
      style={{ marginTop: sideContentOffset }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden backdrop-blur-sm border pp-glass-surface-button"
          aria-label={backLabel || "Back"}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
          {/*
            UX Logic Layer 2 — Back arrow direction:
            In LTR: arrow points LEFT (←) — user came from the left
            In RTL: arrow points RIGHT (→) — user came from the right
            rtl-mirror handles this via CSS scaleX(-1) when [dir="rtl"] is set on <html>.
          */}
          <ArrowLeft className="w-5 h-5 relative z-10 rtl-mirror" />
        </button>
      )}

      {locationBlockText !== undefined && (
        <div className={`text-base font-semibold city-3d flex items-start gap-1.5 max-w-[10.5rem] ${sideMetaAlign}`}>
          {isLocating && (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--pp-header-meta-color)" }} />
          )}
          <span
            className="whitespace-pre-line"
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: "1.1",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              unicodeBidi: "plaintext",
            }}
          >
            <bdi dir="auto">{locationBlockText}</bdi>
          </span>
        </div>
      )}

      {showDate && (
        <>
          <div
            className={`text-sm font-semibold ${sideMetaAlign}`}
            style={{
              color: "var(--pp-header-meta-color)",
              textShadow: "var(--pp-header-meta-shadow)",
              letterSpacing: "0.02em",
            }}
          >
            {dateStr}
          </div>
          <div
            className={`text-xs font-semibold mt-0.5 ${sideMetaAlign}`}
            style={{
              color: "var(--pp-header-meta-color)",
              textShadow: "var(--pp-header-meta-shadow)",
              letterSpacing: "0.02em",
            }}
          >
            {hijriDateStr}
          </div>
        </>
      )}

    </div>
  );
});

export const Header = memo(function Header({
  title,
  location,
  showDate = false,
  onNotificationClick: _onNotificationClick,
  isLocating,
  titleAlign,
  onBack,
  backLabel,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const locale = localeMap[i18n.language] || "en-US";
  const isRTL = isRtlLanguage(i18n.language);
  // UX Logic Layer 2: Default alignment is 'center' for UI balance.
  const resolvedTitleAlign: TitleAlign = titleAlign || "center";

  const dateStr = today.toLocaleDateString(locale, {
    calendar: "gregory", // Force Gregorian calendar (Arabic locales default to Hijri)
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const hijriDateStr = today.toLocaleDateString(locale, {
    calendar: "islamic",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // For title-only headers (no location/date), use full-width container for proper RTL alignment
  const hasSideContent = Boolean(location || showDate);
  /** Title-only row: flex justify maps to physical sides (see i18n — html dir follows UI language). */
  const isTitleOnlyChrome = !hasSideContent && !onBack;
  // Multi-line titles (home screen "hYYA\nPrayer\nCompanion") get text-center within their container
  const isMultiLineTitle = title.includes("\n");
  // On Home: align location block with second line of title ("Prayer") when title is "hYYa\nPrayer\nPal".
  const sideContentOffset = location ? "2rem" : 0;

  // UX Logic Layer 2: Title and back button MUST switch sides based on UI language direction.
  // RTL (Arabic, Urdu, etc.): Title → Top Right, Back Button → Top Left
  // LTR (English, French, etc.): Title → Top Left, Back Button → Top Right
  // Standard flex-row naturally honors [dir="rtl"] on <html> to swap the visual order.
  const flexDirection = hasSideContent || onBack ? "flex-row" : "";
  const hasSideOrBack = hasSideContent || Boolean(onBack);

  let locationBlockText: string | undefined;
  if (location) {
    const coordsMissing =
      !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude);
    const cityRaw = coordsMissing
      ? t("common.pullToRefresh", { defaultValue: "Pull to Refresh" })
      : (location.displayName ||
          location.city ||
          t("location.currentLocation", { defaultValue: "Current Location" }));
    const resolved = i18n.language === "ur" ? transliterateCityToUrdu(cityRaw) : cityRaw;
    locationBlockText = formatLocationForTwoLines(resolved);
  }

  const toolbarJustify = toolbarJustifyClass(hasSideOrBack, resolvedTitleAlign);
  const titleTextAlign = titleHeadingTextAlignClass(isMultiLineTitle, resolvedTitleAlign);
  const titleSize = titleHeadingSizeClass(isMultiLineTitle);
  const h1ClassName = `${titleSize} font-bold title-3d ${titleTextAlign} whitespace-pre-line leading-tight`;

  return (
    <header
      className="sticky top-0 z-20 px-4 pb-4 animate-fade-in"
      style={{ paddingTop: "calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" }}
    >
      {/*
        UX Logic Layer 2 — Layout direction is driven by UI Language.
        flex-row honors [dir="rtl"] on html:
          - In RTL: Title to the RIGHT, Back button to the LEFT.
          - In LTR: Title to the LEFT, Back button to the RIGHT.
      */}
      <div
        className={`flex ${flexDirection} ${toolbarJustify} items-start`}
        dir={isTitleOnlyChrome ? "ltr" : undefined}
        style={{ marginTop: "calc(0.25rem - 1mm)" }}
      >
        {/* Title - position is determined by flex-row / flex-row-reverse above */}
        <h1 dir={isTitleOnlyChrome ? "auto" : undefined} className={h1ClassName}>
          {title}
        </h1>

        {hasSideOrBack && (
          <HeaderSidePanel
            isRTL={isRTL}
            sideContentOffset={sideContentOffset}
            onBack={onBack}
            backLabel={backLabel}
            locationBlockText={locationBlockText}
            isLocating={isLocating}
            showDate={showDate}
            dateStr={dateStr}
            hijriDateStr={hijriDateStr}
          />
        )}
      </div>
    </header>
  );
});

export default Header;
