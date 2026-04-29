import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import watchBackground from '@/assets/watch/background.png';

// Apple Watch screen sizes (all current models)
// Base design: SE 40mm (smallest) - scale UP to larger screens
const WATCH_SIZES = {
  'SE 40mm': { width: 324, height: 394, scale: 1.0 },
  'SE 44mm': { width: 368, height: 448, scale: 1.136 },
  'Series 11 42mm': { width: 374, height: 446, scale: 1.132 },
  'Series 11 46mm': { width: 416, height: 496, scale: 1.259 },
  'Ultra 3 49mm': { width: 422, height: 514, scale: 1.305 },
} as const;

type WatchSize = keyof typeof WATCH_SIZES;

// Mock prayer times for preview
const mockPrayerTimes = [
  { nameKey: 'prayers.fajr', time: '05:23' },
  { nameKey: 'prayers.shurooq', time: '06:45' },
  { nameKey: 'prayers.dhuhr', time: '12:30' },
  { nameKey: 'prayers.asr', time: '15:45' },
  { nameKey: 'prayers.maghrib', time: '18:15' },
  { nameKey: 'prayers.isha', time: '19:45' },
];

interface PositionConfig {
  tempTop: number;
  tempRight: number;
  tempWidth: number;
  tempHeight: number;
  tempFontSize: number;
  prayerTimesTop: number;
  prayerTimesGap: number;
  prayerTimesFontSize: number;
  counterTop: number;
  counterFontSize: number;
  buttonsTop: number;
  buttonSize: number;
  resetButtonSize: number;
  buttonGap: number;
}

