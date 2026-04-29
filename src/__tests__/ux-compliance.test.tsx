/**
 * UX Compliance Test Suite
 * ========================
 * Automated tests that enforce the rules defined in UX_LOGIC.md and RULES.md.
 *
 * These tests exist because AntiGravity and other AI code editors have repeatedly
 * introduced regressions in the following areas:
 *   - RTL/LTR layout direction (Layer 2)
 *   - Navigation arrow direction (Layer 2)
 *   - Western numeral enforcement (RULES.md §1)
 *   - UI vs. content language separation (Layer 1)
 *
 * DO NOT delete or disable these tests without updating UX_LOGIC.md to reflect
 * the intentional change.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationControls } from "@/components/Quran/NavigationControls";
import { toWesternDigits } from "@/lib/toWesternDigits";
import { formatLocalizedNumber } from "@/lib/formatUtils";

// ---------------------------------------------------------------------------
// Mock react-i18next for all tests in this file
// ---------------------------------------------------------------------------
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: unknown, arg3?: { lng?: string }) => {
      const options = (typeof arg2 === "object" && arg2 !== null ? (arg2 as { lng?: string }) : arg3) ?? undefined;
      // If options.lng is provided, return key.lng so tests can assert language used
      if (options?.lng) return `${key}.${options.lng}`;

      const englishFallback: Record<string, string> = {
        "quran.previous": "Previous",
        "quran.next": "Next",
        "quran.backToList": "Back to List",
      };

      return englishFallback[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

// ===========================================================================
// LAYER 2 — Navigation Arrow Direction
// ===========================================================================
describe("UX Layer 2 — NavigationControls arrow direction", () => {
  /**
   * UX_LOGIC.md Layer 2 rule:
   * "Navigation arrows must ALWAYS face AWAY from each other (never toward each other)."
   *
   * LTR: Previous = ChevronLeft (←),  Next = ChevronRight (→)  → face outward ✓
   * RTL: Previous = ChevronRight (→), Next = ChevronLeft (←)   → face outward ✓
   *
   * The old implementation used rtl-mirror (CSS scaleX flip) which caused arrows
   * to face TOWARD each other in RTL. The fix uses explicit icon selection.
   */

  it("LTR: Previous button renders ChevronLeft and Next renders ChevronRight", () => {
    const { container } = render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        isRTL={false}
      />,
    );
    // ChevronLeft has a specific path that curves left; ChevronRight curves right.
    // We verify by checking the aria-label on the buttons (set from t() mock).
    const prevBtn = screen.getByRole("button", { name: "Previous" });
    const nextBtn = screen.getByRole("button", { name: "Next" });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    // In LTR, Previous button must NOT contain a ChevronRight icon (that would face inward).
    // We check that the SVG inside Previous is NOT the same as the one inside Next.
    const prevSvg = prevBtn.querySelector("svg");
    const nextSvg = nextBtn.querySelector("svg");
    expect(prevSvg).not.toBeNull();
    expect(nextSvg).not.toBeNull();
    // The two icons must be different (one is ChevronLeft, the other ChevronRight)
    expect(prevSvg?.innerHTML).not.toEqual(nextSvg?.innerHTML);
  });

  it("RTL: Previous button renders ChevronRight and Next renders ChevronLeft (arrows face outward)", () => {
    const { container: ltrContainer } = render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        isRTL={false}
      />,
    );
    const ltrPrevSvg = screen
      .getByRole("button", { name: "Previous" })
      .querySelector("svg")?.innerHTML;
    const ltrNextSvg = screen
      .getByRole("button", { name: "Next" })
      .querySelector("svg")?.innerHTML;

    // Re-render with RTL=true
    const { unmount } = render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        isRTL={true}
      />,
    );

    // There will now be two sets of buttons; get the last two (RTL ones)
    const allPrevBtns = screen.getAllByRole("button", { name: "Previous" });
    const allNextBtns = screen.getAllByRole("button", { name: "Next" });
    const rtlPrevSvg = allPrevBtns[allPrevBtns.length - 1].querySelector("svg")?.innerHTML;
    const rtlNextSvg = allNextBtns[allNextBtns.length - 1].querySelector("svg")?.innerHTML;

    // In RTL, Previous icon should be the SAME as LTR Next icon (ChevronRight)
    expect(rtlPrevSvg).toEqual(ltrNextSvg);
    // In RTL, Next icon should be the SAME as LTR Previous icon (ChevronLeft)
    expect(rtlNextSvg).toEqual(ltrPrevSvg);

    unmount();
  });

  it("NavigationControls does NOT apply rtl-mirror class to arrow icons", () => {
    render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        isRTL={true}
      />,
    );
    // rtl-mirror class on navigation arrows causes them to face toward each other — forbidden.
    const prevBtn = screen.getAllByRole("button", { name: "Previous" })[0];
    const nextBtn = screen.getAllByRole("button", { name: "Next" })[0];
    const prevIcon = prevBtn.querySelector("svg");
    const nextIcon = nextBtn.querySelector("svg");
    expect(prevIcon?.classList.contains("rtl-mirror")).toBe(false);
    expect(nextIcon?.classList.contains("rtl-mirror")).toBe(false);
  });
});

