'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckSquare, XCircle, RotateCcw, Clock, ChevronLeft,
  User, FileText, AlertTriangle, CheckCircle, ArrowRight,
} from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

const ENTITY_LABELS: Record<string, string> = {
  purchase_request: 'طلب شراء',
  purchase_order:   'أمر شراء',
  journal_entry:    'قيد محاسبي',
  stock_issue:      'صرف مخزن',
  contract:         'عقد',
};

const ROLE_LABELS: Record<string, string> = {
  supervisor:         'المشرف المباشر',
  finance_controller: 'المراقب المالي',
  management:         'الإدارة',
  director:           'المدير العام',
};

const ROLES = [
  { value: 'supervisor',         label: 'المشرف المباشر' },
  { value: 'finance_controller', label: 'المراقب المالي' },
  { value: 'management',         label: 'الإدارة' },
  { value: 'director',           label: 'المدير العام' },
];

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'قيد الانتظار', color: 'text-amber-400 bg-amber-900/20 border-amber-500/30',  icon: Clock },
  approved:  { label: 'معتمد',        color: 'text-green-400 bg-green-900/20 border-green-500/30',  icon: CheckSquare },
  rejected:  { label: 'مرفوض',       color: 'text-red-400 bg-red-900/20 border-red-500/30',         icon: XCircle },
  returned:  { label: 'معاد',         color: 'text-blue-400 bg-blue-900/20 border-blue-500/30',      icon: RotateCcw },
  cancelled: { label: 'ملغي',         color: 'text-gray-400 bg-gray-800/30 border-gray-600/30',      icon: XCircle },
};

