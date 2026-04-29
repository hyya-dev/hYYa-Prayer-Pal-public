import { useState, useCallback } from 'react';
import { searchInSurah, searchSurahs, type SearchResult } from '@/services/quranSearchService';
import type { Surah, QuranLanguageCode } from '@/types/quran';

export function useQuranSearch(displayLanguage: QuranLanguageCode, selectedSurah: Surah | null) {
    // Search state (within selected surah)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    // Surah list search state
    const [surahSearchQuery, setSurahSearchQuery] = useState('');
    const [surahSearchResults, setSurahSearchResults] = useState<Surah[] | null>(null);
    const [surahSearching, setSurahSearching] = useState(false);
    const [listMode, setListMode] = useState<'surah' | 'juz'>('surah');

    const handleSurahSearch = useCallback(async (query: string) => {
        setSurahSearchQuery(query);

        if (!query.trim()) {
            setSurahSearchResults(null);
            setSurahSearching(false);
            return;
        }

        setSurahSearching(true);
        try {
            const results = await searchSurahs(query, displayLanguage);
            setSurahSearchResults(results);
        } catch (err) {
            console.warn('[Quran] Surah search failed:', err);
            setSurahSearchResults([]);
        } finally {
            setSurahSearching(false);
        }
    }, [displayLanguage]);

    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        if (!selectedSurah || !query.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        try {
            const results = await searchInSurah(selectedSurah.number, query, displayLanguage);
            setSearchResults(results);
        } catch (err) {
            console.warn('[Quran] Search failed:', err);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [selectedSurah, displayLanguage]);

    const resetSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setSearching(false);
        setSurahSearchQuery('');
        setSurahSearchResults(null);
        setSurahSearching(false);
        setListMode('surah');
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        searching,
        setSearching,
        surahSearchQuery,
        setSurahSearchQuery,
        surahSearchResults,
        setSurahSearchResults,
        surahSearching,
        setSurahSearching,
        listMode,
        setListMode,
        handleSearch,
        handleSurahSearch,
        resetSearch
    };
}
