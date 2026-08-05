'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Landmark, Plus, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';

type PayrollCycleStatus =
  | 'draft'
  | 'pending_admin_approval'
  | 'pending_finance_approval'
  | 'pending_treasury_disbursement'
  | 'disbursed'
  | 'rejected';

type PayrollCycle = {
  id: string;
  cycle_no: string;
  period_label: string;
  employee_count: number;
  total_net: number;
  total_base: number;
  total_allowances: number;
  total_deductions: number;
  status: PayrollCycleStatus;
  source_department: string;
  updated_at: string;
  events: Array<{ at: string; action: string; by: string; role: string; notes?: string }>;
};

const STATUS_LABELS: Record<PayrollCycleStatus, string> = {
  draft: 'مسودة',
  pending_admin_approval: 'بانتظار اعتماد الشؤون الإدارية',
  pending_finance_approval: 'بانتظار اعتماد الإدارة المالية',
  pending_treasury_disbursement: 'بانتظار صرف الخزينة',
  disbursed: 'تم الصرف',
  rejected: 'مرفوضة',
};

const STATUS_TONE: Record<PayrollCycleStatus, string> = {
  draft: 'border-slate-600 text-slate-300 bg-slate-700/30',
  pending_admin_approval: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  pending_finance_approval: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  pending_treasury_disbursement: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  disbursed: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  rejected: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
};

const ACTIONS_BY_STATUS: Record<PayrollCycleStatus, Array<{ action: string; label: string }>> = {
  draft: [{ action: 'submit', label: 'إرسال للاعتماد الإداري' }],
  pending_admin_approval: [{ action: 'approve_admin', label: 'اعتماد إداري' }],
  pending_finance_approval: [
    { action: 'approve_finance', label: 'اعتماد مالي' },
    { action: 'return_admin', label: 'إرجاع للشؤون الإدارية' },
  ],
  pending_treasury_disbursement: [{ action: 'disburse_treasury', label: 'تنفيذ الصرف (الخزينة)' }],
  disbursed: [],
  rejected: [],
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(Number(value || 0));
}

