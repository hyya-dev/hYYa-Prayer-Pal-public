import { useTranslation } from 'react-i18next';
import iconImage from '../assets/icon-postprompt.png';

interface NotificationPostPromptProps {
  onEnable: () => void;
  onNotNow: () => void;
}

/**
 * Post-Permission Prompt Modal
 * 
 * Shown AFTER user grants notification permission, asking if they want to enable notifications.
 * This is compliant with Apple Guideline 4.5.4 - user must explicitly choose to enable.
 */
export function NotificationPostPrompt({ 
  onEnable, 
  onNotNow 
}: NotificationPostPromptProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onNotNow}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300"
        style={{
          background: 'var(--pp-card-bg)',
          border: '1px solid var(--pp-border-soft)',
        }}
      >
        {/* Content */}
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <img 
              src={iconImage} 
              alt="hYYa Prayer Pal Icon" 
              className="w-20 h-20 object-contain"
            />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--pp-header-title-color)' }}>
            {t('settings.notifications.postPrompt.title')}
          </h2>

          {/* Description */}
          <p className="text-sm text-center mb-6 px-2" style={{ color: 'var(--pp-text-secondary)' }}>
            {t('settings.notifications.postPrompt.description')}
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            {/* Enable Button */}
            <button
              onClick={onEnable}
              className="py-3 px-6 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] shadow-lg"
              style={{
                background: 'linear-gradient(145deg, #E6A23C 0%, #C78C2E 100%)',
                color: 'var(--pp-text-primary)',
              }}
            >
              {t('settings.notifications.postPrompt.enable')}
            </button>

            {/* Not Now Button */}
            <button
              onClick={onNotNow}
              className="py-2.5 px-6 rounded-2xl font-medium text-sm transition-colors"
              style={{
                color: 'var(--pp-text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              {t('settings.notifications.postPrompt.notNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
