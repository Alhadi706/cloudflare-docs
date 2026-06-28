'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';

type KPI = {
  id: string;
  metric: string;
  value: number;
  target: number;
  period: string;
};

type ApiRecord = {
  id: string;
  payload: Record<string, unknown>;
};

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token') || '';
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

export default function DataPerformancePage() {
  const [rows, setRows] = useState<KPI[]>([]);

  const [metric, setMetric] = useState('');
  const [value, setValue] = useState(0);
  const [target, setTarget] = useState(100);
  const [period, setPeriod] = useState('2026-Q3');

  const removeKpi = async (id: string) => {
    if (!confirm('تأكيد حذف المؤشر؟')) return;
    const res = await fetch('/api/hr-center/data-performance', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const editKpi = async (row: KPI) => {
    const raw = prompt('عدّل بيانات المؤشر كـ JSON', JSON.stringify(row, null, 2));
    if (!raw) return;
    let parsed: KPI;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      metric: String(parsed.metric || '').trim(),
      value: Number(parsed.value || 0),
      target: Number(parsed.target || 0),
      period: String(parsed.period || '').trim(),
    };
    const res = await fetch('/api/hr-center/data-performance', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: row.id, payload }),
    });
    if (res.ok) setRows((prev) => prev.map((r) => (r.id === row.id ? { id: row.id, ...payload } : r)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/data-performance', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const records = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setRows(
          records.map((row) => ({
            id: row.id,
            metric: String(row.payload?.metric || ''),
            value: Number(row.payload?.value || 0),
            target: Number(row.payload?.target || 0),
            period: String(row.payload?.period || ''),
          }))
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/hr-center/data" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> قسم البيانات والإحصاء
          </Link>
          <h1 className="text-2xl font-bold text-white">تقييم الأداء المؤسسي</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="اسم المؤشر" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value) || 0)} placeholder="القيمة الحالية" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} placeholder="القيمة المستهدفة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="الفترة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!metric.trim()) return;
              const payload = { metric: metric.trim(), value, target, period: period.trim() };
              const res = await fetch('/api/hr-center/data-performance', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setRows((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setMetric('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 px-3 py-2 text-sm text-cyan-300"
          >
            <Plus className="w-4 h-4" /> إضافة مؤشر
          </button>
        </div>

        <div className="grid gap-3">
          {rows.map((r) => {
            const achieved = r.target > 0 ? Math.round((r.value / r.target) * 100) : 0;
            return (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{r.metric}</p>
                  <p className="text-xs text-slate-400 mt-1">{r.period} • الحالي: {r.value} • المستهدف: {r.target} • الإنجاز: {achieved}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => editKpi(r)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                  <button type="button" onClick={() => removeKpi(r.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
            );
          })}
          {!rows.length && <p className="text-sm text-slate-500">لا توجد مؤشرات أداء محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
