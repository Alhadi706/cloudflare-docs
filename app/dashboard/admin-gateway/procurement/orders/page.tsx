'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, ChevronLeft, X, CheckCircle, FolderOpen, MapPin,
  Building2, Trash2, Filter, Package
} from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';
import LocationPickerModal, { SelectedLocation } from '../../components/LocationPickerModal';
import { getUserAuthHeaders } from '@/store/useUserStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Project  { id: number; name: string; code: string; }
interface Site     { id: number; name: string; code: string; }
interface Supplier { id: number; supplier_name: string; supplier_code?: string; }
interface POItem   { item_name: string; quantity: number; unit: string; unit_price: number; }
interface PurchaseOrder {
  id: number;
  po_number: string;
  title: string;
  description?: string;
  supplier_id: number;
  supplier_name?: string;
  project_id?: number;
  site_id?: number;
  project_name?: string;
  site_name?: string;
  purchase_request_id?: number;
  linked_request_number?: string;
  total_amount: number;
  currency: string;
  status: string;
  issued_date?: string;
  expected_delivery_date?: string;
  items?: POItem[];
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'مسودة',          cls: 'text-slate-400 bg-slate-500/10' },
  issued:     { label: 'صادر',           cls: 'text-blue-400 bg-blue-500/10' },
  confirmed:  { label: 'مؤكد',           cls: 'text-indigo-400 bg-indigo-500/10' },
  delivered:  { label: 'تم التسليم',     cls: 'text-emerald-400 bg-emerald-500/10' },
  partial:    { label: 'تسليم جزئي',     cls: 'text-amber-400 bg-amber-500/10' },
  cancelled:  { label: 'ملغى',           cls: 'text-rose-400 bg-rose-500/10' },
  closed:     { label: 'مغلق',           cls: 'text-gray-400 bg-gray-500/10' },
};

const emptyForm = () => ({
  title: '', description: '', supplier_id: '',
  project_id: '' as string | number,
  project_name: '',
  site_id: '' as string | number,
  site_name: '',
  purchase_request_id: '',
  total_amount: '', currency: 'LYD', status: 'draft',
  issued_date: '', expected_delivery_date: '', notes: '',
  items: [] as POItem[],
});

