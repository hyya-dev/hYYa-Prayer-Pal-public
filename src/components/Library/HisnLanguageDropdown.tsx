import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HisnLanguage } from '@/types/hisn';
import { TranslationLanguageDropdown, HISN_LANGUAGES } from '@/components/shared/TranslationLanguageDropdown';

export function HisnLanguageDropdown({
    value,
    onChange,
    language,
}: {
    value: HisnLanguage;
    onChange: (lang: HisnLanguage) => void;
    language: HisnLanguage;
}) {
    const { t } = useTranslation();
    
    return (
        <TranslationLanguageDropdown
            value={value}
            onChange={(lang) => onChange(lang as HisnLanguage)}
            languages={HISN_LANGUAGES}
            ariaLabel={t('library.language', { lng: language })}
        />
    );
}