const STEP_CFG: Record<string, { dot: string; line: string }> = {
  approved: { dot: 'bg-green-600 border-green-500',  line: 'bg-green-600/40' },
  rejected: { dot: 'bg-red-600 border-red-500',      line: 'bg-red-600/40' },
  returned: { dot: 'bg-blue-600 border-blue-500',    line: 'bg-blue-600/40' },
  pending:  { dot: 'bg-amber-500 border-amber-400',  line: 'bg-gray-700' },
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [role,       setRole]       = useState('supervisor');
  const [userName,   setUserName]   = useState('');
  const [comments,   setComments]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/approval/requests/${id}`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' },
      });
      if (!res.ok) { setData(null); return; }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const doAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!userName.trim()) { showToast('أدخل اسمك أولاً', false); return; }
    if ((action === 'reject' || action === 'return') && !comments.trim()) {
      showToast('يجب إدخال سبب واضح عند الرفض أو الإرجاع', false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/approval/requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({ action, performed_by: userName, role, comments }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.detail || 'خطأ', false); return; }
      showToast(d.message, true);
      setComments('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">جاري التحميل...</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="w-12 h-12 text-red-400" />
      <p className="text-gray-300 text-lg">الطلب غير موجود</p>
      <Link href="/dashboard/admin-gateway/workflow" className="text-purple-400 hover:text-purple-300 text-sm">← العودة إلى مركز الاعتماد</Link>
    </div>
  );

  const st   = STATUS_CFG[data.status] || STATUS_CFG['pending'];
  const StIcon = st.icon;
  const steps   = data.steps   || [];
  const history = data.history || [];
  const pending_step = steps.find((s: any) => s.status === 'pending');
  const isActionable = data.status === 'pending' && !!pending_step;
  const age_ms = Date.now() - new Date(data.updated_at).getTime();
  const isOverdue = data.status === 'pending' && age_ms > 48 * 3_600_000;

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-gray-300">البوابة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/workflow" className="hover:text-gray-300">مركز الاعتماد</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-gray-300 font-mono">{data.request_number}</span>
        </div>

        {/* Header Card */}
        <div className={`rounded-2xl border p-6 ${st.color}`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <StIcon className="w-6 h-6 shrink-0" />
                <h1 className="text-xl font-bold leading-snug">{data.title}</h1>
                <span className="text-xs font-bold bg-green-500 text-black px-2 py-0.5 rounded whitespace-nowrap">DETAIL PAGE LIVE ✔</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm mt-3">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <FileText className="w-3.5 h-3.5" /> {ENTITY_LABELS[data.entity_type] || data.entity_type}
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <User className="w-3.5 h-3.5" /> قدّمه: {data.submitted_by}
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Clock className="w-3.5 h-3.5" /> {fmtDate(data.created_at)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.color}`}>{st.label}</span>
              <span className="text-gray-500 font-mono text-xs">{data.request_number}</span>
              <span className="text-gray-500 text-xs">خطوة {data.current_step}/{data.total_steps}</span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-red-400 text-xs bg-red-900/30 border border-red-500/30 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" /> متأخر {Math.floor(age_ms / 3_600_000)}h
                </span>
              )}
            </div>
          </div>
          {data.notes && (
            <div className="mt-4 bg-black/20 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">ملاحظات المقدِّم</p>
              <p className="text-gray-200 text-sm">{data.notes}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Timeline — 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            {/* Step Timeline */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="text-white font-semibold mb-5 text-sm">مسار الاعتماد</h2>
              <div className="relative">
                {steps.map((s: any, idx: number) => {
                  const sc = STEP_CFG[s.status] || STEP_CFG['pending'];
                  const isCurrent = s.step_order === data.current_step && data.status === 'pending';
                  const isFuture  = s.status === 'pending' && !isCurrent;
                  return (
                    <div key={s.id} className="flex gap-4 mb-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shrink-0 ${sc.dot} ${isFuture ? 'opacity-40' : ''}`}>
                          {s.status === 'approved' ? <CheckCircle className="w-4 h-4 text-white" /> :
                           s.status === 'rejected' ? <XCircle     className="w-4 h-4 text-white" /> :
                           s.status === 'returned' ? <RotateCcw   className="w-4 h-4 text-white" /> :
                           isCurrent ? <ArrowRight className="w-4 h-4 text-black" /> :
                           <span className="text-white">{s.step_order}</span>}
                        </div>
                        {idx < steps.length - 1 && (
                          <div className={`w-0.5 h-10 ${sc.line} ${isFuture ? 'opacity-20' : ''}`} />
                        )}
                      </div>
                      <div className={`flex-1 pb-6 ${isFuture ? 'opacity-40' : ''}`}>
                        <div className={`rounded-xl border p-3.5 ${isCurrent ? 'border-amber-500/50 bg-amber-900/10' : 'border-gray-700 bg-gray-800/50'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-white text-sm font-medium">{s.step_name}</p>
                              <p className="text-gray-500 text-xs mt-0.5">{ROLE_LABELS[s.role_required] || s.role_required}</p>
                            </div>
                            {s.action_date && (
                              <p className="text-gray-500 text-xs shrink-0">{fmtDate(s.action_date)}</p>
                            )}
                          </div>
                          {s.acted_by && (
                            <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                              <User className="w-3 h-3" /> {s.acted_by}
                            </p>
                          )}
                          {s.comments && (
                            <div className={`mt-2 rounded-lg p-2.5 text-xs ${s.status === 'rejected' ? 'bg-red-900/30 text-red-300 border border-red-500/20' : s.status === 'returned' ? 'bg-blue-900/30 text-blue-300 border border-blue-500/20' : 'bg-gray-700/50 text-gray-400'}`}>
                              {s.status === 'rejected' && <span className="font-semibold block mb-0.5">سبب الرفض: </span>}
                              {s.status === 'returned' && <span className="font-semibold block mb-0.5">سبب الإرجاع: </span>}
                              {s.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* History Log */}
            {history.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
                <h2 className="text-white font-semibold mb-4 text-sm">سجل الإجراءات</h2>
                <div className="space-y-2">
                  {history.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3 text-sm bg-gray-800/50 rounded-lg px-3 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        h.action === 'approved'  ? 'bg-green-900/40 text-green-400' :
                        h.action === 'rejected'  ? 'bg-red-900/40 text-red-400' :
                        h.action === 'returned'  ? 'bg-blue-900/40 text-blue-400' :
                        h.action === 'cancelled' ? 'bg-gray-700 text-gray-400' :
                        'bg-purple-900/40 text-purple-400'
                      }`}>
                        {h.action === 'submitted' ? 'قُدِّم' : h.action === 'approved' ? 'اعتمد' : h.action === 'rejected' ? 'رُفض' : h.action === 'returned' ? 'أُعيد' : h.action === 'cancelled' ? 'أُلغي' : h.action}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs">{h.performed_by}</p>
                        {h.notes && <p className="text-gray-400 text-xs mt-0.5 truncate">{h.notes}</p>}
                      </div>
                      <span className="text-gray-600 text-xs shrink-0">{fmtDate(h.performed_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Current status summary */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white font-semibold mb-3 text-sm">الوضع الحالي</h2>
              {isActionable ? (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 text-sm">
                  <p className="text-amber-300 font-medium mb-1">في انتظار:</p>
                  <p className="text-white">{ROLE_LABELS[pending_step.role_required] || pending_step.role_required}</p>
                  <p className="text-gray-400 text-xs mt-1">{pending_step.step_name}</p>
                </div>
              ) : (
                <div className={`rounded-xl border p-3 text-sm ${st.color}`}>
                  <div className="flex items-center gap-2">
                    <StIcon className="w-4 h-4" />
                    <p className="font-medium">{st.label}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Panel */}
            {isActionable && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-4">
                <h2 className="text-white font-semibold text-sm">اتخاذ إجراء</h2>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">دورك</label>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسمك (للتوقيع) *</label>
                  <input value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    التعليق <span className="text-red-400 text-xs">* مطلوب عند الرفض أو الإرجاع</span>
                  </label>
                  <textarea value={comments} onChange={e => setComments(e.target.value)}
                    placeholder="سبب القرار أو ملاحظاتك..."
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm resize-none h-20" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => doAction('approve')} disabled={submitting || !userName.trim()}
                    className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                    <CheckSquare className="w-4 h-4" /> موافقة على الخطوة
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => doAction('return')} disabled={submitting || !userName.trim()}
                      className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-2.5 font-semibold text-sm flex items-center justify-center gap-1 transition-colors">
                      <RotateCcw className="w-4 h-4" /> إرجاع
                    </button>
                    <button onClick={() => doAction('reject')} disabled={submitting || !userName.trim()}
                      className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-2.5 font-semibold text-sm flex items-center justify-center gap-1 transition-colors">
                      <XCircle className="w-4 h-4" /> رفض
                    </button>
                  </div>
                </div>
                {!userName.trim() && (
                  <p className="text-amber-400 text-xs text-center">⚠️ أدخل اسمك قبل اتخاذ الإجراء</p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-2">
              <h2 className="text-white font-semibold text-sm mb-3">التنقل</h2>
              <Link href="/dashboard/admin-gateway/workflow"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2.5 transition-colors">
                <ChevronLeft className="w-4 h-4" /> مركز الاعتماد
              </Link>
              <Link href="/dashboard/admin-gateway/workflow/approvals"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2.5 transition-colors">
                <CheckSquare className="w-4 h-4" /> موافقاتي
              </Link>
              <Link href="/dashboard/admin-gateway/workflow/requests"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2.5 transition-colors">
                <FileText className="w-4 h-4" /> جميع الطلبات
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
