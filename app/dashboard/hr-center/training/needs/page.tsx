'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Target, Plus } from 'lucide-react';

type Need = {
  id: string;
  department: string;
  skill: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
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

export default function TrainingNeedsPage() {
  const [needs, setNeeds] = useState<Need[]>([]);

  const [department, setDepartment] = useState('');
  const [skill, setSkill] = useState('');
  const [priority, setPriority] = useState<'عالية' | 'متوسطة' | 'منخفضة'>('متوسطة');

  const removeNeed = async (id: string) => {
    if (!confirm('تأكيد حذف الاحتياج؟')) return;
    const res = await fetch('/api/hr-center/training-needs', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setNeeds((prev) => prev.filter((n) => n.id !== id));
  };

  const editNeed = async (need: Need) => {
    const raw = prompt('عدّل بيانات الاحتياج كـ JSON', JSON.stringify(need, null, 2));
    if (!raw) return;
    let parsed: Need;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload: Need = {
      id: need.id,
      department: String(parsed.department || '').trim(),
      skill: String(parsed.skill || '').trim(),
      priority: (['عالية', 'متوسطة', 'منخفضة'].includes(String(parsed.priority || ''))
        ? String(parsed.priority)
        : 'متوسطة') as Need['priority'],
    };
    const res = await fetch('/api/hr-center/training-needs', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: need.id, payload: { department: payload.department, skill: payload.skill, priority: payload.priority } }),
    });
    if (res.ok) setNeeds((prev) => prev.map((n) => (n.id === need.id ? payload : n)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/training-needs', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setNeeds(
          rows.map((row) => ({
            id: row.id,
            department: String(row.payload?.department || ''),
            skill: String(row.payload?.skill || ''),
            priority: (['عالية', 'متوسطة', 'منخفضة'].includes(String(row.payload?.priority || ''))
              ? String(row.payload?.priority)
              : 'متوسطة') as Need['priority'],
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
          <h1 className="text-2xl font-bold text-white">الاحتياجات التدريبية</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="الإدارة الطالبة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="المهارة/الموضوع" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'عالية' | 'متوسطة' | 'منخفضة')} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
              <option>عالية</option>
              <option>متوسطة</option>
              <option>منخفضة</option>
            </select>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!department.trim() || !skill.trim()) return;
              const payload = { department: department.trim(), skill: skill.trim(), priority };
              const res = await fetch('/api/hr-center/training-needs', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setNeeds((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setDepartment('');
              setSkill('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600/20 border border-amber-500/40 px-3 py-2 text-sm text-amber-300"
          >
            <Plus className="w-4 h-4" /> إضافة احتياج
          </button>
        </div>

        <div className="grid gap-3">
          {needs.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{n.skill}</p>
                <p className="text-xs text-slate-400 mt-1">{n.department} • أولوية: {n.priority}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editNeed(n)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeNeed(n.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <Target className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          ))}
          {!needs.length && <p className="text-sm text-slate-500">لا توجد احتياجات تدريبية مسجلة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
