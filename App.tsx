import React, { useState, useEffect, useCallback } from 'react';
import { Dropzone } from './components/Dropzone';
import { CanvasEditor } from './components/CanvasEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { Icons } from './components/Icon';
import { ImageFile, EditState, ExportSettings, ImageFormat, Language } from './types';
import { processImage, formatBytes } from './services/imageUtils';
import { useTranslation } from './locales';

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  
  // Language initialization with detection and persistence
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('collagepro-lang');
    if (saved === 'en' || saved === 'zh') return saved;
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  });
  
  const handleSetLang = (newLang: Language) => {
      setLang(newLang);
      localStorage.setItem('collagepro-lang', newLang);
  };
  
  const t = useTranslation(lang);

  const [editState, setEditState] = useState<EditState>({
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    isCropping: false,
    cropRect: null
  });

  const [settings, setSettings] = useState<ExportSettings>({
    format: ImageFormat.JPEG,
    quality: 0.9,
    maintainAspectRatio: true
  });

  // Handle file uploads
  const handleFilesDropped = useCallback(async (files: File[]) => {
    const newImages: ImageFile[] = await Promise.all(
      files.map(async (file) => {
        const previewUrl = URL.createObjectURL(file);
        const isAnimated = file.type === 'image/gif' || file.type === 'image/webp';
        
        // Get dimensions
        const img = new Image();
        img.src = previewUrl;
        await new Promise(r => img.onload = r);
        
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl,
          name: file.name,
          originalSize: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          isAnimated
        };
      })
    );

    setImages((prev) => [...prev, ...newImages]);
    if (!activeImageId && newImages.length > 0) {
      setActiveImageId(newImages[0].id);
    }
  }, [activeImageId]);

  const activeImage = images.find(img => img.id === activeImageId) || null;

  // Reset edit state when switching images
  useEffect(() => {
    setEditState({
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      isCropping: false,
      cropRect: null
    });
    setSettings(prev => ({
        ...prev,
        targetWidth: undefined,
        targetHeight: undefined,
        targetSizeMB: undefined
    }));
  }, [activeImageId]);

  const removeImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
        // Confirmed delete
        setImages(prev => prev.filter(img => img.id !== id));
        if (activeImageId === id) {
          setActiveImageId(null);
        }
        setDeletingId(null);
    } else {
        // First click
        setDeletingId(id);
        // Auto reset after 3 seconds
        setTimeout(() => {
            setDeletingId(prev => prev === id ? null : prev);
        }, 3000);
    }
  };

  const handleProcess = async () => {
    if (!activeImage) return;
    setIsProcessing(true);

    try {
      await new Promise(r => setTimeout(r, 100)); // UI update

      const blob = await processImage(activeImage.previewUrl, editState, settings);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const ext = settings.format.split('/')[1];
      const filename = activeImage.name.substring(0, activeImage.name.lastIndexOf('.')) + '_processed.' + ext;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
    } catch (error) {
      console.error("Processing failed", error);
      alert("Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSidebarDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsSidebarDragging(true);
  };
  const handleSidebarDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsSidebarDragging(false);
  };
  const handleSidebarDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsSidebarDragging(false);
      if (e.dataTransfer.files) handleFilesDropped(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* Top Bar */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0 z-40 relative">
         <div className="flex items-center gap-4">
             <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
             >
                 <Icons.Menu />
             </button>
             <div className="flex items-center gap-2">
                 <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Icons.Image />
                 </div>
                 <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    {t.title}
                 </h1>
             </div>
         </div>

         <div className="flex items-center gap-3">
             <button 
                onClick={() => handleSetLang(lang === 'en' ? 'zh' : 'en')}
                className="relative flex items-center gap-2 px-1 py-1 rounded-full bg-zinc-800 border border-zinc-700 w-24 h-8 transition-all overflow-hidden"
             >
                <div 
                    className={`absolute top-0.5 bottom-0.5 w-[50%] bg-zinc-600 rounded-full transition-all duration-300 ease-out shadow-sm ${lang === 'en' ? 'left-0.5' : 'left-[calc(50%-2px)] translate-x-[2px]'}`}
                />
                <span className={`relative z-10 w-1/2 text-[10px] font-medium text-center transition-colors ${lang === 'en' ? 'text-white' : 'text-zinc-500'}`}>EN</span>
                <span className={`relative z-10 w-1/2 text-[10px] font-medium text-center transition-colors ${lang === 'zh' ? 'text-white' : 'text-zinc-500'}`}>中文</span>
             </button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Floating Sidebar */}
        <div 
            className={`absolute top-0 bottom-0 left-0 z-30 bg-zinc-900/95 backdrop-blur-md border-r border-zinc-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ width: '280px' }}
        >
            <div 
                className={`p-3 border-b border-zinc-800 shrink-0 transition-all duration-200 ${
                    isSidebarDragging ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-transparent'
                }`}
                onDragOver={handleSidebarDragOver}
                onDragLeave={handleSidebarDragLeave}
                onDrop={handleSidebarDrop}
            >
                <label className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    isSidebarDragging 
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' 
                    : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                }`}>
                    <Icons.Upload /> 
                    <span className="text-xs font-medium">{t.addImages}</span>
                    <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                            if(e.target.files) handleFilesDropped(Array.from(e.target.files));
                        }}
                    />
                </label>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {images.length === 0 && (
                    <div className="text-center mt-10 text-zinc-500 text-xs px-4 leading-relaxed opacity-60">
                        {t.noImages}
                    </div>
            )}
            {images.map((img) => (
                <div 
                    key={img.id}
                    onClick={() => setActiveImageId(img.id)}
                    className={`group relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                    activeImageId === img.id 
                        ? 'bg-zinc-800 border-zinc-700 shadow-md' 
                        : 'border-transparent hover:bg-zinc-800/50'
                    }`}
                >
                    <div className="w-10 h-10 bg-zinc-900 rounded overflow-hidden flex-shrink-0 border border-zinc-800 relative">
                        <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{img.name}</p>
                        <p className="text-[10px] text-zinc-500">{img.width}x{img.height} • {formatBytes(img.originalSize)}</p>
                    </div>
                    <button 
                        onClick={(e) => removeImage(e, img.id)}
                        onMouseLeave={() => setDeletingId(prev => prev === img.id ? null : prev)}
                        className={`absolute right-2 p-1.5 transition-all ${deletingId === img.id ? 'text-red-500 bg-red-500/10 rounded-full opacity-100' : 'text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100'}`}
                    >
                        {deletingId === img.id ? <Icons.X /> : <Icons.Trash />}
                    </button>
                    {/* Tooltip for delete */}
                    {deletingId === img.id && (
                        <div className="absolute top-full right-0 mt-1 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded shadow-lg z-50 whitespace-nowrap">
                            {t.deleteConfirm}
                        </div>
                    )}
                </div>
            ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#09090b] relative min-w-0">
            <div 
                className="flex-1 p-0 relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]"
                onClick={() => {
                    if (activeImage && !editState.isCropping) {
                        setEditState(prev => ({...prev, isCropping: true}));
                    }
                }}
            >
                {activeImage ? (
                    <CanvasEditor 
                        image={activeImage}
                        editState={editState}
                        onEditChange={setEditState}
                    />
                ) : (
                    <div className="max-w-md w-full px-6">
                        <Dropzone onFilesDropped={handleFilesDropped} lang={lang} />
                    </div>
                )}
            </div>
        </div>

        {/* Right Sidebar: Settings */}
        <SettingsPanel 
            activeImage={activeImage}
            editState={editState}
            onEditChange={setEditState}
            settings={settings}
            onSettingsChange={setSettings}
            onProcess={handleProcess}
            isProcessing={isProcessing}
            lang={lang}
        />
      </div>
    </div>
  );
}

export default App;