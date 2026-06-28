'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// الخطة السنوية لمسوحات التآكل — يُعدّها قسم الدعم الفني ثم يُحيلها للمدير
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import {
  CheckCircle, ChevronDown, ChevronUp, Clock, FileText,
  Loader2, Plus, RefreshCw, Send, XCircle,
} from 'lucide-react';

const API = '/api/v1/dept-admin';
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

interface AnnualPlan {
  id: number;
  doc_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  dest_dept?: string | null;
  metadata?: Record<string, any>;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:             { label: 'مسودة — بانتظار الإرسال',    color: 'text-slate-400 bg-slate-800/60 border-slate-700' },
  submitted:         { label: 'مُرسلة للمدير',               color: 'text-blue-300 bg-blue-900/30 border-blue-500/30' },
  approved:          { label: 'مُعتمدة — أُحيلت للمراقبة',  color: 'text-emerald-300 bg-emerald-900/30 border-emerald-500/30' },
  rejected:          { label: 'مُعادة للمراجعة',             color: 'text-red-300 bg-red-900/30 border-red-500/30' },
  forwarded:         { label: 'مُرسلة للمدير',               color: 'text-blue-300 bg-blue-900/30 border-blue-500/30' },
};

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

interface FormData {
  pipeline_name: string;
  route_from: string;
  route_to: string;
  from_station: string;
  to_station: string;
  year: string;
  start_month: string;
  end_month: string;
  priority: string;
  description: string;
}

const EMPTY_FORM: FormData = {
  pipeline_name: '',
  route_from: '',
  route_to: '',
  from_station: '',
  to_station: '',
  year: String(new Date().getFullYear() + 1),
  start_month: 'يناير',
  end_month: 'ديسمبر',
  priority: 'normal',
  description: '',
};

