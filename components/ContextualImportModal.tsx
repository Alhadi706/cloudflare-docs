'use client';

/**
 * ContextualImportModal — مودال الاستيراد الموحّد
 * =================================================
 * PHASE GLOBAL-IMPORT-SYSTEM
 *
 * يعمل مع أي وحدة ERP عبر moduleKey → IMPORT_MODULES[key]
 * يشترط project/site فقط حين requiresProject / requiresSite = true
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Upload, FolderOpen, MapPin, Users, Building2,
  CheckCircle, AlertCircle, ChevronRight, ChevronLeft,
  FileText, Eye, AlertTriangle, Loader2
} from 'lucide-react';
import { IMPORT_MODULES, type ImportModuleConfig } from '@/lib/importModuleRegistry';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface Site {
  id: number;
  name: string;
  code: string;
  site_type?: string;
}

interface ImportResult {
  success: boolean;
  data_type: string;
  tenant_id: string;
  project_id?: number;
  site_id?: number;
  total: number;
  success_count?: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
  batch_id: string;
  detected_columns?: string[];
}

interface PreviewData {
  total_rows: number;
  preview: Record<string, string>[];
  original_columns: string[];
  detected_canonical_fields: string[];
  unmapped_columns: string[];
}

interface ContextualImportModalProps {
  /** مفتاح الوحدة من IMPORT_MODULES — مثال: 'employees', 'departments', 'work_orders' */
  moduleKey: string;
  /** @deprecated استخدم moduleKey بدلاً منه */
  dataType?: string;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
  tenantId?: string;
}

type Step = 'context' | 'upload' | 'result';

