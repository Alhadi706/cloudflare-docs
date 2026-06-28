'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RequestInstitutionPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const [form, setForm] = useState({
    organization_name: '',
    organization_type: '',
    contact_full_name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
  });

  const setField = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const submit = async () => {
    if (!form.organization_name.trim()) return setError('اسم المؤسسة مطلوب');
    if (!form.contact_full_name.trim()) return setError('اسم جهة التواصل مطلوب');
    if (!form.contact_email.trim()) return setError('بريد التواصل مطلوب');
    if (!form.contact_phone.trim()) return setError('رقم الهاتف مطلوب');

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/tenant-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_name: form.organization_name,
          organization_type: form.organization_type || undefined,
          contact_full_name: form.contact_full_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          notes: form.notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'تعذر إرسال الطلب');
        return;
      }

      setDone(true);
      setRequestId(data.request_id || '');
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">طلب انضمام مؤسسة جديدة</h1>
          <Link href="/entry" className="text-sm text-cyan-300 hover:text-cyan-200">
            العودة لتسجيل الدخول
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          {done ? (
            <div className="space-y-3">
              <p className="text-emerald-400 font-semibold">تم إرسال الطلب بنجاح.</p>
              <p className="text-sm text-slate-300">سيتم مراجعته من مالك المنصة قبل التفعيل.</p>
              {requestId && (
                <p className="text-xs text-slate-400">رقم الطلب: <span className="font-mono">{requestId}</span></p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" placeholder="اسم المؤسسة" value={form.organization_name} onChange={e => setField('organization_name', e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" placeholder="نوع المؤسسة (اختياري)" value={form.organization_type} onChange={e => setField('organization_type', e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" placeholder="اسم جهة التواصل" value={form.contact_full_name} onChange={e => setField('contact_full_name', e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" placeholder="بريد جهة التواصل" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 md:col-span-2" placeholder="هاتف جهة التواصل" value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} />
                <textarea className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 md:col-span-2 min-h-28" placeholder="ملاحظات إضافية (اختياري)" value={form.notes} onChange={e => setField('notes', e.target.value)} />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-3 py-2.5 font-medium"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال طلب الانضمام'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
