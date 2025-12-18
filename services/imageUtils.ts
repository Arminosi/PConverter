import { EditState, ExportSettings, ImageFormat } from '../types';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Iteratively compresses the canvas to meet a target file size (Binary Search approach).
 */
const compressToTargetSize = async (
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  targetSizeBytes: number
): Promise<Blob> => {
  if (format === ImageFormat.PNG) {
    // PNG is lossless, quality param doesn't affect size much/at all in standard canvas API
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(), format));
  }

  let minQ = 0.01;
  let maxQ = 1.0;
  let iteration = 0;
  let resultBlob: Blob | null = null;

  // Try max quality first
  resultBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, format, 1.0));
  if (resultBlob && resultBlob.size <= targetSizeBytes) {
    return resultBlob;
  }

  // Binary search for approximate quality
  while (iteration < 6) { // Max 6 iterations for performance
    const midQ = (minQ + maxQ) / 2;
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, format, midQ));
    
    if (!blob) break;

    if (blob.size > targetSizeBytes) {
      maxQ = midQ;
    } else {
      minQ = midQ;
      resultBlob = blob; // Keep the best valid result so far
    }
    iteration++;
  }

  // If we couldn't get it small enough, return the smallest possible
  if (!resultBlob) {
    resultBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, format, minQ));
  }
  
  return resultBlob as Blob;
};

export const processImage = async (
  sourceUrl: string,
  editState: EditState,
  settings: ExportSettings
): Promise<Blob> => {
  const img = await loadImage(sourceUrl);
  
  // 1. Create a canvas for the base operation
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No context');

  // Determine Source Dimensions (Crop or Full)
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  
  if (editState.cropRect && editState.isCropping) {
    sx = editState.cropRect.x;
    sy = editState.cropRect.y;
    sw = editState.cropRect.width;
    sh = editState.cropRect.height;
  }

  // 2. Handle Rotation dimensions
  const rads = (editState.rotation * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rads));
  const absSin = Math.abs(Math.sin(rads));

  // The size of the canvas needed to hold the rotated cropped content
  const rotatedW = sw * absCos + sh * absSin;
  const rotatedH = sw * absSin + sh * absCos;

  // 3. Apply Scaling (Zoom/User Scale) - 
  // NOTE: If the user wants to resize to specific pixel, that happens later.
  // The 'editState.scale' is usually for visual zoom, but here we can apply it as an intrinsic scale.
  // However, usually "Crop" and "Output Size" are separate. 
  // Let's assume editState.scale affects the output "viewport".
  
  const renderW = rotatedW * editState.scale;
  const renderH = rotatedH * editState.scale;

  canvas.width = renderW;
  canvas.height = renderH;

  // 4. Draw
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rads);
  ctx.scale(
    editState.scale * (editState.flipX ? -1 : 1),
    editState.scale * (editState.flipY ? -1 : 1)
  );
  
  // Draw the specific cropped region centered
  ctx.drawImage(
    img,
    sx, sy, sw, sh, // Source crop
    -sw / 2, -sh / 2, sw, sh // Destination (centered in rotated context)
  );
  ctx.restore();

  // 5. Handle Target Resolution (Resizing)
  let finalCanvas = canvas;
  if (settings.targetWidth || settings.targetHeight) {
    const resizeCanvas = document.createElement('canvas');
    let targetW = settings.targetWidth || canvas.width;
    let targetH = settings.targetHeight || canvas.height;

    // Aspect ratio logic is handled in UI, but double check here if one is missing
    const ratio = canvas.width / canvas.height;
    if (settings.targetWidth && !settings.targetHeight && settings.maintainAspectRatio) {
      targetH = Math.round(targetW / ratio);
    } else if (!settings.targetWidth && settings.targetHeight && settings.maintainAspectRatio) {
      targetW = Math.round(targetH * ratio);
    }

    resizeCanvas.width = targetW;
    resizeCanvas.height = targetH;
    const rCtx = resizeCanvas.getContext('2d');
    if (rCtx) {
      rCtx.imageSmoothingEnabled = true;
      rCtx.imageSmoothingQuality = 'high';
      rCtx.drawImage(canvas, 0, 0, targetW, targetH);
      finalCanvas = resizeCanvas;
    }
  }

  // 6. Apply Watermark if enabled
  if (settings.watermark?.enabled && settings.watermark.text) {
    const watermarkCanvas = document.createElement('canvas');
    watermarkCanvas.width = finalCanvas.width;
    watermarkCanvas.height = finalCanvas.height;
    const wCtx = watermarkCanvas.getContext('2d');
    
    if (wCtx) {
      // Draw the original image first
      wCtx.drawImage(finalCanvas, 0, 0);
      
      // Calculate font size based on image dimensions
      const baseFontSize = Math.max(Math.min(finalCanvas.width, finalCanvas.height) * 0.03, 16);
      const fontSize = baseFontSize;
      
      // Auto-calculate spacing based on image size if not explicitly set
      const autoSpacingX = settings.watermark.spacingX || Math.max(finalCanvas.width * 0.2, 200);
      const autoSpacingY = settings.watermark.spacingY || Math.max(finalCanvas.height * 0.15, 150);
      
      // Setup watermark style
      wCtx.font = `${fontSize}px Arial, sans-serif`;
      wCtx.fillStyle = settings.watermark.color;
      wCtx.globalAlpha = settings.watermark.opacity;
      wCtx.textAlign = 'center';
      wCtx.textBaseline = 'middle';
      
      // Calculate text dimensions for proper spacing
      const textMetrics = wCtx.measureText(settings.watermark.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      
      // Draw watermark pattern
      const rows = Math.ceil(finalCanvas.height / autoSpacingY) + 2;
      const cols = Math.ceil(finalCanvas.width / autoSpacingX) + 2;
      
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * autoSpacingX;
          const y = row * autoSpacingY;
          
          wCtx.save();
          wCtx.translate(x, y);
          wCtx.rotate((settings.watermark.rotation * Math.PI) / 180);
          wCtx.fillText(settings.watermark.text, 0, 0);
          wCtx.restore();
        }
      }
      
      finalCanvas = watermarkCanvas;
    }
  }

  // 7. Export with Compression
  if (settings.targetSizeMB && settings.targetSizeMB > 0) {
    const targetBytes = settings.targetSizeMB * 1024 * 1024;
    return compressToTargetSize(finalCanvas, settings.format, targetBytes);
  } else {
    // Standard export
    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas failed'));
        },
        settings.format,
        settings.quality
      );
    });
  }
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};