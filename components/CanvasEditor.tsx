import React, { useRef, useEffect, useState } from 'react';
import { CropRect, EditState, ImageFile } from '../types';

interface CanvasEditorProps {
  image: ImageFile;
  editState: EditState;
  onEditChange: (newState: EditState) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ image, editState, onEditChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ 
    fitScale: 1, 
    viewportW: 0, 
    viewportH: 0 
  });
  
  // Crop Dragging State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    handle: string | null; // 'nw', 'se', 'body', 'n', 's', 'e', 'w'
    startX: number;
    startY: number;
    startRect: CropRect | null;
  }>({ isDragging: false, handle: null, startX: 0, startY: 0, startRect: null });

  // Initialize or reset crop when image changes
  useEffect(() => {
    if(!image) return;
    if (!editState.cropRect) {
      onEditChange({
        ...editState,
        cropRect: { x: 0, y: 0, width: image.width, height: image.height }
      });
    }
  }, [image.id]);

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
        const padding = 80; 
        const availW = Math.max(10, vw - padding);
        const availH = Math.max(10, vh - padding);

        const scaleX = availW / bbW;
        const scaleY = availH / bbH;
        
        const fitScale = Math.min(scaleX, scaleY);

        setViewState({
          fitScale: fitScale > 0 ? fitScale : 1,
          viewportW: vw,
          viewportH: vh
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [image, editState.rotation]);


  // --- Mouse Handlers for Cropping ---
  
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    if (!editState.isCropping || !editState.cropRect) return;
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      isDragging: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...editState.cropRect }
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.startRect || !editState.cropRect) return;
    e.preventDefault();
    e.stopPropagation();

    // Correct Delta for Rotation
    const rad = (-editState.rotation * Math.PI) / 180; // Invert rotation to map screen -> object
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    // Rotate delta vector
    let rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    let rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Correct for Flip
    if (editState.flipX) rotDx = -rotDx;
    if (editState.flipY) rotDy = -rotDy;

    // Scale to Image Coordinates
    const currentScale = viewState.fitScale || 1;
    const deltaImgX = rotDx / currentScale;
    const deltaImgY = rotDy / currentScale;

    const r = { ...dragState.startRect };
    const minSize = 20; // Minimum 20px in image coords

    switch (dragState.handle) {
      case 'body':
        r.x = Math.max(0, Math.min(image.width - r.width, r.x + deltaImgX));
        r.y = Math.max(0, Math.min(image.height - r.height, r.y + deltaImgY));
        break;
      case 'nw': // Top Left
        {
            const newX = Math.min(r.x + r.width - minSize, Math.max(0, r.x + deltaImgX));
            const newY = Math.min(r.y + r.height - minSize, Math.max(0, r.y + deltaImgY));
            r.width = r.width + (r.x - newX);
            r.height = r.height + (r.y - newY);
            r.x = newX;
            r.y = newY;
        }
        break;
      case 'ne': // Top Right
        {
            const newY = Math.min(r.y + r.height - minSize, Math.max(0, r.y + deltaImgY));
            r.width = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
            r.height = r.height + (r.y - newY);
            r.y = newY;
        }
        break;
      case 'se': // Bottom Right
        r.width = Math.max(minSize, Math.min(image.width - r.x, r.width + deltaImgX));
        r.height = Math.max(minSize, Math.min(image.height - r.y, r.height + deltaImgY));
        break;
      case 'sw': // Bottom Left
        {
            const newX = Math.min(r.x + r.width - minSize, Math.max(0, r.x + deltaImgX));
            r.width = r.width + (r.x - newX);
            r.height = Math.max(minSize, Math.min(image.height - r.y, r.height + deltaImgY));
            r.x = newX;
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
  const safeScale = viewState.fitScale > 0.0001 ? viewState.fitScale : 1;
  const invScale = 1 / safeScale;
  
  // Transform for handles: Scale UP to counter the container scale DOWN
  // Also handle flip correction so handles don't flip upside down visually
  const handleTransform = `scale(${invScale}) scale(${editState.flipX ? -1 : 1}, ${editState.flipY ? -1 : 1})`;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center bg-[#09090b] relative overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 
          Main Coordinate System 
          Scales and Rotates the entire content.
      */}
      <div 
        className="absolute shadow-2xl transition-transform duration-200 ease-out origin-center"
        style={{ 
            width: image.width, 
            height: image.height,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${viewState.fitScale}) rotate(${editState.rotation}deg) scale(${editState.flipX ? -1 : 1}, ${editState.flipY ? -1 : 1})`
        }}
      >
        {/* Layer 1: Base Image (z-0) */}
        <img 
            src={image.previewUrl} 
            className="w-full h-full pointer-events-none block object-contain z-0"
            alt="Workplace"
            draggable={false}
        />

        {/* Layer 2: Dimmer Overlay (z-10) */}
        {editState.isCropping && editState.cropRect && (
          <div className="absolute inset-0 pointer-events-none z-10">
             {/* The "Donut" Shadow Hole */}
             <div 
                className="absolute shadow-[0_0_0_99999px_rgba(0,0,0,0.7)]"
                style={{
                    left: editState.cropRect.x,
                    top: editState.cropRect.y,
                    width: editState.cropRect.width,
                    height: editState.cropRect.height,
                }}
             />
          </div>
        )}

        {/* Layer 3: Interactive Crop Controls (z-50 - Top Layer) */}
        {editState.isCropping && editState.cropRect && (
          <div className="absolute inset-0 z-50">
            <div 
              className="absolute cursor-move outline outline-[3px] outline-indigo-500/80"
              style={{
                left: editState.cropRect.x,
                top: editState.cropRect.y,
                width: editState.cropRect.width,
                height: editState.cropRect.height,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'body')}
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
                      className={`absolute w-6 h-6 bg-white border-[3px] border-indigo-600 rounded-full z-[60] shadow-[0_0_0_4px_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-125 transition-transform ${item.cursor}`}
                      style={{
                          top: item.top,
                          left: item.left,
                          transform: `translate(-50%, -50%) ${handleTransform}` 
                      }}
                      onMouseDown={(e) => handleMouseDown(e, item.h)}
                  />
              ))}
              
              {/* Edge Handles - Bars */}
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'n')} 
                className="absolute top-0 left-1/2 w-12 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-n-resize z-50 shadow-sm hover:scale-110 transition-transform"
                style={{ transform: `translate(-50%, -50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 's')} 
                className="absolute bottom-0 left-1/2 w-12 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-s-resize z-50 shadow-sm hover:scale-110 transition-transform" 
                style={{ transform: `translate(-50%, 50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'w')} 
                className="absolute top-1/2 left-0 w-3 h-12 bg-white border-2 border-indigo-600 rounded-full cursor-w-resize z-50 shadow-sm hover:scale-110 transition-transform" 
                style={{ transform: `translate(-50%, -50%) ${handleTransform}` }} 
              />
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'e')} 
                className="absolute top-1/2 right-0 w-3 h-12 bg-white border-2 border-indigo-600 rounded-full cursor-e-resize z-50 shadow-sm hover:scale-110 transition-transform" 
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