'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingDown, Plus, ChevronLeft, X, CheckCircle, FolderOpen, MapPin, Trash2, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Project   { id: number; name: string; }
interface Site      { id: number; name: string; }
interface WH        { id: number; warehouse_name: string; warehouse_code: string; }
interface InvItem   { id: number; item_name: string; item_code: string; unit: string; default_cost?: number; }
interface IssueItem { inventory_item_id: string; quantity: number; unit_cost: number; }
interface Issue {
  id: number; issue_number: string; issue_date: string;
  warehouse_name?: string; project_name?: string; site_name?: string;
  issued_to?: string; work_order_id?: number; asset_id?: number;
  item_count: number; total_value: number; created_at: string;
}

const emptyForm = () => ({
  warehouse_id:'', project_id:'', site_id:'',
  issued_to:'', work_order_id:'', asset_id:'',
  issue_number:'', issue_date: new Date().toISOString().slice(0,10),
  notes:'', items: [] as IssueItem[],
});

export default function StockIssuesPage() {
  const { activeProjectId } = useErpContextStore();
  const [issues, setIssues]     = useState<Issue[]>([]);
  const [total, setTotal]       = useState(0);
  const [whs, setWhs]           = useState<WH[]>([]);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [filterWh, setFilterWh] = useState('');
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm());
  const [formSites, setFormSites] = useState<Site[]>([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string|null>(null);

  const hdr = { 'X-Tenant-ID': getTenantId() || '' };

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses', { headers: hdr }).then(r => r.ok ? r.json() : {warehouses:[]}).then(d => setWhs(d.warehouses||[]));
    fetch('/api/v1/inventory/items', { headers: hdr }).then(r => r.ok ? r.json() : {items:[]}).then(d => setInvItems(d.items||[]));
  }, []);

  useEffect(() => {
    if (!form.project_id) { setFormSites([]); return; }
    fetch(`/api/v1/inventory/projects/${form.project_id}/sites`, { headers: hdr })
      .then(r => r.ok ? r.json() : []).then(d => setFormSites(Array.isArray(d) ? d : []));
  }, [form.project_id]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit:'100' });
    if (filterWh)        p.set('warehouse_id', filterWh);
    if (activeProjectId) p.set('project_id', String(activeProjectId));
    const res = await fetch(`/api/v1/inventory/issues?${p}`, { headers: hdr });
    if (res.ok) { const d = await res.json(); setIssues(d.issues||[]); setTotal(d.total||0); }
    setLoading(false);
  }, [filterWh, activeProjectId]);

  useEffect(() => { load(); }, [load]);

  const addItem    = () => setForm(p => ({...p, items:[...p.items,{inventory_item_id:'',quantity:1,unit_cost:0}]}));
  const removeItem = (i:number) => setForm(p => ({...p, items:p.items.filter((_,idx)=>idx!==i)}));
  const updItem    = (i:number, f:keyof IssueItem, v:string|number) =>
    setForm(p => ({...p, items:p.items.map((it,idx)=>idx===i?{...it,[f]:v}:it)}));

  // auto-fill unit cost from item catalog
  const selectItem = (idx:number, itemId:string) => {
    const found = invItems.find(it => it.id.toString() === itemId);
    setForm(p => ({...p, items:p.items.map((it,i) => i===idx ? {
      ...it, inventory_item_id: itemId,
      unit_cost: found?.default_cost || it.unit_cost,
    } : it)}));
  };

  const calcTotal = () => form.items.reduce((s,it) => s + it.quantity * it.unit_cost, 0);

  const save = async () => {
    if (!form.warehouse_id) { setError('المستودع مطلوب'); return; }
    if (form.items.length === 0) { setError('أضف صنفاً واحداً على الأقل'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/v1/inventory/issues', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Tenant-ID': getTenantId() || '' },
      body: JSON.stringify({
        ...form,
        warehouse_id:    Number(form.warehouse_id),
        project_id:      form.project_id ? Number(form.project_id) : null,
        site_id:         form.site_id    ? Number(form.site_id)    : null,
        work_order_id:   form.work_order_id ? Number(form.work_order_id) : null,
        asset_id:        form.asset_id   ? Number(form.asset_id)   : null,
        items: form.items.map(it => ({...it, inventory_item_id: Number(it.inventory_item_id)})),
      }),
    });
    if (res.ok) { setShowForm(false); setForm(emptyForm()); load(); }
    else { const d = await res.json(); setError(d.detail||'فشل الحفظ'); }
    setSaving(false);
  };

  const totalValue = issues.reduce((s,r) => s+Number(r.total_value||0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4"/>
          <Link href="/dashboard/admin-gateway/inventory" className="hover:text-slate-200">المخزون</Link>
          <ChevronLeft className="w-4 h-4"/>
          <span className="text-slate-200">سندات الصرف</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-rose-600/20 p-4 rounded-xl border border-rose-500/50">
              <TrendingDown className="w-8 h-8 text-rose-400"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">سندات الصرف</h1>
              <p className="text-slate-400 mt-1">صرف المواد للأعمال والصيانة — {total} سند</p>
            </div>
          </div>
          <button onClick={() => { setForm(emptyForm()); setError(null); setShowForm(true); }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
            <Plus className="w-4 h-4"/>سند صرف جديد
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'إجمالي الصرف',  value:total,                               cls:'text-slate-100' },
            { label:'قيمة الصرف',    value:`${totalValue.toLocaleString()} د.ل`, cls:'text-rose-400'  },
            { label:'أوامر عمل مرتبطة', value:issues.filter(i=>i.work_order_id).length, cls:'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <select value={filterWh} onChange={e => setFilterWh(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none">
            <option value="">كل المستودعات</option>
            {whs.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
          </select>
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['رقم السند','التاريخ','المستودع','المشروع / الموقع','الجهة','الأصناف','القيمة'].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">جارٍ التحميل...</td></tr>
              ) : issues.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">لا توجد سندات صرف</td></tr>
              ) : issues.map(r => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.issue_number}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.issue_date}</td>
                  <td className="px-4 py-3 text-slate-200 text-sm">{r.warehouse_name||'—'}</td>
                  <td className="px-4 py-3">
                    {r.project_name && <div className="flex items-center gap-1 text-xs text-blue-300"><FolderOpen className="w-3 h-3"/>{r.project_name}</div>}
                    {r.site_name    && <div className="flex items-center gap-1 text-xs text-purple-300"><MapPin className="w-3 h-3"/>{r.site_name}</div>}
                    {!r.project_name && <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.issued_to||'—'}
                    {r.work_order_id && <div className="flex items-center gap-1 text-xs text-amber-300 mt-0.5"><Wrench className="w-3 h-3"/>أمر #{r.work_order_id}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.item_count} صنف</td>
                  <td className="px-4 py-3 text-rose-300 font-medium text-xs">{Number(r.total_value).toLocaleString()} د.ل</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-white font-bold text-lg">سند صرف جديد</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

              <div>
                <label className="text-gray-300 text-sm mb-1 block">المستودع *</label>
                <select value={form.warehouse_id} onChange={e => setForm(p => ({...p, warehouse_id: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-rose-500">
                  <option value="">— اختر المستودع —</option>
                  {whs.map(w => <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block flex items-center gap-1"><FolderOpen className="w-3 h-3"/>المشروع</label>
                  <select value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value, site_id:''}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    <option value="">— اختر —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3"/>الموقع</label>
                  <select value={form.site_id} onChange={e => setForm(p => ({...p, site_id: e.target.value}))}
                    disabled={!form.project_id}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none disabled:opacity-50">
                    <option value="">— اختر —</option>
                    {formSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الجهة المستلِمة</label>
                  <input value={form.issued_to} onChange={e => setForm(p => ({...p, issued_to: e.target.value}))}
                    placeholder="فريق / شخص / قسم"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block flex items-center gap-1"><Wrench className="w-3 h-3"/>أمر العمل</label>
                  <input type="number" value={form.work_order_id} onChange={e => setForm(p => ({...p, work_order_id: e.target.value}))}
                    placeholder="رقم أمر العمل"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">تاريخ الصرف</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(p => ({...p, issue_date: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-sm font-medium flex items-center gap-1"><Package className="w-3 h-3"/>الأصناف المصروفة *</label>
                  <button onClick={addItem} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">
                    <Plus className="w-3 h-3"/>إضافة صنف
                  </button>
                </div>
                {form.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center">
                    <select value={it.inventory_item_id} onChange={e => selectItem(idx, e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-gray-200 text-xs focus:outline-none">
                      <option value="">— اختر صنف —</option>
                      {invItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>)}
                    </select>
                    <input type="number" placeholder="كمية" value={it.quantity} onChange={e => updItem(idx,'quantity',Number(e.target.value))}
                      className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <input type="number" placeholder="سعر الوحدة" value={it.unit_cost||''} onChange={e => updItem(idx,'unit_cost',Number(e.target.value))}
                      className="w-28 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-gray-200 text-xs focus:outline-none"/>
                    <span className="text-xs text-rose-300 w-20 text-left">{(it.quantity*it.unit_cost).toLocaleString()}</span>
                    <button onClick={() => removeItem(idx)} className="text-rose-400 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                {form.items.length > 0 && (
                  <div className="text-left text-rose-300 text-sm font-medium mt-1">
                    الإجمالي: {calcTotal().toLocaleString()} د.ل
                  </div>
                )}
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
                className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : <><CheckCircle className="w-4 h-4"/>تسجيل الصرف</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
