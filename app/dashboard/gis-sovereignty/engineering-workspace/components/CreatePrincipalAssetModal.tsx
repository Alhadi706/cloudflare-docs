'use client';
/**
 * CreatePrincipalAssetModal — Phase 5A (Unified Asset Creation)
 * ═════════════════════════════════════════════════════════════
 * يظهر بعد إنهاء الرسم على الخريطة.
 *
 * مسارات الإنشاء:
 *   A: أصل مستقل   → اسم + تصنيف + قسم + حفظ
 *   B: أصل فرعي    → نفس A + اختيار الأصل الأب
 *
 * تبويب منفصل: "ربط بأصل موجود" للحالات التي رُسم فيها الشكل
 * على أصل ERP مسجّل مسبقاً (تعيين إحداثيات فقط).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Hexagon, Route, Loader2, CheckCircle, Link2, Building2, Search, GitBranch } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

type Props = {
  geometry: any | null;
  geometryType: 'polygon' | 'path' | null;
  defaultName?: string;
  defaultClassification?: string;
  defaultOwnerDepartment?: string;
  defaultStatus?: string;
  uploadProgress?: { fileName: string; index: number; total: number };
  onSaved: (asset: { id: string; name: string }) => void;
  onClose: () => void;
  onStartDrawing?: (mode: 'polygon' | 'line') => void;
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
  'خط أنابيب',
  'محطة ضخ',
  'خزان',
  'أخرى',
];

const DEPARTMENTS = [
  { key: 'engineering',    label: 'الهندسة' },
  { key: 'maintenance',    label: 'الصيانة' },
  { key: 'operations',     label: 'التشغيل' },
  { key: 'services',       label: 'الخدمات' },
  { key: 'electricity',    label: 'الكهرباء' },
  { key: 'communications', label: 'الاتصالات' },
  { key: 'hr',             label: 'الموارد البشرية' },
  { key: 'facilities',     label: 'المرافق' },
];

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

function getCentroid(geom: any): { lat: number; lng: number } | null {
  if (!geom) return null;
  const coords = geom.type === 'Point' ? [geom.coordinates]
    : geom.type === 'LineString' ? geom.coordinates
    : geom.type === 'Polygon' ? geom.coordinates[0]
    : null;
  if (!coords || coords.length === 0) return null;
  const lngs = coords.map((c: number[]) => c[0]);
  const lats  = coords.map((c: number[]) => c[1]);
  return {
    lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
    lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
  };
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

  // ── Tab: create | link ──────────────────────────────────────────────────
  const [tab, setTab] = useState<'create' | 'link'>('create');

  // ── Create form ─────────────────────────────────────────────────────────
  const [name,           setName]           = useState(defaultName || '');
  const [classification, setClassification] = useState(defaultClassification || '');
  const [ownerDept,      setOwnerDept]      = useState(defaultOwnerDepartment || 'engineering');
  const [status,         setStatus]         = useState(defaultStatus || 'active');
  const [saving,         setSaving]         = useState(false);

  // ── Child asset toggle ──────────────────────────────────────────────────
  const [isChild,        setIsChild]        = useState(false);
  const [parentAssets,   setParentAssets]   = useState<Array<{ id: string; name: string; classification?: string }>>([]);
  const [parentId,       setParentId]       = useState('');
  const [parentQuery,    setParentQuery]    = useState('');
  const [parentLoading,  setParentLoading]  = useState(false);

  // ── Link-to-existing (Mode A) ───────────────────────────────────────────
  const [erpAssets,     setErpAssets]     = useState<Array<{ id: string | number; asset_name: string; asset_type: string; status: string }>>([]);
  const [erpLoading,    setErpLoading]    = useState(false);
  const [erpQuery,      setErpQuery]      = useState('');
  const [selectedErpId, setSelectedErpId] = useState<string | number>('');
  const [linkSaving,    setLinkSaving]    = useState(false);

  React.useEffect(() => { setName(defaultName || ''); },              [defaultName]);
  React.useEffect(() => { setClassification(defaultClassification || ''); }, [defaultClassification]);
  React.useEffect(() => { setOwnerDept(defaultOwnerDepartment || 'engineering'); }, [defaultOwnerDepartment]);
  React.useEffect(() => { setStatus(defaultStatus || 'active'); },    [defaultStatus]);

  const resolvedType = geometryType
    ?? (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon' ? 'polygon' : 'path');

  // Load assets for parent selector when isChild is toggled on
  useEffect(() => {
    if (!isChild || parentAssets.length > 0) return;
    setParentLoading(true);
    fetch('/api/engineering/workspace/principal-assets', { headers: getClientTenantHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any[]) => setParentAssets(d))
      .catch(() => {})
      .finally(() => setParentLoading(false));
  }, [isChild]);

  // Load ERP assets for link tab
  const loadErpAssets = useCallback(async () => {
    setErpLoading(true);
    try {
      const res = await fetch('/api/v1/workspace/assets/all?limit=500', { headers: getClientTenantHeaders() });
      if (res.ok) { const d = await res.json(); setErpAssets(d.assets || []); }
    } catch { /* silent */ } finally { setErpLoading(false); }
  }, []);
  useEffect(() => { if (tab === 'link') loadErpAssets(); }, [tab, loadErpAssets]);

  // ── Save: create asset ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { showToast('يرجى إدخال اسم الأصل', 'warning'); return; }
    if (!geometry)    { showToast('ارسم شكلاً على الخريطة أولاً', 'warning'); return; }
    if (isChild && !parentId) { showToast('اختر الأصل الرئيسي', 'warning'); return; }

    setSaving(true);
    try {
      const tenantId = getTenantId();
      const payload: Record<string, any> = {
        name: name.trim(),
        geometry_type: resolvedType,
        classification:   classification || null,
        owner_department: ownerDept,
        status,
        geometry,
        properties: {
          asset_class: isChild ? 'component_slot' : 'site_asset',
          ...(isChild ? { parent_asset_id: parentId } : {}),
        },
        ...(isChild ? { parent_asset_id: parentId } : {}),
        ...(tenantId ? { tenant_id: tenantId } : {}),
      };
      const res = await fetch('/api/engineering/workspace/principal-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
        body: JSON.stringify(payload),
      });
      const saved = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(saved.error || saved.detail || `خطأ ${res.status}`);
      showToast(`✅ تم إنشاء الأصل "${name}"`, 'success');
      onSaved({ id: saved.id, name: name.trim() });
      onClose();
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Save: link geometry to existing asset ───────────────────────────────
  const handleLinkSave = async () => {
    if (!selectedErpId) { showToast('اختر أصلاً من القائمة أولاً', 'warning'); return; }
    if (!geometry)       { showToast('لا توجد هندسة مرسومة', 'warning'); return; }
    const centroid = getCentroid(geometry);
    if (!centroid) { showToast('تعذّر استخراج الإحداثيات', 'warning'); return; }
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

  const filteredParents = parentAssets.filter(a => {
    const q = parentQuery.toLowerCase();
    return !q || a.name?.toLowerCase().includes(q);
  }).slice(0, 25);

  const filteredErp = erpAssets.filter(a => {
    const q = erpQuery.toLowerCase();
    return !q || a.asset_name?.toLowerCase().includes(q) || a.asset_type?.toLowerCase().includes(q);
  }).slice(0, 30);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[480px] max-w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {resolvedType === 'polygon'
              ? <Hexagon className="w-5 h-5 text-cyan-400" />
              : <Route className="w-5 h-5 text-emerald-400" />}
            <h2 className="text-sm font-bold text-gray-100">
              {tab === 'link' ? 'تعيين موقع لأصل موجود' : isChild ? 'إضافة أصل فرعي' : 'إنشاء أصل جديد'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-800 bg-gray-950/40 shrink-0">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition border-b-2 ${
              tab === 'create'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-900/10'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            إنشاء أصل جديد
          </button>
          <button
            onClick={() => setTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition border-b-2 ${
              tab === 'link'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-900/10'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            ربط بأصل موجود
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-4 space-y-4">

            {/* ══ TAB: CREATE ═══════════════════════════════════════════════ */}
            {tab === 'create' && (
              <>
                {uploadProgress && uploadProgress.total > 1 && (
                  <div className="rounded-lg border border-indigo-700/40 bg-indigo-900/20 px-3 py-2 text-xs text-indigo-200">
                    استيراد "{uploadProgress.fileName}" — عنصر {uploadProgress.index + 1} من {uploadProgress.total}
                  </div>
                )}

                {/* ── أصل مستقل / أصل فرعي toggle ──────────────────────── */}
                <div className="flex gap-2 p-1 bg-gray-800/60 rounded-xl border border-gray-700/50">
                  <button
                    onClick={() => { setIsChild(false); setParentId(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                      !isChild
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    أصل مستقل
                  </button>
                  <button
                    onClick={() => setIsChild(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                      isChild
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    أصل فرعي (مكوّن)
                  </button>
                </div>

                {/* ── Parent selector — shown only when isChild ──────────── */}
                {isChild && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-3 space-y-2">
                    <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" />
                      اختر الأصل الرئيسي الذي يحتوي هذا المكوّن
                    </p>
                    <div className="relative">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                      <input
                        value={parentQuery}
                        onChange={e => setParentQuery(e.target.value)}
                        placeholder="ابحث عن الأصل الرئيسي..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pr-8 pl-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
                      {parentLoading ? (
                        <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-gray-500">
                          <Loader2 className="w-3 h-3 animate-spin" /> جاري التحميل...
                        </div>
                      ) : filteredParents.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">لا توجد أصول — أنشئ أصلاً رئيسياً أولاً</p>
                      ) : filteredParents.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setParentId(a.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-right transition text-xs ${
                            parentId === a.id
                              ? 'bg-amber-600/20 border-r-2 border-amber-500 text-amber-200'
                              : 'text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          <span className="flex-1 truncate">{a.name}</span>
                          {a.classification && <span className="text-gray-600 shrink-0">{a.classification}</span>}
                          {parentId === a.id && <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Asset name ────────────────────────────────────────── */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    الاسم <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isChild ? 'مثال: مضخة رقم 3، صمام التحكم A' : 'مثال: خط أنبوب النهر الرئيسي'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                {/* ── Classification ────────────────────────────────────── */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">التصنيف</label>
                  <select
                    value={classification}
                    onChange={e => setClassification(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">— اختر تصنيفاً —</option>
                    {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* ── Owner dept + Status ────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">الحالة</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="active">نشط</option>
                      <option value="under_construction">تحت الإنشاء</option>
                      <option value="inactive">غير نشط</option>
                    </select>
                  </div>
                </div>

                {/* ── No geometry warning ───────────────────────────────── */}
                {!geometry && (
                  <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 p-3 space-y-2">
                    <p className="text-xs text-amber-300 text-center">⚠️ ارسم الشكل على الخريطة أولاً</p>
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

            {/* ══ TAB: LINK ════════════════════════════════════════════════ */}
            {tab === 'link' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-cyan-700/30 bg-cyan-900/10 px-3 py-2 text-xs text-cyan-300">
                  اختر أصلاً مُسجَّلاً — سيحصل على إحداثيات دقيقة من الشكل المرسوم على الخريطة.
                </div>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    value={erpQuery}
                    onChange={e => setErpQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو النوع..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800/40 divide-y divide-gray-800">
                  {erpLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري التحميل...
                    </div>
                  ) : filteredErp.map(a => (
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
                  ))}
                  {!erpLoading && erpAssets.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">لا توجد أصول في السجل</p>
                  )}
                </div>
                {selectedErpId && !geometry && (
                  <p className="text-xs text-amber-400 text-center">⚠️ ارسم شكلاً على الخريطة أولاً</p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3 shrink-0">
          {tab === 'create' ? (
            <button
              onClick={handleSave}
              disabled={saving || !geometry || (isChild && !parentId)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><CheckCircle className="w-4 h-4" /> {isChild ? 'إضافة الأصل الفرعي' : 'إنشاء الأصل'}</>
              }
            </button>
          ) : (
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

