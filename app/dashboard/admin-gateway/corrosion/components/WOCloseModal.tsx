'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// نافذة إغلاق أمر العمل — ثلاثة أنواع: إتمام / تقييم / ملاحظات
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { CheckCircle, ClipboardList, FileText, Loader2, MessageSquare, X } from 'lucide-react';

const API = '/api/v1/workflow';
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
    'Content-Type': 'application/json',
  };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

type CloseType = 'completed' | 'evaluation' | 'remarks';

interface Props {
  workOrder: { id: number | string; work_order_number?: string; title?: string; title_ar?: string };
  onClose: () => void;
  onSuccess: () => void;
}

const CLOSE_TYPES: { value: CloseType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'completed',
    label: 'إغلاق بإتمام',
    desc: 'تم تنفيذ أمر العمل بالكامل وفق المواصفات المطلوبة',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300',
  },
  {
    value: 'evaluation',
    label: 'إغلاق بتقييم',
    desc: 'تم التنفيذ مع الحاجة لتقييم نتائج العمل وقياس الفاعلية',
    icon: <ClipboardList className="w-5 h-5" />,
    color: 'border-blue-500/40 bg-blue-900/20 text-blue-300',
  },
  {
    value: 'remarks',
    label: 'إغلاق بملاحظات',
    desc: 'تم الإغلاق مع وجود ملاحظات أو أعمال متبقية تُسجَّل للمتابعة',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'border-amber-500/40 bg-amber-900/20 text-amber-300',
  },
];

export default function WOCloseModal({ workOrder, onClose, onSuccess }: Props) {
  const [closeType, setCloseType] = useState<CloseType>('completed');
  const [completionNotes, setCompletionNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [findings, setFindings] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!completionNotes.trim()) { setError('يرجى إدخال ملاحظات الإغلاق'); return; }
    setSaving(true); setError('');
    try {
      const body: any = {
        status: 'closed',
        notes: [
          `[CLOSURE_TYPE:${closeType.toUpperCase()}]`,
          `نوع الإغلاق: ${CLOSE_TYPES.find(t => t.value === closeType)?.label}`,
          completionNotes,
          actionTaken ? `الإجراء المتخذ: ${actionTaken}` : '',
          findings ? `النتائج: ${findings}` : '',
          nextSteps ? `الخطوات التالية: ${nextSteps}` : '',
        ].filter(Boolean).join('\n'),
      };

      const r = await fetch(`${API}/work-orders/${workOrder.id}/status`, {
        method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'خطأ في إغلاق أمر العمل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              إغلاق أمر عمل
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {workOrder.work_order_number ?? `#${workOrder.id}`} — {workOrder.title_ar ?? workOrder.title ?? ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Close Type Selection ── */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">نوع الإغلاق *</label>
            <div className="space-y-2">
              {CLOSE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setCloseType(t.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${
                    closeType === t.value ? t.color + ' font-semibold' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">{t.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Fields based on type ── */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">ملاحظات الإغلاق *</label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="وصف ما تم إنجازه..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {(closeType === 'completed' || closeType === 'evaluation') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">الإجراء المتخذ</label>
                <input
                  value={actionTaken}
                  onChange={e => setActionTaken(e.target.value)}
                  placeholder="مثال: تم تعديل قيمة التيار من 200mA إلى 350mA"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {closeType === 'evaluation' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">نتائج التقييم</label>
                <input
                  value={findings}
                  onChange={e => setFindings(e.target.value)}
                  placeholder="مثال: تحسن معدل الحماية من 65% إلى 89%"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {closeType === 'remarks' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">الخطوات التالية المطلوبة</label>
                <textarea
                  rows={2}
                  value={nextSteps}
                  onChange={e => setNextSteps(e.target.value)}
                  placeholder="مثال: إعادة مسح المقطع بعد 3 أشهر للتحقق من الاستجابة"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            تأكيد الإغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
