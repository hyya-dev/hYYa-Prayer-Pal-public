import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { loadHisnChapter, loadHisnChapters } from '@/services/hisnService';
import { getAllHisnBookmarks, toggleHisnBookmark, removeHisnBookmarksForChapter } from '@/services/hisnBookmarkService';
import { getAllHisnChapterBookmarks, toggleHisnChapterBookmark } from "@/services/hisnChapterBookmarkService";
import type { HisnChapter, HisnItem } from '@/types/hisn';
import type { ReadingMode } from '@/types/library';
import { StorageService } from "@/services/StorageService";


export interface LastReadingState {
    chapterIndex: number;
    itemId?: number;
    readingMode: ReadingMode;
}

const LAST_READING_STATE_KEY = 'hisn_last_reading_state_v1';

export function useLibraryData() {
    const { t } = useTranslation();

    const [chapters, setChapters] = useState<HisnChapter[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<HisnChapter | null>(null);
    const [items, setItems] = useState<HisnItem[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingChapter, setLoadingChapter] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ===== Bookmarks (items) state =====
    const [bookmarks, setBookmarks] = useState(() => getAllHisnBookmarks());
    const refreshBookmarks = useCallback(() => {
        setBookmarks(getAllHisnBookmarks());
    }, []);
    const handleToggleBookmark = useCallback((chapterIndex: number, itemId: number) => {
        toggleHisnBookmark(chapterIndex, itemId);
        refreshBookmarks();
    }, [refreshBookmarks]);

    // ===== Favorites (chapters) state =====
    const [chapterBookmarks, setChapterBookmarks] = useState(() => getAllHisnChapterBookmarks());
    const refreshChapterBookmarks = useCallback(() => {
        setChapterBookmarks(getAllHisnChapterBookmarks());
    }, []);
    const toggleChapterBookmark = useCallback((chapterIndex: number) => {
        toggleHisnChapterBookmark(chapterIndex);
        refreshChapterBookmarks();
    }, [refreshChapterBookmarks]);

    const handleToggleListBookmark = useCallback((chapterIndex: number, isCurrentlyFavorited: boolean) => {
        if (isCurrentlyFavorited) {
            // Unfavorite both chapter and all its items
            let changedItems = false;
            let changedChapter = false;
            
            const currentChapterBookmarks = new Set(getAllHisnChapterBookmarks());
            if (currentChapterBookmarks.has(chapterIndex)) {
                toggleHisnChapterBookmark(chapterIndex);
                changedChapter = true;
            }
            
            if (removeHisnBookmarksForChapter(chapterIndex)) {
                changedItems = true;
            }
            
            if (changedChapter) refreshChapterBookmarks();
            if (changedItems) refreshBookmarks();
        } else {
            // Just favorite the chapter
            const currentChapterBookmarks = new Set(getAllHisnChapterBookmarks());
            if (!currentChapterBookmarks.has(chapterIndex)) {
                toggleHisnChapterBookmark(chapterIndex);
                refreshChapterBookmarks();
            }
        }
    }, [refreshChapterBookmarks, refreshBookmarks]);

    // Keep both bookmark stores in sync if another part
    // of the app updates StorageService in this session.
    useEffect(() => {
        refreshBookmarks();
        refreshChapterBookmarks();
    }, [refreshBookmarks, refreshChapterBookmarks]);

    // Load chapters on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await loadHisnChapters();
                if (cancelled) return;
                setChapters(data);
            } catch (e) {
                if (cancelled) return;
                console.error('[Hisn Muslim] Failed to load chapters:', e);
                setError(t('library.loadError'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const loadChapter = useCallback(async (chapterIndex: number) => {
        setLoadingChapter(true);
        setError(null);
        try {
            const chapter = chapters.find(c => c.index === chapterIndex);
            if (chapter) setSelectedChapter(chapter);

            const data = await loadHisnChapter(chapterIndex);
            if (!chapter && data?.chapter) {
                setSelectedChapter(data.chapter);
            }
            setItems(data.items || []);
            return { chapter: chapter ?? data.chapter, items: data.items || [] };
        } catch (e) {
            console.error('[Hisn Muslim] Failed to load chapter:', e);
            setError(t('library.loadError'));
            return null;
        } finally {
            setLoadingChapter(false);
        }
    }, [chapters, t]);

    const persistLastReading = useCallback((chapterIndex: number, itemId: number | undefined, readingMode: ReadingMode) => {
        try {
            StorageService.setItem(
                LAST_READING_STATE_KEY,
                JSON.stringify({ chapterIndex, itemId, readingMode, updatedAt: Date.now() }),
            );
        } catch {
            // ignore
        }
    }, []);

    const lastReadingState = useMemo(() => {
        try {
            const raw = StorageService.getItem(LAST_READING_STATE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as unknown;
            if (!parsed || typeof parsed !== "object") return null;
            const rec = parsed as { chapterIndex?: unknown; itemId?: unknown; readingMode?: unknown };
            if (typeof rec.chapterIndex !== "number") return null;
            return {
                chapterIndex: rec.chapterIndex,
                itemId: typeof rec.itemId === "number" ? rec.itemId : undefined,
                readingMode: rec.readingMode === "focus" ? "focus" : "list",
            };
        } catch {
            return null;
        }
    }, []);

    return {
        chapters,
        selectedChapter,
        setSelectedChapter,
        items,
        setItems,
        loading,
        loadingChapter,
        error,
        bookmarks,
        handleToggleBookmark,
        chapterBookmarks,
        toggleChapterBookmark,
        handleToggleListBookmark,
        loadChapter,
        persistLastReading,
        lastReadingState
    };
}
