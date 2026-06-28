'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, Search, X, Edit2, ChevronLeft } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/revenue';

type CStatus = 'active' | 'inactive' | 'suspended';
type CType   = 'individual' | 'entity' | 'government' | 'ngo' | 'other';

interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
  customer_type: CType;
  phone?: string;
  email?: string;
  address?: string;
  status: CStatus;
  notes?: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  individual: 'فرد', entity: 'مؤسسة', government: 'جهة حكومية', ngo: 'منظمة', other: 'أخرى',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/20 text-green-300 border-green-500/30',
  inactive:  'bg-slate-500/20 text-slate-300 border-slate-500/30',
  suspended: 'bg-red-500/20 text-red-300 border-red-500/30',
};
const STATUS_LABELS: Record<string, string> = { active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف' };

const emptyForm = {
  customer_name: '', customer_code: '', customer_type: 'entity' as CType,
  phone: '', email: '', address: '', status: 'active' as CStatus, notes: '',
};

export default function CustomersPage() {
  const [rows, setRows]               = useState<Customer[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Customer | null>(null);
  const [form, setForm]               = useState({ ...emptyForm });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '200' });
      if (search)       p.set('search', search);
      if (filterStatus) p.set('status', filterStatus);
      if (filterType)   p.set('customer_type', filterType);
      const r = await fetch(`${BASE}/customers?${p}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.customers || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      customer_name: c.customer_name, customer_code: c.customer_code,
      customer_type: c.customer_type, phone: c.phone || '', email: c.email || '',
      address: c.address || '', status: c.status, notes: c.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.customer_name.trim()) { setError('اسم العميل مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const url    = editing ? `${BASE}/customers/${editing.id}` : `${BASE}/customers`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || 'حدث خطأ'); return; }
      setShowForm(false); load();
    } catch { setError('خطأ في الاتصال'); } finally { setSaving(false); }
  };

  const inp = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
        <ChevronLeft className="w-4 h-4" />
        <Link href="/dashboard/admin-gateway/revenue" className="hover:text-slate-200">الإيرادات</Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-slate-200">العملاء</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">سجل العملاء والمستفيدين</h1>
            <p className="text-slate-400 text-sm">{total} عميل مسجل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportButton module="customers" onSuccess={load} />
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة عميل
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرمز أو الهاتف..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="suspended">موقوف</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الأنواع</option>
          <option value="individual">فرد</option>
          <option value="entity">مؤسسة</option>
          <option value="government">حكومية</option>
          <option value="ngo">منظمة</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">لا يوجد عملاء مسجلون بعد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr className="text-slate-300">
                <th className="px-4 py-3 text-right">الرمز</th>
                <th className="px-4 py-3 text-right">الاسم</th>
                <th className="px-4 py-3 text-right">النوع</th>
                <th className="px-4 py-3 text-right">الهاتف</th>
                <th className="px-4 py-3 text-right">البريد</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">{c.customer_code}</td>
                  <td className="px-4 py-3 text-slate-100 font-medium">{c.customer_name}</td>
                  <td className="px-4 py-3 text-slate-300">{TYPE_LABELS[c.customer_type] || c.customer_type}</td>
                  <td className="px-4 py-3 text-slate-400">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[c.status] || ''}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(c)}
                      className="text-slate-400 hover:text-blue-400 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4" dir="rtl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">{editing ? 'تعديل عميل' : 'إضافة عميل جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">اسم العميل *</label>
                <input value={form.customer_name} onChange={inp('customer_name')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">رمز العميل</label>
                <input value={form.customer_code} onChange={inp('customer_code')} placeholder="تلقائي إذا فارغ"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">النوع</label>
                <select value={form.customer_type} onChange={inp('customer_type')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="individual">فرد</option>
                  <option value="entity">مؤسسة</option>
                  <option value="government">حكومية</option>
                  <option value="ngo">منظمة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الهاتف</label>
                <input value={form.phone} onChange={inp('phone')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">البريد الإلكتروني</label>
                <input value={form.email} onChange={inp('email')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">العنوان</label>
                <input value={form.address} onChange={inp('address')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الحالة</label>
                <select value={form.status} onChange={inp('status')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="suspended">موقوف</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={inp('notes')} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : (editing ? 'حفظ التعديلات' : 'إضافة عميل')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
