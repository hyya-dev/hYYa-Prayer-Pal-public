import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePrayerTimes } from '../usePrayerTimes';

// usePrayerTimes uses default location (Makkah) and internal calculation when called with no args.
// It returns prayerTimes (array), nextPrayer, location, etc. — not "timings".

describe('usePrayerTimes Hook', () => {
    it('does not compute prayer times without a confirmed location', async () => {
        const { result } = renderHook(() =>
            usePrayerTimes('en', undefined, {
                method: 'UmmAlQura',
                madhab: 'shafi',
            })
        );

        await waitFor(() => {
            expect(Array.isArray(result.current.prayerTimes)).toBe(true);
            expect(result.current.prayerTimes.length).toBe(0);
            expect(result.current.nextPrayer).toBeNull();
            expect(Number.isFinite(result.current.location.latitude)).toBe(false);
            expect(Number.isFinite(result.current.location.longitude)).toBe(false);
        });
    });
});