export default function PurchaseOrdersPage() {
  const { activeProjectId } = useErpContextStore();
  const [orders, setOrders]         = useState<PurchaseOrder[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [filterSite,    setFilterSite]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterSiteList, setFilterSiteList] = useState<Site[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editing, setEditing]       = useState<PurchaseOrder | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── bootstrap dropdowns
  useEffect(() => {
    const hdr = { 'X-Tenant-ID': getTenantId() || '' };
    fetch('/api/v1/procurement/suppliers', { headers: hdr })
      .then(r => r.ok ? r.json() : { suppliers: [] }).then(d => setSuppliers(d.suppliers || []));
  }, []);

  // ── sites for filter
  useEffect(() => {
    if (!activeProjectId) { setFilterSiteList([]); return; }
    fetch(`/api/v1/procurement/projects/${activeProjectId}/sites`, { headers: getUserAuthHeaders() })
      .then(r => r.ok ? r.json() : []).then(d => setFilterSiteList(Array.isArray(d) ? d : []));
  }, [activeProjectId]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (activeProjectId) p.set('project_id', String(activeProjectId));
      if (filterSite)    p.set('site_id',    filterSite);
      if (filterStatus)  p.set('status',     filterStatus);
      const res = await fetch(`/api/v1/procurement/orders?${p}`, {
        headers: getUserAuthHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setOrders(d.orders || []);
        setTotal(d.total || 0);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeProjectId, filterSite, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm(), project_id: activeProjectId?.toString() || '' }); setError(null); setShowForm(true); };
  const openEdit   = (o: PurchaseOrder) => {
    setEditing(o);
    setForm({
      title: o.title, description: o.description || '',
      supplier_id: o.supplier_id.toString(),
      project_id: o.project_id ?? '',
      project_name: o.project_name || '',
      site_id: o.site_id ?? '',
      site_name: o.site_name || '',
      purchase_request_id: o.purchase_request_id?.toString() || '',
      total_amount: o.total_amount.toString(),
      currency: o.currency, status: o.status,
      issued_date: o.issued_date || '',
      expected_delivery_date: o.expected_delivery_date || '',
      notes: '', items: o.items || [],
    });
    setError(null); setShowForm(true);
  };

  const addItem    = () => setForm(p => ({ ...p, items: [...p.items, { item_name: '', quantity: 1, unit: 'piece', unit_price: 0 }] }));
  const removeItem = (idx: number) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof POItem, val: string | number) =>
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const calcTotal = () => form.items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  const handleSave = async () => {
    if (!form.title.trim())    { setError('عنوان أمر الشراء مطلوب'); return; }
    if (!form.supplier_id)     { setError('المورّد مطلوب'); return; }
    if (!form.project_id || !form.site_id) { setError('يجب تحديد الموقع من الخريطة قبل حفظ أمر الشراء'); return; }
    setSaving(true); setError(null);
    try {
      const url    = editing ? `/api/v1/procurement/orders/${editing.id}` : '/api/v1/procurement/orders';
      const method = editing ? 'PUT' : 'POST';
      const body   = {
        ...form,
        supplier_id:          Number(form.supplier_id),
        project_id:           form.project_id ? Number(form.project_id) : null,
        site_id:              form.site_id    ? Number(form.site_id)    : null,
        purchase_request_id:  form.purchase_request_id ? Number(form.purchase_request_id) : null,
        total_amount:         form.items.length ? calcTotal() : (form.total_amount ? Number(form.total_amount) : 0),
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowForm(false); fetchOrders(); }
      else { const d = await res.json(); setError(d.detail || 'فشل الحفظ'); }
    } catch { setError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  const openCount    = orders.filter(o => ['draft','issued'].includes(o.status)).length;
  const deliveredCnt = orders.filter(o => o.status === 'delivered').length;
  const totalAmt     = orders.reduce((a, o) => a + (Number(o.total_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/procurement" className="hover:text-slate-200">المشتريات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">أوامر الشراء</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Truck className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">أوامر الشراء</h1>
              <p className="text-slate-400 mt-1">إصدار وإدارة أوامر الشراء — {total} أمر</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5"/><span>أمر شراء جديد</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الأوامر',   value: total,       cls: 'text-slate-100' },
            { label: 'مفتوحة',           value: openCount,   cls: 'text-blue-400' },
            { label: 'مسلّمة',           value: deliveredCnt, cls: 'text-emerald-400' },
            { label: 'إجمالي المبالغ',   value: `${totalAmt.toLocaleString()} د.ل`, cls: 'text-violet-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-4 h-4 text-slate-500" />
          {!!activeProjectId && (
            <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none min-w-[160px]">
              <option value="">كل المواقع</option>
              {filterSiteList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  {['رقم الأمر','العنوان','المورّد','المشروع / الموقع','المبلغ الكلي','الحالة','تاريخ الإصدار'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">جارٍ التحميل...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">لا توجد أوامر شراء بعد</td></tr>
                ) : orders.map(o => {
                  const st = STATUS_MAP[o.status] || { label: o.status, cls: 'text-slate-400 bg-slate-500/10' };
                  return (
                    <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => openEdit(o)}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{o.po_number}</td>
                      <td className="px-4 py-3 text-slate-200 font-medium max-w-[180px] truncate">{o.title}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-slate-300">
                          <Building2 className="w-3 h-3 text-emerald-400"/>
                          {o.supplier_name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {o.project_name && <div className="flex items-center gap-1 text-xs text-blue-300"><FolderOpen className="w-3 h-3"/>{o.project_name}</div>}
                        {o.site_name    && <div className="flex items-center gap-1 text-xs text-purple-300"><MapPin className="w-3 h-3"/>{o.site_name}</div>}
                        {!o.project_name && <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-violet-300 font-medium">{Number(o.total_amount).toLocaleString()} {o.currency}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{o.issued_date || o.created_at?.slice(0,10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(loc: SelectedLocation) => {
          setForm(p => ({
            ...p,
            project_id: loc.project_id,
            project_name: loc.project_name,
            site_id: loc.site_id ?? '',
            site_name: loc.site_name ?? '',
          }));
          setShowLocationPicker(false);
        }}
        initialValue={form.project_id ? {
          project_id: Number(form.project_id),
          project_name: form.project_name,
          site_id: form.site_id ? Number(form.site_id) : undefined,
          site_name: form.site_name,
        } : undefined}
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-white font-bold text-lg">{editing ? 'تعديل أمر شراء' : 'إصدار أمر شراء جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

              {/* Supplier */}
              <div>
                <label className="text-gray-300 text-sm mb-1 block"><Building2 className="w-3 h-3 inline ml-1"/>المورّد <span className="text-red-400">*</span></label>
                <select value={form.supplier_id} onChange={e => setForm(p => ({...p, supplier_id: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-violet-500">
                  <option value="">— اختر المورّد —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} {s.supplier_code ? `(${s.supplier_code})` : ''}</option>)}
                </select>
              </div>

              {/* Location Picker */}
              <div className={`rounded-lg p-4 border ${form.site_id ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-red-900/20 border-red-700/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${form.site_id ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span className="text-sm font-medium text-gray-200">موقع أمر الشراء</span>
                    {!form.site_id && <span className="text-xs text-red-400">(إلزامي)</span>}
                  </div>
                  <button type="button" onClick={() => setShowLocationPicker(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.site_id ? 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300' : 'bg-violet-600/30 hover:bg-violet-600/50 text-violet-300'
                    }`}>
                    {form.site_id ? 'تغيير الموقع' : 'اختر من الخريطة'}
                  </button>
                </div>
                {form.site_id ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-blue-300">
                      <FolderOpen className="w-3 h-3" />
                      <span>{form.project_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      <MapPin className="w-3 h-3" />
                      <span>{form.site_name}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">افتح الخريطة لتحديد المشروع والموقع الجغرافي</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-gray-300 text-sm mb-1 block">عنوان أمر الشراء <span className="text-red-400">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-violet-500"/>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">تاريخ الإصدار</label>
                  <input type="date" value={form.issued_date} onChange={e => setForm(p => ({...p, issued_date: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">التسليم المتوقع</label>
                  <input type="date" value={form.expected_delivery_date} onChange={e => setForm(p => ({...p, expected_delivery_date: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-sm font-medium flex items-center gap-1"><Package className="w-3 h-3"/>بنود الأمر</label>
                  <button onClick={addItem} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                    <Plus className="w-3 h-3"/>إضافة بند
                  </button>
                </div>
                {form.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center">
                    <input placeholder="اسم الصنف" value={it.item_name} onChange={e => updateItem(idx,'item_name',e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <input type="number" placeholder="كمية" value={it.quantity} onChange={e => updateItem(idx,'quantity',Number(e.target.value))}
                      className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <input placeholder="وحدة" value={it.unit} onChange={e => updateItem(idx,'unit',e.target.value)}
                      className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <input type="number" placeholder="سعر الوحدة" value={it.unit_price || ''} onChange={e => updateItem(idx,'unit_price',Number(e.target.value))}
                      className="w-28 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <span className="text-xs text-violet-300 w-20 text-left">{(it.quantity * it.unit_price).toLocaleString()}</span>
                    <button onClick={() => removeItem(idx)} className="text-rose-400 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                {form.items.length > 0 && (
                  <div className="text-left text-violet-300 text-sm font-medium mt-1">
                    الإجمالي: {calcTotal().toLocaleString()} {form.currency}
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-1 block">الوصف</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none resize-none"/>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : <><CheckCircle className="w-4 h-4"/>{editing ? 'حفظ التعديلات' : 'إصدار الأمر'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