// ===========================================================================
// RULES.md §1 — Western Numeral Enforcement
// ===========================================================================
describe("RULES.md §1 — Western numeral enforcement", () => {
  /**
   * RULES.md §1: "Always Enforce Western Arabic numerals (0, 1, 2, 3...) for all
   * numbers in any language, no exceptions."
   *
   * Intl.NumberFormat('ar').format(5) returns '٥' (Arabic-Indic digit) by default.
   * toWesternDigits() must convert all such digits to 0-9.
   */

  it("toWesternDigits converts Arabic-Indic digits to Western", () => {
    // Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩
    expect(toWesternDigits("٥")).toBe("5");
    expect(toWesternDigits("١٢٣")).toBe("123");
    expect(toWesternDigits("١٤٤٥")).toBe("1445"); // Hijri year
  });

  it("toWesternDigits converts Extended Arabic-Indic (Urdu/Persian) digits", () => {
    // Extended Arabic-Indic: ۰۱۲۳۴۵۶۷۸۹
    expect(toWesternDigits("۵")).toBe("5");
    expect(toWesternDigits("۱۴۴۵")).toBe("1445");
  });

  it("toWesternDigits leaves Western digits unchanged", () => {
    expect(toWesternDigits("12345")).toBe("12345");
    expect(toWesternDigits("0")).toBe("0");
  });

  it("formatLocalizedNumber always returns Western digits for Arabic locale", () => {
    // This was the bug: Intl.NumberFormat('ar').format(5) = '٥' without toWesternDigits
    const result = formatLocalizedNumber(5, "ar");
    // Must not contain any Arabic-Indic or Extended Arabic-Indic digits
    expect(result).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    expect(result).toBe("5");
  });

  it("formatLocalizedNumber always returns Western digits for Urdu locale", () => {
    const result = formatLocalizedNumber(42, "ur");
    expect(result).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    expect(result).toBe("42");
  });

  it("formatLocalizedNumber works correctly for English locale", () => {
    expect(formatLocalizedNumber(1000, "en")).toBe("1,000");
  });
});

// ===========================================================================
// LAYER 1 — UI vs. Content Language Separation
// ===========================================================================
describe("UX Layer 1 — UI vs. content language separation", () => {
  /**
   * UX_LOGIC.md Layer 1 rule:
   * "UI chrome (navigation buttons, titles, labels) MUST always use the UI language.
   *  Content (Quran text, Hisn, Tafsir, Manasik) MUST use the content/library language."
   *
   * These tests verify that NavigationControls passes the correct language to t().
   */

  it("NavigationControls uses the explicit language prop for all labels", () => {
    render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        showBackToList
        language="ar"
      />,
    );
    // The mock returns "key.lng" when lng is provided, so we can verify language is passed
    expect(screen.getByRole("button", { name: "quran.previous.ar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "quran.next.ar" })).toBeInTheDocument();
    expect(screen.getByText("quran.backToList.ar")).toBeInTheDocument();
  });

  it("NavigationControls falls back to default strings when language is omitted", () => {
    render(
      <NavigationControls
        onPrevious={() => {}}
        onNext={() => {}}
        onBackToList={() => {}}
        canGoPrevious
        canGoNext
        showBackToList
      />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByText("Back to List")).toBeInTheDocument();
  });
});
