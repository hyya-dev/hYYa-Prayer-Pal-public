import { useTranslation } from 'react-i18next';

export function LocationBadgePreview() {
  const { t } = useTranslation();

  const badges = [
    t('locationConfidence.gpsWithAccuracy', { accuracy: 42 }),
    t('locationConfidence.gps'),
    t('locationConfidence.ipApproximate'),
    t('locationConfidence.cached'),
    t('locationConfidence.manual'),
    t('locationConfidence.default'),
  ];

  return (
    <div
      className="mx-4 mb-3 p-3 rounded-xl border"
      style={{
        background: 'var(--pp-surface-gradient)',
        borderColor: 'var(--pp-border-soft)',
      }}
    >
      <p
        className="text-xs font-semibold mb-2"
        style={{
          color: 'var(--pp-header-meta-color)',
          textShadow: 'var(--pp-header-meta-shadow)',
        }}
      >
        {t('locationConfidence.previewTitle')}
      </p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge}
            className="px-2 py-1 rounded-full text-[11px] font-semibold border"
            style={{
              color: 'var(--pp-header-meta-color)',
              background: 'var(--pp-surface-gradient-soft)',
              borderColor: 'var(--pp-border-soft)',
              textShadow: 'var(--pp-header-meta-shadow)',
            }}
          >
            {badge}
          </span>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--pp-text-secondary)' }}>
        {t('locationConfidence.nearTemplate', { city: 'Jubail', distance: '7.2' })}
      </p>
    </div>
  );
}
