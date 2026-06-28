'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// أمر العمل المزدوج — يُنشئه قسم الدعم الفني لحالات التآكل الداخلي
// يتضمن: أمر رئيسي (فك صمام) → قسم تخطيط الصيانة + نسخة (طلاء) → قسم المكونات
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, GitBranch, Loader2, Send, X } from 'lucide-react';

const WF_API   = '/api/v1/workflow';
const DEPT_API = '/api/v1/dept-admin';

function createWorkOrderNumber(prefix = 'WO'): string {
  const now = new Date();
  const y = now.getFullYear();
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${y}-${t}${r}`;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
    'Content-Type': 'application/json',
  };
  return headers;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill from analysis findings */
  prefill?: {
    location?: string;
    pipeline?: string;
    chainage?: string;
    finding?: string;
  };
}

export default function DualWOCreator({ onClose, onSuccess, prefill }: Props) {
  const [form, setForm] = useState({
    location:        prefill?.location ?? '',
    pipeline:        prefill?.pipeline ?? '',
    chainage:        prefill?.chainage ?? '',
    finding:         prefill?.finding ?? '',
    // Dismantling work order (for maintenance planning)
    dismantle_title:  prefill?.finding ? `فك وتفتيش صمام — نقطة ${prefill.chainage ?? ''}` : '',
    dismantle_desc:   '',
    dismantle_priority: 'high',
    // Coating work order (for coating section)
    coating_title:    prefill?.finding ? `طلاء واقٍ — نقطة ${prefill.chainage ?? ''}` : '',
    coating_desc:     '',
    coating_priority: 'high',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ dismantle?: string; coating?: string } | null>(null);

  const setF = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.location || !form.dismantle_title || !form.coating_title) {
      setError('يرجى ملء الموقع وعنواني أمر الفك وأمر الطلاء');
      return;
    }
    setSaving(true); setError('');
    try {
      // 1. Create parent (dismantling) work order → target: engineering (مدير التآكل → مدير الهندسة)
      const dismantleBody = {
        work_order_number: createWorkOrderNumber('WO-DISM'),
        work_type: 'corrective',
        title:    form.dismantle_title,
        title_ar: `[مزدوج/فك] ${form.dismantle_title}`,
        description: [
          `تآكل داخلي محدد في نقطة: ${form.chainage || form.location}`,
          `المسار: ${form.pipeline}`,
          `النتيجة: ${form.finding}`,
          form.dismantle_desc,
          'يتطلب: فك الصمام ثم الطلاء الواقي — أمر مزدوج',
        ].filter(Boolean).join('\n'),
        asset_name:        form.location,
        priority:          form.dismantle_priority,
        status:            'open',
        source_dept:       'corrosion',
        routing_type:      'external',
        target_department: 'engineering',
        notes:             `[DUAL_WO][PARENT][pipeline=${form.pipeline}][chainage=${form.chainage}]`,
        created_by:        'corrosion_support',
      };
      const dismantleRes = await fetch(`${WF_API}/work-orders/manual`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(dismantleBody),
      });
      if (!dismantleRes.ok) throw new Error('فشل إنشاء أمر الفك: ' + await dismantleRes.text());
      const dismantleData = await dismantleRes.json();
      const parentId = dismantleData.id ?? dismantleData.work_order?.id;

      // 2. Create child (coating) work order → target: coating section (internal corrosion dept)
      const coatingBody = {
        work_order_number: createWorkOrderNumber('WO-COAT'),
        work_type: 'corrective',
        title:    form.coating_title,
        title_ar: `[مزدوج/طلاء] ${form.coating_title}`,
        description: [
          `طلاء واقٍ بعد فك الصمام — نقطة: ${form.chainage || form.location}`,
          `المسار: ${form.pipeline}`,
          form.coating_desc,
          'للتنسيق مع فرق الهندسة لإتمام عملية الطلاء بعد الفك',
        ].filter(Boolean).join('\n'),
        asset_name:        form.location,
        priority:          form.coating_priority,
        status:            'open',
        source_dept:       'corrosion',
        routing_type:      'internal',
        target_department: 'corrosion',
        assigned_team:     'coating_section',
        parent_wo_id:      parentId ?? null,
        notes:             `[DUAL_WO][CHILD_COATING][parent=${parentId}][pipeline=${form.pipeline}]`,
        created_by:        'corrosion_support',
      };
      const coatingRes = await fetch(`${WF_API}/work-orders/manual`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(coatingBody),
      });
      if (!coatingRes.ok) throw new Error('فشل إنشاء أمر الطلاء: ' + await coatingRes.text());
      const coatingData = await coatingRes.json();

      // 3. Create notification document → corrosion manager for routing to engineering manager
      await fetch(`${DEPT_API}/corrosion/documents`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          doc_type: 'dual_wo_notification',
          title: `إشعار أمر عمل مزدوج — ${form.location}`,
          body_text: `
صدر أمر عمل مزدوج من قسم الدعم الفني بإدارة التآكل:

الموقع: ${form.location}
المسار: ${form.pipeline}
النقطة: ${form.chainage}
النتيجة: ${form.finding}

📌 أمر الفك (${dismantleData.work_order_number ?? dismantleData.id}): يُحال لمدير إدارة الهندسة ثم تخطيط الصيانة
📌 أمر الطلاء (${coatingData.work_order?.work_order_number ?? coatingData.id}): نسخة لقسم المكونات والطلاء للتنسيق

يُرجى اعتماد وإحالة أمر الفك لمدير الهندسة والدعم الفني.
          `.trim(),
          dest_dept: 'corrosion',
          priority: form.dismantle_priority,
          created_by: 'corrosion_support',
          metadata: {
            section: 'manager',
            workflow_stage: 'pending_manager_routing',
            dual_wo: true,
            dismantle_wo_id: parentId,
            coating_wo_id: coatingData.id ?? coatingData.work_order?.id,
            location: form.location,
            pipeline: form.pipeline,
            chainage: form.chainage,
          },
        }),
      });

      setCreated({
        dismantle: dismantleData.work_order_number ?? String(dismantleData.id),
        coating:   coatingData.work_order?.work_order_number ?? String(coatingData.id),
      });
    } catch (e: any) {
      setError(e.message ?? 'خطأ في إنشاء أوامر العمل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-orange-400" />
              إنشاء أمر عمل مزدوج
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">تآكل داخلي يتطلب فكّاً وطلاءً — يُحال للمدير ثم للهندسة وتخطيط الصيانة</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {created ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-300">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-base">تم إنشاء الأوامر بنجاح</p>
                <p className="text-sm text-slate-400">وتم إرسال إشعار لمدير إدارة التآكل للإحالة</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">أمر الفك (→ مدير التآكل → مدير الهندسة → تخطيط الصيانة)</p>
                <p className="text-sm font-bold text-orange-300">{created.dismantle}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">أمر الطلاء (→ قسم المكونات والطلاء — للتنسيق)</p>
                <p className="text-sm font-bold text-amber-300">{created.coating}</p>
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300">
              <AlertTriangle className="w-4 h-4 inline ml-1.5" />
              تتبع الإجراءات: مدير إدارة التآكل ← صفحة المدير ← لوحة الموافقات
            </div>
            <button
              onClick={onSuccess}
              className="w-full py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-600/30 transition-colors"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Incident info */}
            <div className="bg-orange-900/10 border border-orange-500/20 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-orange-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> بيانات الحادثة / الموقع
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الموقع / الأصل *</label>
                  <input value={form.location} onChange={e => setF('location', e.target.value)}
                    placeholder="مثال: صمام قطع KV-14" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">المسار / الخط</label>
                  <input value={form.pipeline} onChange={e => setF('pipeline', e.target.value)}
                    placeholder="مثال: خط الشويرف" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">رقم المحطة / الكيلومتراج</label>
                  <input value={form.chainage} onChange={e => setF('chainage', e.target.value)}
                    placeholder="مثال: 270" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">نتيجة التحليل / السبب</label>
                  <input value={form.finding} onChange={e => setF('finding', e.target.value)}
                    placeholder="مثال: تآكل داخلي +0.3mm/year" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
              </div>
            </div>

            {/* Dismantling WO */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-300">١</div>
                <h3 className="text-sm font-semibold text-orange-300">أمر الفك والتفتيش</h3>
                <span className="text-xs text-slate-500">→ مدير التآكل → مدير الهندسة → تخطيط الصيانة</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">عنوان أمر الفك *</label>
                  <input value={form.dismantle_title} onChange={e => setF('dismantle_title', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الأولوية</label>
                  <select value={form.dismantle_priority} onChange={e => setF('dismantle_priority', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
                    <option value="urgent">عاجل</option>
                    <option value="high">عالي</option>
                    <option value="normal">عادي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">وصف إضافي</label>
                  <input value={form.dismantle_desc} onChange={e => setF('dismantle_desc', e.target.value)}
                    placeholder="تفاصيل الفك..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                </div>
              </div>
            </div>

            {/* Coating WO */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">٢</div>
                <h3 className="text-sm font-semibold text-amber-300">أمر الطلاء الواقي</h3>
                <span className="text-xs text-slate-500">→ قسم المكونات والطلاء للتنسيق</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">عنوان أمر الطلاء *</label>
                  <input value={form.coating_title} onChange={e => setF('coating_title', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الأولوية</label>
                  <select value={form.coating_priority} onChange={e => setF('coating_priority', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="urgent">عاجل</option>
                    <option value="high">عالي</option>
                    <option value="normal">عادي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">وصف إضافي</label>
                  <input value={form.coating_desc} onChange={e => setF('coating_desc', e.target.value)}
                    placeholder="نوع الطلاء المطلوب..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">إلغاء</button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-300 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                إنشاء الأمرين وإرسال للمدير
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
