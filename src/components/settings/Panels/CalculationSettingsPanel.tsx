import { useTranslation } from "react-i18next";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings, CalculationMethodName, HijriCalendarType } from "@/hooks/useAppSettings";
import { StorageService } from "@/services/StorageService";

interface CalculationSettingsPanelProps {
  readonly settings: AppSettings;
  readonly onUpdateCalculation: (calculation: Partial<AppSettings["calculation"]>) => void;
  readonly onBack: () => void;
}

const calculationMethodKeys: CalculationMethodName[] = [
  "UmmAlQura",
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "Dubai",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Turkey",
  "Tehran",
  "NorthAmerica",
  "MoonsightingCommittee",
];

const hijriCalendarTypeKeys: HijriCalendarType[] = [
  "IslamicUmmAlQura",
  "Islamic",
  "IslamicCivil",
  "IslamicTabular",
];

const highLatitudeModeOptions: Array<{ value: AppSettings['calculation']['highLatitudeMode']; labelKey: string }> = [
  { value: 'auto', labelKey: 'settings.calculation.highLatitudeModes.auto' },
  { value: 'off', labelKey: 'settings.calculation.highLatitudeModes.off' },
  { value: 'middle', labelKey: 'settings.calculation.highLatitudeModes.middle' },
  { value: 'seventh', labelKey: 'settings.calculation.highLatitudeModes.seventh' },
  { value: 'twilight', labelKey: 'settings.calculation.highLatitudeModes.twilight' },
];

