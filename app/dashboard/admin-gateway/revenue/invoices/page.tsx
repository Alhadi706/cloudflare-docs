'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search, X, Edit2, ChevronLeft } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/revenue';

type InvStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';
type InvType   = 'service' | 'supply' | 'subscription' | 'penalty' | 'other';

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_title: string;
  invoice_type: InvType;
  invoice_amount: number;
  currency: string;
  issue_date: string;
  due_date?: string;
  status: InvStatus;
  customer_id: number;
  customer_name: string;
  project_id?: number;
  project_name?: string;
  site_id?: number;
  site_name?: string;
  collected_amount?: number;
  description?: string;
  notes?: string;
}

interface Customer { id: number; customer_name: string; customer_code: string; }
interface Project  { id: number; name: string; }
interface Site     { id: number; name: string; project_id: number; }

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-slate-500/20 text-slate-300 border-slate-500/30',
  issued:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  partial:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  paid:      'bg-green-500/20 text-green-300 border-green-500/30',
  overdue:   'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة', issued: 'مُصدَرة', partial: 'جزئي', paid: 'مدفوعة', overdue: 'متأخرة', cancelled: 'ملغاة',
};
const TYPE_LABELS: Record<string, string> = {
  service: 'خدمة', supply: 'توريد', subscription: 'اشتراك', penalty: 'غرامة', other: 'أخرى',
};

const emptyForm = {
  invoice_title: '', invoice_number: '', invoice_type: 'service' as InvType,
  invoice_amount: '', currency: 'LYD', status: 'draft' as InvStatus,
  customer_id: '', project_id: '', site_id: '',
  issue_date: new Date().toISOString().slice(0, 10), due_date: '',
  description: '', notes: '',
};

