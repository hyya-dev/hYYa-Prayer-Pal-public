import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsIpad } from "@/hooks/useIsIpad";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';

interface SettingsRowProps {
  icon?: ReactNode;
  label: string | ReactNode;
  value?: string;
  onClick?: () => void;
  rightElement?: ReactNode;
  showChevron?: boolean;
  isLast?: boolean;
  danger?: boolean;
  highlight?: boolean; // For special styling like hYYa button
  labelNextToIcon?: boolean; // Position label directly next to icon
}

export function SettingsRow({
  icon,
  label,
  value,
  onClick,
  rightElement,
  showChevron = true,
  isLast = false,
  danger = false,
  highlight = false,
  labelNextToIcon = false,
  className,
  style,
}: SettingsRowProps & {
  className?: string;
  style?: React.CSSProperties;
}) {
  const isIpad = useIsIpad();
  const { i18n } = useTranslation();
  const isRTL = isRtlLanguage(i18n.language);

  // iPad: Use CSS Grid for true horizontal centering of label
  // Grid columns: [Icon 40px] [Label 1fr centered] [Value+Chevron auto]
  // If labelNextToIcon, use: [Icon+Label auto] [spacer 1fr] [Value+Chevron auto]
  if (isIpad) {
    const gridContent = labelNextToIcon ? (
      <div
        className="w-full items-center gap-3"
        style={{
          display: "grid",
          gridTemplateColumns: icon ? "auto 1fr auto" : "1fr auto",
          padding: "10px 16px",
        }}
      >
        {icon && (
          <div className={cn("text-white flex items-center gap-2",)}>
            {icon}
            {typeof label === "string" ? (
              <span
                className={cn(
                  "text-lg font-medium",
                  danger ? "text-red-400" : "text-[color:var(--pp-text-primary)]",
                  "text-start",
                )}
              >
                {label}
              </span>
            ) : (
              <span
                className={cn(
                  "text-lg font-medium inline-flex items-center gap-2",
                  "text-start",
                )}
              >
                {label}
              </span>
            )}
          </div>
        )}
        {!icon && (
          <div className="flex items-center">
            {typeof label === "string" ? (
              <span
                className={cn(
                  "text-lg font-medium",
                  danger ? "text-red-400" : "text-[color:var(--pp-text-primary)]",
                  "text-start",
                )}
              >
                {label}
              </span>
            ) : (
              <span
                className={cn(
                  "text-lg font-medium inline-flex items-center gap-2",
                  "text-start",
                )}
              >
                {label}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          {value && <span className="text-lg" style={{ color: 'var(--pp-text-secondary)' }}>{value}</span>}
          {rightElement}
          {onClick && showChevron && (
            <ChevronRight className="w-5 h-5 rtl-mirror" style={{ color: 'var(--pp-text-secondary)' }} />
          )}
        </div>
      </div>
    ) : (
      <div
        className="w-full items-center gap-3"
        style={{
          display: "grid",
          gridTemplateColumns: icon ? "40px 1fr auto" : "1fr auto",
          padding: "10px 16px",
        }}
      >
        {icon && (
          <div className="text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="flex items-center justify-center w-full">
          {typeof label === "string" ? (
            <span
              className={cn(
                "text-lg font-medium",
                danger ? "text-red-400" : "text-[color:var(--pp-text-primary)]",
                "text-center",
              )}
            >
              {label}
            </span>
          ) : (
            <span
              className={cn(
                "text-lg font-medium inline-flex items-center justify-center gap-2",
                "text-center",
              )}
            >
              {label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {value && <span className="text-lg" style={{ color: 'var(--pp-text-secondary)' }}>{value}</span>}
          {rightElement}
          {onClick && showChevron && (
            <ChevronRight className="w-5 h-5 rtl-mirror" style={{ color: 'var(--pp-text-secondary)' }} />
          )}
        </div>
      </div>
    );

    const rootClassName = cn(
      "w-full",
      !isLast && "border-b",
      onClick && "hover:bg-white/10 active:bg-white/15 transition-colors",
      highlight &&
        "bg-white/10 border border-white/20 rounded-lg mx-2 my-1",
      className,
    );

    if (onClick) {
      return (
        <button onClick={onClick} className={rootClassName} style={{ ...style, borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}>
          {gridContent}
        </button>
      );
    }

    return (
      <div className={rootClassName} style={{ ...style, borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}>
        {gridContent}
      </div>
    );
  }

  // iPhone: Original flexbox layout
  // If labelNextToIcon, position label directly next to icon
  const valueClass = cn("text-base me-2");
  const iconClass = cn("me-3", highlight ? "text-[color:var(--pp-text-primary)]" : "text-white");

  const content = labelNextToIcon ? (
    <>
      {icon && (
        <div
          className={cn(
            "flex items-center gap-2",
            highlight ? "text-[color:var(--pp-text-primary)]" : "text-white",
          )}
        >
          {icon}
          {typeof label === "string" ? (
            <span
              className={cn(
                "text-base font-medium",
                danger
                  ? "text-red-400"
                  : highlight
                    ? "text-white font-semibold"
                    : "text-[color:var(--pp-text-primary)]",
                "text-start",
              )}
            >
              {label}
            </span>
          ) : (
            <span
              className={cn(
                "text-base font-medium inline-flex items-center gap-2",
                "text-start",
              )}
            >
              {label}
            </span>
          )}
        </div>
      )}
      {!icon && (
        <div>
          {typeof label === "string" ? (
            <span
              className={cn(
                "text-base font-medium",
                danger
                  ? "text-red-400"
                  : highlight
                    ? "text-white font-semibold"
                    : "text-[color:var(--pp-text-primary)]",
                "text-start",
              )}
            >
              {label}
            </span>
          ) : (
            <span
              className={cn(
                "text-base font-medium inline-flex items-center gap-2",
                "text-start",
              )}
            >
              {label}
            </span>
          )}
        </div>
      )}
      <div className="flex-1" />
      {value && <span className={valueClass} style={{ color: 'var(--pp-text-secondary)' }}>{value}</span>}
      {rightElement}
      {onClick && showChevron && (
        <ChevronRight className="w-4 h-4 rtl-mirror" style={{ color: 'var(--pp-text-secondary)' }} />
      )}
    </>
  ) : (
    <>
      {icon && <div className={iconClass}>{icon}</div>}
      <div className="flex-1">
        {typeof label === "string" ? (
          <span
            className={cn(
              "text-base font-medium",
              danger
                ? "text-red-400"
                : highlight
                  ? "text-white font-semibold"
                  : "text-[color:var(--pp-text-primary)]",
              "text-start",
            )}
          >
            {label}
          </span>
        ) : (
          <span
            className={cn(
              "text-base font-medium inline-flex items-center gap-2",
              "text-start",
            )}
          >
            {label}
          </span>
        )}
      </div>
      {value && <span className={valueClass} style={{ color: 'var(--pp-text-secondary)' }}>{value}</span>}
      {rightElement}
      {onClick && showChevron && (
        <ChevronRight className="w-4 h-4 rtl-mirror" style={{ color: 'var(--pp-text-secondary)' }} />
      )}
    </>
  );

  const rootClassName = cn(
    "w-full flex items-center px-4 py-2",
    !isLast && "border-b",
    onClick &&
      "hover:bg-white/5 active:bg-white/10 transition-all duration-300 ease-out active:scale-[0.98]",
    highlight &&
      "bg-white/10 border border-white/20 rounded-lg mx-2 my-1",
    className,
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={rootClassName} style={{ ...style, borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}>
        {content}
      </button>
    );
  }

  return (
    <div className={rootClassName} style={{ ...style, borderColor: "var(--pp-border-soft)", color: "var(--pp-text-primary)" }}>
      {content}
    </div>
  );
}
