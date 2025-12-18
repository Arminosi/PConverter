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
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  activeImage,
  editState,
  onEditChange,
  settings,
  onSettingsChange,
  onProcess,
  isProcessing,
  lang
}) => {
  const t = useTranslation(lang);

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

  const currentSliderValue = settings.targetSizeMB ? getSliderFromMb(settings.targetSizeMB) : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (val === 0) {
        onSettingsChange({ ...settings, targetSizeMB: undefined });
    } else {
        onSettingsChange({ ...settings, targetSizeMB: getMbFromSlider(val) });
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
    <div className="w-80 flex-shrink-0 h-full border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-y-auto custom-scrollbar relative z-20">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100">{t.adjustments}</h2>
      </div>

      <div className="p-4 space-y-8 flex-1">
        {/* Transform & Crop */}
        <div className="space-y-4">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t.transform}</label>
          
          {/* Crop Toggle */}
           <button 
              onClick={() => onEditChange({ ...editState, isCropping: !editState.isCropping })}
              className={`w-full flex items-center justify-center gap-2 p-2 rounded transition-colors border ${
                  editState.isCropping 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Icons.Crop />
              {editState.isCropping ? t.cropInfo : t.crop}
            </button>

          <div className="flex gap-2">
            <button 
              onClick={() => onEditChange({ ...editState, rotation: (editState.rotation + 90) % 360 })}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 p-2 rounded text-zinc-300 flex justify-center border border-zinc-700"
              title={t.rotate}
            >
              <Icons.RotateCw />
            </button>
            <button 
              onClick={() => onEditChange({ ...editState, flipX: !editState.flipX })}
              className={`flex-1 p-2 rounded flex justify-center border transition-colors ${editState.flipX ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'}`}
              title={t.flipH}
            >
              <Icons.FlipH />
            </button>
            <button 
              onClick={() => onEditChange({ ...editState, flipY: !editState.flipY })}
              className={`flex-1 p-2 rounded flex justify-center border transition-colors ${editState.flipY ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'}`}
              title={t.flipV}
            >
              <Icons.FlipV />
            </button>
          </div>
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Export Settings */}
        <div className="space-y-5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t.exportSettings}</label>

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

          {/* Target Size (MB) */}
          <div className="space-y-2">
             <div className="flex justify-between text-sm text-zinc-300">
                <label>{t.targetSize}</label>
                <span className="text-indigo-400 font-mono text-xs">
                    {settings.targetSizeMB ? `${settings.targetSizeMB.toFixed(2)} MB` : t.auto}
                </span>
             </div>
             {settings.format !== ImageFormat.PNG ? (
                <div className="flex gap-3 items-center">
                    <input
                        type="range"
                        min="0"
                        max="100" // Normalised 0-100 range
                        step="0.1"
                        value={currentSliderValue}
                        onChange={handleSliderChange}
                        className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    {settings.targetSizeMB === undefined && (
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Max Q</span>
                    )}
                </div>
             ) : (
                 <p className="text-xs text-zinc-500 italic">{t.lossless}</p>
             )}
             <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>0.1 MB</span>
                 <span>{maxLimitMB.toFixed(1)} MB</span>
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

      <div className="p-4 border-t border-zinc-800 bg-zinc-900 z-10 shrink-0">
        <button
          onClick={onProcess}
          disabled={isProcessing}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {isProcessing ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <Icons.Download />
              {t.convert}
            </>
          )}
        </button>
      </div>
    </div>
  );
};