const TENANT_ID = '';
const TENANT_CODE = null;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ContextualImportModal({
  moduleKey,
  dataType,
  onClose,
  onSuccess,
  tenantId = TENANT_ID,
}: ContextualImportModalProps) {
  // Resolve config — fall back to dataType for legacy callers
  const resolvedKey = moduleKey || dataType || 'employees';
  const config: ImportModuleConfig = IMPORT_MODULES[resolvedKey] ?? IMPORT_MODULES['employees'];

  // ── Step state ──
  // If module requires neither project nor site, skip context step
  const firstStep: Step = (config.requiresProject || config.requiresSite) ? 'context' : 'upload';
  const [step, setStep] = useState<Step>(firstStep);

  // ── Context step ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);

  // ── Upload step ──
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── Import state ──
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ─────────────────────
  // Fetch projects
  // ─────────────────────
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch('/api/v1/import/projects', {
          headers: { 'X-Tenant-ID': tenantId },
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (e) {
        console.error('Failed to fetch projects:', e);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [tenantId]);

  // ─────────────────────
  // Fetch sites when project changes
  // ─────────────────────
  useEffect(() => {
    if (!selectedProjectId) {
      setSites([]);
      setSelectedSiteId(null);
      return;
    }
    const fetchSites = async () => {
      setLoadingSites(true);
      setSites([]);
      setSelectedSiteId(null);
      try {
        const res = await fetch(`/api/v1/import/projects/${selectedProjectId}/sites`, {
          headers: { 'X-Tenant-ID': tenantId },
        });
        if (res.ok) {
          const data = await res.json();
          setSites(data);
        }
      } catch (e) {
        console.error('Failed to fetch sites:', e);
      } finally {
        setLoadingSites(false);
      }
    };
    fetchSites();
  }, [selectedProjectId, tenantId]);

  // ─────────────────────
  // File handlers
  // ─────────────────────
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(null);
    setImportError(null);

    // معاينة
    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`/api/v1/import/preview?data_type=${resolvedKey}`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Tenant-ID': tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setImportError(err.detail || 'فشل تحليل الملف');
      }
    } catch (e) {
      setImportError('خطأ في الاتصال أثناء معاينة الملف');
    } finally {
      setLoadingPreview(false);
    }
  }, [resolvedKey, tenantId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelected(dropped);
  }, [handleFileSelected]);

  // ─────────────────────
  // Submit import
  // ─────────────────────
  const handleImport = async () => {
    if (!file) return;
    if (config.requiresProject && !selectedProjectId) return;
    if (config.requiresSite && !selectedSiteId) return;
    setImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams();
      if (config.requiresProject && selectedProjectId) params.set('project_id', String(selectedProjectId));
      if (config.requiresSite && selectedSiteId) params.set('site_id', String(selectedSiteId));
      const paramStr = params.toString();
      const url = `${config.endpoint}${paramStr ? `?${paramStr}` : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Tenant-ID': tenantId,
          'X-Tenant-Code': TENANT_CODE,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setStep('result');
        onSuccess?.(data);
      } else {
        setImportError(data.detail || 'فشل الاستيراد');
      }
    } catch (e) {
      setImportError('خطأ في الاتصال أثناء الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  // ─────────────────────
  // Step labels
  // ─────────────────────
  const steps: { key: Step; label: string }[] = [
    ...(config.requiresProject || config.requiresSite ? [{ key: 'context' as Step, label: 'اختيار السياق' }] : []),
    { key: 'upload', label: 'رفع الملف' },
    { key: 'result', label: 'النتائج' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  const dataTypeLabel = config.label;
  const dataTypeIcon = <Upload className="w-4 h-4" />;

  // Context step OK state
  const contextOk =
    (!config.requiresProject || !!selectedProjectId) &&
    (!config.requiresSite || !!selectedSiteId);

  // ─────────────────────
  // RENDER
  // ─────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">استيراد ملف {dataTypeLabel}</h2>
              <p className="text-gray-400 text-xs">
                {TENANT_CODE} · <span className="font-mono text-gray-500">{tenantId.slice(0, 8)}…</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800/50 border-b border-gray-700/50">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                i <= stepIndex ? 'text-blue-400' : 'text-gray-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                  i < stepIndex ? 'bg-blue-600 border-blue-600 text-white' :
                  i === stepIndex ? 'border-blue-400 text-blue-400' :
                  'border-gray-600 text-gray-500'
                }`}>
                  {i < stepIndex ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <ChevronLeft className={`w-4 h-4 ${i < stepIndex ? 'text-blue-500' : 'text-gray-600'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ═══════════════════════════════════════
              STEP 1: اختيار السياق
          ════════════════════════════════════════ */}
          {step === 'context' && (
            <div className="space-y-5">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  تنبيه: اختيار السياق إلزامي
                </div>
                <p className="text-gray-400 text-xs">
                  كل صف سيُربط تلقائياً بـ <strong className="text-gray-300">
                    tenant{config.requiresProject ? ' + project' : ''}{config.requiresSite ? ' + site' : ''}
                  </strong>.
                  {config.notes && <span className="block mt-1 text-gray-500">{config.notes}</span>}
                </p>
              </div>

              {/* نوع البيانات */}
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">نوع البيانات</label>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-300">
                  {dataTypeIcon}
                  <span>{dataTypeLabel}</span>
                  <span className="mr-auto text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{resolvedKey}</span>
                </div>
              </div>

              {/* المشروع — يظهر فقط إذا requiresProject */}
              {config.requiresProject && (
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">
                    المشروع <span className="text-red-400">*</span>
                  </label>
                  {loadingProjects ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل المشاريع...
                    </div>
                  ) : (
                    <select
                      value={selectedProjectId ?? ''}
                      onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="">— اختر المشروع —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* الموقع — يظهر فقط إذا requiresSite */}
              {config.requiresSite && (
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">
                    الموقع / المنطقة <span className="text-red-400">*</span>
                  </label>
                  {!selectedProjectId ? (
                    <div className="text-gray-500 text-sm bg-gray-800/50 border border-dashed border-gray-600 rounded-lg px-4 py-3">
                      اختر المشروع أولاً لتظهر المواقع
                    </div>
                  ) : loadingSites ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل المواقع...
                    </div>
                  ) : sites.length === 0 ? (
                    <div className="text-yellow-500 text-sm bg-yellow-900/10 border border-yellow-700/30 rounded-lg px-4 py-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      لا توجد مواقع مسجّلة لهذا المشروع
                    </div>
                  ) : (
                    <select
                      value={selectedSiteId ?? ''}
                      onChange={e => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="">— اختر الموقع —</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              )}

              {/* معاينة السياق المحدد */}
              {contextOk && (
                <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    السياق محدد — جاهز للمرحلة التالية
                  </div>
                  <div className={`grid gap-2 text-xs ${config.requiresSite ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div className="bg-gray-800/60 rounded p-2">
                      <div className="text-gray-500 mb-0.5">Tenant</div>
                      <div className="text-gray-200 font-mono truncate">{TENANT_CODE}</div>
                    </div>
                    {config.requiresProject && (
                      <div className="bg-gray-800/60 rounded p-2">
                        <div className="text-gray-500 mb-0.5">Project ID</div>
                        <div className="text-blue-300 font-mono">{selectedProjectId}</div>
                      </div>
                    )}
                    {config.requiresSite && (
                      <div className="bg-gray-800/60 rounded p-2">
                        <div className="text-gray-500 mb-0.5">Site ID</div>
                        <div className="text-purple-300 font-mono">{selectedSiteId}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              STEP 2: رفع الملف + معاينة
          ════════════════════════════════════════ */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Context summary badge — only when context was needed */}
              {(config.requiresProject || config.requiresSite) && (
                <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-sm">
                  {config.requiresProject && (<>
                    <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-gray-400">المشروع:</span>
                    <span className="text-blue-300 font-medium">
                      {projects.find(p => p.id === selectedProjectId)?.name}
                    </span>
                  </>)}
                  {config.requiresSite && (<>
                    <MapPin className="w-4 h-4 text-purple-400 shrink-0 mr-2" />
                    <span className="text-gray-400">الموقع:</span>
                    <span className="text-purple-300 font-medium">
                      {sites.find(s => s.id === selectedSiteId)?.name}
                    </span>
                  </>)}
                </div>
              )}

              {/* منطقة السحب والإفلات */}
              <div
                onClick={() => document.getElementById('import-file-input')?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 cursor-pointer text-center transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500 bg-gray-800/30'
                }`}
              >
                <input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelected(f);
                  }}
                />
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-300 font-medium mb-1">
                  {file ? file.name : 'اسحب الملف هنا أو اضغط للاختيار'}
                </p>
                <p className="text-gray-500 text-xs">يدعم: .csv · .xlsx</p>
                {file && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-600/20 text-blue-300 text-xs px-3 py-1 rounded-full">
                    <FileText className="w-3 h-3" />
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>

              {/* خطأ */}
              {importError && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {importError}
                </div>
              )}

              {/* تحميل المعاينة */}
              {loadingPreview && (
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ تحليل الملف...
                </div>
              )}

              {/* معاينة البيانات */}
              {preview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Eye className="w-4 h-4 text-blue-400" />
                    معاينة الملف — {preview.total_rows} صف إجمالي
                  </div>

                  {/* الأعمدة المكتشفة */}
                  <div className="flex flex-wrap gap-1.5">
                    {preview.detected_canonical_fields.map(col => (
                      <span key={col} className="text-xs bg-green-800/30 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">
                        ✓ {col}
                      </span>
                    ))}
                    {preview.unmapped_columns.map(col => (
                      <span key={col} className="text-xs bg-yellow-800/20 text-yellow-400 border border-yellow-600/30 px-2 py-0.5 rounded-full">
                        ؟ {col}
                      </span>
                    ))}
                  </div>

                  {/* جدول المعاينة */}
                  {preview.preview.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-gray-800">
                          <tr>
                            {Object.keys(preview.preview[0]).map(col => (
                              <th key={col} className="px-3 py-2 text-gray-400 font-medium whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.preview.slice(0, 5).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-800/30'}>
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[120px] truncate">
                                  {String(val ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.preview.length > 5 && (
                        <div className="text-center text-gray-500 text-xs py-2 border-t border-gray-700">
                          + {preview.preview.length - 5} صفوف أخرى في المعاينة...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              STEP 3: النتائج
          ════════════════════════════════════════ */}
          {step === 'result' && result && (
            <div className="space-y-5">
              <div className={`rounded-xl p-5 border ${
                result.failed === 0
                  ? 'bg-green-900/20 border-green-700/40'
                  : 'bg-yellow-900/20 border-yellow-600/40'
              }`}>
                <div className={`flex items-center gap-2 font-bold text-lg mb-3 ${
                  result.failed === 0 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {result.failed === 0
                    ? <><CheckCircle className="w-5 h-5" /> اكتمل الاستيراد بنجاح</>
                    : <><AlertTriangle className="w-5 h-5" /> اكتمل الاستيراد مع بعض الأخطاء</>
                  }
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-200">{result.total}</div>
                    <div className="text-gray-400 text-xs mt-1">إجمالي الصفوف</div>
                  </div>
                  <div className="bg-green-900/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{result.total - result.failed}</div>
                    <div className="text-gray-400 text-xs mt-1">نجح</div>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{result.failed}</div>
                    <div className="text-gray-400 text-xs mt-1">فشل</div>
                  </div>
                </div>
              </div>

              {/* تفاصيل السياق */}
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Tenant</span>
                  <span className="text-gray-200 font-mono">{TENANT_CODE}</span>
                </div>
                {result.project_id != null && (
                  <div className="flex justify-between text-gray-400">
                    <span>Project ID</span>
                    <span className="text-blue-300 font-mono">{result.project_id}</span>
                  </div>
                )}
                {result.site_id != null && (
                  <div className="flex justify-between text-gray-400">
                    <span>Site ID</span>
                    <span className="text-purple-300 font-mono">{result.site_id}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Batch ID</span>
                  <span className="text-gray-500 font-mono text-xs">{result.batch_id}</span>
                </div>
              </div>

              {/* صفوف الخطأ */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-red-400 text-sm font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    صفوف فاشلة ({result.errors.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs bg-red-900/10 border border-red-800/30 rounded px-3 py-1.5 text-red-300">
                        صف {err.row}: {err.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          {/* زر السابق */}
          {step === 'upload' && (config.requiresProject || config.requiresSite) && (
            <button
              onClick={() => setStep('context')}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              رجوع
            </button>
          )}
          {!(step === 'upload' && (config.requiresProject || config.requiresSite)) && <div />}

          {/* زر التالي / الاستيراد */}
          {step === 'context' && (
            <button
              disabled={!contextOk}
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              التالي: رفع الملف
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {step === 'upload' && (
            <button
              disabled={!file || !preview || importing || !!importError}
              onClick={handleImport}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الاستيراد...</>
              ) : (
                <><Upload className="w-4 h-4" /> استيراد {preview ? `(${preview.total_rows} صف)` : ''}</>
              )}
            </button>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              إغلاق
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
