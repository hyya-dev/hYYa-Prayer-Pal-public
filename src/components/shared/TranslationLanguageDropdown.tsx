import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';

export interface LanguageOption {
    code: string;
    name: string;
    shortCode: string;
}

interface TranslationLanguageDropdownProps {
    value: string;
    onChange: (lang: string) => void;
    languages: LanguageOption[];
    ariaLabel?: string;
}

export function TranslationLanguageDropdown({
    value,
    onChange,
    languages,
    ariaLabel,
}: TranslationLanguageDropdownProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const selectedLang = languages.find(l => l.code === value);
    const label = selectedLang?.shortCode || value.toUpperCase().slice(0, 2);

    return (
        <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 relative backdrop-blur-sm border transition-all"
                style={{
                    background: 'var(--pp-surface-gradient)',
                    borderColor: 'var(--pp-border-soft)',
                    boxShadow: 'var(--pp-surface-shadow)',
                }}
                aria-label={ariaLabel || t('settings.language.title')}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-lg" />
                <Languages className="w-4 h-4 flex-shrink-0 relative z-10 pointer-events-none" style={{ color: 'var(--pp-text-secondary)' }} />
                <span className="text-xs relative z-10 whitespace-nowrap" style={{ color: 'var(--pp-text-primary)' }}>{label}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 relative z-10 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--pp-text-secondary)' }} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className="fixed rounded-xl shadow-lg border z-50 backdrop-blur-sm"
                        style={{
                            background: 'var(--pp-surface-gradient-strong)',
                            borderColor: 'var(--pp-border-soft)',
                            boxShadow: 'var(--pp-surface-shadow-lg)',
                            width: 'max-content',
                            maxWidth: 'none',
                            pointerEvents: 'auto',
                            top: containerRef.current ? containerRef.current.getBoundingClientRect().bottom + 8 : 'auto',
                            right: containerRef.current ? window.innerWidth - containerRef.current.getBoundingClientRect().right : 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        role="listbox"
                        aria-label={ariaLabel || t('settings.language.title')}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none rounded-xl" />
                        <div className="p-2 relative z-10">
                            {languages.map((lang) => {
                                const isSelected = value === lang.code;
                                return (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            onChange(lang.code);
                                            setIsOpen(false);
                                        }}
                                        className={`block w-full text-left px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                                            isSelected
                                                ? 'bg-white/20 text-white font-semibold border'
                                                : 'hover:bg-white/10'
                                        }`}
                                            style={isSelected
                                              ? { borderColor: 'var(--pp-border-soft)' }
                                              : { color: 'var(--pp-text-primary)' }}
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span>{lang.name}</span>
                                            {isSelected && <span className="text-white flex-shrink-0">✓</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Pre-defined language options for different contexts
// eslint-disable-next-line react-refresh/only-export-components
export const HISN_LANGUAGES: LanguageOption[] = [
    { code: 'ar', name: 'العربية', shortCode: 'AR' },
    { code: 'en', name: 'English', shortCode: 'EN' },
];

// eslint-disable-next-line react-refresh/only-export-components
export const QURAN_LANGUAGES: LanguageOption[] = [
    { code: 'ar', name: 'العربية', shortCode: 'AR' },
    { code: 'en', name: 'English', shortCode: 'EN' },
    { code: 'ur', name: 'اردو', shortCode: 'UR' },
    { code: 'id', name: 'Bahasa Indonesia', shortCode: 'ID' },
    { code: 'tr', name: 'Türkçe', shortCode: 'TR' },
    { code: 'fr', name: 'Français', shortCode: 'FR' },
];
