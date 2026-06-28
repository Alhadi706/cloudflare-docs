'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import ImportButton from '@/components/ImportButton';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
const API    = '/api/v1/accounting';
const H      = { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' };

interface CostCenter {
  id: number; cost_center_code: string; cost_center_name: string;
  project_id: number | null; project_name: string | null;
  site_id: number | null; site_name: string | null;
  description: string | null; is_active: boolean;
}
interface Project { id: number; name: string; code: string; }
interface Site    { id: number; name: string; }

const blank = () => ({ cost_center_code: '', cost_center_name: '', project_id: '', site_id: '', description: '', is_active: true });

export default function CostCentersPage() {
  const { activeProjectId } = useErpContextStore();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [sites, setSites]             = useState<Site[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<CostCenter | null>(null);
  const [form, setForm]               = useState(blank());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeProjectId) params.set('project_id', String(activeProjectId));
      const [cc] = await Promise.all([
        fetch(`${API}/cost-centers?${params}`, { headers: H }).then(r => r.json()),
      ]);
      setCostCenters(cc.cost_centers || []);
    } finally { setLoading(false); }
  }, [activeProjectId]);

  useEffect(() => { load(); }, [load]);

  async function loadSites(pid: string) {
    if (!pid) { setSites([]); return; }
    const r = await fetch(`${API}/projects/${pid}/sites`, { headers: H });
    setSites(await r.json());
  }

  function openCreate() { setEditing(null); setForm(blank()); setSites([]); setError(''); setShowModal(true); }
  function openEdit(c: CostCenter) {
    setEditing(c);
    setForm({ cost_center_code: c.cost_center_code, cost_center_name: c.cost_center_name,
              project_id: String(c.project_id ?? ''), site_id: String(c.site_id ?? ''),
              description: c.description ?? '', is_active: c.is_active });
    if (c.project_id) loadSites(String(c.project_id));
    setError(''); setShowModal(true);
  }

  async function save() {
    if (!form.cost_center_name.trim()) { setError('اسم مركز التكلفة مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const url  = editing ? `${API}/cost-centers/${editing.id}` : `${API}/cost-centers`;
      const meth = editing ? 'PUT' : 'POST';
      const r    = await fetch(url, { method: meth, headers: H, body: JSON.stringify(form) });
      const d    = await r.json();
      if (!r.ok) { setError(d.detail || 'خطأ في الحفظ'); return; }
      setShowModal(false); load();
    } finally { setSaving(false); }
  }

  const activeCount = costCenters.filter(c => c.is_active).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-teal-900/50 p-3 rounded-xl"><Building2 className="w-7 h-7 text-teal-400" /></div>
          <div>
            <nav className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
              <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة الإدارة</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/dashboard/admin-gateway/accounting" className="hover:text-slate-300">المحاسبة</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-300">مراكز التكلفة</span>
            </nav>
            <h1 className="text-xl font-bold text-slate-100">مراكز التكلفة</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton moduleKey="cost_centers" onSuccess={load} />
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة مركز
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المراكز', value: costCenters.length, color: 'text-slate-100' },
          { label: 'نشطة', value: activeCount, color: 'text-teal-400' },
          { label: 'مرتبطة بمشاريع', value: costCenters.filter(c => c.project_id).length, color: 'text-sky-400' },
          { label: 'مرتبطة بمواقع', value: costCenters.filter(c => c.site_id).length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : costCenters.length === 0 ? (
        <div className="text-center text-slate-500 py-16">لا توجد مراكز تكلفة — ابدأ بالإضافة</div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="text-xs text-slate-500 bg-slate-800/50 border-b border-slate-800">
                {['الرمز', 'الاسم', 'المشروع', 'الموقع', 'الوصف', 'الحالة', ''].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costCenters.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">{c.cost_center_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{c.cost_center_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.project_name || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.site_name || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">{c.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      {c.is_active ? 'نشط' : 'معطّل'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-teal-400 p-1 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">{editing ? 'تعديل مركز التكلفة' : 'إضافة مركز تكلفة'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-rose-900/30 border border-rose-700/50 text-rose-300 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">رمز المركز</label>
                  <input value={form.cost_center_code} onChange={e => setForm(f => ({...f, cost_center_code: e.target.value}))}
                    disabled={!!editing} placeholder="تلقائي إن تُرك فارغاً"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم المركز *</label>
                  <input value={form.cost_center_name} onChange={e => setForm(f => ({...f, cost_center_name: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">المشروع</label>
                  <select value={form.project_id} onChange={e => { setForm(f => ({...f, project_id: e.target.value, site_id: ''})); loadSites(e.target.value); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">— اختياري —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الموقع</label>
                  <select value={form.site_id} onChange={e => setForm(f => ({...f, site_id: e.target.value}))}
                    disabled={!form.project_id}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50">
                    <option value="">— اختياري —</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">وصف</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cc_active" checked={!!form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} className="rounded" />
                <label htmlFor="cc_active" className="text-sm text-slate-300">مركز نشط</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
