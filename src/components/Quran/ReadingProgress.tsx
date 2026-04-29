import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, TrendingUp, Flame } from 'lucide-react';
import type { SurahProgress, JuzProgress } from '@/services/quranReadingProgressService';
import { getOverallProgress, getReadingStreak } from '@/services/quranReadingProgressService';

interface ReadingProgressProps {
  surahProgress?: SurahProgress;
  juzProgress?: JuzProgress;
  showOverall?: boolean;
  showStreak?: boolean;
  compact?: boolean;
}

/**
 * Reading Progress Component
 * Displays reading statistics and progress
 */
export function ReadingProgress({
  surahProgress,
  juzProgress,
  showOverall = true,
  showStreak = true,
  compact = false,
}: ReadingProgressProps) {
  const { t } = useTranslation();
  const overallProgress = showOverall ? getOverallProgress() : null;
  const streakDays = showStreak ? getReadingStreak() : null;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--pp-text-secondary)' }}>
        {overallProgress && (
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>
              {overallProgress.readCount} / {overallProgress.totalVerses} ({overallProgress.percentage}%)
            </span>
          </div>
        )}
        {streakDays !== null && streakDays > 0 && (
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-white/80" />
            <span>{streakDays} {streakDays === 1 ? t('quran.day') : t('quran.days')}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      {overallProgress && (
        <div className="rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm"
          style={{
            background: 'var(--pp-surface-gradient-soft)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
        >
          {/* Glass highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-white/80" />
              <h3 className="font-bold" style={{ color: 'var(--pp-text-primary)' }}>{t('quran.overallProgress')}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm" style={{ color: 'var(--pp-text-secondary)' }}>
                <span>{t('quran.versesRead')}</span>
                <span className="font-semibold" style={{ color: 'var(--pp-text-primary)' }}>
                  {overallProgress.readCount} / {overallProgress.totalVerses}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className="bg-white/60 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress.percentage}%` }}
                />
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--pp-text-secondary)' }}>{overallProgress.percentage}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Reading Streak */}
      {streakDays !== null && streakDays > 0 && (
        <div className="rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm"
          style={{
            background: 'var(--pp-surface-gradient-soft)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
        >
          {/* Glass highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
          <div className="relative z-10 flex items-center gap-3">
            <Flame className="w-5 h-5 text-white/80" />
            <div className="flex-1">
              <h3 className="font-bold" style={{ color: 'var(--pp-text-primary)' }}>{t('quran.readingStreak')}</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--pp-text-secondary)' }}>
                {streakDays} {streakDays === 1 ? t('quran.day') : t('quran.days')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Surah Progress */}
      {surahProgress && (
        <div className="rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm"
          style={{
            background: 'var(--pp-surface-gradient-soft)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
        >
          {/* Glass highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-5 h-5 text-white/80" />
              <h3 className="font-bold" style={{ color: 'var(--pp-text-primary)' }}>
                {t('quran.surahProgress')} - {t('quran.sura')} {surahProgress.surahNumber}
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm" style={{ color: 'var(--pp-text-secondary)' }}>
                <span>{t('quran.versesRead')}</span>
                <span className="font-semibold" style={{ color: 'var(--pp-text-primary)' }}>
                  {surahProgress.readCount} / {surahProgress.totalVerses}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className="bg-white/60 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${surahProgress.percentage}%` }}
                />
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--pp-text-secondary)' }}>{surahProgress.percentage}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Juz Progress */}
      {juzProgress && (
        <div className="rounded-xl p-4 border relative overflow-hidden backdrop-blur-sm"
          style={{
            background: 'var(--pp-surface-gradient-soft)',
            borderColor: 'var(--pp-border-soft)',
            boxShadow: 'var(--pp-surface-shadow)',
          }}
        >
          {/* Glass highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/30 pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-5 h-5 text-white/80" />
              <h3 className="font-bold" style={{ color: 'var(--pp-text-primary)' }}>
                {t('quran.juzProgress')} - {t('quran.juz')} {juzProgress.juzNumber}
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm" style={{ color: 'var(--pp-text-secondary)' }}>
                <span>{t('quran.versesRead')}</span>
                <span className="font-semibold" style={{ color: 'var(--pp-text-primary)' }}>
                  {juzProgress.readCount} / {juzProgress.totalVerses}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className="bg-white/60 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${juzProgress.percentage}%` }}
                />
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--pp-text-secondary)' }}>{juzProgress.percentage}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
