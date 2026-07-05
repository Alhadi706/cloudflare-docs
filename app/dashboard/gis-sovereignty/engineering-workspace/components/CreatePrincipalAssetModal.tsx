'use client';
/**
 * CreatePrincipalAssetModal — Phase 3 (GIS as Location Provider)
 * ════════════════════════════════════════════════════════════════
 * يظهر بعد إنهاء الرسم على الخريطة أو بالضغط على زر "إنشاء أصل رئيسي"
 *
 * Phase 3 adds a MODE selector:
 *   Mode A: "ربط بأصل موجود"     → assigns drawn geometry coords to an ERP asset
 *   Mode B: "إنشاء أصل هندسي جديد" → current behavior (GIS infrastructure asset)
 *
 * This enforces: GIS = Location Provider, NOT Asset Creator.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Hexagon, Route, Loader2, CheckCircle, Link2, Building2, Search } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { validatePrincipalAssetCreatePayload } from '@/lib/gis/assetGovernanceRules';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

type Props = {
  geometry: any | null;          // GeoJSON geometry from drawing (nullable for manual open)
  geometryType: 'polygon' | 'path' | null;
  defaultName?: string;
  defaultClassification?: string;
  defaultOwnerDepartment?: string;
  defaultStatus?: string;
  uploadProgress?: { fileName: string; index: number; total: number };
  onSaved: (asset: { id: string; name: string }) => void;
  onClose: () => void;
  onStartDrawing?: (mode: 'polygon' | 'line') => void;  // callback to start drawing on map
};

const CLASSIFICATIONS = [
  'بنية تحتية مائية',
  'شبكة كهرباء',
  'شبكة صرف صحي',
  'طريق / مواصلات',
  'منطقة صناعية',
  'مجمع سكني',
  'مرفق خدمي',
  'موقع حيوي',
  'أخرى',
];

const DEPARTMENTS = [
  { key: 'engineering',    label: 'الهندسة' },
  { key: 'services',       label: 'الخدمات' },
  { key: 'electricity',    label: 'الكهرباء' },
  { key: 'maintenance',    label: 'الصيانة' },
  { key: 'communications', label: 'الاتصالات' },
  { key: 'hr',             label: 'الموارد البشرية' },
  { key: 'facilities',     label: 'المرافق' },
];

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

export default function CreatePrincipalAssetModal({
  geometry,
  geometryType,
  defaultName,
  defaultClassification,
  defaultOwnerDepartment,
  defaultStatus,
  uploadProgress,
  onSaved,
  onClose,
  onStartDrawing,
}: Props) {
  const { showToast } = useToast();

  // ── Phase 3: Mode selector ─────────────────────────────────────────────────
  type DrawMode = 'link' | 'create';
  const [drawMode, setDrawMode] = useState<DrawMode>('link');

  // ── Mode A: Link to existing ERP asset ───────────────────────────────────
  const [erpAssets, setErpAssets] = useState<Array<{ id: string | number; asset_name: string; asset_type: string; status: string }>>([]);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpQuery, setErpQuery] = useState('');
  const [selectedErpId, setSelectedErpId] = useState<string | number>('');
  const [linkSaving, setLinkSaving] = useState(false);

  const loadErpAssets = useCallback(async () => {
    setErpLoading(true);
    try {
      const res = await fetch('/api/v1/workspace/assets/all?limit=500', {
        headers: getClientTenantHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setErpAssets(d.assets || []);
      }
    } catch { /* silent */ } finally {
      setErpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (drawMode === 'link') loadErpAssets();
  }, [drawMode, loadErpAssets]);

  // Extract centroid from geometry
  function getCentroid(geom: any): { lat: number; lng: number } | null {
    if (!geom) return null;
    const coords = geom.type === 'Point' ? [geom.coordinates]
      : geom.type === 'LineString' ? geom.coordinates
      : geom.type === 'Polygon' ? geom.coordinates[0]
      : null;
    if (!coords || coords.length === 0) return null;
    const lngs = coords.map((c: number[]) => c[0]);
    const lats = coords.map((c: number[]) => c[1]);
    return {
      lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
      lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
    };
  }

  const handleLinkSave = async () => {
    if (!selectedErpId) { showToast('اختر أصلاً من القائمة أولاً', 'warning'); return; }
    if (!geometry) { showToast('لا توجد هندسة مرسومة', 'warning'); return; }
    const centroid = getCentroid(geometry);
    if (!centroid) { showToast('تعذّر استخراج إحداثيات من الشكل المرسوم', 'warning'); return; }
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/v1/workspace/assets/${selectedErpId}`, {
        method: 'PUT',
        headers: { ...getClientTenantHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: centroid.lat, longitude: centroid.lng }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || d.error || `خطأ ${res.status}`);
      const asset = erpAssets.find(a => String(a.id) === String(selectedErpId));
      showToast(`✅ تم تعيين موقع "${asset?.asset_name || 'الأصل'}" على الخريطة`, 'success');
      onSaved({ id: String(selectedErpId), name: asset?.asset_name || String(selectedErpId) });
      onClose();
    } catch (e: any) {
      showToast(`فشل الربط: ${e.message}`, 'error');
    } finally {
      setLinkSaving(false);
    }
  };

  // ── Mode B: Create new GIS infrastructure asset ──────────────────────────
  const [name, setName]           = useState(defaultName || '');
  const [classification, setClassification] = useState(defaultClassification || '');
  const [ownerDept, setOwnerDept] = useState(defaultOwnerDepartment || 'engineering');
  const [status, setStatus]       = useState(defaultStatus || 'active');
  const [saving, setSaving]       = useState(false);

  React.useEffect(() => { setName(defaultName || ''); }, [defaultName]);
  React.useEffect(() => { setClassification(defaultClassification || ''); }, [defaultClassification]);
  React.useEffect(() => { setOwnerDept(defaultOwnerDepartment || 'engineering'); }, [defaultOwnerDepartment]);
  React.useEffect(() => { setStatus(defaultStatus || 'active'); }, [defaultStatus]);

  // Determine geometry type from geometry if not passed
  const resolvedType = geometryType
    ?? (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon' ? 'polygon' : 'path');
  const classificationOptions = React.useMemo(() => {
    if (!classification || CLASSIFICATIONS.includes(classification)) return CLASSIFICATIONS;
    return [classification, ...CLASSIFICATIONS];
  }, [classification]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('يرجى إدخال اسم الأصل', 'warning');
      return;
    }
    if (!geometry) {
      showToast('لا توجد هندسة مرسومة — ارسم مضلعاً أو مساراً أولاً', 'warning');
      return;
    }

    const payload = {
      name: name.trim(),
      geometry_type: resolvedType,
      classification: classification || null,
      owner_department: ownerDept,
      status,
      geometry,
      properties: {},
    };
    const check = validatePrincipalAssetCreatePayload(payload);
    if (!check.ok) {
      showToast(check.error || 'فشل تحقق حوكمة الأصل', 'error');
      return;
    }

    setSaving(true);
    try {
      const tenantId = getTenantId();
      const res = await fetch('/api/engineering/workspace/principal-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
        body: JSON.stringify({
          ...payload,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `خطأ ${res.status}`);
      }
      const saved = await res.json();
      showToast(`✅ تم إنشاء الأصل "${name}"`, 'success');
      onSaved({ id: saved.id, name: name.trim() });
      onClose();
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[500px] max-w-full mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {resolvedType === 'polygon'
              ? <Hexagon className="w-5 h-5 text-cyan-400" />
              : <Route className="w-5 h-5 text-emerald-400" />
            }
            <h2 className="text-sm font-bold text-gray-100">
              {drawMode === 'link' ? 'تعيين موقع لأصل موجود' : 'إنشاء أصل هندسي جديد'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Phase 3: Mode selector */}
        <div className="flex gap-0 border-b border-gray-800 bg-gray-950/40">
          <button
            onClick={() => setDrawMode('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition border-b-2 ${
              drawMode === 'link'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-900/10'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            ربط بأصل موجود في Registry
          </button>
          <button
            onClick={() => setDrawMode('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition border-b-2 ${
              drawMode === 'create'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-900/10'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            إنشاء أصل هندسي جديد
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">

          {/* ── Mode A: Link to existing ERP asset ────────────────────────── */}
          {drawMode === 'link' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-cyan-700/30 bg-cyan-900/10 px-3 py-2 text-xs text-cyan-300">
                <strong>كيف يعمل:</strong> اختر أصلاً مُسجَّلاً في سجل الأصول — سيحصل على إحداثيات دقيقة من الشكل المرسوم على الخريطة ويظهر في Asset 360.
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={erpQuery}
                  onChange={e => setErpQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو النوع..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Asset list */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800/40 divide-y divide-gray-800">
                {erpLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري التحميل...
                  </div>
                ) : erpAssets
                    .filter(a => {
                      const q = erpQuery.toLowerCase();
                      return !q || a.asset_name?.toLowerCase().includes(q) || a.asset_type?.toLowerCase().includes(q);
                    })
                    .slice(0, 30)
                    .map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedErpId(a.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition ${
                          String(selectedErpId) === String(a.id)
                            ? 'bg-cyan-600/20 border-r-2 border-cyan-500'
                            : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-100 truncate">{a.asset_name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{a.asset_type} · {a.status}</p>
                        </div>
                        {String(selectedErpId) === String(a.id) && (
                          <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                      </button>
                    ))
                }
                {!erpLoading && erpAssets.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    لا توجد أصول في Registry — أضف أصولاً من{' '}
                    <a href="/dashboard/admin-gateway/assets/registry" target="_blank" className="text-cyan-400 hover:underline">سجل الأصول</a>
                  </p>
                )}
              </div>

              {selectedErpId && !geometry && (
                <p className="text-xs text-amber-400 text-center">⚠️ ارسم شكلاً على الخريطة أولاً ثم احفظ</p>
              )}
            </div>
          )}

          {/* ── Mode B: Create new GIS infrastructure asset ───────────────── */}
          {drawMode === 'create' && (
            <>
              {uploadProgress && uploadProgress.total > 1 && (
                <div className="rounded-lg border border-indigo-700/40 bg-indigo-900/20 px-3 py-2 text-xs text-indigo-200">
                  استيراد من الملف "{uploadProgress.fileName}" — عنصر {uploadProgress.index + 1} من {uploadProgress.total}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">الاسم <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: خط أنبوب النهر الرئيسي"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>

              {/* Classification */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">التصنيف</label>
                <select
                  value={classification}
                  onChange={e => setClassification(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— اختر تصنيفاً —</option>
                  {classificationOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Owner Department */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">الجهة المالكة</label>
                <select
                  value={ownerDept}
                  onChange={e => setOwnerDept(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">الحالة</label>
                <div className="flex gap-2">
                  {['active', 'under_construction', 'inactive'].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                        status === s
                          ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      {s === 'active' ? 'نشط' : s === 'under_construction' ? 'تحت الإنشاء' : 'غير نشط'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Geometry prompt */}
              {!geometry && (
                <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 p-3 space-y-2">
                  <p className="text-xs text-amber-300 text-center">⚠️ لا توجد هندسة — اختر نوع الرسم على الخريطة:</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { onClose(); onStartDrawing?.('polygon'); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 text-xs hover:bg-cyan-600/30 transition"
                    >
                      <Hexagon className="w-3.5 h-3.5" /> رسم مضلع
                    </button>
                    <button
                      type="button"
                      onClick={() => { onClose(); onStartDrawing?.('line'); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 text-xs hover:bg-emerald-600/30 transition"
                    >
                      <Route className="w-3.5 h-3.5" /> رسم مسار
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          {drawMode === 'link' ? (
            <button
              onClick={handleLinkSave}
              disabled={linkSaving || !selectedErpId || !geometry}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {linkSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الربط...</>
                : <><Link2 className="w-4 h-4" /> تعيين الموقع للأصل</>
              }
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !geometry}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><CheckCircle className="w-4 h-4" /> إنشاء الأصل الهندسي</>
              }
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {uploadProgress && uploadProgress.total > 1 && (
            <div className="rounded-lg border border-indigo-700/40 bg-indigo-900/20 px-3 py-2 text-xs text-indigo-200">
              استيراد من الملف "{uploadProgress.fileName}" — عنصر {uploadProgress.index + 1} من {uploadProgress.total}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الاسم <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: محطة ضخ المياه الرئيسية"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>

          {/* Classification */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">التصنيف</label>
            <select
              value={classification}
              onChange={e => setClassification(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">— اختر تصنيفاً —</option>
              {classificationOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Owner Department */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الجهة المالكة</label>
            <select
              value={ownerDept}
              onChange={e => setOwnerDept(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الحالة</label>
            <div className="flex gap-2">
              {['active', 'under_construction', 'inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                    status === s
                      ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {s === 'active' ? 'نشط' : s === 'under_construction' ? 'تحت الإنشاء' : 'غير نشط'}
                </button>
              ))}
            </div>
          </div>

          {/* Geometry prompt — show draw buttons when no geometry yet */}
          {!geometry && (
            <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 p-3 space-y-2">
              <p className="text-xs text-amber-300 text-center">⚠️ لا توجد هندسة — اختر نوع الرسم على الخريطة:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { onClose(); onStartDrawing?.('polygon'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 text-xs hover:bg-cyan-600/30 transition"
                >
                  <Hexagon className="w-3.5 h-3.5" /> رسم مضلع
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); onStartDrawing?.('line'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 text-xs hover:bg-emerald-600/30 transition"
                >
                  <Route className="w-3.5 h-3.5" /> رسم مسار
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !geometry}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
              : <><CheckCircle className="w-4 h-4" /> حفظ الأصل</>
            }
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
