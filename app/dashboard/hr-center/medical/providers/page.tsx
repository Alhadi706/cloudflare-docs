'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, Plus } from 'lucide-react';

type Provider = {
  id: string;
  name: string;
  category: 'مصحة' | 'مستشفى' | 'مختبر' | 'عيادة';
  contractNumber: string;
  active: boolean;
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

export default function MedicalProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Provider['category']>('مصحة');
  const [contractNumber, setContractNumber] = useState('');

  const removeProvider = async (id: string) => {
    if (!confirm('تأكيد حذف الجهة المتعاقدة؟')) return;
    const res = await fetch('/api/hr-center/medical-providers', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  const editProvider = async (provider: Provider) => {
    const raw = prompt('عدّل بيانات الجهة كـ JSON', JSON.stringify(provider, null, 2));
    if (!raw) return;
    let parsed: Provider;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      name: String(parsed.name || '').trim(),
      category: (['مصحة', 'مستشفى', 'مختبر', 'عيادة'].includes(String(parsed.category || ''))
        ? String(parsed.category)
        : 'مصحة') as Provider['category'],
      contractNumber: String(parsed.contractNumber || '').trim(),
      active: Boolean(parsed.active),
    };
    const res = await fetch('/api/hr-center/medical-providers', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: provider.id, payload }),
    });
    if (res.ok) setProviders((prev) => prev.map((p) => (p.id === provider.id ? { id: provider.id, ...payload } : p)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/medical-providers', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setProviders(
          rows.map((row) => ({
            id: row.id,
            name: String(row.payload?.name || ''),
            category: (['مصحة', 'مستشفى', 'مختبر', 'عيادة'].includes(String(row.payload?.category || ''))
              ? String(row.payload?.category)
              : 'مصحة') as Provider['category'],
            contractNumber: String(row.payload?.contractNumber || ''),
            active: Boolean(row.payload?.active),
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
          <Link href="/dashboard/hr-center/medical" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> قسم الشؤون الطبية
          </Link>
          <h1 className="text-2xl font-bold text-white">المصحات والعيادات المتعاقدة</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الجهة" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <select value={category} onChange={(e) => setCategory(e.target.value as Provider['category'])} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
              <option>مصحة</option>
              <option>مستشفى</option>
              <option>مختبر</option>
              <option>عيادة</option>
            </select>
            <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="رقم التعاقد" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!name.trim()) return;
              const payload = { name: name.trim(), category, contractNumber: contractNumber.trim(), active: true };
              const res = await fetch('/api/hr-center/medical-providers', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setProviders((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setName('');
              setContractNumber('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-pink-600/20 border border-pink-500/40 px-3 py-2 text-sm text-pink-300"
          >
            <Plus className="w-4 h-4" /> إضافة جهة متعاقدة
          </button>
        </div>

        <div className="grid gap-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{p.name}</p>
                <p className="text-xs text-slate-400 mt-1">{p.category} • عقد: {p.contractNumber || '—'} • {p.active ? 'نشط' : 'متوقف'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editProvider(p)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeProvider(p.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <Building2 className="w-4 h-4 text-pink-400" />
              </div>
            </div>
          ))}
          {!providers.length && <p className="text-sm text-slate-500">لا توجد جهات متعاقدة حتى الآن.</p>}
        </div>
      </div>
    </div>
  );
}
