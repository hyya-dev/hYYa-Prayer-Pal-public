import { memo, useMemo, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { isRtlLanguage } from "@/lib/rtlLanguages";
import mosqueIcon from "@/assets/Icon Mosque.png";
import libraryIcon from "@/assets/Icon Library.png";
import umbrellaIcon from "@/assets/Icon Umbrella.png";
import settingsIcon from "@/assets/Icon Settings.png";

export type Screen =
  | "home"
  | "qibla"
  | "library"
  | "counter"
  | "quran"
  | "weather"
  | "settings";

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

// Base nav items order: Home - Library - Weather - Settings (LTR)
const baseNavItems: { id: Screen; icon: string; labelKey: string }[] = [
  { id: "home", icon: mosqueIcon, labelKey: "nav.home" },
  { id: "library", icon: libraryIcon, labelKey: "nav.library" },
  { id: "weather", icon: umbrellaIcon, labelKey: "nav.weather" },
  { id: "settings", icon: settingsIcon, labelKey: "nav.settings" },
];

export const BottomNav = memo(function BottomNav({
  currentScreen,
  onNavigate,
}: BottomNavProps) {
  const { t } = useTranslation();

  const navItems = baseNavItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        width: "100%",
        maxWidth: "100vw",
        paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Glass morphism background */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent backdrop-blur-2xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Nav content - order changes based on RTL/LTR */}
      <div
        className="relative flex justify-around items-center px-4 py-3"
      >
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                // Always navigate, even if already on the screen (allows resetting scroll position, etc.)
                onNavigate(item.id);
              }}
              className={cn(
                "relative flex items-center justify-center transition-all duration-300 select-none rounded-full",
                isActive
                  ? "scale-110"
                  : "hover:scale-105 active:scale-95 opacity-70",
              )}
              aria-label={t(item.labelKey)}
            >
              {/* Active ring glow */}
              {isActive && (
                <div
                  className="absolute -inset-1 rounded-full blur-md"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in srgb, var(--pp-accent) 45%, transparent) 0%, transparent 70%)",
                  }}
                />
              )}

              <img
                src={item.icon}
                alt={t(item.labelKey)}
                className={cn(
                  "relative w-14 h-14 object-contain transition-all duration-300 rounded-full",
                )}
                style={
                  isActive
                    ? {
                        border: "2px solid var(--pp-accent)",
                        boxShadow:
                          "0 0 20px color-mix(in srgb, var(--pp-accent) 45%, transparent)",
                      }
                    : undefined
                }
              />
            </button>
          );
        })}
      </div>

      {/* Decorative bottom accent */}
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ marginBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))" }}
      />
    </nav>
  );
});
