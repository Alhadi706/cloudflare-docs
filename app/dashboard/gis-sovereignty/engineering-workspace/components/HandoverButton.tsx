'use client';
/**
 * HandoverButton — زر الاستلام النهائي
 * ───────────────────────────────────────────────────────
 * يظهر فقط عندما:
 *  - المسار النشط = 'project'
 *  - الأصل المحدد في طبقة project
 *  - الدور مصرح (project_admin, super_admin, site_manager)
 *
 * عند الضغط يفتح dialog للاختيار من طبقات الأصول المتاحة،
 * ثم يُرسل طلب الاستلام للـ API.
 */

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Archive, ChevronDown, X } from 'lucide-react';
import { workspaceApi } from '@/store/apiService';
import { useLayerStore } from '@/store/layerStore';
import { useToast } from '@/components/ToastProvider';

interface HandoverButtonProps {
  assetId: string;
  assetName: string;
  userRole?: string;
  onHandoverComplete?: (newAssetId: string) => void;
}

const ALLOWED_ROLES = new Set(['super_admin', 'project_admin', 'site_manager']);

export default function HandoverButton({
  assetId,
  assetName,
  userRole,
  onHandoverComplete,
}: HandoverButtonProps) {
  const { layers, activePath } = useLayerStore();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [notes, setNotes] = useState('');

  // Only show in project path, for authorised roles
  if (activePath !== 'project') return null;
  if (!userRole || !ALLOWED_ROLES.has(userRole)) return null;

  // Asset layers available as handover targets
  const assetLayers = layers.filter(l => (l.layer_category ?? 'asset') === 'asset');

  const handleHandover = async () => {
    if (!selectedLayerId) {
      showToast('اختر طبقة الأصول المستهدفة أولاً', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await workspaceApi.handoverAsset(
        assetId,
        selectedLayerId,
        {},   // financial_archive — يُمكن توسيعه لاحقاً
        {},   // technical_archive
        notes || undefined,
        {
          source_asset_id: assetId,
          source_asset_name: assetName,
          source_context: 'project_layer',
          handover_trigger: 'engineering_workspace',
        },
      );
      showToast(`✓ تم الاستلام النهائي — "${assetName}" أُضيف لسجل الأصول`, 'success');
      setOpen(false);
      onHandoverComplete?.(result.new_asset_id);
    } catch (err: any) {
      showToast(`فشل الاستلام: ${err?.message ?? 'خطأ غير معروف'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                   bg-emerald-600/20 border border-emerald-500/40 text-emerald-300
                   hover:bg-emerald-600/35 hover:border-emerald-400 transition-all"
        title="تحويل هذا المشروع إلى أصل في سجل الأصول"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        استلام نهائي
      </button>

      {/* Overlay dialog */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <Archive className="w-4 h-4" />
                الاستلام النهائي للمشروع
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Asset name */}
            <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs text-slate-300">
              <span className="text-slate-500">المعلم: </span>
              <span className="font-medium text-white">{assetName}</span>
            </div>

            {/* Target layer select */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">طبقة الأصول المستهدفة</label>
              {assetLayers.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">
                  لا توجد طبقات أصول متاحة — أنشئ طبقة أصول أولاً
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedLayerId}
                    onChange={e => setSelectedLayerId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">— اختر طبقة —</option>
                    {assetLayers.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">ملاحظات الاستلام (اختياري)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="مثال: تم الاستلام بتاريخ ٦/٥/٢٠٢٦ بعد اكتمال الفحوصات الفنية"
                className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder-slate-600"
              />
            </div>

            {/* Warning */}
            <div className="text-[11px] text-amber-400 bg-amber-900/15 border border-amber-700/25 rounded-lg px-3 py-2 leading-relaxed">
              ⚠️ بعد الاستلام: يُنقل المعلم الجغرافي لطبقة الأصول، وتُحفظ البيانات المالية والفنية أرشيفاً دائماً مرتبطاً بالأصل الجديد.
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg text-xs border border-slate-600 text-slate-400 hover:text-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleHandover}
                disabled={loading || !selectedLayerId}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                           font-medium bg-emerald-600 hover:bg-emerald-500 text-white
                           disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                تأكيد الاستلام
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
