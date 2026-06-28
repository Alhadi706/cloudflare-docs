'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, FileBarChart, Plus } from 'lucide-react';

type Study = {
  id: string;
  title: string;
  domain: string;
  recommendation: string;
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

export default function DataStudiesPage() {
  const [studies, setStudies] = useState<Study[]>([]);

  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('القوى العاملة');
  const [recommendation, setRecommendation] = useState('');

  const removeStudy = async (id: string) => {
    if (!confirm('تأكيد حذف الدراسة؟')) return;
    const res = await fetch('/api/hr-center/data-studies', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setStudies((prev) => prev.filter((s) => s.id !== id));
  };

  const editStudy = async (study: Study) => {
    const raw = prompt('عدّل بيانات الدراسة كـ JSON', JSON.stringify(study, null, 2));
    if (!raw) return;
    let parsed: Study;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      title: String(parsed.title || '').trim(),
      domain: String(parsed.domain || '').trim(),
      recommendation: String(parsed.recommendation || '').trim(),
    };
    const res = await fetch('/api/hr-center/data-studies', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: study.id, payload }),
    });
    if (res.ok) setStudies((prev) => prev.map((s) => (s.id === study.id ? { id: study.id, ...payload } : s)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/data-studies', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setStudies(
          rows.map((row) => ({
            id: row.id,
            title: String(row.payload?.title || ''),
            domain: String(row.payload?.domain || ''),
            recommendation: String(row.payload?.recommendation || ''),
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
          <h1 className="text-2xl font-bold text-white">الدراسات والبحوث</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الدراسة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="المجال" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="التوصية الرئيسية" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!title.trim()) return;
              const payload = { title: title.trim(), domain: domain.trim(), recommendation: recommendation.trim() };
              const res = await fetch('/api/hr-center/data-studies', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setStudies((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setTitle('');
              setRecommendation('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-3 py-2 text-sm text-indigo-300"
          >
            <Plus className="w-4 h-4" /> إضافة دراسة
          </button>
        </div>

        <div className="grid gap-3">
          {studies.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{s.title}</p>
                <p className="text-xs text-slate-400 mt-1">{s.domain} • التوصية: {s.recommendation || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editStudy(s)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeStudy(s.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <FileBarChart className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
          ))}
          {!studies.length && <p className="text-sm text-slate-500">لا توجد دراسات محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
