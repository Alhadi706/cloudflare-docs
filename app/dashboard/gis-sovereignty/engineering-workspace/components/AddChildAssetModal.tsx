'use client';
/**
 * AddChildAssetModal
 * إضافة أصل فرعي بثلاثة أنواع هندسية: نقطة / مضلع / مسار
 */
import React, { useState, useEffect } from 'react';
import { X, MapPin, Loader2, CheckCircle, Pentagon, Waypoints } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { useGisEngine } from '@/store/gisEngine';
import { validateChildAssetCreatePayload } from '@/lib/gis/assetGovernanceRules';
import type { PrincipalAsset } from './AssetLeftPanel';

type Props = {
  principalAssets: PrincipalAsset[];
  preselectedParentId?: string | null;
  onSaved: () => void;
  onClose: () => void;
};

type GeomMode = 'point' | 'polygon' | 'path';

const ASSET_TYPES = [
  { key: 'storage',    label: 'مخزن',              color: '#f97316' },
  { key: 'building',   label: 'مبنى',               color: '#3b82f6' },
  { key: 'valve',      label: 'صمام',               color: '#ef4444' },
  { key: 'pump',       label: 'مضخة',               color: '#06b6d4' },
  { key: 'generator',  label: 'مولّد',              color: '#f59e0b' },
  { key: 'tank',       label: 'خزان',               color: '#8b5cf6' },
  { key: 'station',    label: 'محطة',               color: '#10b981' },
  { key: 'junction',   label: 'تقاطع / وصلة',      color: '#64748b' },
  { key: 'sensor',     label: 'حساس / جهاز قياس',  color: '#22d3ee' },
  { key: 'equipment',  label: 'معدة / آلة',         color: '#a855f7' },
  { key: 'office',     label: 'مكتب / إداري',       color: '#84cc16' },
  { key: 'other',      label: 'أخرى',               color: '#6b7280' },
];

const DEPARTMENTS = [
  { key: 'engineering',    label: 'الهندسة' },
  { key: 'services',       label: 'الخدمات' },
  { key: 'electricity',    label: 'الكهرباء' },
  { key: 'maintenance',    label: 'الصيانة' },
  { key: 'communications', label: 'الاتصالات' },
  { key: 'hr',             label: 'الموارد البشرية' },
  { key: 'facilities',     label: 'المرافق' },
  { key: 'technical',      label: 'التقني' },
];

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

const GEOM_MODES: { key: GeomMode; label: string; hint: string }[] = [
  { key: 'point',   label: 'نقطة',  hint: 'نقرة واحدة على الخريطة' },
  { key: 'polygon', label: 'مضلع',  hint: 'ارسم حدود المنطقة' },
  { key: 'path',    label: 'مسار',  hint: 'ارسم خطاً أو مساراً' },
];

