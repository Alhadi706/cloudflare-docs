'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Warehouse, Plus, ChevronLeft, X, CheckCircle, FolderOpen, MapPin, Pencil } from 'lucide-react';
import Link from 'next/link';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Project   { id: number; name: string; }
interface Site      { id: number; name: string; }
interface WH {
  id: number; warehouse_code: string; warehouse_name: string;
  warehouse_type: string; location_name?: string; status: string;
  project_id?: number; site_id?: number;
  project_name?: string; site_name?: string; notes?: string;
}

const TYPES = ['general','spare_parts','equipment','consumables','chemicals','other'];
const TYPE_AR: Record<string,string> = {
  general:'عام', spare_parts:'قطع غيار', equipment:'معدات',
  consumables:'مستهلكات', chemicals:'مواد كيماوية', other:'أخرى',
};

const emptyForm = () => ({
  warehouse_name:'', warehouse_code:'', warehouse_type:'general',
  location_name:'', project_id:'', site_id:'', notes:'', status:'active',
});

export default function WarehousesPage() {
  const [whs, setWhs]           = useState<WH[]>([]);
  const [total, setTotal]       = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites]       = useState<Site[]>([]);
  const [filterProj, setFilterProj] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterSiteList, setFilterSiteList] = useState<Site[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<WH | null>(null);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string|null>(null);

  const hdr = { 'X-Tenant-ID': getTenantId() || '' };

  useEffect(() => {
    fetch('/api/v1/inventory/projects', { headers: hdr })
      .then(r => r.ok ? r.json() : []).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!filterProj) { setFilterSiteList([]); return; }
    fetch(`/api/v1/inventory/projects/${filterProj}/sites`, { headers: hdr })
      .then(r => r.ok ? r.json() : []).then(d => setFilterSiteList(Array.isArray(d) ? d : []));
  }, [filterProj]);

  useEffect(() => {
    if (!form.project_id) { setSites([]); return; }
    fetch(`/api/v1/inventory/projects/${form.project_id}/sites`, { headers: hdr })
      .then(r => r.ok ? r.json() : []).then(d => setSites(Array.isArray(d) ? d : []));
  }, [form.project_id]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterProj) p.set('project_id', filterProj);
    if (filterSite) p.set('site_id', filterSite);
    const res = await fetch(`/api/v1/inventory/warehouses?${p}`, { headers: hdr });
    if (res.ok) { const d = await res.json(); setWhs(d.warehouses||[]); setTotal(d.total||0); }
    setLoading(false);
  }, [filterProj, filterSite]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(null); setShowForm(true); };
  const openEdit   = (w: WH) => {
    setEditing(w);
    setForm({
      warehouse_name: w.warehouse_name, warehouse_code: w.warehouse_code,
      warehouse_type: w.warehouse_type, location_name: w.location_name||'',
      project_id: w.project_id?.toString()||'', site_id: w.site_id?.toString()||'',
      notes: w.notes||'', status: w.status,
    });
    setError(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.warehouse_name.trim()) { setError('اسم المستودع مطلوب'); return; }
    setSaving(true); setError(null);
    const url    = editing ? `/api/v1/inventory/warehouses/${editing.id}` : '/api/v1/inventory/warehouses';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
      body: JSON.stringify({
        ...form,
        project_id: form.project_id ? Number(form.project_id) : null,
        site_id:    form.site_id    ? Number(form.site_id)    : null,
      }),
    });
    if (res.ok) { setShowForm(false); load(); }
    else { const d = await res.json(); setError(d.detail||'فشل الحفظ'); }
    setSaving(false);
  };

  const activeCount  = whs.filter(w => w.status === 'active').length;
  const projectCount = new Set(whs.map(w => w.project_id).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4"/>
          <Link href="/dashboard/admin-gateway/inventory" className="hover:text-slate-200">المخزون</Link>
          <ChevronLeft className="w-4 h-4"/>
          <span className="text-slate-200">المستودعات</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-teal-600/20 p-4 rounded-xl border border-teal-500/50">
              <Warehouse className="w-8 h-8 text-teal-400"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المستودعات</h1>
              <p className="text-slate-400 mt-1">إدارة مستودعات المشاريع والمواقع — {total} مستودع</p>
            </div>
          </div>
          <div className="flex gap-3">
            <ImportButton moduleKey="warehouses" projectId={filterProj ? Number(filterProj) : undefined} siteId={filterSite ? Number(filterSite) : undefined} onImportComplete={load}/>
            <button onClick={openCreate}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Plus className="w-4 h-4"/>مستودع جديد
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي', value: total,        cls: 'text-slate-100' },
            { label: 'نشط',    value: activeCount,  cls: 'text-teal-400'  },
            { label: 'مشاريع', value: projectCount, cls: 'text-blue-400'  },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <select value={filterProj} onChange={e => { setFilterProj(e.target.value); setFilterSite(''); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none">
            <option value="">كل المشاريع</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {filterProj && (
            <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none">
              <option value="">كل المواقع</option>
              {filterSiteList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['الرمز','الاسم','النوع','الموقع','المشروع / الموقع','الحالة',''].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">جارٍ التحميل...</td></tr>
              ) : whs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">لا توجد مستودعات</td></tr>
              ) : whs.map(w => (
                <tr key={w.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{w.warehouse_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{w.warehouse_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{TYPE_AR[w.warehouse_type] || w.warehouse_type}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{w.location_name||'—'}</td>
                  <td className="px-4 py-3">
                    {w.project_name && <div className="flex items-center gap-1 text-xs text-blue-300"><FolderOpen className="w-3 h-3"/>{w.project_name}</div>}
                    {w.site_name    && <div className="flex items-center gap-1 text-xs text-purple-300"><MapPin className="w-3 h-3"/>{w.site_name}</div>}
                    {!w.project_name && <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${w.status==='active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-500/10'}`}>
                      {w.status==='active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(w)} className="text-slate-500 hover:text-teal-400 p-1 transition-colors">
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
              <h2 className="text-white font-bold text-lg">{editing ? 'تعديل مستودع' : 'مستودع جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">اسم المستودع *</label>
                  <input value={form.warehouse_name} onChange={e => setForm(p => ({...p, warehouse_name: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-teal-500"/>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الرمز</label>
                  <input value={form.warehouse_code} onChange={e => setForm(p => ({...p, warehouse_code: e.target.value}))}
                    placeholder="تلقائي إن ترك فارغاً"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">النوع</label>
                  <select value={form.warehouse_type} onChange={e => setForm(p => ({...p, warehouse_type: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_AR[t]||t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none">
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-1 block flex items-center gap-1"><FolderOpen className="w-3 h-3"/>المشروع</label>
                  <select value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value, site_id: ''}))}
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
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-1 block">اسم الموقع / العنوان</label>
                <input value={form.location_name} onChange={e => setForm(p => ({...p, location_name: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none"/>
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
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جارٍ الحفظ...' : <><CheckCircle className="w-4 h-4"/>{editing ? 'حفظ' : 'إنشاء'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
