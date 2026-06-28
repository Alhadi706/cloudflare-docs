'use client';
import { buildClientTenantHeaders, fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';
// ═══════════════════════════════════════════════════════════════════════════════
// منشئ أمر عمل الحماية الكاثودية (أمر عادي)
// يُستدعى من قسم الدعم الفني عند توصية التحليل بإضافة CP في منطقة محددة
// يُحال إلى قسم المراقبة والصيانة لتنفيذ التركيب
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { CheckCircle, Loader2, ShieldCheck, X } from 'lucide-react';

const WF_API  = '/api/v1/workspace';
const DOC_API = '/api/v1/dept-admin';

function getHeaders(): Record<string, string> {
  const tenantId = (typeof window !== 'undefined')
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

  const headers: Record<string, string> = buildClientTenantHeaders();
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const raw = await res.text().catch(() => '');
  const lower = raw.toLowerCase();

  if (lower.includes('tenant_not_found') || lower.includes('tenant context') || lower.includes('invalid tenant')) {
    return 'تعذر التعرف على المؤسسة الحالية. حدّث الصفحة ثم أعد تسجيل الدخول إلى المؤسسة الصحيحة.';
  }

  try {
    const parsed = JSON.parse(raw || '{}');
    return String(parsed?.error || parsed?.message || parsed?.detail || fallback);
  } catch {
    return raw || fallback;
  }
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
    session_id?: string;
  };
}

const CP_TYPES = [
  { value: 'impressed_current', label: 'حماية بالتيار المفروض (ICCP)', hint: 'أنظمة التيار الكهربائي المستمر' },
  { value: 'sacrificial_anode', label: 'أنود تضحوي (SACP)', hint: 'مغنيسيوم، زنك، ألومنيوم' },
  { value: 'test_post', label: 'نقطة فحص جديدة (Test Post)', hint: 'لقياس الجهد في منطقة فاقدة' },
  { value: 'bond_cable', label: 'توصيل ترابطي (Bond Cable)', hint: 'ربط مناطق منفصلة بالشبكة' },
  { value: 'joint_coating', label: 'عزل وصلة (Joint Coating)', hint: 'إصلاح عزل في نقطة الكسر' },
];

const SECTION_TARGETS = [
  { value: 'monitoring_section', label: 'قسم المراقبة الدورية' },
  { value: 'coating_section', label: 'قسم المكونات والطلاء' },
  { value: 'technical_support', label: 'قسم الدعم الفني' },
];

const MANAGEMENT_TARGETS = [
  { value: 'engineering', label: 'إدارة الهندسة' },
  { value: 'maintenance', label: 'إدارة الصيانة' },
  { value: 'operations', label: 'إدارة العمليات' },
];

