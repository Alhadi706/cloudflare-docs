'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Star, Phone, Mail, Edit2, Trash2, ChevronLeft, X, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Supplier {
  id: number;
  supplier_code?: string;
  supplier_name: string;
  supplier_type: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  status: string;
  evaluation_score?: number;
  contact_person?: string;
  tax_number?: string;
  notes?: string;
  created_at: string;
}

const SUPPLIER_TYPES: Record<string, string> = {
  general: 'عام', goods: 'بضائع', services: 'خدمات',
  contractor: 'مقاول', consultant: 'استشاري', maintenance: 'صيانة',
};
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'نشط',    cls: 'text-emerald-400 bg-emerald-500/10' },
  inactive:  { label: 'غير نشط', cls: 'text-slate-400 bg-slate-500/10' },
  suspended: { label: 'موقوف',  cls: 'text-rose-400 bg-rose-500/10' },
};

const emptyForm = (): Partial<Supplier> => ({
  supplier_name: '', supplier_type: 'general', status: 'active',
  phone: '', email: '', address: '', city: '', contact_person: '',
  tax_number: '', notes: '', supplier_code: '',
});

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [form, setForm]           = useState<Partial<Supplier>>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search)       params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/v1/procurement/suppliers?${params}`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' },
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
        setTotal(data.total || 0);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(null); setShowForm(true); };
  const openEdit   = (s: Supplier) => { setEditing(s); setForm({ ...s }); setError(null); setShowForm(true); };

  const handleSave = async () => {
    if (!form.supplier_name?.trim()) { setError('اسم المورّد مطلوب'); return; }
    setSaving(true); setError(null);
    try {
      const url  = editing ? `/api/v1/procurement/suppliers/${editing.id}` : '/api/v1/procurement/suppliers';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        fetchSuppliers();
      } else {
        const d = await res.json();
        setError(d.detail || 'فشل الحفظ');
      }
    } catch { setError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل تريد حذف هذا المورّد؟')) return;
    const res = await fetch(`/api/v1/procurement/suppliers/${id}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-ID': getTenantId() || '' },
    });
    if (res.ok) fetchSuppliers();
    else {
      const d = await res.json();
      alert(d.detail || 'فشل الحذف');
    }
  };

  const activeCount   = suppliers.filter(s => s.status === 'active').length;
  const avgScore      = suppliers.filter(s => s.evaluation_score).reduce((a, b) => a + (b.evaluation_score || 0), 0) / (suppliers.filter(s => s.evaluation_score).length || 1);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/procurement" className="hover:text-slate-200">المشتريات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الموردون</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الموردون</h1>
              <p className="text-slate-400 mt-1">سجل الموردين المعتمدين — {total} مورّد</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="suppliers" onSuccess={fetchSuppliers} />
            <button
              onClick={openCreate}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>مورّد جديد</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الموردين', value: total, color: 'text-slate-100' },
            { label: 'نشطون', value: activeCount, color: 'text-emerald-400' },
            { label: 'متوسط التقييم', value: isNaN(avgScore) ? '--' : avgScore.toFixed(1) + '/5', color: 'text-amber-400' },
            { label: 'أنواع الموردين', value: new Set(suppliers.map(s => s.supplier_type)).size, color: 'text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم أو رمز المورّد..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-10 pl-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="suspended">موقوف</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  {['الرمز', 'اسم المورّد', 'النوع', 'جهة الاتصال', 'التقييم', 'الحالة', 'إجراءات'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">جارٍ التحميل...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">لا يوجد موردون بعد</td></tr>
                ) : suppliers.map(s => {
                  const st = STATUS_LABELS[s.status] || { label: s.status, cls: 'text-slate-400 bg-slate-500/10' };
                  return (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.supplier_code || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{s.supplier_name}</div>
                        {s.city && <div className="text-xs text-slate-500">{s.city}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{SUPPLIER_TYPES[s.supplier_type] || s.supplier_type}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {s.phone && <div className="flex items-center gap-1 text-xs text-slate-400"><Phone className="w-3 h-3" />{s.phone}</div>}
                          {s.email && <div className="flex items-center gap-1 text-xs text-slate-400"><Mail className="w-3 h-3" />{s.email}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.evaluation_score ? (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="w-4 h-4 fill-amber-400" />
                            <span className="font-medium">{s.evaluation_score}</span>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(s)} className="text-slate-400 hover:text-blue-400 transition-colors p-1">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="text-slate-400 hover:text-rose-400 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-white font-bold text-lg">{editing ? 'تعديل مورّد' : 'إضافة مورّد جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">اسم المورّد <span className="text-red-400">*</span></label>
                  <input value={form.supplier_name || ''} onChange={e => setForm(p => ({...p, supplier_name: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الرمز</label>
                  <input value={form.supplier_code || ''} onChange={e => setForm(p => ({...p, supplier_code: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">النوع</label>
                  <select value={form.supplier_type || 'general'} onChange={e => setForm(p => ({...p, supplier_type: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    {Object.entries(SUPPLIER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الحالة</label>
                  <select value={form.status || 'active'} onChange={e => setForm(p => ({...p, status: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                    <option value="suspended">موقوف</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الهاتف</label>
                  <input value={form.phone || ''} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">البريد الإلكتروني</label>
                  <input value={form.email || ''} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">جهة الاتصال</label>
                  <input value={form.contact_person || ''} onChange={e => setForm(p => ({...p, contact_person: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الرقم الضريبي</label>
                  <input value={form.tax_number || ''} onChange={e => setForm(p => ({...p, tax_number: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">المدينة</label>
                  <input value={form.city || ''} onChange={e => setForm(p => ({...p, city: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">درجة التقييم (1-5)</label>
                  <input type="number" min="1" max="5" step="0.1"
                    value={form.evaluation_score || ''} onChange={e => setForm(p => ({...p, evaluation_score: e.target.value ? Number(e.target.value) : undefined}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-gray-300 text-sm mb-1 block">العنوان</label>
                <input value={form.address || ''} onChange={e => setForm(p => ({...p, address: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-300 text-sm mb-1 block">ملاحظات</label>
                <textarea rows={2} value={form.notes || ''} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : <><CheckCircle className="w-4 h-4" />{editing ? 'حفظ التعديلات' : 'إضافة المورّد'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
