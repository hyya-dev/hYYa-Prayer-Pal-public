import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { HisnLanguage } from '@/types/hisn';
import { isRtlLanguage } from "@/lib/rtlLanguages";

export function HisnSearchBar({
    currentLanguage,
    placeholder,
    onSearch,
    showCancel,
    onCancel,
    uiLanguage,
    className,
}: Readonly<{
    currentLanguage: HisnLanguage;
    placeholder: string;
    onSearch: (q: string) => void;
    showCancel?: boolean;
    onCancel?: () => void;
    uiLanguage: string;
    className?: string;
}>) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const isRTL = isRtlLanguage(currentLanguage);

    return (
        <div className={className || "relative mb-4"}>
            <div className={`flex items-center gap-2`}>
                <div className="relative flex-1">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--pp-text-secondary)' }} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            const v = e.target.value;
                            setQuery(v);
                            onSearch(v);
                        }}
                        placeholder={placeholder}
                        dir={isRTL ? "rtl" : "ltr"}
                        className={`w-full ps-10 pe-4 py-3 rounded-xl backdrop-blur-sm border placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30`}
                        style={{
                            background: 'var(--pp-button-bg)',
                            borderColor: 'var(--pp-border-soft)',
                            color: 'var(--pp-text-primary)',
                            boxShadow: 'var(--pp-surface-shadow)',
                            textAlign: isRTL ? "right" : "left",
                        }}
                    />
                </div>
                {showCancel && (
                    <button
                        onClick={() => {
                            setQuery('');
                            onSearch('');
                            onCancel?.();
                        }}
                        className="px-4 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap font-semibold relative overflow-hidden backdrop-blur-sm border"
                        style={{
                            background: 'var(--pp-button-bg)',
                            borderColor: 'var(--pp-border-soft)',
                            color: 'var(--pp-text-primary)',
                            boxShadow: 'var(--pp-surface-shadow)',
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
                        <span className="relative z-10">{t('quran.cancel', { lng: currentLanguage })}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
