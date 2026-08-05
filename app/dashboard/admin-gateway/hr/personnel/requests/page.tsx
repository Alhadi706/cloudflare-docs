'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, RefreshCw, Send, CheckCircle2, XCircle, Pencil } from 'lucide-react';

type PersonnelRequest = {
  id: string;
  employee_no: string;
  employee_name: string;
  request_type: string;
  title: string;
  details: string;
  priority: 'low' | 'medium' | 'high';
  status:
    | 'pending_section_head_review'
    | 'pending_department_manager_review'
    | 'pending_hr_review'
    | 'approved'
    | 'archived'
    | 'rejected';
  created_at: string;
  updated_at: string;
  due_at: string;
  leave_days: number;
};

type CreatePayload = {
  employee_no: string;
  employee_name: string;
  request_type: string;
  title: string;
  details: string;
  priority: 'low' | 'medium' | 'high';
  leave_days: number;
};

type LeaveBalance = {
  annual_leave_balance: number;
  sick_leave_balance: number;
};

const STATUS_LABEL: Record<PersonnelRequest['status'], string> = {
  pending_section_head_review: 'بانتظار رئيس القسم',
  pending_department_manager_review: 'بانتظار مدير الإدارة',
  pending_hr_review: 'بانتظار شؤون الموظفين',
  approved: 'معتمد',
  archived: 'مؤرشف',
  rejected: 'مرفوض',
};

const REQUEST_TYPES = [
  'طلب إجازة',
  'تحديث بيانات شخصية',
  'خطاب تعريف',
  'تعديل وظيفي',
  'طلب نقل داخلي',
  'معالجة تعاقد',
];

function statusClass(status: PersonnelRequest['status']): string {
  if (status === 'approved' || status === 'archived') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'rejected') return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
}

function getCookieValue(key: string): string {
  if (typeof document === 'undefined') return '';
  const hit = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));
  if (!hit) return '';
  return decodeURIComponent(hit.slice(key.length + 1)).trim();
}

