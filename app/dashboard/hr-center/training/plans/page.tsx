'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardList, Plus } from 'lucide-react';

type TrainingPlan = {
  id: string;
  title: string;
  department: string;
  period: string;
  targetEmployees: number;
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

export default function TrainingPlansPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('الموارد البشرية');
  const [period, setPeriod] = useState('2026-Q3');
  const [targetEmployees, setTargetEmployees] = useState(10);

  const removePlan = async (id: string) => {
    if (!confirm('تأكيد حذف الخطة؟')) return;
    const res = await fetch('/api/hr-center/training-plans', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const editPlan = async (plan: TrainingPlan) => {
    const raw = prompt('عدّل بيانات الخطة كـ JSON', JSON.stringify(plan, null, 2));
    if (!raw) return;
    let parsed: TrainingPlan;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      title: String(parsed.title || '').trim(),
      department: String(parsed.department || '').trim(),
      period: String(parsed.period || '').trim(),
      targetEmployees: Number(parsed.targetEmployees || 0),
    };
    const res = await fetch('/api/hr-center/training-plans', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: plan.id, payload }),
    });
    if (res.ok) setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, ...payload } : p)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/training-plans', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setPlans(
          rows.map((row) => ({
            id: row.id,
            title: String(row.payload?.title || ''),
            department: String(row.payload?.department || ''),
            period: String(row.payload?.period || ''),
            targetEmployees: Number(row.payload?.targetEmployees || 0),
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
          <Link href="/dashboard/hr-center/training" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> قسم التدريب والتطوير
          </Link>
          <h1 className="text-2xl font-bold text-white">خطط التدريب السنوية</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الخطة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="الإدارة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="الفترة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={targetEmployees} onChange={(e) => setTargetEmployees(Number(e.target.value) || 0)} placeholder="عدد المستهدفين" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!title.trim()) return;
              const payload = { title: title.trim(), department: department.trim(), period: period.trim(), targetEmployees };
              const res = await fetch('/api/hr-center/training-plans', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setPlans((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setTitle('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600/20 border border-teal-500/40 px-3 py-2 text-sm text-teal-300"
          >
            <Plus className="w-4 h-4" /> إضافة خطة
          </button>
        </div>

        <div className="grid gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{p.title}</p>
                <p className="text-xs text-slate-400 mt-1">{p.department} • {p.period} • مستهدف: {p.targetEmployees}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editPlan(p)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removePlan(p.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <ClipboardList className="w-4 h-4 text-teal-400" />
              </div>
            </div>
          ))}
          {!plans.length && <p className="text-sm text-slate-500">لا توجد خطط محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
