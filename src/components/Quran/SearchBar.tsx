import React, { useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isRtlLanguage } from '@/lib/rtlLanguages';
import type { QuranLanguageCode } from '@/types/quran';

interface SearchBarProps {
  onSearch: (query: string) => void;
  currentLanguage: QuranLanguageCode;
  placeholder?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  className?: string;
}

export function SearchBar({ onSearch, currentLanguage, placeholder, showCancel = false, onCancel, className }: Readonly<SearchBarProps>) {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const isRTL = isRtlLanguage(currentLanguage);
  const quranT = useMemo(() => i18n.getFixedT(currentLanguage), [i18n, currentLanguage]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    if (onCancel) {
      onCancel();
    }
  }, [onSearch, onCancel]);

  return (
    <div className={className || "relative mb-4"}>
      <div className="flex items-center gap-2 h-full">
        <div className="relative flex-1 h-full">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder={placeholder || quranT('quran.searchPlaceholder', 'Search verses')}
            className={`w-full h-full px-4 rounded-xl backdrop-blur-sm border placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 relative`}
            dir={isRTL ? "rtl" : "ltr"}
            style={{
              background: 'var(--pp-button-bg)',
              borderColor: 'var(--pp-border-soft)',
              color: 'var(--pp-text-primary)',
              boxShadow: 'var(--pp-surface-shadow)',
              textAlign: isRTL ? "right" : "left",
            }}
          />
          {query && (
            <button
              onClick={handleClear}
              className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-all z-10`}
              aria-label={quranT('quran.clearSearch', 'Clear Search')}
            >
              <X className="w-4 h-4" style={{ color: 'var(--pp-text-primary)' }} />
            </button>
          )}
        </div>
        {showCancel && (
          <button
            onClick={handleClear}
            className="px-4 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap font-semibold relative overflow-hidden backdrop-blur-sm border"
            style={{
              background: 'var(--pp-button-bg)',
              borderColor: 'var(--pp-border-soft)',
              color: 'var(--pp-text-primary)',
              boxShadow: 'var(--pp-surface-shadow)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
            <span className="relative z-10">{quranT('quran.cancel', 'Cancel')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