export default function PersonnelRequestsPage() {
  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [actorRole, setActorRole] = useState('employee');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);

  const [form, setForm] = useState<CreatePayload>({
    employee_no: '',
    employee_name: '',
    request_type: REQUEST_TYPES[0],
    title: '',
    details: '',
    priority: 'medium',
    leave_days: 1,
  });

  useEffect(() => {
    const role = getCookieValue('user_role') || 'employee';
    const employeeNo = getCookieValue('employee_no');
    const employeeName = getCookieValue('user_name');
    setActorRole(role.toLowerCase());
    setForm((prev) => ({
      ...prev,
      employee_no: prev.employee_no || employeeNo,
      employee_name: prev.employee_name || employeeName,
    }));
  }, []);

  async function loadRequests() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/hr/personnel/requests', { cache: 'no-store' });
      const data = await res.json();
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setMessage('تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaveBalance() {
    try {
      const res = await fetch('/api/hr/personnel/leave-balance', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.balance) {
        setLeaveBalance(data.balance);
      } else {
        setLeaveBalance(null);
      }
    } catch {
      setLeaveBalance(null);
    }
  }

  useEffect(() => {
    void loadRequests();
    void loadLeaveBalance();
  }, []);

  const kpis = useMemo(() => {
    const now = Date.now();
    const pending = requests.filter(
      (r) =>
        r.status === 'pending_section_head_review' ||
        r.status === 'pending_department_manager_review' ||
        r.status === 'pending_hr_review',
    );
    const overdue = pending.filter((r) => new Date(r.due_at).getTime() < now);
    return {
      total: requests.length,
      pending: pending.length,
      approved: requests.filter((r) => r.status === 'approved').length,
      overdue: overdue.length,
    };
  }, [requests]);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/hr/personnel/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر إنشاء الطلب.');
        return;
      }
      setForm((prev) => ({
        ...prev,
        title: '',
        details: '',
        request_type: REQUEST_TYPES[0],
        priority: 'medium',
        leave_days: 1,
      }));
      await loadRequests();
      await loadLeaveBalance();
    } catch {
      setMessage('تعذر إنشاء الطلب.');
    } finally {
      setSubmitting(false);
    }
  }

  async function transitionRequest(
    id: string,
    action: 'approve_section_head' | 'approve_department_manager' | 'approve_hr' | 'reject' | 'archive',
  ) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch(`/api/hr/personnel/requests/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر تحديث الحالة.');
        return;
      }
      await loadRequests();
      await loadLeaveBalance();
    } catch {
      setMessage('تعذر تحديث الحالة.');
    } finally {
      setBusyId(null);
    }
  }

  async function editRequest(item: PersonnelRequest) {
    const title = window.prompt('تعديل عنوان الطلب', item.title);
    if (title === null) return;
    const details = window.prompt('تعديل التفاصيل', item.details || '');
    if (details === null) return;
    const leaveDaysRaw = window.prompt('عدد أيام الإجازة (إن وُجد)', String(item.leave_days || 0));
    if (leaveDaysRaw === null) return;

    setBusyId(item.id);
    setMessage('');
    const leaveDays = Number(leaveDaysRaw || '0');
    try {
      const res = await fetch(`/api/hr/personnel/requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          details,
          leave_days: Number.isFinite(leaveDays) ? Math.max(0, leaveDays) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر تعديل الطلب.');
        return;
      }
      await loadRequests();
    } catch {
      setMessage('تعذر تعديل الطلب.');
    } finally {
      setBusyId(null);
    }
  }

  function canApproveSectionHead(): boolean {
    return ['section_manager', 'dept_manager', 'admin_manager', 'admin_officer', 'super_admin'].includes(actorRole);
  }

  function canApproveDepartmentManager(): boolean {
    return ['dept_manager', 'admin_manager', 'admin_officer', 'super_admin'].includes(actorRole);
  }

  function canApproveHr(): boolean {
    return ['hr_manager', 'admin_manager', 'admin_officer', 'super_admin'].includes(actorRole);
  }

  function canReject(): boolean {
    return ['section_manager', 'dept_manager', 'admin_manager', 'admin_officer', 'super_admin'].includes(actorRole);
  }

  function canArchive(): boolean {
    return ['admin_manager', 'admin_officer', 'super_admin'].includes(actorRole);
  }

  function canEdit(item: PersonnelRequest): boolean {
    return (
      actorRole === 'employee' &&
      (item.status === 'pending_section_head_review' || item.status === 'pending_department_manager_review')
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr/personnel" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> شؤون الموظفين
        </Link>

        <section className="rounded-3xl border border-cyan-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">طلبات ومعاملات الموظفين</h1>
          <p className="mt-2 text-sm text-slate-300">متاحة لكل موظف بعد تسجيل الدخول مع مسار موافقات: رئيس القسم ثم مدير الإدارة ثم شؤون الموظفين.</p>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">إجمالي الطلبات</p>
            <p className="mt-2 text-2xl font-bold text-white">{kpis.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300">طلبات معلقة</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{kpis.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-300">معتمدة</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{kpis.approved}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs text-rose-300">متأخرة عن SLA</p>
            <p className="mt-2 text-2xl font-bold text-rose-200">{kpis.overdue}</p>
          </div>
        </section>

        {leaveBalance ? (
          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-xs text-cyan-300">رصيد الإجازات الرسمي (موحّد)</p>
            <p className="mt-2 text-sm text-cyan-100">
              سنوية: {leaveBalance.annual_leave_balance} يوم | مرضية: {leaveBalance.sick_leave_balance} يوم
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">إنشاء طلب جديد</h2>
            <Plus className="h-4 w-4 text-cyan-300" />
          </div>
          <form onSubmit={submitRequest} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={form.employee_no}
              onChange={(e) => setForm((s) => ({ ...s, employee_no: e.target.value }))}
              placeholder="الرقم الوظيفي"
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
            <input
              value={form.employee_name}
              onChange={(e) => setForm((s) => ({ ...s, employee_name: e.target.value }))}
              placeholder="اسم الموظف"
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
            <select
              value={form.request_type}
              onChange={(e) => setForm((s) => ({ ...s, request_type: e.target.value }))}
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value as CreatePayload['priority'] }))}
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            >
              <option value="low">منخفض</option>
              <option value="medium">متوسط</option>
              <option value="high">عالي</option>
            </select>
            <input
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="عنوان الطلب"
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400 md:col-span-2"
            />
            <textarea
              value={form.details}
              onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))}
              placeholder="تفاصيل إضافية"
              rows={3}
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400 md:col-span-2"
            />
            <input
              type="number"
              min={0}
              value={form.leave_days}
              onChange={(e) => setForm((s) => ({ ...s, leave_days: Math.max(0, Number(e.target.value || 0)) }))}
              placeholder="عدد أيام الإجازة"
              className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400 md:col-span-2"
            />
            <div className="flex items-center gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'جارٍ الحفظ...' : 'إرسال الطلب'}
              </button>
              <button
                type="button"
                onClick={() => void loadRequests()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200"
              >
                <RefreshCw className="h-4 w-4" /> تحديث
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">قائمة الطلبات</h2>
          {message ? <p className="mt-2 text-sm text-rose-300">{message}</p> : null}
          {loading ? <p className="mt-3 text-sm text-slate-400">جارٍ التحميل...</p> : null}

          <div className="mt-4 space-y-3">
            {requests.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-400">{item.employee_name} - {item.employee_no}</p>
                    <p className="text-base font-semibold text-white">{item.title}</p>
                  </div>
                  <span className={`rounded-lg border px-2 py-1 text-xs ${statusClass(item.status)}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.request_type}</p>
                {item.leave_days > 0 ? <p className="mt-1 text-xs text-cyan-300">أيام الإجازة المطلوبة: {item.leave_days}</p> : null}
                <p className="mt-1 text-xs text-slate-400">الاستحقاق: {new Date(item.due_at).toLocaleString('ar-LY')}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === 'pending_section_head_review' && canApproveSectionHead() ? (
                    <button
                      onClick={() => void transitionRequest(item.id, 'approve_section_head')}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد رئيس القسم
                    </button>
                  ) : null}

                  {item.status === 'pending_department_manager_review' && canApproveDepartmentManager() ? (
                    <button
                      onClick={() => void transitionRequest(item.id, 'approve_department_manager')}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد مدير الإدارة
                    </button>
                  ) : null}

                  {item.status === 'pending_hr_review' && canApproveHr() ? (
                    <button
                      onClick={() => void transitionRequest(item.id, 'approve_hr')}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد شؤون الموظفين
                    </button>
                  ) : null}

                  {item.status === 'approved' && canArchive() ? (
                    <button
                      onClick={() => void transitionRequest(item.id, 'archive')}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                    >
                      أرشفة
                    </button>
                  ) : null}

                  {(item.status === 'pending_section_head_review' || item.status === 'pending_department_manager_review' || item.status === 'pending_hr_review') && canReject() ? (
                    <button
                      onClick={() => void transitionRequest(item.id, 'reject')}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> رفض
                    </button>
                  ) : null}

                  {canEdit(item) ? (
                    <button
                      onClick={() => void editRequest(item)}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> تعديل الطلب
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!loading && requests.length === 0 ? <p className="text-sm text-slate-400">لا توجد طلبات حالياً.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
