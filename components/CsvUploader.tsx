'use client';

/**
 * CsvUploader — مكوّن رفع ملفات CSV لوحدات ERP
 * يعمل مع: hr | assets | maintenance | finance | generic
 * يُضاف إلى أي صفحة في admin-gateway
 */

import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, FileText, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface CsvUploaderProps {
  module: 'hr' | 'assets' | 'maintenance' | 'finance' | 'generic';
  onSuccess?: (result: UploadResult) => void;
  className?: string;
}

interface UploadResult {
  success: boolean;
  rows_imported: number;
  rows_skipped: number;
  rows_incomplete: number;
  module: string;
  project_id: number | null;
  site_id: number | null;
  preview: Record<string, any>[];
  errors: string[];
}

const MODULE_LABELS: Record<string, string> = {
  hr: 'الموارد البشرية',
  assets: 'الأصول',
  maintenance: 'الصيانة',
  finance: 'المالية',
  generic: 'عام',
};

const MODULE_HINTS: Record<string, string> = {
  hr: 'الأعمدة المقترحة: name, department, position, salary, hire_date',
  assets: 'الأعمدة المقترحة: asset_name, asset_type, status, health_score, location',
  maintenance: 'الأعمدة المقترحة: title, asset_id, priority, scheduled_date, technician',
  finance: 'الأعمدة المقترحة: amount, category, date, description, vendor',
  generic: 'أي أعمدة — سيتم رفعها كما هي',
};

export default function CsvUploader({ module, onSuccess, className = '' }: CsvUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { activeProjectId, activeSiteId } = useErpContextStore();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('module', module);
      if (activeProjectId) form.append('project_id', String(activeProjectId));
      if (activeSiteId) form.append('site_id', String(activeSiteId));

      const res = await fetch('/api/v1/workspace/upload-csv', {
        method: 'POST',
        headers: {
          ...getClientTenantHeaders(),
        },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'فشل الرفع');
      }

      const data: UploadResult = await res.json();
      setResult(data);
      onSuccess?.(data);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء الرفع');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setShowPreview(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={`${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded-xl text-sm font-medium transition-colors"
      >
        <Upload className="w-4 h-4" />
        استيراد CSV
        {open ? <ChevronUp className="w-3.5 h-3.5 mr-auto" /> : <ChevronDown className="w-3.5 h-3.5 mr-auto" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-3 bg-slate-900/60 border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-slate-200">رفع بيانات {MODULE_LABELS[module]}</h3>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context Info */}
          {(activeProjectId || activeSiteId) && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              البيانات ستُربط بـ
              {activeProjectId ? ` مشروع #${activeProjectId}` : ''}
              {activeSiteId ? ` · موقع #${activeSiteId}` : ''}
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
            {MODULE_HINTS[module]}
          </p>

          {/* Drop Zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              {file ? (
                <div className="space-y-1">
                  <FileText className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-medium text-emerald-300">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} كيلوبايت</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-400">اسحب ملف CSV هنا أو انقر للاختيار</p>
                  <p className="text-xs text-slate-600">يقبل: .csv</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">تم الاستيراد بنجاح</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2">
                  <div className="text-xl font-bold text-emerald-400">{result.rows_imported}</div>
                  <div className="text-xs text-slate-400 mt-0.5">مستورد</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg py-2">
                  <div className="text-xl font-bold text-amber-400">{result.rows_incomplete}</div>
                  <div className="text-xs text-slate-400 mt-0.5">ناقص</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg py-2">
                  <div className="text-xl font-bold text-red-400">{result.rows_skipped}</div>
                  <div className="text-xs text-slate-400 mt-0.5">مرفوض</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 space-y-0.5">
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}

              {result.preview.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowPreview(p => !p)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    معاينة أول {result.preview.length} صفوف
                  </button>
                  {showPreview && (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700">
                      <table className="text-xs w-full">
                        <thead className="bg-slate-800 text-slate-400">
                          <tr>
                            <th className="px-2 py-1.5 text-right">الحالة</th>
                            {Object.keys(result.preview[0]).filter(k => k !== '_status').slice(0, 5).map(k => (
                              <th key={k} className="px-2 py-1.5 text-right">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {result.preview.map((row, i) => (
                            <tr key={i} className={row._status === 'incomplete' ? 'bg-amber-500/5' : ''}>
                              <td className="px-2 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  row._status === 'incomplete'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {row._status === 'incomplete' ? 'ناقص' : 'مكتمل'}
                                </span>
                              </td>
                              {Object.entries(row).filter(([k]) => k !== '_status').slice(0, 5).map(([k, v]) => (
                                <td key={k} className="px-2 py-1.5 text-slate-300 max-w-[120px] truncate">{String(v ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={reset}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors"
              >
                رفع ملف آخر
              </button>
            </div>
          )}

          {/* Upload Button */}
          {!result && file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'جاري الرفع...' : 'رفع البيانات'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
