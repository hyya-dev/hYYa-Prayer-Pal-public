import React from 'react';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import type { QuranLanguageCode } from '@/types/quran';
import type { SearchResult } from '@/services/quranSearchService';

interface QuranSearchViewProps {
    handleSearch: (q: string) => void;
    displayLanguage: QuranLanguageCode;
    onCancel: () => void;
    searchResults: SearchResult[];
    searchQuery: string;
    searching?: boolean;
    handleSelectSearchResult: (surah: number, verse: number) => void;
}

export function QuranSearchView({
    handleSearch,
    displayLanguage,
    onCancel,
    searchResults,
    searchQuery,
    searching = false,
    handleSelectSearchResult,
}: QuranSearchViewProps) {
    return (
        <div className="max-w-2xl mx-auto w-full pt-4 pb-0">
            <SearchBar
                onSearch={handleSearch}
                currentLanguage={displayLanguage}
                showCancel
                onCancel={onCancel}
            />
            <SearchResults
                results={searchResults}
                currentLanguage={displayLanguage}
                searchQuery={searchQuery}
                searching={searching}
                onSelectResult={handleSelectSearchResult}
            />
        </div>
    );
}
