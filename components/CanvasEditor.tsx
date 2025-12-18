import React, { useRef, useEffect, useState } from 'react';
import { CropRect, EditState, ImageFile, ExportSettings } from '../types';

interface CanvasEditorProps {
  image: ImageFile;
  editState: EditState;
  onEditChange: (newState: EditState) => void;
  sidebarOpen?: boolean;
  settings: ExportSettings;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ image, editState, onEditChange, sidebarOpen, settings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ 
    fitScale: 1, 
    viewportW: 0, 
    viewportH: 0,
    userScale: 1,
    offsetX: 0,
    offsetY: 0
  });
  
  // Crop Dragging State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    handle: string | null; // 'nw', 'se', 'body', 'n', 's', 'e', 'w'
    startX: number;
    startY: number;
    startRect: CropRect | null;
  }>({ isDragging: false, handle: null, startX: 0, startY: 0, startRect: null });
  
  // Pan/Zoom State
  const [panState, setPanState] = useState<{
    isPanning: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({ isPanning: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });
  
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  // Initialize or reset crop when image changes
  useEffect(() => {
    if(!image) return;
    if (!editState.cropRect) {
      onEditChange({
        ...editState,
        cropRect: { x: 0, y: 0, width: image.width, height: image.height }
      });
    }
  }, [image.id, editState.cropRect]);

  // Handle Resize & Fit Calculation
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && image) {
        const vw = containerRef.current.clientWidth;
        const vh = containerRef.current.clientHeight;
        
        // Calculate Bounding Box of Rotated Image
        const rad = (editState.rotation * Math.PI) / 180;
        const c = Math.abs(Math.cos(rad));
        const s = Math.abs(Math.sin(rad));
        
        const bbW = image.width * c + image.height * s;
        const bbH = image.width * s + image.height * c;

        // Determine Scale to fit viewport with padding
        // Increased padding to 80px to ensure handles (which hang off the edge) aren't clipped
        // Add extra bottom padding for the floating toolbar
        const padding = 80; 
        const toolbarHeight = window.innerWidth < 640 ? 160 : 120; // Mobile vs Desktop toolbar height with extra spacing
        const availW = Math.max(10, vw - padding);
        const availH = Math.max(10, vh - padding - toolbarHeight);

        const scaleX = availW / bbW;
        const scaleY = availH / bbH;
        
        const fitScale = Math.min(scaleX, scaleY);

        setViewState(prev => ({
          ...prev,
          fitScale: fitScale > 0 ? fitScale : 1,
          viewportW: vw,
          viewportH: vh
        }));
      }
    };

    // Delay to allow sidebar animation to complete
    const timer = setTimeout(updateDimensions, 320);
    updateDimensions();
    
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [image, editState.rotation, sidebarOpen]);

  // Handle Pan Start
  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't pan if cropping or if clicking on crop handles
    if (editState.isCropping || dragState.isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setPanState({
      isPanning: true,
      startX: clientX,
      startY: clientY,
      startOffsetX: viewState.offsetX,
      startOffsetY: viewState.offsetY
    });
  };

  // Handle Pan Move
  const handlePanMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!panState.isPanning) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - panState.startX;
    const deltaY = clientY - panState.startY;
    
    setViewState(prev => ({
      ...prev,
      offsetX: panState.startOffsetX + deltaX,
      offsetY: panState.startOffsetY + deltaY
    }));
  };

  // Handle Pan End
  const handlePanEnd = () => {
    setPanState(prev => ({ ...prev, isPanning: false }));
  };

  // Handle Pinch Zoom
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (lastPinchDistance !== null) {
        const scaleDelta = distance / lastPinchDistance;
        const newScale = Math.max(0.5, Math.min(3, viewState.userScale * scaleDelta));
        
        setViewState(prev => ({
          ...prev,
          userScale: newScale
        }));
      }
      
      setLastPinchDistance(distance);
    } else {
      setLastPinchDistance(null);
      handlePanMove(e);
    }
  };

  // Handle Touch End
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setLastPinchDistance(null);
    }
    if (e.touches.length === 0) {
      handlePanEnd();
    }
  };

  // Handle Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, viewState.userScale * delta));
    
    setViewState(prev => ({
      ...prev,
      userScale: newScale
    }));
  };


  // --- Mouse Handlers for Cropping ---
  
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    if (!editState.isCropping || !editState.cropRect) return;
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragState({
      isDragging: true,
      handle,
      startX: clientX,
      startY: clientY,
      startRect: { ...editState.cropRect }
    });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.isDragging || !dragState.startRect || !editState.cropRect) return;
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Correct Delta for Rotation
    const rad = (-editState.rotation * Math.PI) / 180; // Invert rotation to map screen -> object
    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    
    // Rotate delta vector
    let rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    let rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Correct for Flip
    if (editState.flipX) rotDx = -rotDx;
    if (editState.flipY) rotDy = -rotDy;

    // Scale to Image Coordinates (must account for both fitScale and userScale)
    const currentScale = (viewState.fitScale || 1) * viewState.userScale;
    const deltaImgX = rotDx / currentScale;
    const deltaImgY = rotDy / currentScale;

    const r = { ...dragState.startRect };
    const minSize = 20; // Minimum 20px in image coords
    const aspectRatio = dragState.startRect.width / dragState.startRect.height;

    switch (dragState.handle) {
      case 'body':
        r.x = Math.max(0, Math.min(image.width - r.width, r.x + deltaImgX));
        r.y = Math.max(0, Math.min(image.height - r.height, r.y + deltaImgY));
        break;
      case 'nw': // Top Left
        {
            if (editState.cropAspectLocked) {
              const newWidth = Math.max(minSize, Math.min(r.x + r.width, r.width - deltaImgX));
              const newHeight = newWidth / aspectRatio;
              const newX = r.x + r.width - newWidth;
              const newY = r.y + r.height - newHeight;
              if (newX >= 0 && newY >= 0 && newHeight >= minSize) {
                r.width = newWidth;
                r.height = newHeight;
                r.x = newX;
                r.y = newY;
              }
            } else {
              const newX = Math.min(r.x + r.width - minSize, Math.max(0, r.x + deltaImgX));
              const newY = Math.min(r.y + r.height - minSize, Math.max(0, r.y + deltaImgY));
              r.width = r.width + (r.x - newX);
              r.height = r.height + (r.y - newY);
              r.x = newX;
              r.y = newY;
            }
        }
        break;
      case 'ne': // Top Right
        {
            if (editState.cropAspectLocked) {
              const newWidth = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
              const newHeight = newWidth / aspectRatio;
              const newY = r.y + r.height - newHeight;
              if (newY >= 0 && newHeight >= minSize) {
                r.width = newWidth;
                r.height = newHeight;
                r.y = newY;
              }
            } else {
              const newY = Math.min(r.y + r.height - minSize, Math.max(0, r.y + deltaImgY));
              r.width = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
              r.height = r.height + (r.y - newY);
              r.y = newY;
            }
        }
        break;
      case 'se': // Bottom Right
        if (editState.cropAspectLocked) {
          const newWidth = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
          const newHeight = newWidth / aspectRatio;
          if (r.y + newHeight <= image.height && newHeight >= minSize) {
            r.width = newWidth;
            r.height = newHeight;
          }
        } else {
          r.width = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
          r.height = Math.max(minSize, Math.min(image.height - r.y, r.height + deltaImgY));
        }
        break;
      case 'sw': // Bottom Left
        {
            if (editState.cropAspectLocked) {
              const newWidth = Math.max(minSize, Math.min(r.x + r.width, r.width - deltaImgX));
              const newHeight = newWidth / aspectRatio;
              const newX = r.x + r.width - newWidth;
              if (newX >= 0 && r.y + newHeight <= image.height && newHeight >= minSize) {
                r.width = newWidth;
                r.height = newHeight;
                r.x = newX;
              }
            } else {
              const newX = Math.min(r.x + r.width - minSize, Math.max(0, r.x + deltaImgX));
              r.width = r.width + (r.x - newX);
              r.height = Math.max(minSize, Math.min(image.height - r.y, r.height + deltaImgY));
              r.x = newX;
            }
        }
        break;
      case 'n': // Top
        {
            const newY = Math.min(r.y + r.height - minSize, Math.max(0, r.y + deltaImgY));
            r.height = r.height + (r.y - newY);
            r.y = newY;
        }
        break;
      case 's': // Bottom
        r.height = Math.max(minSize, Math.min(image.height - r.y, r.height + deltaImgY));
        break;
      case 'w': // Left
        {
            const newX = Math.min(r.x + r.width - minSize, Math.max(0, r.x + deltaImgX));
            r.width = r.width + (r.x - newX);
            r.x = newX;
        }
        break;
      case 'e': // Right
        r.width = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
        break;
    }

    onEditChange({ ...editState, cropRect: r });
  };

  const handleMouseUp = () => {
    setDragState({ ...dragState, isDragging: false, startRect: null });
  };

  // --- Render Helpers ---

  // Calculate handle size compensation
  // We want handles to appear ~24px on screen regardless of image scale.
  // Must account for both fitScale and userScale
  const totalScale = (viewState.fitScale > 0.0001 ? viewState.fitScale : 1) * viewState.userScale;
  const invScale = 1 / totalScale;
  
  // Transform for handles: Scale UP to counter the container scale DOWN
  // Also handle flip correction so handles don't flip upside down visually
  const handleTransform = `scale(${invScale}) scale(${editState.flipX ? -1 : 1}, ${editState.flipY ? -1 : 1})`;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center relative overflow-hidden select-none bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
      style={{
        backgroundImage: `
          radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          linear-gradient(to bottom right, #18181b, #27272a)
        `,
        backgroundSize: '20px 20px, 100% 100%, 100% 100%, 100% 100%',
        backgroundPosition: '0 0, 0 0, 0 0, 0 0',
        cursor: panState.isPanning ? 'grabbing' : (!editState.isCropping ? 'grab' : 'default')
      }}
      onMouseDown={handlePanStart}
      onMouseMove={(e) => {
        handlePanMove(e);
        handleMouseMove(e);
      }}
      onMouseUp={(e) => {
        handlePanEnd();
        handleMouseUp();
      }}
      onMouseLeave={(e) => {
        handlePanEnd();
        handleMouseUp();
      }}
      onTouchStart={handlePanStart}
      onTouchMove={(e) => {
        handleTouchMove(e);
        handleMouseMove(e);
      }}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        handleMouseUp();
      }}
      onTouchCancel={(e) => {
        handlePanEnd();
        handleMouseUp();
      }}
      onWheel={handleWheel}
    >
      {/* 
          Main Coordinate System 
          Scales and Rotates the entire content.
      */}
      <div 
        className="absolute transition-transform duration-200 ease-out origin-center"
        style={{ 
            width: image.width, 
            height: image.height,
            left: `calc(50% + ${viewState.offsetX}px)`,
            top: `calc(50% + ${viewState.offsetY}px)`,
            transform: `translate(-50%, -50%) scale(${viewState.fitScale * viewState.userScale}) rotate(${editState.rotation}deg) scale(${editState.flipX ? -1 : 1}, ${editState.flipY ? -1 : 1})`,
            backgroundImage: `
              linear-gradient(45deg, #27272a 25%, transparent 25%),
              linear-gradient(-45deg, #27272a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #27272a 75%),
              linear-gradient(-45deg, transparent 75%, #27272a 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Layer 1: Base Image (z-0) */}
        <img 
            src={image.previewUrl} 
            className="w-full h-full pointer-events-none block object-contain z-0"
            alt="Workplace"
            draggable={false}
        />

        {/* Layer 2: Watermark Preview (z-5) */}
        {settings.watermark?.enabled && settings.watermark.text && (
          <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
            {(() => {
              const baseFontSize = Math.max(Math.min(image.width, image.height) * 0.03, 16);
              const autoSpacingX = settings.watermark.spacingX || Math.max(image.width * 0.2, 200);
              const autoSpacingY = settings.watermark.spacingY || Math.max(image.height * 0.15, 150);
              
              const rows = Math.ceil(image.height / autoSpacingY) + 2;
              const cols = Math.ceil(image.width / autoSpacingX) + 2;
              
              const watermarks = [];
              for (let row = -1; row < rows; row++) {
                for (let col = -1; col < cols; col++) {
                  watermarks.push(
                    <div
                      key={`${row}-${col}`}
                      className="absolute"
                      style={{
                        left: col * autoSpacingX,
                        top: row * autoSpacingY,
                        transform: `rotate(${settings.watermark.rotation}deg)`,
                        transformOrigin: 'center center',
                        color: settings.watermark.color,
                        opacity: settings.watermark.opacity,
                        fontSize: `${baseFontSize}px`,
                        fontFamily: 'Arial, sans-serif',
                        whiteSpace: 'nowrap',
                        userSelect: 'none'
                      }}
                    >
                      {settings.watermark.text}
                    </div>
                  );
                }
              }
              return watermarks;
            })()}
          </div>
        )}

        {/* Layer 3: Dimmer Overlay (z-10) */}
        {editState.isCropping && editState.cropRect && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
             {/* The "Donut" Shadow Hole - Semi-transparent to show background */}
             <div 
                className="absolute"
                style={{
                    left: editState.cropRect.x,
                    top: editState.cropRect.y,
                    width: editState.cropRect.width,
                    height: editState.cropRect.height,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                }}
             />
          </div>
        )}

        {/* Layer 4: Interactive Crop Controls (z-50 - Top Layer) */}
        {editState.isCropping && editState.cropRect && (
          <div className="absolute inset-0 z-50">
            <div 
              className="absolute cursor-move outline outline-[3px] outline-indigo-500/80 touch-none"
              style={{
                left: editState.cropRect.x,
                top: editState.cropRect.y,
                width: editState.cropRect.width,
                height: editState.cropRect.height,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'body')}
              onTouchStart={(e) => handleMouseDown(e, 'body')}
            >
              
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col pointer-events-none opacity-40">
                  <div className="flex-1 border-b border-white/50 shadow-sm"></div>
                  <div className="flex-1 border-b border-white/50 shadow-sm"></div>
                  <div className="flex-1"></div>
              </div>
              <div className="absolute inset-0 flex pointer-events-none opacity-40">
                  <div className="flex-1 border-r border-white/50 shadow-sm"></div>
                  <div className="flex-1 border-r border-white/50 shadow-sm"></div>
                  <div className="flex-1"></div>
              </div>

              {/* Corner Handles */}
              {/* High visibility styling: z-[60], extra shadow ring */}
              {[
                  { h: 'nw', top: 0, left: 0, cursor: 'cursor-nw-resize' },
                  { h: 'ne', top: 0, left: '100%', cursor: 'cursor-ne-resize' },
                  { h: 'sw', top: '100%', left: 0, cursor: 'cursor-sw-resize' },
                  { h: 'se', top: '100%', left: '100%', cursor: 'cursor-se-resize' }
              ].map((item) => (
                  <div 
                      key={item.h}
                      className={`absolute w-8 h-8 md:w-6 md:h-6 bg-white border-[3px] border-indigo-600 rounded-full z-[60] shadow-[0_0_0_4px_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-125 active:scale-125 transition-transform ${item.cursor} touch-none`}
                      style={{
                          top: item.top,
                          left: item.left,
                          transform: `translate(-50%, -50%) ${handleTransform}` 
                      }}
                      onMouseDown={(e) => handleMouseDown(e, item.h)}
                      onTouchStart={(e) => handleMouseDown(e, item.h)}
                  />
              ))}
              
              {/* Edge Handles - Bars */}
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'n')}
                onTouchStart={(e) => handleMouseDown(e, 'n')}
                className="absolute top-0 left-1/2 w-12 h-4 md:h-3 bg-white border-2 border-indigo-600 rounded-full cursor-n-resize z-50 shadow-sm hover:scale-110 active:scale-110 transition-transform touch-none"
                style={{ transform: `translate(-50%, -50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 's')}
                onTouchStart={(e) => handleMouseDown(e, 's')}
                className="absolute bottom-0 left-1/2 w-12 h-4 md:h-3 bg-white border-2 border-indigo-600 rounded-full cursor-s-resize z-50 shadow-sm hover:scale-110 active:scale-110 transition-transform touch-none" 
                style={{ transform: `translate(-50%, 50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'w')}
                onTouchStart={(e) => handleMouseDown(e, 'w')}
                className="absolute top-1/2 left-0 w-4 md:w-3 h-12 bg-white border-2 border-indigo-600 rounded-full cursor-w-resize z-50 shadow-sm hover:scale-110 active:scale-110 transition-transform touch-none" 
                style={{ transform: `translate(-50%, -50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'e')}
                onTouchStart={(e) => handleMouseDown(e, 'e')}
                className="absolute top-1/2 right-0 w-4 md:w-3 h-12 bg-white border-2 border-indigo-600 rounded-full cursor-e-resize z-50 shadow-sm hover:scale-110 active:scale-110 transition-transform touch-none" 
                style={{ transform: `translate(50%, -50%) ${handleTransform}` }} 
              />

            </div>
          </div>
        )}
      </div>

       {/* Animated Indicator */}
       {image.isAnimated && !editState.isCropping && (
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white flex items-center gap-2 border border-white/10 z-20 pointer-events-none">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                GIF/WEBP
            </div>
        )}
    </div>
  );
};