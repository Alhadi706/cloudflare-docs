'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, Plus } from 'lucide-react';

type Course = {
  id: string;
  title: string;
  provider: string;
  hours: number;
  mode: 'حضوري' | 'عن بعد';
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

export default function TrainingCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [hours, setHours] = useState(8);
  const [mode, setMode] = useState<'حضوري' | 'عن بعد'>('حضوري');

  const removeCourse = async (id: string) => {
    if (!confirm('تأكيد حذف الدورة؟')) return;
    const res = await fetch('/api/hr-center/training-courses', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const editCourse = async (course: Course) => {
    const raw = prompt('عدّل بيانات الدورة كـ JSON', JSON.stringify(course, null, 2));
    if (!raw) return;
    let parsed: Course;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      title: String(parsed.title || '').trim(),
      provider: String(parsed.provider || '').trim(),
      hours: Number(parsed.hours || 0),
      mode: String(parsed.mode || 'حضوري') === 'عن بعد' ? 'عن بعد' : 'حضوري',
    } as Course;
    const res = await fetch('/api/hr-center/training-courses', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: course.id, payload }),
    });
    if (res.ok) setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, ...payload } : c)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/training-courses', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setCourses(
          rows.map((row) => ({
            id: row.id,
            title: String(row.payload?.title || ''),
            provider: String(row.payload?.provider || ''),
            hours: Number(row.payload?.hours || 0),
            mode: String(row.payload?.mode || 'حضوري') === 'عن بعد' ? 'عن بعد' : 'حضوري',
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
          <h1 className="text-2xl font-bold text-white">الدورات التدريبية</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الدورة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="الجهة المنفذة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} placeholder="الساعات" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <select value={mode} onChange={(e) => setMode(e.target.value as 'حضوري' | 'عن بعد')} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
              <option>حضوري</option>
              <option>عن بعد</option>
            </select>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!title.trim()) return;
              const payload = { title: title.trim(), provider: provider.trim(), hours, mode };
              const res = await fetch('/api/hr-center/training-courses', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setCourses((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setTitle('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300"
          >
            <Plus className="w-4 h-4" /> إضافة دورة
          </button>
        </div>

        <div className="grid gap-3">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{c.title}</p>
                <p className="text-xs text-slate-400 mt-1">{c.provider || '—'} • {c.hours} ساعة • {c.mode}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editCourse(c)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeCourse(c.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <GraduationCap className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          ))}
          {!courses.length && <p className="text-sm text-slate-500">لا توجد دورات محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