const prayerKeys = [
  "fajr",
  "shurooq",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;

export function CalculationSettingsPanel({
  settings,
  onUpdateCalculation,
  onBack,
}: CalculationSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <SettingsSubScreen
      title={t("settings.calculation.title")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory title={t("settings.calculation.prayerTime")}>
        <div className="px-4 py-3 border-b border-white/5">
          <label className="text-xs text-white/50 block mb-1">
            {t("settings.calculation.method")}
          </label>
          <select
            value={settings.calculation.method}
            onChange={(e) => {
              StorageService.setItem("calculationMethodManualOverride", "true");
              onUpdateCalculation({
                method: e.target.value as CalculationMethodName,
              });
            }}
            className="w-full bg-black/30 rounded-lg px-3 py-2 text-white text-sm border-none"
          >
            {calculationMethodKeys.map((key) => (
              <option key={key} value={key} className="bg-gray-800">
                {t(`calculationMethods.${key}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="px-4 py-3">
          <label className="text-xs text-white/50 block mb-2">
            {t("settings.calculation.juristicMethod")}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateCalculation({ madhab: "shafi" })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98] duration-300 ease-out ${
                settings.calculation.madhab === "shafi"
                  ? "bg-white text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {t("settings.calculation.shafi")}
            </button>
            <button
              onClick={() => onUpdateCalculation({ madhab: "hanafi" })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98] duration-300 ease-out ${
                settings.calculation.madhab === "hanafi"
                  ? "bg-white text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {t("settings.calculation.hanafi")}
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5">
          <label className="text-xs text-white/50 block mb-1">
            {t('settings.calculation.highLatitudeRule')}
          </label>
          <select
            value={settings.calculation.highLatitudeMode}
            onChange={(e) =>
              onUpdateCalculation({
                highLatitudeMode: e.target.value as AppSettings['calculation']['highLatitudeMode'],
              })
            }
            className="w-full bg-black/30 rounded-lg px-3 py-2 text-white text-sm border-none"
          >
            {highLatitudeModeOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-gray-800">
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/60 mt-2">
            {t('settings.calculation.highLatitudeHint')}
          </p>
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[11px] leading-5 text-white/70">
              {t(
                'settings.calculation.highLatitudeExplainer',
                'Recommended default: Auto. High‑latitude adjustment affects places far north/south where twilight can distort Fajr/Isha. You can override it if the results don’t match your expectations.',
              )}
            </p>
          </div>
        </div>
      </SettingsCategory>

      <SettingsCategory title={t("settings.calculation.manualCorrections")}>
        {prayerKeys.map((key, idx) => (
          <div
            key={key}
            className={`flex items-center justify-between px-4 py-3 ${
              idx === prayerKeys.length - 1 ? "" : "border-b border-white/5"
            }`}
          >
            <span className="text-sm text-white">{t(`prayers.${key}`)}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onUpdateCalculation({
                    manualCorrections: {
                      ...settings.calculation.manualCorrections,
                      [key]: settings.calculation.manualCorrections[key] - 1,
                    },
                  })
                }
                className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
              >
                -
              </button>
              <span className="w-8 text-center text-sm text-white">
                {settings.calculation.manualCorrections[key]}
              </span>
              <button
                onClick={() =>
                  onUpdateCalculation({
                    manualCorrections: {
                      ...settings.calculation.manualCorrections,
                      [key]: settings.calculation.manualCorrections[key] + 1,
                    },
                  })
                }
                className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </SettingsCategory>

      <SettingsCategory title={t("settings.calculation.daylightSaving")}>
        <div className="px-4 py-3 border-b border-white/5">
          <label className="text-xs text-white/50 block mb-2">
            {t("settings.calculation.mode")}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateCalculation({ daylightSaving: "auto" })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98] duration-300 ease-out ${
                settings.calculation.daylightSaving === "auto"
                  ? "bg-white text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {t("settings.calculation.automatic")}
            </button>
            <button
              onClick={() => onUpdateCalculation({ daylightSaving: "manual" })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98] duration-300 ease-out ${
                settings.calculation.daylightSaving === "manual"
                  ? "bg-white text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {t("settings.calculation.manual")}
            </button>
          </div>
        </div>

        {settings.calculation.daylightSaving === "manual" && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-white">
              {t("settings.calculation.offsetHours")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onUpdateCalculation({
                    daylightSavingOffset: Math.max(
                      -1,
                      settings.calculation.daylightSavingOffset - 1,
                    ),
                  })
                }
                className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
              >
                -
              </button>
              <span className="w-8 text-center text-sm text-white">
                {settings.calculation.daylightSavingOffset > 0 ? "+" : ""}
                {settings.calculation.daylightSavingOffset}
              </span>
              <button
                onClick={() =>
                  onUpdateCalculation({
                    daylightSavingOffset: Math.min(
                      1,
                      settings.calculation.daylightSavingOffset + 1,
                    ),
                  })
                }
                className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
              >
                +
              </button>
            </div>
          </div>
        )}
      </SettingsCategory>

      <SettingsCategory title={t("settings.calculation.hijriCalendar")}>
        <div className="px-4 py-3 border-b border-white/5">
          <label className="text-xs text-white/50 block mb-1">
            {t("settings.calculation.calendarType")}
          </label>
          <select
            value={settings.calculation.hijriCalendarType}
            onChange={(e) =>
              onUpdateCalculation({
                hijriCalendarType: e.target.value as HijriCalendarType,
              })
            }
            className="w-full bg-black/30 rounded-lg px-3 py-2 text-white text-sm border-none"
          >
            {hijriCalendarTypeKeys.map((key) => (
              <option key={key} value={key} className="bg-gray-800">
                {t(`hijriCalendarTypes.${key}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white">
            {t(
              "settings.calculation.dateCorrectionHijriDays",
              t("settings.calculation.dateCorrection"),
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onUpdateCalculation({
                  hijriDateCorrection: Math.max(
                    -2,
                    settings.calculation.hijriDateCorrection - 1,
                  ),
                })
            }
              className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
            >
              -
            </button>
            <span className="w-8 text-center text-sm text-white">
              {settings.calculation.hijriDateCorrection > 0 ? "+" : ""}
              {settings.calculation.hijriDateCorrection}
            </span>
            <button
              onClick={() =>
                onUpdateCalculation({
                  hijriDateCorrection: Math.min(
                    2,
                    settings.calculation.hijriDateCorrection + 1,
                  ),
                })
              }
              className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all duration-300 ease-out"
            >
              +
            </button>
          </div>
        </div>
      </SettingsCategory>
    </SettingsSubScreen>
  );
}
