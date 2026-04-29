import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { loadSurahMetadata, loadJuzMapping, loadSurahVerses, getSurah } from '@/services/quranService';
import type { Surah, Verse, Juz, QuranLanguageCode } from '@/types/quran';

export function useQuranData(displayLanguage: QuranLanguageCode) {
    const { t } = useTranslation();

    const [surahs, setSurahs] = useState<Surah[]>([]);
    const [juzs, setJuzs] = useState<Juz[]>([]);
    const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
    const [verses, setVerses] = useState<Verse[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingVerses, setLoadingVerses] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load surah metadata on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const [surahsData, juzData] = await Promise.all([
                    loadSurahMetadata(displayLanguage),
                    loadJuzMapping(),
                ]);
                if (cancelled) return;
                setSurahs(surahsData);
                setJuzs(juzData);
            } catch (err) {
                console.error('Error loading surah metadata:', err);
                if (cancelled) return;
                setError(t('quran.loadError'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t, displayLanguage]);

    // Load verses when surah + display language changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!selectedSurah) {
                setVerses([]);
                return;
            }
            try {
                setLoadingVerses(true);
                setError(null);
                const versesData = await loadSurahVerses(selectedSurah.number, displayLanguage);
                if (cancelled) return;
                setVerses(versesData);
            } catch (err) {
                console.error('Error loading verses:', err);
                if (!cancelled) setError(t('quran.loadError'));
            } finally {
                if (!cancelled) setLoadingVerses(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedSurah, displayLanguage, t]);

    const handleSelectSurah = useCallback(async (surahNumber: number) => {
        try {
            const surah = await getSurah(surahNumber);
            if (surah) setSelectedSurah(surah);
        } catch (err) {
            console.error('Error selecting surah:', err);
            setError(t('quran.loadError'));
        }
    }, [t]);

    return {
        surahs,
        juzs,
        selectedSurah,
        setSelectedSurah, // Exposed for logic that needs manual control (e.g. restore state)
        verses,
        setVerses, // Exposed for clear operation
        loading,
        loadingVerses,
        error,
        handleSelectSurah,
        setError
    };
}
