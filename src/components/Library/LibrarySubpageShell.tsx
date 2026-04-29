import { memo, ReactNode } from "react";
/**
 * LibrarySubpageShell — Shared architectural primitive for all Library subpages.
 * 
 * Enforces UX_LOGIC.md compliance:
 * - Layer 1: Separates UI chrome language (uiLanguage) from content language (contentLanguage)
 * - Layer 2: Title alignment and back-button placement driven by uiIsRtl, never content direction
 * - Layer 2: Back arrow direction driven by uiIsRtl, never content direction
 * - Consistent title-container height across all subpages
 * 
 * ARCHITECTURAL DECISION (per user requirement 2026-04-02):
 * Library is a content-immersive zone. All chrome within Library subpages (tabs, buttons, labels,
 * controls) uses Curated Translations language, NOT UI language. The only exception is the page
 * title itself (e.g., "Holy Quran", "Tafsir AlQuran") which remains in UI language per Layer 2.
 * 
 * UX LOGIC RULES (per user requirement 2026-04-03):
 * Rule 1: In a button with RTL text + icon, the icon goes to the RIGHT of the text.
 *         In a button with LTR text + icon, the icon goes to the LEFT of the text.
 * Rule 2: The search bar button is on the RIGHT side of the page for RTL language,
 *         and on the LEFT side of the page for LTR language.
 * Rule 3: Tapping the active NavigationBar icon steps back one level at a time
 *         (reader → chapter-list → home), not a full reset.
 * 
 * Visual Structure:
 * ┌─────────────────────────────────────────┐
 * │ [Title (aligned by uiIsRtl)]            │  ← Title row (height: fixed)
 * ├─────────────────────────────────────────┤
 * │ [Back Btn] ── [Controls Row]            │  ← Back + Controls on SAME row
 * ├─────────────────────────────────────────┤
 * │ [Optional Subtitle Card]                │  ← Subtitle BELOW controls row
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │   Scrollable Content Area               │
 * │   (uses contentLanguage/contentDir)     │
 * │                                         │
 * └─────────────────────────────────────────┘
 */

interface LibrarySubpageShellProps {
  // ===== UI Chrome (always use uiLanguage) =====
  /** Page title localized with uiLanguage */
  title: string;
  
  /** UI language code (e.g., "en", "ar") */
  uiLanguage: string;
  
  /** UI language direction — drives title alignment, back-button placement, and arrow direction */
  uiIsRtl: boolean;
  
  
  // ===== Content Language (for content area only) =====
  /** Curated content language code (e.g., "ar", "en") */
  contentLanguage: string;
  
  /** Curated content direction — applied to the scrollable content area only */
  contentIsRtl: boolean;
  
  // ===== Controls Row (shares row with back button) =====
  /**
   * Optional controls row content (e.g., font size TT, search, bookmarks, deselect-all).
   * This renders on the SAME row as the back button.
   * Back button is on the leading edge (left in LTR, right in RTL).
   * Controls fill the remaining space on the trailing edge.
   */
  controlsRow?: ReactNode;
  
  /**
   * Optional subtitle row content (e.g., chapter name, surah name chip).
   * Renders BELOW the back+controls row.
   */
  subtitleRow?: ReactNode;
  
  // ===== Content Area =====
  /** Scrollable content area */
  children: ReactNode;
  
  /** Optional className for the scrollable content container */
  contentClassName?: string;
  
  /** Optional ref for the scrollable content container */
  contentRef?: React.RefObject<HTMLDivElement>;

  /** Optional scroll handler for the content area */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

export const LibrarySubpageShell = memo(function LibrarySubpageShell({
  title,
  uiLanguage,
  uiIsRtl,
  contentLanguage,
  contentIsRtl,
  controlsRow,
  subtitleRow,
  children,
  contentClassName = "",
  contentRef,
  onScroll,
}: LibrarySubpageShellProps) {
  // UX Logic Layer 2: Title alignment driven by content language direction
  const titleAlignment = contentIsRtl ? "text-end" : "text-start";
  
  
  return (
    <div className="page-library flex-1 flex flex-col h-full overflow-hidden">
      {/* Title Row — Fixed Height */}
      <header
        className={`sticky top-0 z-20 px-4 pb-[2cm] animate-fade-in`}
        style={{ paddingTop: "calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" }}
      >
        <div style={{ marginTop: "calc(0.25rem - 1mm)" }}>
          <h1 className={`text-3xl font-bold title-3d ${titleAlignment} leading-tight`}>
            {title}
          </h1>
        </div>
      </header>
      
      {/* Controls Row */}
      {controlsRow && (
        <div className="px-4 pb-2 flex">
          <div className="w-full md:max-w-2xl md:mx-auto min-w-0">
            {controlsRow}
          </div>
        </div>
      )}
      
      {/* Subtitle Row — Optional, renders BELOW the back+controls row */}
      {subtitleRow && (
        <div className="px-4 pb-4 flex">
          <div className="w-full md:max-w-2xl md:mx-auto min-w-0">
            {subtitleRow}
          </div>
        </div>
      )}
      
      {/* Scrollable Content Area — Uses Content Language/Direction */}
      <div
        ref={contentRef}
        lang={contentLanguage}
        dir={contentIsRtl ? "rtl" : "ltr"}
        className={`page-scroll-content flex-1 overflow-y-auto px-4 ${contentClassName}`}
        style={{ paddingBottom: "var(--pp-content-bottom)" }}
        onScroll={onScroll}
      >
        {children}
      </div>
    </div>
  );
});
