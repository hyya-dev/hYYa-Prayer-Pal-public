import React from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import { useIsIpad } from "@/hooks/useIsIpad";
import SadaqahBannerPhone from "@/assets/SadaqahJariyah.png";
import SadaqahBannerIpad from "@/assets/ipad/Sadaqah Jariyah.png";

interface SettingsLayoutProps {
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Shared layout component for Settings screen that renders the fixed header
 * with title and Sadaqah Jariyah banner, and a scrollable content area.
 * This ensures the header is always visible across all settings views.
 */
export function SettingsLayout({
  children,
  containerRef,
}: SettingsLayoutProps) {
  const { t, i18n } = useTranslation();
  const isIpad = useIsIpad();
  const isRTL = isRtlLanguage(i18n.language);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Fixed Header with Sadaqah Jariyah Banner - ALWAYS VISIBLE */}
      <header
        className="sticky top-0 z-20 px-4 pb-4"
        style={{ paddingTop: "calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" }}
      >
        {/*
          UX Logic Layer 2 — Page title must appear on the correct side based on UI language.
          RTL (Arabic, Urdu, etc.): Title aligns to the RIGHT (text-end)
          LTR (English, French, etc.): Title aligns to the LEFT (text-start)
        */}
        <h1
          className={`text-3xl font-bold title-3d ${isRTL ? "text-end" : "text-start"}`}
          style={{ marginTop: "calc(0.25rem - 1mm)" }}
        >
          {t("screens.settings")}
        </h1>
        {/* Sadaqah Jariyah Banner - displays between title and content */}
        <div
          className="mt-2 flex justify-center animate-scale-in"
          style={{ marginBottom: "10mm", animationDelay: "0.1s", animationFillMode: "both" }}
        >
          <img
            src={isIpad ? SadaqahBannerIpad : SadaqahBannerPhone}
            alt="Sadaqah Jariyah"
            className="w-full max-w-md h-auto object-contain"
            style={{ maxHeight: "75px" }}
          />
        </div>
      </header>

      {/* Scrollable Content - content flows naturally from top */}
      <div
        ref={containerRef}
        className="settings-container flex-1 overflow-y-auto px-0"
        style={{
          paddingBottom: "var(--pp-nav-only)",
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
