/**
 * Компонент за качване на медийни файлове (Изображение или Моушън видео)
 * Поддържа Drag & Drop и избор чрез кликване съгласно правилата за използваемост.
 */

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Video, X, CheckCircle2, Loader2, Link as LinkIcon, Film } from 'lucide-react';
import { safeFetchJson } from '../utils/apiHelper.ts';

interface MediaUploaderProps {
  id: string;
  label: string;
  accept: 'image' | 'video';
  value: string;
  onChange: (url: string) => void;
  helperText?: string;
  placeholder?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  id,
  label,
  accept,
  value,
  onChange,
  helperText,
  placeholder,
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('http') && !value.includes('/uploads/') ? 'url' : 'upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = accept === 'image';
  const fileTypesLabel = isImage ? 'JPG, PNG, WEBP (до 25MB)' : 'MP4, MOV, WEBM (до 100MB)';
  const acceptMimes = isImage ? 'image/jpeg,image/png,image/webp,image/jpg' : 'video/mp4,video/quicktime,video/webm';

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const uploadFile = async (file: File) => {
    // Vercel Serverless лимитът за заявка е 4.5 MB
    const maxVercelBytes = 4.5 * 1024 * 1024;
    if (file.size > maxVercelBytes) {
      setUploadError(
        `Файлът е с размер ${formatBytes(file.size)}. Vercel Serverless има лимит до 4.5 MB за директно качване. Моля, компресирайте файла или превключете на таб "Интернет URL" и поставете директен линк.`
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await safeFetchJson<{ url: string; error?: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.data?.url) {
        throw new Error(response.error || 'Грешка при качване на файла.');
      }

      onChange(response.data.url);
    } catch (err: any) {
      console.error('Грешка при качване:', err);
      setUploadError(err.message || 'Неуспешно качване на файла.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    onChange('');
    setFileName(null);
    setFileSize(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isLocalUpload = Boolean(value && value.includes('/uploads/'));
  const hasValue = Boolean(value && value.trim());

  return (
    <div
      className="space-y-2 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header and Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          {isImage ? <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> : <Video className="w-3.5 h-3.5 text-indigo-600" />}
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              mode === 'upload' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Качване на файл
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              mode === 'url' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            URL адрес
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div>
          {/* Hidden File Input */}
          <input
            id={id}
            ref={fileInputRef}
            type="file"
            accept={acceptMimes}
            onChange={handleFileChange}
            className="hidden"
          />

          {!hasValue ? (
            /* Drag and Drop Zone */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/60 scale-[0.99]'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-white'
              } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  <p className="text-xs font-medium text-slate-700">Качване на файла към сървъра...</p>
                  <p className="text-[10px] text-slate-400">{fileName} ({fileSize})</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-indigo-600 hover:underline">
                      Кликнете за избор на файл
                    </span>
                    <span className="text-xs text-slate-600"> или го плъзнете тук</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {fileTypesLabel}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Preview of Selected/Uploaded Media */
            <div className={`p-3 bg-slate-50 border rounded-xl space-y-2.5 transition-all ${
              isDragging ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-300' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  {isLocalUpload ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ваш качен файл
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                      Предварителен шаблон
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-800 truncate" title={fileName || value}>
                    {fileName || (isLocalUpload ? 'Качен медиен файл' : 'Шаблон')}
                  </span>
                  {fileSize && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                      {fileSize}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                  title="Изчисти и качи нов файл"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Visual Preview Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200 max-h-48 relative cursor-pointer group"
                title="Кликнете за замяна с друг файл"
              >
                {isImage ? (
                  <img
                    src={value}
                    alt="Предварителен преглед"
                    className="max-h-48 w-auto object-contain transition-opacity group-hover:opacity-85"
                  />
                ) : (
                  <video
                    src={value}
                    controls
                    className="max-h-48 w-full object-contain"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-semibold text-white bg-slate-900/80 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Кликнете или пуснете нов файл за замяна
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span className="font-mono truncate max-w-[240px]" title={value}>
                  {value}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold underline shrink-0 cursor-pointer"
                  >
                    Замени с друг файл
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-rose-600 hover:text-rose-800 font-medium shrink-0 cursor-pointer"
                  >
                    Изчисти
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manual URL Input Mode */
        <div className="space-y-1.5">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <LinkIcon className="w-3.5 h-3.5" />
            </div>
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || 'https://example.com/asset.mp4'}
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono text-slate-800"
            />
            {hasValue && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {hasValue && (
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-hidden flex items-center justify-center">
              {isImage ? (
                <img src={value} alt="Preview" className="max-h-32 object-contain" />
              ) : (
                <video src={value} controls className="max-h-32 object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-xs text-rose-600 font-medium">
          ⚠️ {uploadError}
        </p>
      )}

      {/* Helper text */}
      {helperText && (
        <p className="text-[11px] text-slate-500 leading-normal">
          {helperText}
        </p>
      )}
    </div>
  );
};
