'use client';

/**
 * File Upload Zone Component
 * منطقة رفع الملفات للبيانات الخطية
 */

import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  success?: string | null;
}

export function FileUploadZone({
  onFileSelect,
  isLoading = false,
  error = null,
  success = null,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      await onFileSelect(file);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      await onFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const acceptedFormats = '.csv,.xlsx,.xls';

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats}
          onChange={handleInputChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center gap-3">
          {isLoading ? (
            <>
              <Loader className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-gray-300">جاري معالجة الملف...</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <div>
                <p className="font-semibold text-white">رفع ملف البيانات الخطية</p>
                <p className="text-sm text-gray-400">
                  اسحب الملف هنا أو انقر للاختيار
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV, Excel (.xlsx, .xls)</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Info */}
      {selectedFile && !isLoading && (
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-sm font-semibold text-gray-300">
            الملف المختار: {selectedFile.name}
          </p>
          <p className="text-xs text-gray-500">
            الحجم: {(selectedFile.size / 1024).toFixed(2)} KB
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300 text-sm">خطأ</p>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-300 text-sm">نجاح</p>
            <p className="text-sm text-green-200">{success}</p>
          </div>
        </div>
      )}
    </div>
  );
}
