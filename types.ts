export enum ImageFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export type Language = 'en' | 'zh';

export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  originalSize: number;
  width: number;
  height: number;
  isAnimated: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditState {
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  isCropping: boolean;
  cropRect: CropRect | null; // The crop rectangle relative to the *original* image dimensions
  cropAspectLocked: boolean; // Lock crop aspect ratio
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  color: string;
  opacity: number; // 0-1
  fontSize: number; // Will be auto-calculated based on image size
  rotation: number; // degrees
  spacingX: number; // horizontal spacing
  spacingY: number; // vertical spacing
}

export interface ExportSettings {
  format: ImageFormat;
  quality: number; // Used if targetSizeMB is not set
  targetSizeMB?: number; // Target size in Megabytes
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio: boolean;
  watermark: WatermarkSettings;
}

export interface ProcessedResult {
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
}