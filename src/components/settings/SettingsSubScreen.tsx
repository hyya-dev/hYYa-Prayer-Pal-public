
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from '@/lib/rtlLanguages';
import { cn } from '@/lib/utils';

interface SettingsSubScreenProps {
  title: string;
  children: React.ReactNode;
  className?: string; // Add optional className prop
  headerClassName?: string;
  contentClassName?: string;
}

export function SettingsSubScreen({
  title,
  children,
  className,
  headerClassName,
  contentClassName,
}: SettingsSubScreenProps) {
  const { i18n } = useTranslation();

  return (
    <div
      className={`flex-1 flex flex-col w-full ${className || ""}`}
    >
      {/*
        Secondary Nav Bar space has been removed per user request.
        The back button no longer appears on subpages.
      */}
      {/* Content - No internal scrolling, relies on parent container */}
      <div className={cn("w-full px-0 pb-4 pt-[75px]", contentClassName)}>{children}</div>
    </div>
  );
}
