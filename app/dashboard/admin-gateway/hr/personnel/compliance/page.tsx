'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, ListChecks, RefreshCw } from 'lucide-react';

type AuditRecord = {
  id: string;
  request_id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  notes: string | null;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

type Summary = {
  total_requests: number;
  pending_requests: number;
  overdue_requests: number;
  archived_requests: number;
  rejected_requests: number;
  sla_compliance_pct: number;
};

export default function PersonnelCompliancePage() {
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadAudit() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/hr/personnel/audit?limit=100', { cache: 'no-store' });
      const data = await res.json();
      setAudit(Array.isArray(data?.audit) ? data.audit : []);
      setSummary(data?.summary || null);
    } catch {
      setMessage('تعذر تحميل مؤشرات الامتثال وسجل التدقيق.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr/personnel" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> شؤون الموظفين
        </Link>

        <section className="rounded-3xl border border-emerald-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">الحوكمة والامتثال</h1>
          <p className="mt-2 text-sm text-slate-300">قياس التزام الإجراءات بالـ SLA وسجل تدقيق كامل لكل انتقال حالة.</p>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">إجمالي الطلبات</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary?.total_requests ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300">طلبات معلقة</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{summary?.pending_requests ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs text-rose-300">خارج SLA</p>
            <p className="mt-2 text-2xl font-bold text-rose-200">{summary?.overdue_requests ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-300">مؤرشفة</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{summary?.archived_requests ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs text-rose-300">مرفوضة</p>
            <p className="mt-2 text-2xl font-bold text-rose-200">{summary?.rejected_requests ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-xs text-cyan-300">الالتزام بالـ SLA</p>
            <p className="mt-2 text-2xl font-bold text-cyan-200">{summary?.sla_compliance_pct ?? '-'}%</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white">
              <ListChecks className="h-5 w-5 text-cyan-300" /> سجل التدقيق
            </h2>
            <button
              type="button"
              onClick={() => void loadAudit()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200"
            >
              <RefreshCw className="h-4 w-4" /> تحديث
            </button>
          </div>

          {message ? <p className="mb-3 text-sm text-rose-300">{message}</p> : null}
          {loading ? <p className="text-sm text-slate-400">جارٍ التحميل...</p> : null}

          <div className="space-y-3">
            {audit.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">طلب #{row.request_id}</p>
                  <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString('ar-LY')}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">الإجراء: {row.action}</span>
                  <span className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-slate-300">من: {row.from_status || '-'}</span>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">إلى: {row.to_status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">المنفذ: {row.actor_id} ({row.actor_role})</p>
                {row.notes ? <p className="mt-1 text-xs text-slate-400">ملاحظات: {row.notes}</p> : null}
              </div>
            ))}
            {!loading && audit.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/50 p-6 text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">لا توجد أحداث تدقيق بعد.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