export default function AddChildAssetModal({ principalAssets, preselectedParentId, onSaved, onClose }: Props) {
  const { showToast } = useToast();
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);

  const [parentId, setParentId]   = useState(preselectedParentId ?? (principalAssets[0]?.id ?? ''));
  const [name, setName]           = useState('');
  const [assetType, setAssetType] = useState('building');
  const [dept, setDept]           = useState('engineering');
  const [status, setStatus]       = useState('active');
  const [geomMode, setGeomMode]   = useState<GeomMode>('point');
  const [geometry, setGeometry]   = useState<any>(null);
  const [picking, setPicking]     = useState(false);
  const [saving, setSaving]       = useState(false);

  // Receive point picked
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ geometry: any }>;
      if (ev.detail?.geometry) {
        setGeometry(ev.detail.geometry);
        setPicking(false);
        setDrawingMode('idle');
        (window as any).__childGeometryPicking = false;
        showToast('📍 تم تحديد موقع الأصل الفرعي', 'success');
      }
    };
    window.addEventListener('asset:child-point-picked', handler as EventListener);
    return () => window.removeEventListener('asset:child-point-picked', handler as EventListener);
  }, [setDrawingMode, showToast]);

  // Receive polygon/path picked (flagged to prevent page.tsx from intercepting)
  useEffect(() => {
    const handler = (e: Event) => {
      if (!(window as any).__childGeometryPicking) return;
      const ev = e as CustomEvent<{ geometry: any; mode: string }>;
      if (ev.detail?.geometry) {
        setGeometry(ev.detail.geometry);
        setPicking(false);
        setDrawingMode('idle');
        (window as any).__childGeometryPicking = false;
        showToast('✅ تم تحديد هندسة الأصل الفرعي', 'success');
      }
    };
    window.addEventListener('engineering:feature-drawn', handler as EventListener);
    return () => window.removeEventListener('engineering:feature-drawn', handler as EventListener);
  }, [setDrawingMode, showToast]);

  useEffect(() => {
    return () => { (window as any).__childGeometryPicking = false; };
  }, []);

  const startPicking = () => {
    setPicking(true);
    // Ensure page-level draw listeners treat this drawing session as child-asset flow.
    (window as any).__childGeometryPicking = true;
    if (geomMode === 'point') {
      setDrawingMode('point');
    } else if (geomMode === 'polygon') {
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setDrawingMode('polygon');
    } else {
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setDrawingMode('line');
    }
  };

  const cancelPicking = () => {
    setPicking(false);
    setDrawingMode('idle');
    (window as any).__childGeometryPicking = false;
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('يرجى إدخال اسم الأصل الفرعي', 'warning'); return; }
    if (!parentId)    { showToast('اختر الأصل الرئيسي', 'warning'); return; }
    if (!geometry)    { showToast('يرجى تحديد موقع الأصل على الخريطة', 'warning'); return; }

    const payload = {
      name: name.trim(),
      asset_type: assetType,
      owner_department: dept,
      status,
      geometry,
      properties: { geometry_mode: geomMode },
    };
    const check = validateChildAssetCreatePayload(payload, parentId);
    if (!check.ok) {
      showToast(check.error || 'فشل تحقق حوكمة الأصل', 'error');
      return;
    }

    setSaving(true);
    try {
      const tenantId = getTenantId();
      const res = await fetch(`/api/engineering/workspace/principal-assets/${parentId}/children`, {
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
      showToast(`✅ تم إضافة الأصل الفرعي "${name}"`, 'success');
      onSaved();
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedTypeColor = ASSET_TYPES.find(t => t.key === assetType)?.color ?? '#6b7280';

  // ── Picking overlay ──
  if (picking) {
    return (
      <div className="fixed inset-0 z-[9999] pointer-events-none" dir="rtl">
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-3 bg-amber-900/90 border border-amber-500 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-sm">
            <MapPin className="w-5 h-5 text-amber-300 shrink-0 animate-bounce" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                {geomMode === 'point'
                  ? 'انقر على الخريطة لتحديد موقع الأصل'
                  : geomMode === 'polygon'
                    ? 'ارسم المضلع على الخريطة ثم انقر مرتين للإنهاء'
                    : 'ارسم المسار على الخريطة ثم انقر مرتين للإنهاء'}
              </p>
              <p className="text-xs text-amber-400">
                {geomMode === 'point' ? 'نقرة واحدة كافية' : 'انقر على الخريطة لإضافة نقاط، انقر مرتين للإنهاء'}
              </p>
            </div>
            <button onClick={cancelPicking} className="mr-2 text-amber-400 hover:text-white transition text-xs underline">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal modal ──
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[480px] max-w-full mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTypeColor }} />
            <h2 className="text-sm font-bold text-gray-100">إضافة أصل فرعي</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Geometry mode selector */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">نوع الهندسة</label>
            <div className="grid grid-cols-3 gap-2">
              {GEOM_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => { setGeomMode(m.key); setGeometry(null); }}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition ${
                    geomMode === m.key
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                      : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>{m.label}</span>
                  <span className="text-[9px] opacity-60">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parent asset */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الأصل الرئيسي <span className="text-red-400">*</span></label>
            {principalAssets.length === 0 ? (
              <p className="text-xs text-gray-600">لا توجد أصول رئيسية</p>
            ) : (
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">— اختر الأصل الرئيسي —</option>
                {principalAssets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الاسم <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: مضخة رئيسية #1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Asset type — colored grid */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">نوع الأصل</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ASSET_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setAssetType(t.key)}
                  className="px-2 py-1.5 rounded-lg border text-[11px] font-medium transition flex items-center gap-1"
                  style={assetType === t.key
                    ? { backgroundColor: t.color + '33', borderColor: t.color, color: t.color }
                    : { backgroundColor: 'rgba(31,41,55,0.6)', borderColor: '#374151', color: '#9ca3af' }
                  }
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الإدارة المالكة</label>
            <select
              value={dept}
              onChange={e => setDept(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>

          {/* Location picker */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الموقع على الخريطة <span className="text-red-400">*</span></label>
            <button
              onClick={startPicking}
              className={`w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition ${
                geometry
                  ? 'bg-green-900/30 border-green-600/50 text-green-300'
                  : 'bg-amber-900/20 border-amber-600/50 text-amber-300 hover:bg-amber-900/40'
              }`}
            >
              <MapPin className="w-4 h-4" />
              {geometry
                ? `✅ تم تحديد الموقع (${GEOM_MODES.find(m => m.key === geomMode)?.label}) — انقر لإعادة التحديد`
                : `📍 انقر هنا ثم ${GEOM_MODES.find(m => m.key === geomMode)?.hint}`
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !geometry || !parentId}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
              : <><CheckCircle className="w-4 h-4" /> حفظ الأصل الفرعي</>
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
