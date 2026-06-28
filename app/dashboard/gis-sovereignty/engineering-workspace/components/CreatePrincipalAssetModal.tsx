'use client';
/**
 * CreatePrincipalAssetModal
 * يظهر بعد إنهاء الرسم على الخريطة أو بالضغط على زر "إنشاء أصل رئيسي"
 */
import React, { useState } from 'react';
import { X, Hexagon, Route, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { validatePrincipalAssetCreatePayload } from '@/lib/gis/assetGovernanceRules';

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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[460px] max-w-full mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {resolvedType === 'polygon'
              ? <Hexagon className="w-5 h-5 text-cyan-400" />
              : <Route className="w-5 h-5 text-emerald-400" />
            }
            <h2 className="text-sm font-bold text-gray-100">إنشاء أصل رئيسي — {resolvedType === 'polygon' ? 'مضلع' : 'مسار'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

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
