import React, { useMemo } from 'react';
import { EditState, ExportSettings, ImageFile, ImageFormat, Language } from '../types';
import { Icons } from './Icon';
import { useTranslation } from '../locales';

interface SettingsPanelProps {
  activeImage: ImageFile | null;
  editState: EditState;
  onEditChange: (newState: EditState) => void;
  settings: ExportSettings;
  onSettingsChange: (newSettings: ExportSettings) => void;
  onProcess: () => void;
  isProcessing: boolean;
  lang: Language;
  onReset: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  activeImage,
  editState,
  onEditChange,
  settings,
  onSettingsChange,
  onProcess,
  isProcessing,
  lang,
  onReset
}) => {
  const t = useTranslation(lang);
  const [isResetConfirming, setIsResetConfirming] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<'export' | 'watermark'>('export');
  
  // Auto-set default unit based on image size
  const defaultUnit = React.useMemo(() => {
    if (!activeImage) return 'KB';
    const sizeMB = activeImage.originalSize / (1024 * 1024);
    return sizeMB > 10 ? 'MB' : 'KB';
  }, [activeImage]);
  
  const [sizeUnit, setSizeUnit] = React.useState<'KB' | 'MB'>(defaultUnit);
  
  // Update unit when image changes
  React.useEffect(() => {
    setSizeUnit(defaultUnit);
  }, [defaultUnit]);

  // --- Dynamic Target Size Logic ---
  const activeMB = activeImage ? activeImage.originalSize / (1024 * 1024) : 0;
  
  // The absolute maximum limit for the slider (Original size, but at least 1MB)
  const maxLimitMB = useMemo(() => {
    return Math.max(1.0, activeMB);
  }, [activeMB]);

  // Convert Slider Value (0-100) to MB (Non-linear)
  // 0-50 range -> 0.1MB to 1.0MB
  // 50-100 range -> 1.0MB to maxLimitMB
  const getMbFromSlider = (val: number) => {
    if (val <= 50) {
      // Linear from 0.1 to 1.0
      return 0.1 + (val / 50) * 0.9;
    } else {
      // Linear from 1.0 to maxLimitMB
      return 1.0 + ((val - 50) / 50) * (maxLimitMB - 1.0);
    }
  };

  // Convert MB to Slider Value (0-100)
  const getSliderFromMb = (mb: number) => {
    if (mb <= 1.0) {
        return ((mb - 0.1) / 0.9) * 50;
    } else {
        return 50 + ((mb - 1.0) / (maxLimitMB - 1.0)) * 50;
    }
  };

  const currentSliderValue = useMemo(() => {
    if (!settings.targetSizeMB) return 0;
    const sliderVal = getSliderFromMb(settings.targetSizeMB);
    return Math.max(0, Math.min(100, sliderVal));
  }, [settings.targetSizeMB, maxLimitMB]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (val === 0) {
        onSettingsChange({ ...settings, targetSizeMB: undefined });
    } else {
        const mbValue = getMbFromSlider(val);
        onSettingsChange({ ...settings, targetSizeMB: Math.min(mbValue, maxLimitMB) });
    }
  };

  const handleManualSizeInput = (value: string) => {
    if (value === '') {
      onSettingsChange({ ...settings, targetSizeMB: undefined });
    } else {
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0.1 && num <= maxLimitMB) {
        onSettingsChange({ ...settings, targetSizeMB: num });
      }
    }
  };


  if (!activeImage) {
    return (
      <div className="w-80 flex-shrink-0 h-full border-l border-zinc-800 bg-zinc-900/50 p-6 flex flex-col items-center justify-center text-zinc-500">
        <p>{t.workspace}</p>
      </div>
    );
  }

  // Handle resolution change with aspect ratio lock
  const handleDimensionChange = (key: 'targetWidth' | 'targetHeight', value: string) => {
    const val = parseInt(value);
    const num = isNaN(val) ? undefined : val;
    
    let newSettings = { ...settings, [key]: num };

    if (settings.maintainAspectRatio && num && activeImage) {
      // Calculate other dimension
      const w = editState.cropRect ? editState.cropRect.width : activeImage.width;
      const h = editState.cropRect ? editState.cropRect.height : activeImage.height;
      const ratio = w / h;

      if (key === 'targetWidth') {
        newSettings.targetHeight = Math.round(num / ratio);
      } else {
        newSettings.targetWidth = Math.round(num * ratio);
      }
    }
    
    onSettingsChange(newSettings);
  };

  return (
    <div className="w-full h-full bg-transparent flex flex-col">
      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'export'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {t.exportSettings}
        </button>
        <button
          onClick={() => setActiveTab('watermark')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'watermark'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {t.watermark}
        </button>
      </div>

      <div className="p-4 pt-2 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'export' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t.exportSettings}</label>
          </div>

          {/* Current Image Info */}
          <div className="relative bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8"></div>
            <div className="relative space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-700/50">
                <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                  <Icons.Image />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{activeImage.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 rounded-lg p-2.5 border border-zinc-700/30">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">文件大小</div>
                  <div className="text-sm font-semibold text-indigo-400 font-mono">{(activeImage.originalSize / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2.5 border border-zinc-700/30">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">分辨率</div>
                  <div className="text-sm font-semibold text-zinc-200 font-mono">{activeImage.width} × {activeImage.height}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">{t.format}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'JPG', val: ImageFormat.JPEG },
                { label: 'PNG', val: ImageFormat.PNG },
                { label: 'WEBP', val: ImageFormat.WEBP },
              ].map((fmt) => (
                <button
                  key={fmt.val}
                  onClick={() => onSettingsChange({ ...settings, format: fmt.val })}
                  className={`text-xs font-medium py-2 rounded border transition-all ${
                    settings.format === fmt.val
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Size (MB/KB) */}
          <div className="space-y-2">
             <div className="flex justify-between items-center text-sm text-zinc-300">
                <label>{t.targetSize}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputValue !== '' ? inputValue : (
                      settings.targetSizeMB 
                        ? sizeUnit === 'KB'
                          ? Math.round(settings.targetSizeMB * 1024).toString()
                          : settings.targetSizeMB.toFixed(2)
                        : ''
                    )}
                    placeholder={t.auto}
                    onFocus={(e) => {
                      // Set input value on focus to allow editing
                      if (settings.targetSizeMB) {
                        const displayValue = sizeUnit === 'KB'
                          ? Math.round(settings.targetSizeMB * 1024).toString()
                          : settings.targetSizeMB.toFixed(2);
                        setInputValue(displayValue);
                      }
                    }}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      setInputValue('');
                      
                      if (val === '') {
                        onSettingsChange({ ...settings, targetSizeMB: undefined });
                        return;
                      }
                      
                      const num = parseFloat(val);
                      if (!isNaN(num) && num > 0) {
                        const mbValue = sizeUnit === 'KB' ? num / 1024 : num;
                        if (mbValue >= 0.1 && mbValue <= maxLimitMB) {
                          onSettingsChange({ ...settings, targetSizeMB: mbValue });
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-16 text-right bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-indigo-400 font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={() => setSizeUnit(sizeUnit === 'KB' ? 'MB' : 'KB')}
                    className="text-xs text-zinc-500 hover:text-indigo-400 font-medium min-w-[24px] cursor-pointer transition-colors px-1 py-0.5 rounded hover:bg-zinc-800"
                    title="点击切换单位"
                  >
                    {sizeUnit}
                  </button>
                </div>
             </div>
             {settings.format !== ImageFormat.PNG ? (
                <div className="flex gap-3 items-center">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={currentSliderValue}
                        onChange={handleSliderChange}
                        className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
             ) : (
                 <p className="text-xs text-zinc-500 italic">{t.lossless}</p>
             )}
             <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>{sizeUnit === 'KB' ? '100 KB' : '0.1 MB'}</span>
                 <span>{sizeUnit === 'KB' ? `${Math.round(maxLimitMB * 1024)} KB` : `${maxLimitMB.toFixed(1)} MB`}</span>
             </div>
          </div>

          {/* Resolution */}
           <div className="space-y-2">
            <div className="flex items-center justify-between">
                 <label className="text-sm text-zinc-300">{t.dimensions}</label>
                 <button 
                    onClick={() => onSettingsChange({...settings, maintainAspectRatio: !settings.maintainAspectRatio})}
                    className={`p-1 rounded transition-colors ${settings.maintainAspectRatio ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title={t.maintainRatio}
                 >
                     {settings.maintainAspectRatio ? <Icons.Link /> : <Icons.Unlock />}
                 </button>
            </div>
            
            <div className="flex gap-2">
               <div className="flex-1 relative group">
                 <span className="absolute left-2 top-2 text-xs text-zinc-500 font-medium group-focus-within:text-indigo-500">{t.width}</span>
                 <input 
                    type="number" 
                    value={settings.targetWidth || ''} 
                    placeholder={t.auto}
                    onChange={(e) => handleDimensionChange('targetWidth', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 pl-8 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                 />
               </div>
               <div className="flex-1 relative group">
                 <span className="absolute left-2 top-2 text-xs text-zinc-500 font-medium group-focus-within:text-indigo-500">{t.height}</span>
                 <input 
                    type="number" 
                    value={settings.targetHeight || ''} 
                    placeholder={t.auto}
                    onChange={(e) => handleDimensionChange('targetHeight', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 pl-8 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                 />
               </div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 px-1">
                <span>{t.original}: {activeImage.width} x {activeImage.height}</span>
            </div>
          </div>
        
        {/* Animated Warning */}
        {activeImage.isAnimated && (
           <>
            <div className="h-px bg-zinc-800" />
            <div className="space-y-2">
                 <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Icons.Film /> {t.animated}
                 </label>
                 <div className="p-3 bg-indigo-900/20 border border-indigo-500/20 rounded text-xs text-indigo-300">
                    {t.animatedInfo}
                 </div>
            </div>
           </>
        )}
        </div>
        )}

        {activeTab === 'watermark' && (
        <div className="space-y-4">
          {/* Watermark Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-300">{t.enableWatermark}</label>
            <button 
              onClick={() => onSettingsChange({
                ...settings, 
                watermark: { ...settings.watermark, enabled: !settings.watermark.enabled }
              })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                settings.watermark.enabled
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {settings.watermark.enabled ? '✓ ' + t.enableWatermark : t.enableWatermark}
            </button>
          </div>
          
          {settings.watermark.enabled && (
            <>
              <div className="h-px bg-zinc-800" />
              
              {/* Text Input */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">{t.watermarkText}</label>
                <input 
                  type="text"
                  value={settings.watermark.text}
                  placeholder={t.watermarkTextPlaceholder}
                  onChange={(e) => onSettingsChange({
                    ...settings,
                    watermark: { ...settings.watermark, text: e.target.value }
                  })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              
              {/* Color */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">{t.watermarkColor}</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color"
                    value={settings.watermark.color}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      watermark: { ...settings.watermark, color: e.target.value }
                    })}
                    className="w-12 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-zinc-800"
                  />
                  <input 
                    type="text"
                    value={settings.watermark.color}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      watermark: { ...settings.watermark, color: e.target.value }
                    })}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              
              {/* Opacity */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">{t.watermarkOpacity}</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.watermark.opacity}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      watermark: { ...settings.watermark, opacity: parseFloat(e.target.value) }
                    })}
                    className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-sm text-zinc-400 font-mono w-12 text-right">
                    {Math.round(settings.watermark.opacity * 100)}%
                  </span>
                </div>
              </div>
              
              {/* Rotation */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">{t.watermarkRotation}</label>
                {/* Preset Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[0, -45, 45, 90].map((angle) => (
                    <button
                      key={angle}
                      onClick={() => onSettingsChange({
                        ...settings,
                        watermark: { ...settings.watermark, rotation: angle }
                      })}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        settings.watermark.rotation === angle
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={settings.watermark.rotation}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      watermark: { ...settings.watermark, rotation: parseInt(e.target.value) }
                    })}
                    className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-sm text-zinc-400 font-mono w-12 text-right">
                    {settings.watermark.rotation}°
                  </span>
                </div>
              </div>
              
              {/* Spacing */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">{t.watermarkSpacing}</label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{t.watermarkSpacingX}</span>
                      <input 
                        type="number"
                        min="50"
                        max="1000"
                        value={settings.watermark.spacingX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 50 && val <= 1000) {
                            onSettingsChange({
                              ...settings,
                              watermark: { ...settings.watermark, spacingX: val }
                            });
                          }
                        }}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 font-mono text-right focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <input 
                      type="range"
                      min="50"
                      max="1000"
                      step="10"
                      value={settings.watermark.spacingX}
                      onChange={(e) => onSettingsChange({
                        ...settings,
                        watermark: { ...settings.watermark, spacingX: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{t.watermarkSpacingY}</span>
                      <input 
                        type="number"
                        min="50"
                        max="1000"
                        value={settings.watermark.spacingY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 50 && val <= 1000) {
                            onSettingsChange({
                              ...settings,
                              watermark: { ...settings.watermark, spacingY: val }
                            });
                          }
                        }}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 font-mono text-right focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <input 
                      type="range"
                      min="50"
                      max="1000"
                      step="10"
                      value={settings.watermark.spacingY}
                      onChange={(e) => onSettingsChange({
                        ...settings,
                        watermark: { ...settings.watermark, spacingY: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
};