export default function AnnualPlanTab() {
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/corrosion/documents?doc_type=annual_plan&limit=50`, { headers: getHeaders() });
      const d = await r.json();
      setPlans(d.documents ?? []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (asDraft: boolean) => {
    if (!form.pipeline_name || !form.route_from || !form.route_to) {
      setError('يرجى ملء اسم المسار ونقطتَي البداية والنهاية');
      return;
    }
    setSaving(true); setError('');
    try {
      const body = {
        doc_type: 'annual_plan',
        title: `خطة سنوية ${form.year} — مسار ${form.pipeline_name} (${form.route_from} ← ${form.route_to})`,
        dest_dept: asDraft ? 'corrosion' : 'corrosion',
        priority: form.priority,
        body_text: form.description || `خطة مسح الحماية الكاثودية لعام ${form.year} على مسار ${form.pipeline_name}`,
        created_by: 'corrosion_support',
        metadata: {
          section: 'support',
          pipeline_name: form.pipeline_name,
          route_from: form.route_from,
          route_to: form.route_to,
          from_station: form.from_station,
          to_station: form.to_station,
          year: form.year,
          start_month: form.start_month,
          end_month: form.end_month,
          status: asDraft ? 'draft' : 'submitted',
          workflow_stage: asDraft ? 'draft' : 'pending_manager_approval',
        },
      };
      const r = await fetch(`${API}/corrosion/documents`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message ?? 'خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const submitToManager = async (planId: number) => {
    setSubmitting(planId);
    try {
      // Forward to manager (corrosion dept, section=manager)
      await fetch(`${API}/corrosion/documents/${planId}/forward`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          doc_type: 'annual_plan',
          target_dept: 'corrosion',
          title: 'خطة سنوية — تنتظر اعتماد المدير',
          forwarded_by: 'corrosion_support',
          metadata: { section: 'manager', workflow_stage: 'pending_manager_approval', status: 'submitted' },
        }),
      });
      // Update original doc metadata to mark as submitted
      load();
    } catch {
      // ignore — reload anyway
      load();
    } finally {
      setSubmitting(null);
    }
  };

  const metaOf = (p: AnnualPlan) => {
    try { return typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata ?? {}); }
    catch { return {}; }
  };

  const stageOf = (p: AnnualPlan) => {
    const m = metaOf(p);
    return m.workflow_stage ?? m.status ?? p.status ?? 'draft';
  };

  const statusInfo = (p: AnnualPlan) => {
    const stage = stageOf(p);
    return STATUS_LABEL[stage] ?? STATUS_LABEL['draft'];
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">الخطط السنوية للمسح</h2>
          <p className="text-sm text-slate-400 mt-0.5">يُعدّها قسم الدعم الفني ويُحيلها لمدير الإدارة للاعتماد</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            خطة جديدة
          </button>
        </div>
      </div>

      {/* ── Plan Creation Form ── */}
      {showForm && (
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-emerald-300 flex items-center gap-2">
            <FileText className="w-4 h-4" /> إعداد خطة مسح سنوية جديدة
          </h3>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pipeline Name */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">اسم المسار / الخط *</label>
              <input
                value={form.pipeline_name}
                onChange={e => setForm(f => ({ ...f, pipeline_name: e.target.value }))}
                placeholder="مثال: خط الشويرف – فزان"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Route From */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">من (نقطة البداية) *</label>
              <input
                value={form.route_from}
                onChange={e => setForm(f => ({ ...f, route_from: e.target.value }))}
                placeholder="مثال: الشويرف"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Route To */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">إلى (نقطة النهاية) *</label>
              <input
                value={form.route_to}
                onChange={e => setForm(f => ({ ...f, route_to: e.target.value }))}
                placeholder="مثال: خزان فزان"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* From Station */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">من المحطة رقم</label>
              <input
                value={form.from_station}
                onChange={e => setForm(f => ({ ...f, from_station: e.target.value }))}
                placeholder="مثال: 200"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* To Station */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">إلى المحطة رقم</label>
              <input
                value={form.to_station}
                onChange={e => setForm(f => ({ ...f, to_station: e.target.value }))}
                placeholder="مثال: 350"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">سنة الخطة</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">الأولوية</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="low">منخفضة</option>
                <option value="normal">عادية</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </select>
            </div>

            {/* Start Month */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">شهر البدء</label>
              <select
                value={form.start_month}
                onChange={e => setForm(f => ({ ...f, start_month: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* End Month */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">شهر الانتهاء</label>
              <select
                value={form.end_month}
                onChange={e => setForm(f => ({ ...f, end_month: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">وصف الخطة (اختياري)</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="أهداف الخطة، الجهات المعنية، ملاحظات إضافية..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              حفظ وإرسال للمدير
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              حفظ كمسودة
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors ml-auto"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── Plans List ── */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>جاري تحميل الخطط...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد خطط سنوية بعد</p>
          <p className="text-xs mt-1">أنشئ خطة جديدة لبدء دورة المسح السنوي</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const meta = metaOf(plan);
            const info = statusInfo(plan);
            const isExpanded = expandedId === plan.id;
            const isDraft = (meta.workflow_stage ?? meta.status ?? 'draft') === 'draft';

            return (
              <div key={plan.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Card Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                >
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{plan.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {plan.doc_number} — {new Date(plan.created_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${info.color}`}>
                    {info.label}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'المسار', value: meta.pipeline_name ?? '—' },
                        { label: 'من', value: meta.route_from ?? '—' },
                        { label: 'إلى', value: meta.route_to ?? '—' },
                        { label: 'سنة الخطة', value: meta.year ?? '—' },
                        { label: 'من المحطة', value: meta.from_station ?? '—' },
                        { label: 'إلى المحطة', value: meta.to_station ?? '—' },
                        { label: 'شهر البدء', value: meta.start_month ?? '—' },
                        { label: 'شهر الانتهاء', value: meta.end_month ?? '—' },
                      ].map(f => (
                        <div key={f.label} className="bg-slate-800/50 rounded-lg p-2.5">
                          <p className="text-slate-500 mb-0.5">{f.label}</p>
                          <p className="text-white font-medium">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    {isDraft && (
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => submitToManager(plan.id)}
                          disabled={submitting === plan.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          {submitting === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          إرسال للمدير للاعتماد
                        </button>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> مسودة — لم تُرسل بعد
                        </span>
                      </div>
                    )}
                    {!isDraft && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        تم إرسال الخطة — بانتظار قرار مدير الإدارة
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