export default function FinancePayrollPage() {
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [asRole, setAsRole] = useState('finance_manager');
  const [form, setForm] = useState({
    period_label: '',
    employee_count: '',
    total_base: '',
    total_allowances: '',
    total_deductions: '',
    total_net: '',
    source_department: 'HR',
  });

  const totals = useMemo(() => {
    return {
      count: cycles.length,
      disbursed: cycles.filter((c) => c.status === 'disbursed').length,
      pending: cycles.filter((c) => c.status !== 'disbursed' && c.status !== 'rejected').length,
      net: cycles.reduce((sum, c) => sum + Number(c.total_net || 0), 0),
    };
  }, [cycles]);

  const loadCycles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/finance/payroll/cycles');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'تعذر تحميل دورات المرتبات');
        return;
      }
      setCycles(Array.isArray(data?.cycles) ? data.cycles : []);
    } catch {
      setError('تعذر تحميل دورات المرتبات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCycles();
  }, []);

  const createCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const payload = {
        period_label: form.period_label,
        employee_count: Number(form.employee_count || 0),
        total_base: Number(form.total_base || 0),
        total_allowances: Number(form.total_allowances || 0),
        total_deductions: Number(form.total_deductions || 0),
        total_net: Number(form.total_net || 0),
        source_department: form.source_department,
      };

      const res = await fetch('/api/finance/payroll/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'تعذر إنشاء دورة مرتبات');
        return;
      }
      setForm({
        period_label: '',
        employee_count: '',
        total_base: '',
        total_allowances: '',
        total_deductions: '',
        total_net: '',
        source_department: 'HR',
      });
      setMsg('تم إنشاء دورة المرتبات بنجاح.');
      await loadCycles();
    } catch {
      setError('تعذر إنشاء دورة المرتبات');
    } finally {
      setSaving(false);
    }
  };

  const applyAction = async (id: string, action: string) => {
    setSaving(true);
    setMsg('');
    setError('');

    const needsReason = action === 'reject' || action === 'return_admin';
    const notes = needsReason ? window.prompt('اكتب سبب الإجراء:') || '' : '';
    if (needsReason && !notes.trim()) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/finance/payroll/cycles/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes, as_role: asRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'تعذر تنفيذ الإجراء');
        return;
      }
      setMsg('تم تنفيذ الإجراء بنجاح.');
      await loadCycles();
    } catch {
      setError('تعذر تنفيذ الإجراء');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/admin-gateway/finance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-3">
            <ArrowRight className="w-4 h-4" />
            الإدارة المالية
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl border border-cyan-500/35 bg-cyan-500/10 flex items-center justify-center">
                <Landmark className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">دورة المرتبات والاعتمادات</h1>
                <p className="text-sm text-slate-400 mt-1">ربط الموارد البشرية والشؤون الإدارية والمالية والخزينة في مسار موحد</p>
              </div>
            </div>
            <button onClick={() => void loadCycles()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
              <RefreshCw className="w-4 h-4" />
              تحديث
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">إجمالي الدورات</p>
            <p className="text-xl font-bold text-white mt-1">{totals.count}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">بانتظار إجراء</p>
            <p className="text-xl font-bold text-amber-300 mt-1">{totals.pending}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">تم صرفها</p>
            <p className="text-xl font-bold text-emerald-300 mt-1">{totals.disbursed}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">صافي الالتزام</p>
            <p className="text-xl font-bold text-cyan-300 mt-1">{formatCurrency(totals.net)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-sm font-bold text-cyan-200">إنشاء دورة مرتبات جديدة</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-300">الدور التنفيذي:</span>
              <select value={asRole} onChange={(e) => setAsRole(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200">
                <option value="hr_manager">HR Manager</option>
                <option value="admin_officer">Admin Officer</option>
                <option value="finance_controller">Finance Controller</option>
                <option value="finance_manager">Finance Manager</option>
                <option value="treasury_head">Treasury Head</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <form onSubmit={createCycle} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={form.period_label} onChange={(e) => setForm((p) => ({ ...p, period_label: e.target.value }))} placeholder="الفترة (مثال: يوليو 2026)" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
            <input value={form.employee_count} onChange={(e) => setForm((p) => ({ ...p, employee_count: e.target.value }))} placeholder="عدد الموظفين" type="number" min={1} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
            <input value={form.total_net} onChange={(e) => setForm((p) => ({ ...p, total_net: e.target.value }))} placeholder="صافي المرتبات" type="number" min={0} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
              <Plus className="w-4 h-4" />
              إنشاء دورة
            </button>

            <input value={form.total_base} onChange={(e) => setForm((p) => ({ ...p, total_base: e.target.value }))} placeholder="إجمالي الأساسي" type="number" min={0} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input value={form.total_allowances} onChange={(e) => setForm((p) => ({ ...p, total_allowances: e.target.value }))} placeholder="إجمالي البدلات" type="number" min={0} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input value={form.total_deductions} onChange={(e) => setForm((p) => ({ ...p, total_deductions: e.target.value }))} placeholder="إجمالي الاستقطاعات" type="number" min={0} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input value={form.source_department} onChange={(e) => setForm((p) => ({ ...p, source_department: e.target.value }))} placeholder="مصدر الدورة (HR)" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
          </form>
        </div>

        {msg && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{msg}</div>}
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link href="/dashboard/admin-gateway/hr/salary-info" className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 hover:bg-sky-500/15 transition-all">
            <div className="flex items-center gap-2 text-sky-200 text-sm font-bold"><Wallet className="w-4 h-4" /> ربط مباشر مع HR - معلومات الرواتب</div>
            <p className="text-xs text-slate-300 mt-2">مراجعة بيانات الرواتب المصدرية قبل اعتماد الدورة.</p>
          </Link>
          <Link href="/dashboard/admin-gateway/workflow/approvals?role=finance_controller&dept=finance" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-all">
            <div className="flex items-center gap-2 text-amber-200 text-sm font-bold"><ShieldCheck className="w-4 h-4" /> ربط مباشر مع مركز الموافقات</div>
            <p className="text-xs text-slate-300 mt-2">متابعة الاعتمادات الإدارية والمالية في مسار موحد.</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-bold text-white mb-4">دورات المرتبات</h2>
          {loading ? (
            <p className="text-sm text-slate-400">جاري التحميل...</p>
          ) : cycles.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد دورات مرتبات بعد.</p>
          ) : (
            <div className="space-y-3">
              {cycles.map((cycle) => (
                <div key={cycle.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-white">{cycle.period_label}</p>
                      <p className="text-xs text-slate-400 mt-1">{cycle.cycle_no} · {cycle.employee_count} موظف · {formatCurrency(cycle.total_net)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_TONE[cycle.status]}`}>{STATUS_LABELS[cycle.status]}</span>
                  </div>

                  {ACTIONS_BY_STATUS[cycle.status].length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ACTIONS_BY_STATUS[cycle.status].map((a) => (
                        <button key={a.action} disabled={saving} onClick={() => void applyAction(cycle.id, a.action)} className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60">
                          {a.label}
                        </button>
                      ))}
                      {(cycle.status === 'pending_admin_approval' || cycle.status === 'pending_finance_approval' || cycle.status === 'pending_treasury_disbursement') && (
                        <button disabled={saving} onClick={() => void applyAction(cycle.id, 'reject')} className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-60">
                          رفض الدورة
                        </button>
                      )}
                    </div>
                  )}

                  {cycle.events?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <p className="text-[11px] text-slate-500 mb-2">آخر الإجراءات:</p>
                      <div className="space-y-1">
                        {cycle.events.slice(-3).reverse().map((ev, idx) => (
                          <p key={`${ev.at}-${idx}`} className="text-[11px] text-slate-400">
                            {new Date(ev.at).toLocaleString('ar-LY')} · {ev.action} · {ev.by} ({ev.role})
                            {ev.notes ? ` · ${ev.notes}` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
