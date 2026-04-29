import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { useDeviceHeading } from '@/hooks/useDeviceHeading';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useIsIpad } from '@/hooks/useIsIpad';
interface QiblaCompassProps {
  qiblaDirection: number; // The bearing to Makkah from current location
}

// 3D text shadow style - white text with brown shadow for compass letters
const text3DStyle: React.CSSProperties = {
  color: 'var(--pp-text-primary)',
  fontWeight: 'bold',
  textShadow: `
    0 1px 0 #8D6E63,
    0 2px 0 #6D4C41,
    0 3px 0 #5D4037,
    0 4px 0 #4E342E,
    0 5px 10px rgba(78, 52, 46, 0.8),
    0 8px 20px rgba(62, 39, 35, 0.6),
    0 12px 30px rgba(45, 31, 27, 0.4),
    2px 2px 4px rgba(62, 39, 35, 0.9)
  `.trim().replace(/\s+/g, ' '),
};

// 3D icon shadow style
const icon3DStyle = {
  filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.2)) drop-shadow(0 4px 4px rgba(0,0,0,0.3)) drop-shadow(0 8px 8px rgba(0,0,0,0.2))'
};
export function QiblaCompass({
  qiblaDirection
}: QiblaCompassProps) {
  const {
    t
  } = useTranslation();
  const {
    heading,
    accuracy,
    isSupported,
    permissionGranted,
    sessionGranted,
    error,
    requestPermission
  } = useDeviceHeading();

  // Detect Android for device-specific smoothing
  // LESSON LEARNED: Use Capacitor.getPlatform() instead of user agent parsing
  const isAndroid = useMemo(() => Capacitor.getPlatform() === 'android', []);

  // PERFORMANCE FIX: Use centralized iPad detection hook
  const isIpad = useIsIpad();
  
  // Smooth heading with interpolation
  const [smoothHeading, setSmoothHeading] = useState<number>(0);
  useEffect(() => {
    if (heading !== null) {
      setSmoothHeading(prev => {
        // Interpolate for smoother rotation
        let diff = heading - prev;
        // Handle wrap-around
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        // Android: Higher factor since heavy smoothing already applied in hook
        // iOS: Lower factor for smooth animation
        const smoothingFactor = isAndroid ? 0.5 : 0.3;
        
        return prev + diff * smoothingFactor;
      });
    }
  }, [heading, isAndroid]);
  const handleRequestPermission = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  // Calculate the rotation: compass rotates opposite to heading, needle points to qibla
  // When heading = 0 (facing north), compass shows north at top
  // Needle always points to qiblaDirection relative to the compass
  //
  // CRITICAL FIX: iPad/Tablet now uses SAME logic as iPhone
  // The previous 180° correction was WRONG and caused:
  // 1. Compass twitching due to modulo producing negative values
  // 2. Wrong Qibla direction
  // 3. Fighting with the smoothing algorithm
  //
  // Both iPhone and iPad use the same webkitCompassHeading API and return
  // the same heading values. There is no need for device-specific corrections.
  const compassRotation = useMemo(() => {
    if (heading === null) return 0;
    
    // Same rotation logic for ALL devices (iPhone, iPad, Android phones, tablets)
    // No device-specific corrections needed - the heading API works the same way
    return -smoothHeading;
  }, [heading, smoothHeading]);
  
  // Needle rotation is always relative to the compass, so no iPad-specific adjustment needed
  const needleRotation = qiblaDirection;

  // Show permission request UI for iOS (only if permission not granted)
  // Check multiple sources: permissionGranted state, sessionGranted flag, and heading data
  // If ANY of these indicate permission was granted, don't show the button
  const hasHeadingData = heading !== null;
  const hasPermission = permissionGranted || sessionGranted || hasHeadingData;
  const needsPermission = isSupported && !hasPermission;

  if (needsPermission) {
    return <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="text-6xl mb-6">🧭</div>
        <h2 className="text-xl font-semibold prayer-text mb-2">{t('qibla.faceKaaba')}</h2>
        <p className="text-sm prayer-text/70 text-center mb-6">
          {t('qibla.enableCompassDesc')}
        </p>
        <button
          onClick={handleRequestPermission}
          className="px-6 py-3 font-semibold rounded-full shadow-lg active:scale-95 transition-transform border"
          style={{
            background: 'var(--pp-button-bg)',
            color: 'var(--pp-accent)',
            borderColor: 'var(--pp-border-strong)',
          }}
        >
          {t('qibla.enableCompassButton')}
        </button>
      </div>;
  }

  // Show error state
  if (error && accuracy === 'unreliable') {
    return <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="text-6xl mb-6 animate-pulse">🔄</div>
        <h2 className="text-xl font-semibold prayer-text mb-2">{t('qibla.calibrationNeededTitle')}</h2>
        <p className="text-sm prayer-text/70 text-center">
          {t('qibla.calibrationNeededDesc')}
        </p>
      </div>;
  }
  // iPad-specific sizing
  const compassSize = isIpad ? 380 : 290;
  const needleHeight = isIpad ? 155 : 109;
  const cardinalTextClass = isIpad ? 'text-2xl' : 'text-lg';
  const centerDotSize = isIpad ? 24 : 16;
  const kaabaTextClass = isIpad ? 'text-3xl' : 'text-2xl';
  const compassYOffset = '0cm';

  return <div className="flex flex-col items-center h-full overflow-visible">
      {/* Compass aligned with background frame */}
      <div 
        className="qibla-compass-container flex-1 flex flex-col items-center justify-center overflow-visible"
        style={{
          transform: `translateY(${compassYOffset})`
        }}
      >
        <div 
          className="relative rounded-full prayer-text flex items-center justify-center" 
          style={{
            width: `${compassSize}px`,
            height: `${compassSize}px`,
            transform: `perspective(800px) rotateX(5deg) rotate(${compassRotation}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.1s ease-out'
          }}
        >
          {/* Cardinal points with 3D effect - white text with dark shadow (+1cm radius) */}
          <span className={`absolute top-2 left-1/2 -translate-x-1/2 font-bold ${cardinalTextClass}`} style={text3DStyle}>
            {t('qibla.north')}
          </span>
          <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 font-bold ${cardinalTextClass}`} style={text3DStyle}>
            {t('qibla.south')}
          </span>
          <span className={`absolute right-2 top-1/2 -translate-y-1/2 font-bold ${cardinalTextClass}`} style={text3DStyle}>
            {t('qibla.east')}
          </span>
          <span className={`absolute left-2 top-1/2 -translate-y-1/2 font-bold ${cardinalTextClass}`} style={text3DStyle}>
            {t('qibla.west')}
          </span>
          
          {/* Needle with Kaaba at the end (+0.5cm radius) */}
          <div className="absolute flex flex-col items-center origin-bottom" style={{
            transform: `rotate(${needleRotation}deg)`,
            bottom: '50%',
            height: `${needleHeight}px`,
            transformStyle: 'preserve-3d'
          }}>
            {/* Kaaba icon at needle tip with 3D effect */}
            <div className={`${kaabaTextClass} animate-pulse-glow mb-1`} style={{
              transform: 'rotate(90deg) translateZ(10px)',
              ...icon3DStyle
            }}>
              🕋
            </div>
            {/* Needle body with 3D effect */}
            <div className={isIpad ? 'w-2' : 'w-1.5'} style={{
              flex: 1,
              borderRadius: '9999px',
              background: 'linear-gradient(to top, #8B0000, #c91f16, #ff6b6b)',
              boxShadow: '0 0 20px rgba(193, 31, 22, 0.8), 0 0 40px rgba(255, 107, 107, 0.4), 2px 4px 6px rgba(0,0,0,0.4)',
              transform: 'translateZ(5px)'
            }} />
          </div>
          
          {/* Center dot with 3D effect */}
          <div 
            className="rounded-full z-10" 
            style={{
              width: `${centerDotSize}px`,
              height: `${centerDotSize}px`,
              background: 'radial-gradient(circle at 30% 30%, #ffffff, #d4af37, #8B6914)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.6)',
              transform: 'translateZ(8px)'
            }} 
          />
        </div>
        
        {/* Direction info */}
        
      </div>
    </div>;
}