export default function InvoicesPage() {
  const ctx    = useErpContextStore();
  const ctxProjectId = ctx.activeProjectId ? String(ctx.activeProjectId) : '';
  const ctxSiteId    = ctx.activeSiteId    ? String(ctx.activeSiteId)    : '';

  const [rows, setRows]             = useState<Invoice[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [sites, setSites]           = useState<Site[]>([]);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterProject, setFilterProject]   = useState(ctxProjectId);
  const [filterSite, setFilterSite]         = useState(ctxSiteId);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Invoice | null>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // load lookups once
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/customers?limit=500`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
      fetch(`${BASE}/projects`,            { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
      fetch(`${BASE}/sites`,               { headers: { 'X-Tenant-ID': getTenantId() || '' } }).then(r => r.json()),
    ]).then(([cd, pd, sd]) => {
      setCustomers(cd.customers || []);
      setProjects(Array.isArray(pd) ? pd : []);
      setSites(Array.isArray(sd) ? sd : []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '200' });
      if (search)        p.set('search', search);
      if (filterStatus)  p.set('status', filterStatus);
      if (filterCustomer) p.set('customer_id', filterCustomer);
      if (filterProject) p.set('project_id', filterProject);
      if (filterSite)    p.set('site_id', filterSite);
      const r = await fetch(`${BASE}/invoices?${p}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.invoices || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterCustomer, filterProject, filterSite]);

  useEffect(() => { load(); }, [load]);

  // filter sites by selected project
  const filteredSites = form.project_id
    ? sites.filter(s => String(s.project_id) === String(form.project_id))
    : sites;

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, project_id: ctxProjectId, site_id: ctxSiteId });
    setError(''); setShowForm(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setForm({
      invoice_title: inv.invoice_title, invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type, invoice_amount: String(inv.invoice_amount),
      currency: inv.currency, status: inv.status,
      customer_id: String(inv.customer_id),
      project_id: inv.project_id ? String(inv.project_id) : '',
      site_id: inv.site_id ? String(inv.site_id) : '',
      issue_date: inv.issue_date?.slice(0, 10) || '', due_date: inv.due_date?.slice(0, 10) || '',
      description: inv.description || '', notes: inv.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.invoice_title.trim()) { setError('عنوان الفاتورة مطلوب'); return; }
    if (!form.customer_id) { setError('العميل مطلوب'); return; }
    if (form.invoice_amount === '' || isNaN(Number(form.invoice_amount)) || Number(form.invoice_amount) < 0) {
      setError('المبلغ يجب أن يكون رقماً صحيحاً'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        customer_id:    Number(form.customer_id),
        project_id:     form.project_id  ? Number(form.project_id)  : null,
        site_id:        form.site_id     ? Number(form.site_id)      : null,
        invoice_amount: Number(form.invoice_amount),
        due_date:       form.due_date || null,
      };
      const url    = editing ? `${BASE}/invoices/${editing.id}` : `${BASE}/invoices`;
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

  const remaining = (inv: Invoice) => {
    const col = inv.collected_amount ?? 0;
    return Math.max(0, inv.invoice_amount - col);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
        <ChevronLeft className="w-4 h-4" />
        <Link href="/dashboard/admin-gateway/revenue" className="hover:text-slate-200">الإيرادات</Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-slate-200">الفواتير</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">الفواتير</h1>
            <p className="text-slate-400 text-sm">{total} فاتورة</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> إنشاء فاتورة
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة أو العنوان..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل العملاء</option>
          {customers.map(c => <option key={c.id} value={String(c.id)}>{c.customer_name}</option>)}
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
          <div className="p-8 text-center text-slate-500">لا توجد فواتير بعد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr className="text-slate-300">
                <th className="px-4 py-3 text-right">الرقم</th>
                <th className="px-4 py-3 text-right">العنوان</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-right">المشروع</th>
                <th className="px-4 py-3 text-right">المبلغ</th>
                <th className="px-4 py-3 text-right">المحصّل</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">تاريخ الاستحقاق</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-100 font-medium max-w-[180px] truncate">{inv.invoice_title}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{inv.project_name || '—'}{inv.site_name ? ` / ${inv.site_name}` : ''}</td>
                  <td className="px-4 py-3 text-slate-100 font-mono">{Number(inv.invoice_amount).toLocaleString('ar-LY', {minimumFractionDigits: 2})} {inv.currency}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{Number(inv.collected_amount || 0).toLocaleString('ar-LY', {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[inv.status] || ''}`}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{inv.due_date?.slice(0, 10) || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(inv)} className="text-slate-400 hover:text-amber-400 transition-colors">
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">{editing ? 'تعديل فاتورة' : 'إنشاء فاتورة جديدة'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">عنوان الفاتورة *</label>
                <input value={form.invoice_title} onChange={inp('invoice_title')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">رقم الفاتورة</label>
                <input value={form.invoice_number} onChange={inp('invoice_number')} placeholder="تلقائي إذا فارغ"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">نوع الفاتورة</label>
                <select value={form.invoice_type} onChange={inp('invoice_type')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">العميل *</label>
                <select value={form.customer_id} onChange={inp('customer_id')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="">اختر عميلاً</option>
                  {customers.map(c => <option key={c.id} value={String(c.id)}>{c.customer_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الحالة</label>
                <select value={form.status} onChange={inp('status')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">المبلغ *</label>
                <input value={form.invoice_amount} onChange={inp('invoice_amount')} type="number" min="0" step="0.001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">العملة</label>
                <select value={form.currency} onChange={inp('currency')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="LYD">دينار ليبي (LYD)</option>
                  <option value="USD">دولار (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">تاريخ الإصدار</label>
                <input value={form.issue_date} onChange={inp('issue_date')} type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">تاريخ الاستحقاق</label>
                <input value={form.due_date} onChange={inp('due_date')} type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">المشروع</label>
                <select value={form.project_id} onChange={e => { inp('project_id')(e); setForm(f => ({ ...f, site_id: '' })); }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="">بدون مشروع</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الموقع</label>
                <select value={form.site_id} onChange={inp('site_id')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                  <option value="">بدون موقع</option>
                  {filteredSites.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">الوصف</label>
                <textarea value={form.description} onChange={inp('description')} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={inp('notes')} rows={1}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : (editing ? 'حفظ التعديلات' : 'إنشاء الفاتورة')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
