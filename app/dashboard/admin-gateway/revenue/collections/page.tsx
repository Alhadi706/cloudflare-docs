'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CreditCard, Plus, Search, X, Edit2, ChevronLeft } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/revenue';

type ColStatus = 'recorded' | 'confirmed' | 'cancelled';
type PayMethod = 'cash' | 'bank_transfer' | 'check' | 'internal' | 'other';

interface Collection {
  id: number;
  collection_number: string;
  collection_date: string;
  amount_received: number;
  payment_method: PayMethod;
  status: ColStatus;
  invoice_id: number;
  invoice_number: string;
  invoice_title: string;
  invoice_amount: number;
  currency: string;
  customer_name: string;
  project_id?: number;
  project_name?: string;
  site_id?: number;
  site_name?: string;
  notes?: string;
}

interface Invoice { id: number; invoice_number: string; invoice_title: string; invoice_amount: number; currency: string; status: string; }
interface Project { id: number; name: string; }
interface Site    { id: number; name: string; project_id: number; }

const STATUS_COLORS: Record<string, string> = {
  recorded:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  confirmed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};
const STATUS_LABELS: Record<string, string> = { recorded: 'مسجّل', confirmed: 'مؤكد', cancelled: 'ملغى' };
const METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً', bank_transfer: 'تحويل بنكي', check: 'شيك', internal: 'داخلي', other: 'أخرى',
};

const emptyForm = {
  invoice_id: '', amount_received: '',
  collection_date: new Date().toISOString().slice(0, 10),
  payment_method: 'bank_transfer' as PayMethod,
  status: 'recorded' as ColStatus,
  notes: '',
};

export default function CollectionsPage() {
  const ctx    = useErpContextStore();
  const ctxProjectId = ctx.activeProjectId ? String(ctx.activeProjectId) : '';
  const ctxSiteId    = ctx.activeSiteId    ? String(ctx.activeSiteId)    : '';

  const [rows, setRows]           = useState<Collection[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [sites, setSites]         = useState<Site[]>([]);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterMethod, setFilterMethod]   = useState('');
  const [filterProject, setFilterProject] = useState(ctxProjectId);
  const [filterSite, setFilterSite]       = useState(ctxSiteId);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Collection | null>(null);
  const [form, setForm]           = useState({ ...emptyForm });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/invoices?limit=500&status=issued`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
      fetch(`${BASE}/projects`,                          { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
      fetch(`${BASE}/sites`,                             { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
    ]).then(([invD, prD, siteD]) => {
      // show all non-cancelled, non-paid invoices
      const allInv = invD.invoices || [];
      setInvoices(allInv.filter((i: Invoice) => i.status !== 'cancelled'));
      setProjects(Array.isArray(prD) ? prD : []);
      setSites(Array.isArray(siteD) ? siteD : []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '200' });
      if (search)        p.set('search', search);
      if (filterStatus)  p.set('status', filterStatus);
      if (filterMethod)  p.set('payment_method', filterMethod);
      if (filterProject) p.set('project_id', filterProject);
      if (filterSite)    p.set('site_id', filterSite);
      const r = await fetch(`${BASE}/collections?${p}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.collections || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterMethod, filterProject, filterSite]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null); setSelectedInvoice(null);
    setForm({ ...emptyForm });
    setError(''); setShowForm(true);
  };
  const openEdit = (col: Collection) => {
    setEditing(col);
    const inv = invoices.find(i => i.id === col.invoice_id) || null;
    setSelectedInvoice(inv);
    setForm({
      invoice_id: String(col.invoice_id),
      amount_received: String(col.amount_received),
      collection_date: col.collection_date?.slice(0, 10) || '',
      payment_method: col.payment_method,
      status: col.status,
      notes: col.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const onInvoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(f => ({ ...f, invoice_id: val }));
    const inv = invoices.find(i => String(i.id) === val) || null;
    setSelectedInvoice(inv);
  };

  const save = async () => {
    if (!form.invoice_id) { setError('يجب اختيار فاتورة'); return; }
    if (!form.amount_received || isNaN(Number(form.amount_received)) || Number(form.amount_received) <= 0) {
      setError('المبلغ المحصّل يجب أن يكون أكبر من صفر'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        invoice_id:      Number(form.invoice_id),
        amount_received: Number(form.amount_received),
      };
      const url    = editing ? `${BASE}/collections/${editing.id}` : `${BASE}/collections`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(payload),
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
        <span className="text-slate-200">التحصيلات</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">التحصيلات</h1>
            <p className="text-slate-400 text-sm">{total} تحصيل مسجّل</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> تسجيل تحصيل
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم التحصيل أو رقم الفاتورة..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل وسائل الدفع</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setFilterSite(''); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        {filterProject && (
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
            <option value="">كل المواقع</option>
            {sites.filter(s => String(s.project_id) === filterProject).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">لا توجد تحصيلات بعد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr className="text-slate-300">
                <th className="px-4 py-3 text-right">الرقم</th>
                <th className="px-4 py-3 text-right">الفاتورة</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-right">المشروع</th>
                <th className="px-4 py-3 text-right">المبلغ المحصّل</th>
                <th className="px-4 py-3 text-right">وسيلة الدفع</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(col => (
                <tr key={col.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">{col.collection_number}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-slate-300 font-mono">{col.invoice_number}</div>
                    <div className="text-slate-500 truncate max-w-[140px]">{col.invoice_title}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{col.customer_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{col.project_name || '—'}</td>
                  <td className="px-4 py-3 text-emerald-400 font-mono font-bold">
                    {Number(col.amount_received).toLocaleString('ar-LY', {minimumFractionDigits: 2})} {col.currency}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{METHOD_LABELS[col.payment_method] || col.payment_method}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{col.collection_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[col.status] || ''}`}>
                      {STATUS_LABELS[col.status] || col.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(col)} className="text-slate-400 hover:text-emerald-400 transition-colors">
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
              <h2 className="text-xl font-bold text-slate-100">{editing ? 'تعديل تحصيل' : 'تسجيل تحصيل جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">الفاتورة *</label>
                <select value={form.invoice_id} onChange={onInvoiceChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="">اختر فاتورة</option>
                  {invoices.map(i => (
                    <option key={i.id} value={String(i.id)}>
                      {i.invoice_number} — {i.invoice_title} ({Number(i.invoice_amount).toLocaleString()} {i.currency})
                    </option>
                  ))}
                </select>
                {selectedInvoice && (
                  <p className="text-xs text-slate-500 mt-1">
                    المبلغ الكلي للفاتورة: {Number(selectedInvoice.invoice_amount).toLocaleString()} {selectedInvoice.currency}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">المبلغ المحصّل *</label>
                <input value={form.amount_received} onChange={inp('amount_received')} type="number" min="0.001" step="0.001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">تاريخ التحصيل</label>
                <input value={form.collection_date} onChange={inp('collection_date')} type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">وسيلة الدفع</label>
                <select value={form.payment_method} onChange={inp('payment_method')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الحالة</label>
                <select value={form.status} onChange={inp('status')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={inp('notes')} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : (editing ? 'حفظ التعديلات' : 'تسجيل التحصيل')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
