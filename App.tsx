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
  const [previewModal, setPreviewModal] = useState<{ url: string; filename: string; size: number } | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isGithubConfirming, setIsGithubConfirming] = useState(false);
  
  // History for undo/redo
  const [editHistory, setEditHistory] = useState<EditState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
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
    cropRect: null,
    cropAspectLocked: false
  });

  const [settings, setSettings] = useState<ExportSettings>({
    format: ImageFormat.JPEG,
    quality: 0.9,
    maintainAspectRatio: true,
    watermark: {
      enabled: false,
      text: '',
      color: '#ffffff',
      opacity: 0.3,
      fontSize: 24,
      rotation: 0,
      spacingX: 200,
      spacingY: 150
    }
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
    if (!activeImage) return;
    
    const newState = {
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      isCropping: false,
      cropRect: { x: 0, y: 0, width: activeImage.width, height: activeImage.height },
      cropAspectLocked: false
    };
    setEditState(newState);
    setEditHistory([newState]);
    setHistoryIndex(0);
    setSettings(prev => ({
        ...prev,
        targetWidth: undefined,
        targetHeight: undefined,
        targetSizeMB: undefined
    }));
  }, [activeImageId, activeImage?.width, activeImage?.height]);

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
      const ext = settings.format.split('/')[1];
      const filename = activeImage.name.substring(0, activeImage.name.lastIndexOf('.')) + '_processed.' + ext;
      
      // Show preview modal
      setPreviewModal({ url, filename, size: blob.size });
      
    } catch (error) {
      console.error("Processing failed", error);
      alert("Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!previewModal) return;
    
    const link = document.createElement('a');
    link.href = previewModal.url;
    link.download = previewModal.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    handleClosePreview();
  };

  const handleClosePreview = () => {
    if (previewModal) {
      setIsClosingModal(true);
      setTimeout(() => {
        URL.revokeObjectURL(previewModal.url);
        setPreviewModal(null);
        setIsClosingModal(false);
      }, 250);
    }
  };

  // Add state to history
  const addToHistory = useCallback((state: EditState) => {
    setEditHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      // Limit history to 50 items
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditState(editHistory[newIndex]);
    }
  }, [historyIndex, editHistory]);
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditState(editHistory[newIndex]);
    }
  }, [historyIndex, editHistory]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          handleRedo();
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleReset = () => {
    if (!activeImage) return;
    const newState = {
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      isCropping: false,
      cropRect: { x: 0, y: 0, width: activeImage.width, height: activeImage.height },
      cropAspectLocked: false
    };
    setEditState(newState);
    addToHistory(newState);
    setSettings({
      format: ImageFormat.JPEG,
      quality: 0.9,
      maintainAspectRatio: true,
      targetWidth: undefined,
      targetHeight: undefined,
      targetSizeMB: undefined,
      watermark: {
        enabled: false,
        text: '',
        color: '#ffffff',
        opacity: 0.3,
        fontSize: 24,
        rotation: 0,
        spacingX: 200,
        spacingY: 150
      }
    });
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
    <div className="flex flex-col bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      
      {/* Top Bar */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-2 sm:px-4 justify-between shrink-0 z-40 relative">
         <div className="flex items-center gap-2 sm:gap-4 min-w-0">
             <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                aria-label="Toggle sidebar"
             >
                 <Icons.Menu />
             </button>
             <div className="flex items-center gap-2 min-w-0">
                 <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
                    <Icons.Image />
                 </div>
                 <h1 className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent truncate hidden sm:block">
                    {t.title}
                 </h1>
             </div>
         </div>

         <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
             <button 
                onClick={() => handleSetLang(lang === 'en' ? 'zh' : 'en')}
                className="relative flex items-center gap-2 px-1 py-1 rounded-full bg-zinc-800 border border-zinc-700 w-16 sm:w-24 h-8 transition-all overflow-hidden"
             >
                <div 
                    className={`absolute top-0.5 bottom-0.5 w-[50%] bg-zinc-600 rounded-full transition-all duration-300 ease-out shadow-sm ${lang === 'en' ? 'left-0.5' : 'left-[calc(50%-2px)] translate-x-[2px]'}`}
                />
                <span className={`relative z-10 w-1/2 text-[9px] sm:text-[10px] font-medium text-center transition-colors ${lang === 'en' ? 'text-white' : 'text-zinc-500'}`}>EN</span>
                <span className={`relative z-10 w-1/2 text-[9px] sm:text-[10px] font-medium text-center transition-colors ${lang === 'zh' ? 'text-white' : 'text-zinc-500'}`}>中文</span>
             </button>
             
             <div className="relative">
               <div className="flex items-center gap-0">
                 <button
                    onClick={handleProcess}
                    disabled={isProcessing || !activeImage}
                    className="relative px-3 sm:px-5 py-2 rounded-l-lg font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed group overflow-hidden border border-indigo-500/50 hover:border-indigo-400 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                 >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 group-hover:from-indigo-500/90 group-hover:to-indigo-600/90 transition-all" />
                    <div className="relative flex items-center gap-2 text-white">
                      {isProcessing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span className="hidden sm:inline">{t.processing}</span>
                        </>
                      ) : (
                        <>
                          <Icons.Download />
                          <span className="hidden sm:inline">{t.convert}</span>
                        </>
                      )}
                    </div>
                 </button>
                 
                 <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExportMenu(!showExportMenu);
                    }}
                    disabled={!activeImage}
                    className="relative p-2 rounded-r-lg bg-indigo-600/90 hover:bg-indigo-500/90 border border-l-0 border-indigo-500/50 hover:border-indigo-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                 >
                    <Icons.Settings />
                 </button>
               </div>
               
               {showExportMenu && activeImage && (
                 <div 
                   className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                   onClick={(e) => e.stopPropagation()}
                 >
                   <div className="p-4">
                     <SettingsPanel 
                       activeImage={activeImage}
                       editState={editState}
                       onEditChange={setEditState}
                       settings={settings}
                       onSettingsChange={setSettings}
                       onProcess={handleProcess}
                       isProcessing={isProcessing}
                       lang={lang}
                       onReset={handleReset}
                     />
                   </div>
                 </div>
               )}
             </div>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative" onClick={() => showExportMenu && setShowExportMenu(false)}>
        {/* Spacer for Sidebar - only on desktop */}
        <div 
            className="shrink-0 transition-all duration-300 ease-in-out hidden md:block"
            style={{ width: isSidebarOpen ? '320px' : '0px' }}
        />
        
        {/* Floating Sidebar */}
        <div 
            className={`absolute top-0 bottom-0 left-0 z-30 bg-zinc-900/95 backdrop-blur-md border-r border-zinc-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ width: '320px' }}
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
                      {deletingId === img.id && (
                          <div className="absolute top-full right-0 mt-1 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded shadow-lg z-50 whitespace-nowrap">
                              {t.deleteConfirm}
                          </div>
                      )}
                  </div>
              ))}
            </div>
            
            {/* Author Info */}
            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-500 mb-0.5">{t.author}</p>
                  <p className="text-sm font-medium text-zinc-300 truncate">Arminosi</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (isGithubConfirming) {
                        window.open('https://github.com/Arminosi/PConverter', '_blank');
                        setIsGithubConfirming(false);
                      } else {
                        setIsGithubConfirming(true);
                        setTimeout(() => setIsGithubConfirming(false), 3000);
                      }
                    }}
                    onMouseLeave={() => setIsGithubConfirming(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      isGithubConfirming
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <span>GitHub</span>
                  </button>
                  {isGithubConfirming && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                      <div className="relative">
                        {t.githubConfirm}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-indigo-600"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#09090b] relative min-w-0">
            <div 
                className="absolute inset-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
                style={{
                  backgroundImage: `
                    radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                    radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
                    linear-gradient(to bottom right, #18181b, #27272a)
                  `,
                  backgroundSize: '20px 20px, 100% 100%, 100% 100%, 100% 100%',
                  backgroundPosition: '0 0, 0 0, 0 0, 0 0'
                }}
                onClick={() => {
                    // Close sidebar on mobile when clicking canvas area
                    if (isSidebarOpen && window.innerWidth < 768) {
                        setSidebarOpen(false);
                    }
                    // Enable cropping if not already active
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
                        sidebarOpen={isSidebarOpen}
                        settings={settings}
                    />
                ) : (
                    <div className="max-w-md w-full px-6">
                        <Dropzone onFilesDropped={handleFilesDropped} lang={lang} />
                    </div>
                )}
                
                {/* Floating Canvas Toolbar */}
                {activeImage && (
                  <div 
                    className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-lg sm:rounded-xl shadow-2xl z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Mobile Layout - Stacked */}
                    <div className="flex flex-col gap-2 p-2 sm:hidden">
                      {/* Row 1: Undo/Redo & Crop Controls */}
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={handleUndo}
                          disabled={historyIndex <= 0}
                          className="p-2 bg-zinc-800 active:bg-zinc-700 rounded-md text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex justify-center"
                          title={`${t.undo} (Ctrl+Z)`}
                        >
                          <Icons.Undo />
                        </button>
                        <button 
                          onClick={handleRedo}
                          disabled={historyIndex >= editHistory.length - 1}
                          className="p-2 bg-zinc-800 active:bg-zinc-700 rounded-md text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex justify-center"
                          title={`${t.redo} (Ctrl+Shift+Z)`}
                        >
                          <Icons.Redo />
                        </button>
                        <div className="flex-1 flex items-center gap-0">
                          <button 
                            onClick={() => {
                              const newState = { ...editState, isCropping: !editState.isCropping };
                              setEditState(newState);
                              addToHistory(newState);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-l-md transition-all border text-xs font-medium whitespace-nowrap min-w-0 max-w-[120px] ${
                              editState.isCropping
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                : 'bg-zinc-800 border-zinc-700 active:bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            <Icons.Crop className="flex-shrink-0" />
                            <span className="truncate">{editState.isCropping ? t.cropInfo : t.crop}</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newState = { ...editState, cropAspectLocked: !editState.cropAspectLocked };
                              setEditState(newState);
                              addToHistory(newState);
                            }}
                            disabled={!editState.isCropping}
                            className={`flex items-center justify-center w-10 h-10 rounded-r-md transition-all border border-l-0 ${
                              !editState.isCropping
                                ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                                : editState.cropAspectLocked
                                  ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' 
                                  : 'border-indigo-500 text-zinc-300 active:bg-zinc-800'
                            }`}
                            title={editState.cropAspectLocked ? t.cropLocked : t.cropUnlocked}
                          >
                            <Icons.Link />
                          </button>
                        </div>
                      </div>
                      {/* Row 2: Transform & Reset */}
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => {
                            const newState = { ...editState, rotation: (editState.rotation + 90) % 360 };
                            setEditState(newState);
                            addToHistory(newState);
                          }}
                          className="flex-1 p-2 bg-zinc-800 active:bg-zinc-700 rounded-md text-zinc-300 border border-zinc-700 transition-colors flex justify-center"
                          title={t.rotate}
                        >
                          <Icons.RotateCw />
                        </button>
                        <button 
                          onClick={() => {
                            const newState = { ...editState, flipX: !editState.flipX };
                            setEditState(newState);
                            addToHistory(newState);
                          }}
                          className={`flex-1 p-2 rounded-md border transition-all flex justify-center ${
                            editState.flipX
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'bg-zinc-800 border-zinc-700 active:bg-zinc-700 text-zinc-300'
                          }`}
                          title={t.flipH}
                        >
                          <Icons.FlipH />
                        </button>
                        <button 
                          onClick={() => {
                            const newState = { ...editState, flipY: !editState.flipY };
                            setEditState(newState);
                            addToHistory(newState);
                          }}
                          className={`flex-1 p-2 rounded-md border transition-all flex justify-center ${
                            editState.flipY
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'bg-zinc-800 border-zinc-700 active:bg-zinc-700 text-zinc-300'
                          }`}
                          title={t.flipV}
                        >
                          <Icons.FlipV />
                        </button>
                        <div className="relative">
                          <button 
                            onClick={() => {
                              if (isResetConfirming) {
                                handleReset();
                                setIsResetConfirming(false);
                              } else {
                                setIsResetConfirming(true);
                                setTimeout(() => setIsResetConfirming(false), 3000);
                              }
                            }}
                            onMouseLeave={() => setIsResetConfirming(false)}
                            className={`flex-1 p-2 rounded-md border transition-all flex justify-center ${
                              isResetConfirming
                                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' 
                                : 'bg-zinc-800/50 border-zinc-700 active:bg-zinc-800 text-zinc-400'
                            }`}
                            title={t.reset}
                          >
                            <Icons.RotateCcw />
                          </button>
                          {isResetConfirming && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <div className="relative">
                                {t.resetConfirm}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-600"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Desktop Layout - Single Row */}
                    <div className="hidden sm:flex items-center justify-center gap-2 p-3">
                      {/* Undo/Redo */}
                      <button 
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border text-sm font-medium bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        title={`${t.undo} (Ctrl+Z)`}
                      >
                        <Icons.Undo />
                        <span className="hidden md:inline">{t.undo}</span>
                      </button>
                      <button 
                        onClick={handleRedo}
                        disabled={historyIndex >= editHistory.length - 1}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border text-sm font-medium bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        title={`${t.redo} (Ctrl+Shift+Z)`}
                      >
                        <Icons.Redo />
                        <span className="hidden md:inline">{t.redo}</span>
                      </button>
                      
                      <div className="h-6 w-px bg-zinc-700"></div>
                      
                      <div className="flex items-center gap-0">
                        <button 
                          onClick={() => {
                            const newState = { ...editState, isCropping: !editState.isCropping };
                            setEditState(newState);
                            addToHistory(newState);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg transition-all border text-sm font-medium h-10 whitespace-nowrap ${
                            editState.isCropping
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                              : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          <Icons.Crop className="flex-shrink-0" />
                          <span className="hidden md:inline">{editState.isCropping ? t.cropInfo : t.crop}</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newState = { ...editState, cropAspectLocked: !editState.cropAspectLocked };
                            setEditState(newState);
                            addToHistory(newState);
                          }}
                          disabled={!editState.isCropping}
                          className={`flex items-center justify-center w-10 h-10 rounded-r-lg transition-all border border-l-0 ${
                            !editState.isCropping
                              ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                              : editState.cropAspectLocked
                                ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' 
                                : 'border-indigo-500 text-zinc-300 hover:bg-zinc-800'
                          }`}
                          title={editState.cropAspectLocked ? t.cropLocked : t.cropUnlocked}
                        >
                          <Icons.Link />
                        </button>
                      </div>

                      <div className="h-6 w-px bg-zinc-700"></div>

                      <button 
                        onClick={() => {
                          const newState = { ...editState, rotation: (editState.rotation + 90) % 360 };
                          setEditState(newState);
                          addToHistory(newState);
                        }}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 border border-zinc-700 transition-colors"
                        title={t.rotate}
                      >
                        <Icons.RotateCw />
                      </button>
                      <button 
                        onClick={() => {
                          const newState = { ...editState, flipX: !editState.flipX };
                          setEditState(newState);
                          addToHistory(newState);
                        }}
                        className={`p-2 rounded-lg border transition-all ${
                          editState.flipX
                            ? 'bg-indigo-600 border-indigo-500 text-white' 
                            : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title={t.flipH}
                      >
                        <Icons.FlipH />
                      </button>
                      <button 
                        onClick={() => {
                          const newState = { ...editState, flipY: !editState.flipY };
                          setEditState(newState);
                          addToHistory(newState);
                        }}
                        className={`p-2 rounded-lg border transition-all ${
                          editState.flipY
                            ? 'bg-indigo-600 border-indigo-500 text-white' 
                            : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title={t.flipV}
                      >
                        <Icons.FlipV />
                      </button>

                      <div className="h-6 w-px bg-zinc-700"></div>

                      <div className="relative">
                        <button 
                          onClick={() => {
                            if (isResetConfirming) {
                              handleReset();
                              setIsResetConfirming(false);
                            } else {
                              setIsResetConfirming(true);
                              setTimeout(() => setIsResetConfirming(false), 3000);
                            }
                          }}
                          onMouseLeave={() => setIsResetConfirming(false)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm whitespace-nowrap ${
                            isResetConfirming
                              ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' 
                              : 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                          }`}
                          title={t.reset}
                        >
                          <Icons.RotateCcw />
                          <span className="hidden md:inline">{t.reset}</span>
                        </button>
                        {isResetConfirming && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="relative">
                              {t.resetConfirm}
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-red-600"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
            </div>
        </div>

      </div>

      {/* Preview Modal */}
      {previewModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-250 ease-out"
          onClick={handleClosePreview}
          style={{
            animation: isClosingModal ? 'fadeOut 0.25s ease-out' : 'fadeIn 0.3s ease-out',
            opacity: isClosingModal ? 0 : 1
          }}
        >
          <div 
            className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: isClosingModal ? 'scaleOut 0.25s ease-out' : 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isClosingModal ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
              opacity: isClosingModal ? 0 : 1
            }}
          >
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
              }
              @keyframes scaleIn {
                from { 
                  opacity: 0;
                  transform: scale(0.8) translateY(20px);
                }
                to { 
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
              }
              @keyframes scaleOut {
                from { 
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
                to { 
                  opacity: 0;
                  transform: scale(0.9) translateY(10px);
                }
              }
            `}</style>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-white">{t.previewTitle}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {previewModal.filename} • {formatBytes(previewModal.size)}
                </p>
              </div>
              <button
                onClick={handleClosePreview}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <Icons.X />
              </button>
            </div>

            {/* Image Preview */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]">
              <img 
                src={previewModal.url} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                onClick={handleClosePreview}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDownload}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
              >
                <Icons.Download />
                {t.download}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;