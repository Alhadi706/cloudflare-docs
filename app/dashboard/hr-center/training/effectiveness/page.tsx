'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';

type Effectiveness = {
  id: string;
  courseTitle: string;
  department: string;
  score: number;
  note: string;
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

export default function TrainingEffectivenessPage() {
  const [items, setItems] = useState<Effectiveness[]>([]);

  const [courseTitle, setCourseTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [score, setScore] = useState(80);
  const [note, setNote] = useState('');

  const removeItem = async (id: string) => {
    if (!confirm('تأكيد حذف التقييم؟')) return;
    const res = await fetch('/api/hr-center/training-effectiveness', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const editItem = async (item: Effectiveness) => {
    const raw = prompt('عدّل بيانات التقييم كـ JSON', JSON.stringify(item, null, 2));
    if (!raw) return;
    let parsed: Effectiveness;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      courseTitle: String(parsed.courseTitle || '').trim(),
      department: String(parsed.department || '').trim(),
      score: Number(parsed.score || 0),
      note: String(parsed.note || '').trim(),
    };
    const res = await fetch('/api/hr-center/training-effectiveness', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: item.id, payload }),
    });
    if (res.ok) setItems((prev) => prev.map((it) => (it.id === item.id ? { id: item.id, ...payload } : it)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/training-effectiveness', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setItems(
          rows.map((row) => ({
            id: row.id,
            courseTitle: String(row.payload?.courseTitle || ''),
            department: String(row.payload?.department || ''),
            score: Number(row.payload?.score || 0),
            note: String(row.payload?.note || ''),
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
          <h1 className="text-2xl font-bold text-white">تقييم فاعلية التدريب</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="اسم الدورة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="الإدارة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={score} onChange={(e) => setScore(Number(e.target.value) || 0)} min={0} max={100} placeholder="نسبة الفاعلية" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!courseTitle.trim() || !department.trim()) return;
              const payload = { courseTitle: courseTitle.trim(), department: department.trim(), score, note: note.trim() };
              const res = await fetch('/api/hr-center/training-effectiveness', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setItems((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setCourseTitle('');
              setDepartment('');
              setNote('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 px-3 py-2 text-sm text-cyan-300"
          >
            <Plus className="w-4 h-4" /> إضافة تقييم
          </button>
        </div>

        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{it.courseTitle}</p>
                <p className="text-xs text-slate-400 mt-1">{it.department} • الفاعلية: {it.score}% • {it.note || 'بدون ملاحظات'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editItem(it)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeItem(it.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
          ))}
          {!items.length && <p className="text-sm text-slate-500">لا توجد تقييمات محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
