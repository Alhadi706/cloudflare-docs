'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Wrench, Plus, Search, X, Edit2, ChevronLeft } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/fleet';

type EStatus = 'active' | 'maintenance' | 'out_of_service' | 'reserved' | 'retired';
type EType   = 'pump' | 'generator' | 'compressor' | 'excavator' | 'drill' | 'welder' | 'crane' | 'mixer' | 'survey' | 'other';

interface Project   { id: number; name: string; }
interface Site      { id: number; name: string; project_id: number; }
interface Equipment {
  id: number; equipment_code: string; equipment_name: string;
  equipment_type: EType; serial_number?: string; make?: string; model?: string;
  status: EStatus; assigned_project_id?: number; assigned_project_name?: string;
  assigned_site_id?: number; assigned_site_name?: string; notes?: string; created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  pump: 'مضخة', generator: 'مولد', compressor: 'ضاغط', excavator: 'حفار',
  drill: 'مثقاب', welder: 'لحام', crane: 'رافعة', mixer: 'خلاطة', survey: 'مساحة', other: 'أخرى',
};
const STATUS_COLORS: Record<string, string> = {
  active:         'bg-green-500/20  text-green-300  border-green-500/30',
  maintenance:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  out_of_service: 'bg-red-500/20    text-red-300    border-red-500/30',
  reserved:       'bg-blue-500/20   text-blue-300   border-blue-500/30',
  retired:        'bg-slate-500/20  text-slate-400  border-slate-500/30',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'نشط', maintenance: 'صيانة', out_of_service: 'خارج الخدمة',
  reserved: 'محجوز', retired: 'مسحوب',
};

const emptyForm = {
  equipment_name: '', equipment_type: 'generator' as EType, equipment_code: '',
  serial_number: '', make: '', model: '',
  status: 'active' as EStatus,
  assigned_project_id: '' as string | number,
  assigned_site_id:    '' as string | number,
  notes: '',
};

export default function EquipmentPage() {
  const [rows, setRows]             = useState<Equipment[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [projects, setProjects]     = useState<Project[]>([]);
  const [sites, setSites]           = useState<Site[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Equipment | null>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const filteredSites = sites.filter(s =>
    !form.assigned_project_id || s.project_id === Number(form.assigned_project_id)
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (search)        p.set('search',         search);
      if (filterStatus)  p.set('status',          filterStatus);
      if (filterType)    p.set('equipment_type',  filterType);
      if (filterProject) p.set('project_id',      filterProject);
      const r = await fetch(`${BASE}/equipment?${p}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.equipment || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterType, filterProject]);

  const loadContext = useCallback(async () => {
    const [rp, rs] = await Promise.all([
      fetch(`${BASE}/projects`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
      fetch(`${BASE}/sites`,    { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
    ]);
    const dp = await rp.json(); const ds = await rs.json();
    setProjects(Array.isArray(dp) ? dp : (dp.projects || []));
    setSites(Array.isArray(ds) ? ds : (ds.sites || []));
  }, []);

  useEffect(() => { load(); },        [load]);
  useEffect(() => { loadContext(); }, [loadContext]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setShowForm(true); };
  const openEdit = (e: Equipment) => {
    setEditing(e);
    setForm({
      equipment_name: e.equipment_name, equipment_type: e.equipment_type,
      equipment_code: e.equipment_code, serial_number: e.serial_number || '',
      make: e.make || '', model: e.model || '',
      status: e.status,
      assigned_project_id: e.assigned_project_id || '',
      assigned_site_id:    e.assigned_site_id    || '',
      notes: e.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.equipment_name.trim()) { setError('اسم المعدة مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const url    = editing ? `${BASE}/equipment/${editing.id}` : `${BASE}/equipment`;
      const method = editing ? 'PUT' : 'POST';
      const body   = {
        ...form,
        assigned_project_id: form.assigned_project_id ? Number(form.assigned_project_id) : null,
        assigned_site_id:    form.assigned_site_id    ? Number(form.assigned_site_id)    : null,
      };
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || 'حدث خطأ'); return; }
      setShowForm(false); load();
    } catch { setError('خطأ في الاتصال'); } finally { setSaving(false); }
  };

  const F = (field: keyof typeof emptyForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'assigned_project_id') next.assigned_site_id = '';
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400" dir="ltr">
        <Link href="/dashboard/admin-gateway"          className="hover:text-slate-200 transition-colors">بوابة الإدارة</Link>
        <ChevronLeft className="w-4 h-4" />
        <Link href="/dashboard/admin-gateway/vehicles" className="hover:text-slate-200 transition-colors">المركبات والمعدات</Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-slate-200">المعدات</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">سجل المعدات والآلات</h1>
            <p className="text-slate-400 text-sm">{total} معدة مسجلة</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportButton module="equipment" onSuccess={load} />
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة معدة
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرمز أو الرقم التسلسلي..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">لا توجد معدات — أضف أول معدة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  {['الرمز', 'الاسم', 'النوع', 'الرقم التسلسلي', 'الصانع / الموديل', 'المشروع', 'الموقع', 'الحالة', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(eq => (
                  <tr key={eq.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-violet-300 font-mono text-xs">{eq.equipment_code}</td>
                    <td className="px-4 py-3 text-slate-100 font-medium">{eq.equipment_name}</td>
                    <td className="px-4 py-3 text-slate-300">{TYPE_LABELS[eq.equipment_type] || eq.equipment_type}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{eq.serial_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{[eq.make, eq.model].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{eq.assigned_project_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{eq.assigned_site_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[eq.status]}`}>
                        {STATUS_LABELS[eq.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(eq)} className="p-1.5 text-slate-400 hover:text-violet-400 transition-colors">
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
              <h2 className="text-lg font-bold text-slate-100">{editing ? 'تعديل معدة' : 'إضافة معدة جديدة'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm mb-1.5">اسم المعدة <span className="text-red-400">*</span></label>
                  <input value={form.equipment_name} onChange={e => F('equipment_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">نوع المعدة</label>
                  <select value={form.equipment_type} onChange={e => F('equipment_type', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">رمز المعدة <span className="text-slate-500 text-xs">(اختياري — يُنشأ تلقائياً)</span></label>
                  <input value={form.equipment_code} onChange={e => F('equipment_code', e.target.value)}
                    placeholder="EQP-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm font-mono" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الرقم التسلسلي</label>
                  <input value={form.serial_number} onChange={e => F('serial_number', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm font-mono" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الصانع</label>
                  <input value={form.make} onChange={e => F('make', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الموديل</label>
                  <input value={form.model} onChange={e => F('model', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الحالة</label>
                  <select value={form.status} onChange={e => F('status', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">المشروع</label>
                  <select value={form.assigned_project_id} onChange={e => F('assigned_project_id', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="">— بدون تعيين —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الموقع</label>
                  <select value={form.assigned_site_id} onChange={e => F('assigned_site_id', e.target.value)}
                    disabled={!form.assigned_project_id}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm disabled:opacity-50">
                    <option value="">— بدون تعيين —</option>
                    {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm mb-1.5">ملاحظات</label>
                  <textarea value={form.notes} onChange={e => F('notes', e.target.value)}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
                </div>

              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المعدة'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
