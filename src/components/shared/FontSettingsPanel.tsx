import React from 'react';
import { useTranslation } from 'react-i18next';
import { Type } from 'lucide-react';

interface FontSliderConfig {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}

interface FontSettingsPanelProps {
    sliders: FontSliderConfig[];
    onClose?: () => void;
}

// M and L only: small T = Medium, large T = Large (clearly distinguishable)
const PRESETS = [
    { label: 'medium', factor: 0.5, Icon: Type, iconClass: 'w-4 h-4' },
    { label: 'large', factor: 1, Icon: Type, iconClass: 'w-7 h-7' },
];

export function FontSettingsPanel({ sliders, onClose }: FontSettingsPanelProps) {
    const { t } = useTranslation();

    const applyPreset = (factor: number) => {
        sliders.forEach(slider => {
            const range = slider.max - slider.min;
            const newValue = Math.round(slider.min + range * factor);
            slider.onChange(newValue);
        });
    };

    return (
        <div
            className="px-4 pb-4 relative overflow-hidden backdrop-blur-sm border-b"
            style={{
                background: 'var(--pp-surface-gradient-soft)',
                borderColor: 'var(--pp-border-soft)',
                boxShadow: 'var(--pp-surface-shadow)',
            }}
            role="region"
            aria-label={t('quran.fontSettings')}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none" />
            <div className="relative z-10">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: 'var(--pp-text-primary)' }}>
                            {t('quran.textSize')}
                        </span>
                        <div className="flex items-center gap-2">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => applyPreset(preset.factor)}
                                    className="p-2 rounded-lg transition-all border hover:bg-white/10 flex items-center justify-center"
                                    style={{
                                        background: 'var(--pp-surface-gradient)',
                                        borderColor: 'var(--pp-border-soft)',
                                    }}
                                    aria-label={t(`quran.fontSize.${preset.label}`)}
                                >
                                    <preset.Icon className={preset.iconClass} style={{ color: 'var(--pp-text-primary)' }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