export default function CPInstallWOCreator({ onClose, onSuccess, prefill }: Props) {
  const [form, setForm] = useState({
    location:   prefill?.location ?? '',
    pipeline:   prefill?.pipeline ?? '',
    chainage:   prefill?.chainage ?? '',
    finding:    prefill?.finding ?? '',
    cp_type:    'impressed_current',
    route_scope: 'section',
    target_section: 'monitoring_section',
    target_management: 'engineering',
    priority:   'high',
    description: '',
    recommended_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<string | null>(null);

  const setF = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.location || !form.pipeline) {
      setError('الموقع والمسار مطلوبان');
      return;
    }
    setSaving(true); setError('');
    try {
      const cpTypeLabel = CP_TYPES.find(t => t.value === form.cp_type)?.label ?? form.cp_type;
      const targetSectionLabel = SECTION_TARGETS.find(t => t.value === form.target_section)?.label ?? form.target_section;
      const targetManagementLabel = MANAGEMENT_TARGETS.find(t => t.value === form.target_management)?.label ?? form.target_management;
      const isSectionRoute = form.route_scope === 'section';
      const routingLabel = isSectionRoute
        ? `قسم ${targetSectionLabel} (إحالة مباشرة)`
        : `إدارة ${targetManagementLabel} (إحالة عبر مدير الإدارة)`;

      const woBody = {
        work_type: 'cp_installation',
        title: `تركيب حماية كاثودية — ${form.location}`,
        title_ar: `تركيب ${cpTypeLabel} — نقطة ${form.chainage || form.location}`,
        description: [
          `التوصية: تركيب ${cpTypeLabel}`,
          `الموقع: ${form.location}`,
          `المسار: ${form.pipeline}`,
          form.chainage ? `النقطة/الكيلومتراج: ${form.chainage}` : '',
          `نتيجة التحليل: ${form.finding}`,
          form.description,
        ].filter(Boolean).join('\n'),
        asset_name:        form.location,
        priority:          form.priority,
        status:            'open',
        source_dept:       'corrosion',
        routing_type:      isSectionRoute ? 'internal' : 'external',
        target_department: isSectionRoute ? 'corrosion' : form.target_management,
        assigned_team:     isSectionRoute ? form.target_section : null,
        scheduled_date:    form.recommended_date || null,
        created_by:        'corrosion_support',
        notes:             `[CP_INSTALL][pipeline=${form.pipeline}][chainage=${form.chainage}][cp_type=${form.cp_type}][route=${form.route_scope}][target=${isSectionRoute ? form.target_section : form.target_management}]`,
      };

      const woRes = await fetchWithClientTenantRetry(`${WF_API}/workflow-orders`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(woBody),
      });
      if (!woRes.ok) throw new Error(await parseApiError(woRes, 'تعذر إنشاء أمر العمل'));
      const woData = await woRes.json();

      // Also create a document recommendation
      const docRes = await fetchWithClientTenantRetry(`${DOC_API}/corrosion/documents`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          doc_type: 'cp_installation_recommendation',
          title: `توصية تركيب حماية كاثودية — ${form.location}`,
          body_text: [
            `أوصى قسم الدعم الفني بتركيب ${cpTypeLabel} في الموقع التالي:`,
            `الموقع: ${form.location} — المسار: ${form.pipeline}`,
            form.chainage ? `النقطة: ${form.chainage}` : '',
            `سبب التوصية: ${form.finding}`,
            form.description ? `تفاصيل إضافية: ${form.description}` : '',
            `\nأمر العمل الصادر: ${woData.work_order_number ?? woData.id}`,
            `محال إلى: ${routingLabel}`,
          ].filter(Boolean).join('\n'),
          dest_dept: 'corrosion',
          priority: form.priority,
          created_by: 'corrosion_support',
          metadata: {
            section: isSectionRoute ? 'monitoring' : 'manager',
            workflow_stage: isSectionRoute ? 'cp_installation_ordered' : 'pending_manager_routing',
            cp_type: form.cp_type,
            location: form.location,
            pipeline: form.pipeline,
            chainage: form.chainage,
            route_scope: form.route_scope,
            target_section: isSectionRoute ? form.target_section : null,
            target_department: isSectionRoute ? 'corrosion' : form.target_management,
            related_wo_id: woData.id,
          },
        }),
      });
      if (!docRes.ok) {
        throw new Error(await parseApiError(docRes, 'تم إنشاء أمر العمل ولكن تعذر حفظ وثيقة التوصية'));
      }

      setCreated(woData.work_order_number ?? String(woData.id));
    } catch (e: any) {
      setError(e.message ?? 'خطأ في إنشاء أمر العمل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              إصدار أمر تركيب حماية كاثودية
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">بناءً على توصية التحليل الفني — مع مسار إحالة مباشر للقسم أو عبر مدير الإدارة</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {created ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-300">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-base">تم إصدار أمر العمل بنجاح</p>
                <p className="text-sm text-slate-400">تم تسجيل مسار الإحالة وفق الجهة المختارة</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">رقم أمر العمل (→ قسم المراقبة والصيانة)</p>
              <p className="text-lg font-bold text-cyan-300">{created}</p>
            </div>
            <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-xl p-4 text-xs text-cyan-300">
              سيظهر الأمر في قسم المراقبة ضمن الأوامر الواردة للمعالجة وفق مسار: كشف العوائق ← مسح ← تنفيذ التركيب.
            </div>
            <button onClick={onSuccess} className="w-full py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-600/30 transition-colors">إغلاق</button>
          </div>
        ) : (
          <div className="p-5 space-y-5">

            {/* Finding from analysis */}
            <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-4">
              <p className="text-xs text-cyan-300 font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> بيانات الموقع من التحليل
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الموقع / الأصل *</label>
                  <input value={form.location} onChange={e => setF('location', e.target.value)}
                    placeholder="مثال: نقطة فحص TP-14"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">المسار / الخط *</label>
                  <input value={form.pipeline} onChange={e => setF('pipeline', e.target.value)}
                    placeholder="مثال: خط الشويرف الرئيسي"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الكيلومتراج / رقم المحطة</label>
                  <input value={form.chainage} onChange={e => setF('chainage', e.target.value)}
                    placeholder="مثال: KP 142"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">نتيجة التحليل / السبب</label>
                  <input value={form.finding} onChange={e => setF('finding', e.target.value)}
                    placeholder="مثال: جهد −750mV غير محمي (NACE: NOT_PROTECTED)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
            </div>

            {/* CP type */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">نوع الحماية الكاثودية المطلوبة *</label>
              <div className="space-y-2">
                {CP_TYPES.map(t => (
                  <button key={t.value} onClick={() => setF('cp_type', t.value)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${
                      form.cp_type === t.value
                        ? 'border-cyan-500/50 bg-cyan-900/20 text-cyan-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs opacity-60">{t.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority + date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">جهة الإحالة</label>
                <select value={form.route_scope} onChange={e => setF('route_scope', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="section">قسم (إحالة مباشرة)</option>
                  <option value="management">إدارة (عبر مدير الإدارة)</option>
                </select>
              </div>
              {form.route_scope === 'section' ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">القسم المراد الإحالة إليه</label>
                  <select value={form.target_section} onChange={e => setF('target_section', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500">
                    {SECTION_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">الإدارة المراد التحويل إليها</label>
                  <select value={form.target_management} onChange={e => setF('target_management', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500">
                    {MANAGEMENT_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Priority + date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">الأولوية</label>
                <select value={form.priority} onChange={e => setF('priority', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="urgent">عاجل</option>
                  <option value="high">عالي</option>
                  <option value="normal">عادي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">الموعد المقترح</label>
                <input type="date" value={form.recommended_date} onChange={e => setF('recommended_date', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            {/* Additional notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">ملاحظات تقنية إضافية</label>
              <textarea rows={2} value={form.description} onChange={e => setF('description', e.target.value)}
                placeholder="متطلبات المواصفة، حجم الأنود، تيار التصميم..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none" />
            </div>

            {error && <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">إلغاء</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                إصدار أمر التركيب بالإحالة المحددة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
