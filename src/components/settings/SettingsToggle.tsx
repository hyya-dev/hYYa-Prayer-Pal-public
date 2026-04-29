import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsToggleProps {
  icon?: ReactNode;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isLast?: boolean;
}

export function SettingsToggle({
  icon,
  label,
  description,
  enabled,
  onToggle,
  isLast = false,
}: SettingsToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={cn(
        "w-full flex items-center px-4 py-3 active:bg-white/5 transition-all duration-300 ease-out active:scale-[0.98]",
        !isLast && "border-b",
      )}
      style={{ borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}
    >
      {icon && <div className="text-white/70 me-3">{icon}</div>}
      <div className="flex-1 text-start">
        <span className="text-base font-medium" style={{ color: "var(--pp-text-primary)" }}>{label}</span>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: "var(--pp-text-secondary)" }}>{description}</p>
        )}
      </div>
      <div
        className={cn(
          "w-11 h-6 rounded-full relative transition-colors duration-300",
          enabled
            ? "bg-white/30 border border-white/20"
            : "bg-black/20 border border-white/10",
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 w-[1.125rem] h-[1.125rem] rounded-full bg-white shadow-sm transition-all duration-300 ease-out",
            enabled ? "start-[1.375rem]" : "start-0.5",
          )}
        />
      </div>
    </button>
  );
}
