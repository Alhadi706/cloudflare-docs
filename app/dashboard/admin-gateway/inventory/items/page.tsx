'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, ChevronLeft, X, CheckCircle, Pencil } from 'lucide-react';
import Link from 'next/link';
import ImportButton from '@/components/ImportButton';
import { apiClient } from '@/lib/productionApiClient';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Item {
  id: number; item_code: string; item_name: string;
  item_category?: string; unit: string;
  min_stock_level: number; max_stock_level?: number;
  default_cost?: number; status: string; notes?: string;
}

const UNITS = ['piece','kg','litre','meter','box','set','roll','bag','ton','gallon','other'];
const UNIT_AR: Record<string,string> = {
  piece:'قطعة', kg:'كيلوغرام', litre:'لتر', meter:'متر',
  box:'صندوق', set:'طقم', roll:'لفة', bag:'كيس',
  ton:'طن', gallon:'جالون', other:'أخرى',
};

const emptyForm = () => ({
  item_code:'', item_name:'', item_category:'', unit:'piece',
  min_stock_level:'0', max_stock_level:'', default_cost:'', notes:'', status:'active',
});

export default function InventoryItemsPage() {
  const [items, setItems]       = useState<Item[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Item|null>(null);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string|null>(null);

  const hdr = { 'X-Tenant-ID': getTenantId() || '' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: any = {};
      if (search)    p.search = search;
      if (filterCat) p.category = filterCat;
      const d = await apiClient.getInventoryItems(p);
      setItems(d.items||[]); 
      setTotal(d.total||0);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterCat]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(null); setShowForm(true); };
  const openEdit   = (it: Item) => {
    setEditing(it);
    setForm({
      item_code: it.item_code, item_name: it.item_name,
      item_category: it.item_category||'', unit: it.unit,
      min_stock_level: it.min_stock_level?.toString()||'0',
      max_stock_level: it.max_stock_level?.toString()||'',
      default_cost: it.default_cost?.toString()||'',
      notes: it.notes||'', status: it.status,
    });
    setError(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.item_code.trim() || !form.item_name.trim()) { setError('الرمز والاسم مطلوبان'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        min_stock_level: Number(form.min_stock_level)||0,
        max_stock_level: form.max_stock_level ? Number(form.max_stock_level) : null,
        default_cost:    form.default_cost    ? Number(form.default_cost)    : null,
      };

      if (editing) {
        await apiClient.updateInventoryItem(editing.id, payload);
      } else {
        await apiClient.createInventoryItem(payload);
      }
      setShowForm(false); 
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const cats = [...new Set(items.map(it => it.item_category).filter(Boolean))] as string[];
  const activeCount = items.filter(it => it.status==='active').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4"/>
          <Link href="/dashboard/admin-gateway/inventory" className="hover:text-slate-200">المخزون</Link>
          <ChevronLeft className="w-4 h-4"/>
          <span className="text-slate-200">الأصناف</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-sky-600/20 p-4 rounded-xl border border-sky-500/50">
              <Package className="w-8 h-8 text-sky-400"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">كتالوج الأصناف</h1>
              <p className="text-slate-400 mt-1">الأصناف والمواد والمعدات — {total} صنف</p>
            </div>
          </div>
          <div className="flex gap-3">
            <ImportButton moduleKey="inventory_items" onImportComplete={load}/>
            <button onClick={openCreate}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Plus className="w-4 h-4"/>صنف جديد
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الأصناف', value: total,       cls: 'text-slate-100' },
            { label: 'نشط',            value: activeCount,  cls: 'text-sky-400'   },
            { label: 'فئات',           value: cats.length,  cls: 'text-indigo-400'},
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرمز..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none w-64"/>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none">
            <option value="">كل الفئات</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['الرمز','الاسم','الفئة','الوحدة','الحد الأدنى','السعر الافتراضي','الحالة',''].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">جارٍ التحميل...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">لا توجد أصناف</td></tr>
              ) : items.map(it => (
                <tr key={it.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{it.item_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{it.item_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{it.item_category||'—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{UNIT_AR[it.unit]||it.unit}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{Number(it.min_stock_level).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sky-300 text-xs">
                    {it.default_cost ? `${Number(it.default_cost).toLocaleString()} د.ل` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${it.status==='active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-500/10'}`}>
                      {it.status==='active'?'نشط':'غير نشط'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(it)} className="text-slate-500 hover:text-sky-400 p-1 transition-colors">
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-white font-bold text-lg">{editing ? 'تعديل صنف' : 'صنف جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">رمز الصنف *</label>
                  <input value={form.item_code} onChange={e => setForm(p => ({...p, item_code: e.target.value}))}
                    disabled={!!editing}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-60"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">اسم الصنف *</label>
                  <input value={form.item_name} onChange={e => setForm(p => ({...p, item_name: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-sky-500"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الفئة</label>
                  <input value={form.item_category} onChange={e => setForm(p => ({...p, item_category: e.target.value}))}
                    placeholder="مثال: قطع غيار"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">وحدة القياس</label>
                  <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    {UNITS.map(u => <option key={u} value={u}>{UNIT_AR[u]||u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الحد الأدنى</label>
                  <input type="number" value={form.min_stock_level} onChange={e => setForm(p => ({...p, min_stock_level: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الحد الأقصى</label>
                  <input type="number" value={form.max_stock_level} onChange={e => setForm(p => ({...p, max_stock_level: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">السعر الافتراضي</label>
                  <input type="number" value={form.default_cost} onChange={e => setForm(p => ({...p, default_cost: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-1 block">ملاحظات</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none resize-none"/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : <><CheckCircle className="w-4 h-4"/>{editing ? 'حفظ' : 'إنشاء'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
