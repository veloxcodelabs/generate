/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Video, X, CheckCircle2, Loader2, Link as LinkIcon, Eye } from 'lucide-react';
import { safeFetchJson } from '../utils/apiHelper.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';

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
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('http') && !value.includes('/uploads/') ? 'url' : 'upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = accept === 'image';
  const fileTypesLabel = isImage ? t.media.formatsImage : t.media.formatsVideo;
  const acceptMimes = isImage ? 'image/jpeg,image/png,image/webp,image/jpg' : 'video/mp4,video/quicktime,video/webm';

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const uploadFile = async (file: File) => {
    const maxVercelBytes = 4.5 * 1024 * 1024;
    if (file.size > maxVercelBytes) {
      setUploadError(
        language === 'bg'
          ? `Файлът е с размер ${formatBytes(file.size)}. Лимитът за директно качване е до 4.5 MB. Моля, превключете на таб "${t.media.urlTab}" и поставете директен линк.`
          : `File size is ${formatBytes(file.size)}. Direct upload limit is 4.5 MB. Please switch to "${t.media.urlTab}" tab and paste a direct URL.`
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
        throw new Error(response.error || (language === 'bg' ? 'Грешка при качване на файла.' : 'File upload failed.'));
      }

      onChange(response.data.url);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || (language === 'bg' ? 'Неуспешно качване на файла.' : 'Failed to upload file.'));
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
      {/* Header and Mode Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          {isImage ? (
            <span className="w-5 h-5 rounded-md bg-indigo-500/15 flex items-center justify-center text-indigo-400">
              <ImageIcon className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="w-5 h-5 rounded-md bg-violet-500/15 flex items-center justify-center text-violet-400">
              <Video className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="font-sans tracking-wide">{label}</span>
        </label>
        
        <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg text-[11px] font-tech-mono text-slate-400 border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
              mode === 'upload' ? 'bg-white/[0.12] text-white shadow-xs font-semibold' : 'hover:text-slate-200'
            }`}
          >
            {t.media.uploadTab}
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
              mode === 'url' ? 'bg-white/[0.12] text-white shadow-xs font-semibold' : 'hover:text-slate-200'
            }`}
          >
            {t.media.urlTab}
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            id={id}
            ref={fileInputRef}
            type="file"
            accept={acceptMimes}
            onChange={handleFileChange}
            className="hidden"
          />

          {!hasValue ? (
            /* Drag and Drop Architectural Zone */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10 scale-[0.99] shadow-lg shadow-indigo-500/10'
                  : 'border-white/[0.12] hover:border-white/[0.25] bg-white/[0.02] hover:bg-white/[0.04]'
              } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-xs font-tech-mono text-slate-300">{t.common.loading}</p>
                  <p className="text-[10px] font-tech-mono text-slate-500">{fileName} ({fileSize})</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
                      {t.media.dragDropPrompt}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-tech-mono tracking-wider">
                    {fileTypesLabel}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Preview of Selected/Uploaded Media */
            <div className={`p-3 bg-white/[0.03] border rounded-xl space-y-2.5 transition-all ${
              isDragging ? 'border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/30' : 'border-white/[0.1]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  {isLocalUpload ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-tech-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      {language === 'bg' ? 'Ваш качен файл' : 'Uploaded file'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-tech-mono text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md shrink-0">
                      {language === 'bg' ? 'Шаблон' : 'Preset sample'}
                    </span>
                  )}
                  <span className="text-xs font-tech-mono text-slate-200 truncate" title={fileName || value}>
                    {fileName || (isLocalUpload ? (language === 'bg' ? 'Качен медиен файл' : 'Uploaded media') : (language === 'bg' ? 'Шаблон' : 'Preset'))}
                  </span>
                  {fileSize && (
                    <span className="text-[10px] bg-white/[0.06] text-slate-400 px-1.5 py-0.5 rounded font-tech-mono shrink-0">
                      {fileSize}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title={t.common.delete}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Visual Preview Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl overflow-hidden bg-black/60 flex items-center justify-center border border-white/[0.08] max-h-48 relative cursor-pointer group"
                title={t.media.changeFile}
              >
                {isImage ? (
                  <img
                    src={value}
                    alt={t.media.preview}
                    className="max-h-48 w-auto object-contain transition-opacity group-hover:opacity-75"
                  />
                ) : (
                  <video
                    src={value}
                    controls
                    className="max-h-48 w-full object-contain"
                  />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-tech-mono text-white bg-slate-900/90 px-3 py-1.5 rounded-lg border border-white/20 shadow-lg flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {t.media.changeFile}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-tech-mono">
                <span className="truncate max-w-[240px] text-slate-400" title={value}>
                  {value}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    {t.media.changeFile}
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manual URL Input Mode */
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <LinkIcon className="w-3.5 h-3.5" />
            </div>
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || t.media.urlPlaceholder}
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-white/[0.03] border border-white/[0.1] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white/[0.06] transition-all font-tech-mono text-slate-200 placeholder:text-slate-500"
            />
            {hasValue && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {hasValue && (
            <div className="p-2 bg-black/40 border border-white/[0.08] rounded-xl max-h-36 overflow-hidden flex items-center justify-center">
              {isImage ? (
                <img src={value} alt="Preview" className="max-h-32 object-contain rounded" />
              ) : (
                <video src={value} controls className="max-h-32 object-contain rounded" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-xs text-rose-400 font-tech-mono">
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
