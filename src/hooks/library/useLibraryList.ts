import { useState, useMemo, useCallback } from 'react';
import { searchChapters } from '@/services/hisnSearchService';
import type { HisnChapter, HisnLanguage, HisnBookmark } from '@/types/hisn';
import { getAllHisnChapterBookmarks } from "@/services/hisnChapterBookmarkService";

export function useLibraryList(
    chapters: HisnChapter[],
    bookmarks: HisnBookmark[],
    effectiveLanguage: HisnLanguage
) {
    const [chapterSearchQuery, setChapterSearchQuery] = useState('');
    const [chapterSearchResults, setChapterSearchResults] = useState<HisnChapter[] | null>(null);
    const [chapterSearching, setChapterSearching] = useState(false);
    const [sortAlphabetical, setSortAlphabetical] = useState(false);
    const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

    const handleChapterSearch = useCallback(async (query: string) => {
        setChapterSearchQuery(query);
        if (!query.trim()) {
            setChapterSearchResults(null);
            setChapterSearching(false);
            return;
        }
        setChapterSearching(true);
        try {
            const res = await searchChapters(query, effectiveLanguage);
            setChapterSearchResults(res);
        } catch (e) {
            console.warn('[Hisn Muslim] Chapter search failed:', e);
            setChapterSearchResults([]);
        } finally {
            setChapterSearching(false);
        }
    }, [effectiveLanguage]);

    const visibleChapters = useMemo(() => {
        const base = chapterSearchResults ?? chapters;
        let list = base;

        if (showBookmarksOnly) {
            // "Favorites" in the chapter list refers to chapter-level favorites.
            // We keep item-level bookmarks separate for the reader experience.
            const bookmarkedChapters = new Set(getAllHisnChapterBookmarks());
            for (const b of bookmarks) {
                bookmarkedChapters.add(b.chapterIndex);
            }
            list = list.filter((ch) => bookmarkedChapters.has(ch.index));
        }

        if (!sortAlphabetical) return list;

        const locale = effectiveLanguage === 'ar' ? 'ar' : 'en';
        const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
        // Safe access to title properties
        const titleFor = (ch: HisnChapter) => {
            if (effectiveLanguage === 'ar') return ch.title.ar || '';
            return ch.title.en || '';
        };
        return [...list].sort((a, b) => collator.compare(titleFor(a), titleFor(b)));
    }, [chapterSearchResults, chapters, showBookmarksOnly, bookmarks, sortAlphabetical, effectiveLanguage]);

    const resetListState = useCallback(() => {
        setChapterSearchQuery('');
        setChapterSearchResults(null);
        setChapterSearching(false);
    }, []);

    return {
        chapterSearchQuery,
        setChapterSearchQuery,
        chapterSearchResults,
        setChapterSearchResults,
        chapterSearching,
        setChapterSearching,
        sortAlphabetical,
        setSortAlphabetical,
        showBookmarksOnly,
        setShowBookmarksOnly,
        handleChapterSearch,
        visibleChapters,
        resetListState
    };
}
