import React, { useCallback, useState } from 'react';
import { Icons } from './Icon';
import { Language } from '../types';
import { useTranslation } from '../locales';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
  lang: Language;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesDropped, lang }) => {
  const [isDragging, setIsDragging] = useState(false);
  const t = useTranslation(lang);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(Array.from(e.dataTransfer.files));
    }
  }, [onFilesDropped]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesDropped(Array.from(e.target.files));
    }
  }, [onFilesDropped]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-800/50'}
      `}
    >
      <div className="p-4 bg-zinc-800 rounded-full mb-4 text-zinc-400">
        <Icons.Upload />
      </div>
      <h3 className="text-lg font-medium text-zinc-200 mb-1">{t.dragDrop}</h3>
      <p className="text-sm text-zinc-500 mb-6">{t.support}</p>
      
      <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
        {t.browse}
        <input 
          type="file" 
          className="hidden" 
          multiple 
          accept="image/*"
          onChange={handleFileSelect}
        />
      </label>
    </div>
  );
};