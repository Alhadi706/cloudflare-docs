'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Search, X, Edit2, CheckCircle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE = '/api/v1/contracts';

type Status = 'active' | 'inactive' | 'blacklisted';
type CType = 'general' | 'civil' | 'mechanical' | 'electrical' | 'it' | 'consultancy' | 'maintenance' | 'supply';

interface Contractor {
  id: number; contractor_code: string; contractor_name: string;
  contractor_type: CType; registration_number?: string; classification?: string;
  phone?: string; email?: string; city?: string; contact_person?: string;
  status: Status; notes?: string; created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  general: 'عام', civil: 'مدني', mechanical: 'ميكانيكي', electrical: 'كهربائي',
  it: 'تقنية معلومات', consultancy: 'استشارات', maintenance: 'صيانة', supply: 'توريد',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  inactive: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  blacklisted: 'bg-red-500/20 text-red-300 border-red-500/30',
};
const STATUS_LABELS: Record<string, string> = { active: 'نشط', inactive: 'غير نشط', blacklisted: 'قائمة سوداء' };

const empty = { contractor_name: '', contractor_type: 'general' as CType, contractor_code: '',
  registration_number: '', classification: '', phone: '', email: '', city: '', contact_person: '', status: 'active' as Status, notes: '' };

export default function ContractorsPage() {
  const [rows, setRows] = useState<Contractor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('contractor_type', filterType);
      const r = await fetch(`${BASE}/contractors?${params}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.contractors || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setError(''); setShowForm(true); };
  const openEdit = (c: Contractor) => {
    setEditing(c);
    setForm({ contractor_name: c.contractor_name, contractor_type: c.contractor_type,
      contractor_code: c.contractor_code, registration_number: c.registration_number || '',
      classification: c.classification || '', phone: c.phone || '', email: c.email || '',
      city: c.city || '', contact_person: c.contact_person || '', status: c.status, notes: c.notes || '' });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.contractor_name.trim()) { setError('اسم المقاول مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const url = editing ? `${BASE}/contractors/${editing.id}` : `${BASE}/contractors`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || 'حدث خطأ'); return; }
      setShowForm(false); load();
    } catch { setError('خطأ في الاتصال'); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">سجل المقاولين</h1>
            <p className="text-slate-400 text-sm">{total} مقاول مسجل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportButton module="contractors" onSuccess={load} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة مقاول
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرمز..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="blacklisted">قائمة سوداء</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">لا توجد مقاولون — أضف أول مقاول</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  {['الرمز', 'الاسم', 'النوع', 'التصنيف', 'رقم التسجيل', 'المدينة', 'الهاتف', 'الحالة', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-blue-300 font-mono text-xs">{c.contractor_code}</td>
                    <td className="px-4 py-3 text-slate-100 font-medium">{c.contractor_name}</td>
                    <td className="px-4 py-3 text-slate-300">{TYPE_LABELS[c.contractor_type] || c.contractor_type}</td>
                    <td className="px-4 py-3 text-slate-400">{c.classification || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.registration_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-lg font-bold text-slate-100">{editing ? 'تعديل مقاول' : 'إضافة مقاول جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">اسم المقاول *</label>
                  <input value={form.contractor_name} onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">رمز المقاول</label>
                  <input value={form.contractor_code} onChange={e => setForm(f => ({ ...f, contractor_code: e.target.value }))}
                    placeholder="تلقائي إن تُرك فارغاً"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">نوع المقاول</label>
                  <select value={form.contractor_type} onChange={e => setForm(f => ({ ...f, contractor_type: e.target.value as CType }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">التصنيف</label>
                  <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="">—</option>
                    {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">رقم التسجيل</label>
                  <input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">المدينة</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الهاتف</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">البريد الإلكتروني</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">جهة الاتصال</label>
                  <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                    <option value="blacklisted">قائمة سوداء</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                <CheckCircle className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المقاول'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