function PrayerScreen({ 
  onNavigate, 
  config 
}: { 
  onNavigate: () => void;
  config: PositionConfig;
}) {
  const { t } = useTranslation();
  const temperature = '24°C';
  
  return (
    <div 
      className="relative flex flex-col h-full"
      style={{
        backgroundImage: `url(${watchBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Temperature */}
      <div 
        className="absolute flex items-center justify-center"
        style={{
          top: config.tempTop,
          right: config.tempRight,
          width: config.tempWidth,
          height: config.tempHeight,
        }}
      >
        <span 
          className="text-white font-bold drop-shadow-lg"
          style={{ fontSize: config.tempFontSize }}
        >
          {temperature}
        </span>
      </div>

      {/* Prayer times container */}
      <div 
        className="absolute left-0 right-0 px-4"
        style={{ top: config.prayerTimesTop }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: config.prayerTimesGap }}>
          {mockPrayerTimes.map((prayer, index) => (
            <div 
              key={prayer.nameKey}
              className="flex justify-between items-center"
              style={{ 
                padding: index === 4 ? '2px 8px' : '0 8px',
                background: index === 4 ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                borderRadius: index === 4 ? 4 : 0,
                border: index === 4 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              }}
            >
              <span 
                className="text-white font-medium drop-shadow-md"
                style={{ fontSize: config.prayerTimesFontSize }}
              >
                {t(prayer.nameKey)}
              </span>
              <span 
                className="text-white font-bold drop-shadow-md"
                style={{ fontSize: config.prayerTimesFontSize }}
              >
                {prayer.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrow - right side */}
      <button 
        onClick={onNavigate}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full backdrop-blur-sm"
      >
        <span className="text-white text-lg">›</span>
      </button>

      {/* Page indicator dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-white" />
        <div className="w-2 h-2 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

function CounterScreen({ 
  onNavigate,
  config 
}: { 
  onNavigate: () => void;
  config: PositionConfig;
}) {
  const [count, setCount] = useState(0);

  const increment = () => setCount(prev => Math.min(999, prev + 1));
  const decrement = () => setCount(prev => Math.max(0, prev - 1));
  const reset = () => setCount(0);

  return (
    <div 
      className="relative flex flex-col h-full"
      style={{
        backgroundImage: `url(${watchBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Counter number */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{
          top: config.counterTop,
          padding: '10px 20px',
        }}
      >
        <span
          className="font-bold text-white"
          style={{
            fontSize: config.counterFontSize,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {count.toString().padStart(3, '0')}
        </span>
      </div>

      {/* Control buttons */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center"
        style={{ top: config.buttonsTop, gap: config.buttonGap }}
      >
        {/* Decrement */}
        <button
          onClick={decrement}
          disabled={count === 0}
          className="rounded-full flex items-center justify-center bg-black/40 border border-white/30 backdrop-blur-sm disabled:opacity-40"
          style={{ width: config.buttonSize, height: config.buttonSize }}
        >
          <span className="text-white font-bold" style={{ fontSize: config.buttonSize * 0.45 }}>−</span>
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          disabled={count === 0}
          className="rounded-full flex items-center justify-center bg-black/40 border border-white/30 backdrop-blur-sm disabled:opacity-40"
          style={{ width: config.resetButtonSize, height: config.resetButtonSize }}
        >
          <span className="text-white" style={{ fontSize: config.resetButtonSize * 0.38 }}>↺</span>
        </button>

        {/* Increment */}
        <button
          onClick={increment}
          disabled={count === 999}
          className="rounded-full flex items-center justify-center bg-white/20 border border-white/30 backdrop-blur-sm disabled:opacity-40"
          style={{ width: config.buttonSize, height: config.buttonSize }}
        >
          <span className="text-white font-bold" style={{ fontSize: config.buttonSize * 0.45 }}>+</span>
        </button>
      </div>

      {/* Navigation arrow - left side */}
      <button 
        onClick={onNavigate}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full backdrop-blur-sm"
      >
        <span className="text-white text-lg">‹</span>
      </button>

      {/* Page indicator dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-white/40" />
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

function ControlSlider({ 
  label, 
  value, 
  onChange, 
  min, 
  max,
  color 
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void;
  min: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium w-24 ${color}`}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 h-2 rounded-lg cursor-pointer"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 px-1 py-0.5 text-xs bg-gray-700 text-white rounded border border-gray-600"
      />
    </div>
  );
}

export default function WatchPreview() {
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = useState<'prayer' | 'counter'>('prayer');
  const [watchSize, setWatchSize] = useState<WatchSize>('SE 40mm');
  
  // Base configuration (designed for SE 40mm - 324x394 - smallest screen) - FINAL VALUES
  const [baseConfig, setBaseConfig] = useState<PositionConfig>({
    tempTop: 132,
    tempRight: 190,
    tempWidth: 110,
    tempHeight: 34,
    tempFontSize: 24,
    prayerTimesTop: 178,
    prayerTimesGap: 2,
    prayerTimesFontSize: 16,
    counterTop: 137,
    counterFontSize: 63,
    buttonsTop: 257,
    buttonSize: 74,
    resetButtonSize: 50,
    buttonGap: 30,
  });

  const updateBaseConfig = (key: keyof PositionConfig, value: number) => {
    setBaseConfig(prev => ({ ...prev, [key]: value }));
  };

  // Scale config based on selected watch size
  const currentSize = WATCH_SIZES[watchSize];
  const config: PositionConfig = {
    tempTop: Math.round(baseConfig.tempTop * currentSize.scale),
    tempRight: Math.round(baseConfig.tempRight * currentSize.scale),
    tempWidth: Math.round(baseConfig.tempWidth * currentSize.scale),
    tempHeight: Math.round(baseConfig.tempHeight * currentSize.scale),
    tempFontSize: Math.round(baseConfig.tempFontSize * currentSize.scale),
    prayerTimesTop: Math.round(baseConfig.prayerTimesTop * currentSize.scale),
    prayerTimesGap: Math.round(baseConfig.prayerTimesGap * currentSize.scale),
    prayerTimesFontSize: Math.round(baseConfig.prayerTimesFontSize * currentSize.scale),
    counterTop: Math.round(baseConfig.counterTop * currentSize.scale),
    counterFontSize: Math.round(baseConfig.counterFontSize * currentSize.scale),
    buttonsTop: Math.round(baseConfig.buttonsTop * currentSize.scale),
    buttonSize: Math.round(baseConfig.buttonSize * currentSize.scale),
    resetButtonSize: Math.round(baseConfig.resetButtonSize * currentSize.scale),
    buttonGap: Math.round(baseConfig.buttonGap * currentSize.scale),
  };

  const toggleScreen = () => {
    setCurrentScreen(prev => prev === 'prayer' ? 'counter' : 'prayer');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-start justify-center p-8 gap-8">
      {/* Left side - Watch preview */}
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--pp-header-title-color)' }}>{t('watchPreview.title')}</h1>
        
        {/* Watch size selector */}
        <div className="flex gap-2 mb-4 flex-wrap justify-center">
          {(Object.keys(WATCH_SIZES) as WatchSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setWatchSize(size)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                watchSize === size 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        
        <p className="text-gray-400 mb-4">
          {currentSize.width} × {currentSize.height} px
          {watchSize === 'SE 40mm' && (
            <span className="text-white/60 ml-2">({t('watchPreview.sizeSmallest')})</span>
          )}
          {watchSize === 'Ultra 3 49mm' && (
            <span className="text-green-400 ml-2">({t('watchPreview.sizeBaseDesign')})</span>
          )}
        </p>
        
        {/* Watch frame */}
        <div 
          className="rounded-[50px] overflow-hidden border-4 border-gray-700 shadow-2xl"
          style={{
            width: currentSize.width,
            height: currentSize.height,
            borderRadius: Math.round(60 * currentSize.scale),
          }}
        >
          {currentScreen === 'prayer' ? (
            <PrayerScreen onNavigate={toggleScreen} config={config} />
          ) : (
            <CounterScreen onNavigate={toggleScreen} config={config} />
          )}
        </div>

        {/* Screen switcher */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => setCurrentScreen('prayer')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentScreen === 'prayer' 
                ? 'bg-white/20 text-white border border-white/30' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-transparent'
            }`}
          >
            {t('watchPreview.screenPrayer')}
          </button>
          <button
            onClick={() => setCurrentScreen('counter')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentScreen === 'counter' 
                ? 'bg-white/20 text-white border border-white/30' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-transparent'
            }`}
          >
            {t('watchPreview.screenCounter')}
          </button>
        </div>
      </div>

      {/* Right side - Position controls */}
      <div className="bg-gray-800 rounded-xl p-6 min-w-[320px]">
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--pp-header-title-color)' }}>{t('watchPreview.positionControls')}</h2>
        <p className="text-blue-400 text-xs mb-4">{t('watchPreview.baseDesignNote')}</p>
        
        {/* Temperature controls */}
        <div className="mb-6">
          <h3 className="text-red-400 text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-red-500 rounded-sm"></span>
            {t('watchPreview.temperaturePrayerScreen')}
          </h3>
          <div className="space-y-2 pl-5">
            <ControlSlider 
              label={t('watchPreview.labelTop')}
              value={baseConfig.tempTop} 
              onChange={(v) => updateBaseConfig('tempTop', v)}
              min={0} max={200}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelRight')}
              value={baseConfig.tempRight} 
              onChange={(v) => updateBaseConfig('tempRight', v)}
              min={0} max={200}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelWidth')}
              value={baseConfig.tempWidth} 
              onChange={(v) => updateBaseConfig('tempWidth', v)}
              min={40} max={150}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelHeight')}
              value={baseConfig.tempHeight} 
              onChange={(v) => updateBaseConfig('tempHeight', v)}
              min={20} max={80}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelFontSize')}
              value={baseConfig.tempFontSize} 
              onChange={(v) => updateBaseConfig('tempFontSize', v)}
              min={12} max={48}
              color="text-gray-300"
            />
          </div>
        </div>

        {/* Prayer Times controls */}
        <div className="mb-6">
          <h3 className="text-cyan-400 text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-cyan-500 rounded-sm"></span>
            {t('watchPreview.prayerTimesPrayerScreen')}
          </h3>
          <div className="space-y-2 pl-5">
            <ControlSlider 
              label={t('watchPreview.labelTop')}
              value={baseConfig.prayerTimesTop} 
              onChange={(v) => updateBaseConfig('prayerTimesTop', v)}
              min={100} max={350}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelGap')}
              value={baseConfig.prayerTimesGap} 
              onChange={(v) => updateBaseConfig('prayerTimesGap', v)}
              min={0} max={20}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelFontSize')}
              value={baseConfig.prayerTimesFontSize} 
              onChange={(v) => updateBaseConfig('prayerTimesFontSize', v)}
              min={10} max={24}
              color="text-gray-300"
            />
          </div>
        </div>

        {/* Counter controls */}
        <div className="mb-6">
          <h3 className="text-green-400 text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-green-500 rounded-sm"></span>
            {t('watchPreview.counterNumberCounterScreen')}
          </h3>
          <div className="space-y-2 pl-5">
            <ControlSlider 
              label={t('watchPreview.labelTop')}
              value={baseConfig.counterTop} 
              onChange={(v) => updateBaseConfig('counterTop', v)}
              min={50} max={250}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelFontSize')}
              value={baseConfig.counterFontSize} 
              onChange={(v) => updateBaseConfig('counterFontSize', v)}
              min={24} max={80}
              color="text-gray-300"
            />
          </div>
        </div>

        {/* Buttons controls */}
        <div>
          <h3 className="text-yellow-400 text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-yellow-500 rounded-sm"></span>
            {t('watchPreview.controlButtonsCounterScreen')}
          </h3>
          <div className="space-y-2 pl-5">
            <ControlSlider 
              label={t('watchPreview.labelTop')}
              value={baseConfig.buttonsTop} 
              onChange={(v) => updateBaseConfig('buttonsTop', v)}
              min={150} max={350}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelPlusMinusSize')}
              value={baseConfig.buttonSize} 
              onChange={(v) => updateBaseConfig('buttonSize', v)}
              min={40} max={100}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelResetSize')}
              value={baseConfig.resetButtonSize} 
              onChange={(v) => updateBaseConfig('resetButtonSize', v)}
              min={28} max={70}
              color="text-gray-300"
            />
            <ControlSlider 
              label={t('watchPreview.labelGap')}
              value={baseConfig.buttonGap} 
              onChange={(v) => updateBaseConfig('buttonGap', v)}
              min={4} max={30}
              color="text-gray-300"
            />
          </div>
        </div>

        {/* Current values display */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-2">{t('watchPreview.baseValues')}</p>
          <pre className="text-xs text-green-300 bg-gray-900 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
{`tempTop: ${baseConfig.tempTop}
tempRight: ${baseConfig.tempRight}
tempWidth: ${baseConfig.tempWidth}
tempHeight: ${baseConfig.tempHeight}
tempFontSize: ${baseConfig.tempFontSize}
prayerTimesTop: ${baseConfig.prayerTimesTop}
prayerTimesGap: ${baseConfig.prayerTimesGap}
prayerTimesFontSize: ${baseConfig.prayerTimesFontSize}
counterTop: ${baseConfig.counterTop}
counterFontSize: ${baseConfig.counterFontSize}
buttonsTop: ${baseConfig.buttonsTop}
buttonSize: ${baseConfig.buttonSize}
resetButtonSize: ${baseConfig.resetButtonSize}
buttonGap: ${baseConfig.buttonGap}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
