import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import mascotImage from '../assets/mascot-preprompt.webp';

interface NotificationPrePromptProps {
  onEnable: () => Promise<boolean>;
  onMaybeLater: () => void;
  onClose: () => void;
}

/**
 * Pre-Prompt Modal for Notification Permission
 * 
 * Shown before the system dialog to explain why notifications are needed.
 * This increases the "Allow" rate and preserves the one-shot system prompt
 * if the user chooses "Maybe Later".
 */
export function NotificationPrePrompt({ 
  onEnable, 
  onMaybeLater, 
  onClose 
}: NotificationPrePromptProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      await onEnable();
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  const handleMaybeLater = () => {
    onMaybeLater();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleMaybeLater}
      />
      
      {/* Modal - Image as background */}
      <div 
        className="relative w-full max-w-[320px] rounded-[28px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Mascot image as full background */}
        <img 
          src={mascotImage} 
          alt="hYYa Prayer Pal Mascot" 
          className="w-full block"
        />
        
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/40" />
        
        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-5 pb-4">
          {/* Title at top */}
          <h2 
            className="text-lg font-semibold text-center"
            style={{
              color: 'var(--pp-header-title-color, #ffffff)',
              textShadow: 'var(--pp-header-title-shadow, 0 2px 8px rgba(0, 0, 0, 0.8), 0 1px 3px rgba(0, 0, 0, 0.6))',
            }}
          >
            {t('settings.notifications.prePrompt.title')}
          </h2>

          {/* Spacer for mascot visibility */}
          <div className="flex-1" />

          {/* Buttons at bottom */}
          <div className="flex flex-col items-center gap-1 mt-5">
            {/* Enable Button - smaller */}
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="py-2 px-6 rounded-2xl font-semibold text-xs transition-all active:scale-[0.98] disabled:opacity-70"
              style={{
                background: 'linear-gradient(145deg, #E6A23C 0%, #C78C2E 100%)',
                boxShadow: '0 4px 12px rgba(198, 140, 46, 0.5)',
                color: 'var(--pp-text-primary)',
              }}
            >
              {isLoading 
                ? t('settings.notifications.prePrompt.enabling')
                : t('settings.notifications.prePrompt.enable')
              }
            </button>

            {/* Maybe Later - dark text for readability */}
            <button
              onClick={handleMaybeLater}
              disabled={isLoading}
              className="py-1.5 px-4 text-[11px] font-semibold transition-colors disabled:opacity-50"
              style={{ 
                color: 'var(--pp-header-meta-color, #FFFFFF)',
                textShadow: 'var(--pp-header-meta-shadow, 0 2px 6px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.6))'
              }}
            >
              {t('settings.notifications.prePrompt.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
