import { LocationConfidence } from '@/hooks/usePrayerTimes';
import { useTranslation } from 'react-i18next';

const GPS_ACCURACY_THRESHOLD = 100; // meters

export function LocationBadge({ 
  locationConfidence,
}: { 
  locationConfidence: LocationConfidence;
}) {
  const { t } = useTranslation();

  // Show badge ONLY if:
  // 1. Using GPS with poor accuracy (>100m)
  // 2. OR not using GPS at all (IP, cache, manual, default)
  const shouldShow = 
    (locationConfidence.source === 'gps' && locationConfidence.accuracyMeters && locationConfidence.accuracyMeters > GPS_ACCURACY_THRESHOLD) ||
    (locationConfidence.source !== 'gps');

  if (!shouldShow) {
    return null; // Don't show for good GPS
  }

  return (
    <div
      className="mx-4 mb-3 px-3 py-1.5 rounded-full text-[11px] font-medium inline-block border"
      style={{
        background: 'var(--pp-surface-gradient-soft)',
        borderColor: 'var(--pp-border-soft)',
        color: 'var(--pp-header-meta-color)',
        textShadow: 'var(--pp-header-meta-shadow)',
        width: 'fit-content',
      }}
    >
      {locationConfidence.label}
    </div>
  );
}
