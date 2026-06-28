'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

type JoinStatus = 'pending' | 'approved' | 'rejected';

type JoinRequest = {
  id: string;
  tenant_id: string;
  app_scope: string;
  requested_by: string;
  status: JoinStatus;
  requested_at: number;
  decided_at?: number;
  decided_by?: string;
  decision_note?: string;
};

const LABELS: Record<string, string> = {
  corrosion: 'إدارة التآكل',
  maintenance: 'إدارة الصيانة',
  'admin-affairs': 'الشؤون الإدارية',
  finance: 'الإدارة المالية',
  materials: 'إدارة المواد والأصول',
  services: 'إدارة الذكاء والخدمات',
  'remote-sensing': 'مركز الاستشعار عن بعد',
};

function toLabel(scope: string): string {
  return LABELS[scope] ?? scope;
}

function fmt(ts?: number): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('ar-LY');
  } catch {
    return String(ts);
  }
}

export default function TenantJoinRequestsPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || '') : '';

  const pending = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );

  const loadInbox = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tenant-join-requests/inbox', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'تعذر تحميل طلبات الانضمام');
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  async function decide(id: string, action: 'approve' | 'reject') {
    if (!token) return;
    setSubmitting(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/tenant-join-requests/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision_note: action === 'approve' ? 'تم اعتماد ربط الإدارة' : 'تم رفض ربط الإدارة' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'تعذر تنفيذ القرار');
      setSuccess(action === 'approve' ? 'تم اعتماد طلب الانضمام بنجاح.' : 'تم رفض طلب الانضمام.');
      await loadInbox();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تنفيذ القرار');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-slate-950 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              موافقات انضمام الإدارات
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              هذه الصفحة لاعتماد أو رفض إضافة إدارة جديدة لنفس المؤسسة قبل التفعيل النهائي.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin-gateway"
              className="px-3 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800"
            >
              العودة للبوابة
            </Link>
            <button
              type="button"
              onClick={loadInbox}
              className="px-3 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 inline-flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700/50 bg-red-950/30 p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3 text-emerald-200 text-sm">
            {success}
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-300 inline-flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-amber-300" />
              الطلبات المعلقة: <span className="font-bold text-amber-300">{pending.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400 p-4">جاري التحميل...</div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-slate-400 p-4">لا توجد طلبات انضمام معلقة حاليًا.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-2 text-right">الإدارة الجديدة</th>
                    <th className="py-2 text-right">طلب بواسطة</th>
                    <th className="py-2 text-right">وقت الطلب</th>
                    <th className="py-2 text-right">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((item) => {
                    const busy = submitting === item.id;
                    return (
                      <tr key={item.id} className="border-b border-slate-800/60">
                        <td className="py-3 font-semibold text-slate-100">{toLabel(item.app_scope)}</td>
                        <td className="py-3 text-slate-300">{item.requested_by || '-'}</td>
                        <td className="py-3 text-slate-300">{fmt(item.requested_at)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decide(item.id, 'approve')}
                              className="px-3 py-1.5 rounded-lg border border-emerald-600/60 bg-emerald-700/20 text-emerald-200 hover:bg-emerald-700/30 inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              قبول
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decide(item.id, 'reject')}
                              className="px-3 py-1.5 rounded-lg border border-red-600/60 bg-red-700/20 text-red-200 hover:bg-red-700/30 inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              رفض
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
