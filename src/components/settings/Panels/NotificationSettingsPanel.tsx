import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsToggle } from "../../settings/SettingsToggle";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, NotificationSoundType } from "@/hooks/useAppSettings";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { StorageService } from "@/services/StorageService";

interface NotificationSettingsPanelProps {
  settings: AppSettings;
  onUpdateNotifications: (notifications: Partial<AppSettings["notifications"]>) => void;
  onBack: () => void;
  onTestSound?: (soundType: NotificationSoundType) => void;
  notificationPermission?: "granted" | "denied" | "prompt";
  onRequestNotificationPermission?: () => Promise<boolean>;
}

const prayerKeys = [
  "fajr",
  "shurooq",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;

export function NotificationSettingsPanel({
  settings,
  onUpdateNotifications,
  onBack,
  onTestSound,
  notificationPermission,
  onRequestNotificationPermission,
}: Readonly<NotificationSettingsPanelProps>) {
  const { t } = useTranslation();
  const [deliveryMode, setDeliveryMode] = useState<"exact" | "approx" | "unknown">("unknown");
  const masterOn = settings.notifications.masterEnabled;
  const presetsSubduedClass = masterOn
    ? "transition-opacity"
    : "opacity-45 transition-opacity";

  useEffect(() => {
    const raw = StorageService.getItem("prayerpal_notification_delivery_mode_v1");
    if (raw === "exact" || raw === "approx") {
      setDeliveryMode(raw);
    } else {
      setDeliveryMode("unknown");
    }
  }, []);

  return (
    <SettingsSubScreen
      title={t("settings.notifications.title")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory title={t("settings.notifications.general")}>
        <SettingsToggle
          icon={<Bell className="w-5 h-5" />}
          label={t("settings.notifications.enable")}
          description={t("settings.notifications.enableDesc")}
          enabled={settings.notifications.masterEnabled}
          onToggle={async (enabled) => {
            if (
              enabled &&
              notificationPermission !== "granted" &&
              onRequestNotificationPermission
            ) {
              const granted = await onRequestNotificationPermission();
              if (granted) {
                onUpdateNotifications({ masterEnabled: enabled });
              }
            } else {
              onUpdateNotifications({ masterEnabled: enabled });
            }
          }}
          isLast={!masterOn}
        />
        {masterOn && (
          <>
            {deliveryMode === "approx" ? (
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs text-white/70">
                  {t(
                    "settings.notifications.approxMode",
                    "Approximate scheduling active (exact alarms not enabled). Notifications may drift.",
                  )}
                </p>
              </div>
            ) : null}
            <SettingsToggle
              label={t("settings.notifications.sound")}
              enabled={settings.notifications.sound}
              onToggle={(sound) => onUpdateNotifications({ sound })}
            />
            {settings.notifications.sound && (
              <>
                <div className="px-4 py-3 border-b border-white/5">
                  <label className="text-xs text-white/50 block mb-2">
                    {t("settings.notifications.soundType")}
                  </label>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        value: "discreet" as NotificationSoundType,
                        label: `🔔 ${t("settings.notifications.discreetShort")}`,
                        desc: t("settings.notifications.discreetDesc"),
                      },
                      {
                        value: "takbir" as NotificationSoundType,
                        label: `🕌 ${t("settings.notifications.takbir")}`,
                        desc: t("settings.notifications.takbirDesc"),
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          onUpdateNotifications({ soundType: option.value })
                        }
                        className={`flex items-center justify-between p-3 rounded-lg w-full text-start active:scale-[0.98] transition-all duration-300 ease-out ${
                          settings.notifications.soundType === option.value
                            ? "bg-white/20 border border-white/20"
                            : "bg-black/30 border border-white/10"
                        }`}
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium text-white block">
                            {option.label}
                          </span>
                          <p className="text-xs text-white/50">
                            {option.desc}
                          </p>
                        </div>
                        {settings.notifications.soundType === option.value && (
                          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center ml-3 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {onTestSound && (
                  <button
                    onClick={async () => {
                      try {
                        onTestSound(settings.notifications.soundType);
                      } catch (error) {
                        logger.error("Test sound failed:", error);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 active:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out"
                  >
                    <span className="text-sm text-white/70">
                      🔊 {t("settings.notifications.testSound")}
                    </span>
                  </button>
                )}
              </>
            )}
            <SettingsToggle
              label={t("settings.notifications.vibration")}
              enabled={settings.notifications.vibration}
              onToggle={(vibration) => onUpdateNotifications({ vibration })}
              isLast
            />
          </>
        )}
      </SettingsCategory>

      <div
        className={cn(
          "space-y-0",
          presetsSubduedClass,
          masterOn ? undefined : "pointer-events-none select-none",
        )}
        inert={masterOn ? undefined : true}
      >
        <SettingsCategory title={t("settings.notifications.prayerTime")}>
          {prayerKeys.map((key, idx) => (
            <SettingsToggle
              key={key}
              label={t(`prayers.${key}`)}
              enabled={settings.notifications.prayerNotifications[key]}
              onToggle={(enabled) =>
                onUpdateNotifications({
                  prayerNotifications: {
                    ...settings.notifications.prayerNotifications,
                    [key]: enabled,
                  },
                })
              }
              isLast={idx === prayerKeys.length - 1}
            />
          ))}
        </SettingsCategory>

        <SettingsCategory title={t("settings.notifications.prePrayer")}>
          <div className="px-4 py-3 border-b border-white/5">
            <label className="text-xs text-white/50 block mb-1">
              {t("settings.notifications.minutesBefore")}
            </label>
            <p className="text-xs text-white/40 mb-2">
              {t("settings.notifications.prePrayerSoundNote")}
            </p>
            <select
              value={settings.notifications.prePrayerMinutes}
              onChange={(e) =>
                onUpdateNotifications({
                  prePrayerMinutes: Number.parseInt(e.target.value, 10),
                })
              }
              className="w-full bg-black/30 rounded-lg px-3 py-2 text-white text-sm border-none"
            >
              <option value="5" className="bg-gray-800">
                5 {t("settings.notifications.minutes")}
              </option>
              <option value="10" className="bg-gray-800">
                10 {t("settings.notifications.minutes")}
              </option>
              <option value="15" className="bg-gray-800">
                15 {t("settings.notifications.minutes")}
              </option>
              <option value="30" className="bg-gray-800">
                30 {t("settings.notifications.minutes")}
              </option>
            </select>
          </div>
          {prayerKeys.map((key, idx) => (
            <SettingsToggle
              key={key}
              label={`${t("settings.notifications.before")} ${t(`prayers.${key}`)}`}
              enabled={settings.notifications.prePrayerNotifications[key]}
              onToggle={(enabled) =>
                onUpdateNotifications({
                  prePrayerNotifications: {
                    ...settings.notifications.prePrayerNotifications,
                    [key]: enabled,
                  },
                })
              }
              isLast={idx === prayerKeys.length - 1}
            />
          ))}
        </SettingsCategory>
      </div>
    </SettingsSubScreen>
  );
}
