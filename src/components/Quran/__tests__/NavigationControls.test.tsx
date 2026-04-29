import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavigationControls } from "../NavigationControls";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: unknown, arg3?: { lng?: string }) => {
      const options = (typeof arg2 === "object" && arg2 !== null ? (arg2 as { lng?: string }) : arg3) ?? undefined;
      if (options?.lng) return `${key}.${options.lng}`;

      const englishFallback: Record<string, string> = {
        "quran.previous": "Previous",
        "quran.next": "Next",
        "quran.backToList": "Back to List",
      };

      return englishFallback[key] ?? key;
    },
  }),
}));

describe("NavigationControls", () => {
  it("uses explicit language for labels", () => {
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

    expect(screen.getByRole("button", { name: "quran.previous.ar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "quran.next.ar" })).toBeInTheDocument();
    expect(screen.getByText("quran.backToList.ar")).toBeInTheDocument();
  });

  it("falls back when language is omitted", () => {
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
