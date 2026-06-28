'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Fuel, Plus, Search, X, Edit2, ChevronLeft } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/fleet';

type FuelType   = 'diesel' | 'petrol' | 'lpg' | 'other';
type AssetMode  = 'vehicle' | 'equipment';

interface Project  { id: number; name: string; }
interface Site     { id: number; name: string; project_id: number; }
interface Vehicle  { id: number; vehicle_code: string; vehicle_name: string; }
interface Equipment { id: number; equipment_code: string; equipment_name: string; }

interface FuelRecord {
  id: number; fuel_date: string; fuel_type: FuelType;
  vehicle_id?: number; vehicle_name?: string;
  equipment_id?: number; equipment_name?: string;
  project_id?: number; project_name?: string;
  site_id?: number; site_name?: string;
  quantity: number; unit_cost: number; total_cost: number;
  odometer_km?: number; notes?: string; created_at: string;
}

const FUEL_LABELS: Record<string, string> = {
  diesel: 'ديزل', petrol: 'بنزين', lpg: 'غاز', other: 'أخرى',
};
const FUEL_COLORS: Record<string, string> = {
  diesel: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  petrol: 'bg-blue-500/20  text-blue-300  border-blue-500/30',
  lpg:    'bg-cyan-500/20  text-cyan-300  border-cyan-500/30',
  other:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const emptyForm = {
  asset_mode:   'vehicle' as AssetMode,
  vehicle_id:   '' as string | number,
  equipment_id: '' as string | number,
  fuel_date:    new Date().toISOString().slice(0, 10),
  fuel_type:    'diesel' as FuelType,
  quantity:     '' as string | number,
  unit_cost:    '' as string | number,
  odometer_km:  '' as string | number,
  project_id:   '' as string | number,
  site_id:      '' as string | number,
  notes: '',
};

export default function FuelPage() {
  const [rows, setRows]         = useState<FuelRecord[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterFuel, setFilterFuel]       = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [projects, setProjects]   = useState<Project[]>([]);
  const [sites, setSites]         = useState<Site[]>([]);
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<FuelRecord | null>(null);
  const [form, setForm]           = useState({ ...emptyForm });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const filteredSites = sites.filter(s =>
    !form.project_id || s.project_id === Number(form.project_id)
  );

  // Computed preview
  const previewTotal = (Number(form.quantity) || 0) * (Number(form.unit_cost) || 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (search)        p.set('search',     search);
      if (filterFuel)    p.set('fuel_type',  filterFuel);
      if (filterProject) p.set('project_id', filterProject);
      const r = await fetch(`${BASE}/fuel?${p}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.fuel_records || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterFuel, filterProject]);

  const loadContext = useCallback(async () => {
    const [rp, rs, rv, re] = await Promise.all([
      fetch(`${BASE}/projects`,        { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
      fetch(`${BASE}/sites`,           { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
      fetch(`${BASE}/vehicles?limit=500`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
      fetch(`${BASE}/equipment?limit=500`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
    ]);
    const dp = await rp.json(); const ds = await rs.json();
    const dv = await rv.json(); const de = await re.json();
    setProjects(Array.isArray(dp) ? dp : (dp.projects || []));
    setSites(Array.isArray(ds) ? ds : (ds.sites || []));
    setVehicles(dv.vehicles   || []);
    setEquipment(de.equipment || []);
  }, []);

  useEffect(() => { load(); },        [load]);
  useEffect(() => { loadContext(); }, [loadContext]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, fuel_date: new Date().toISOString().slice(0, 10) });
    setError(''); setShowForm(true);
  };
  const openEdit = (rec: FuelRecord) => {
    setEditing(rec);
    setForm({
      asset_mode:  rec.vehicle_id ? 'vehicle' : 'equipment',
      vehicle_id:  rec.vehicle_id   || '',
      equipment_id: rec.equipment_id || '',
      fuel_date:   rec.fuel_date.slice(0, 10),
      fuel_type:   rec.fuel_type,
      quantity:    rec.quantity,
      unit_cost:   rec.unit_cost,
      odometer_km: rec.odometer_km || '',
      project_id:  rec.project_id  || '',
      site_id:     rec.site_id     || '',
      notes:       rec.notes       || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.fuel_date)              { setError('تاريخ التعبئة مطلوب');    return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('الكمية مطلوبة وأكبر من صفر'); return; }
    if (form.unit_cost === '' || Number(form.unit_cost) < 0) { setError('تكلفة الوحدة مطلوبة');  return; }
    if (form.asset_mode === 'vehicle' && !form.vehicle_id)    { setError('يرجى اختيار مركبة');   return; }
    if (form.asset_mode === 'equipment' && !form.equipment_id) { setError('يرجى اختيار معدة');   return; }
    setSaving(true); setError('');
    try {
      const url    = editing ? `${BASE}/fuel/${editing.id}` : `${BASE}/fuel`;
      const method = editing ? 'PUT' : 'POST';
      const body   = {
        fuel_date:    form.fuel_date,
        fuel_type:    form.fuel_type,
        quantity:     Number(form.quantity),
        unit_cost:    Number(form.unit_cost),
        vehicle_id:   form.asset_mode === 'vehicle'   ? Number(form.vehicle_id)   : null,
        equipment_id: form.asset_mode === 'equipment' ? Number(form.equipment_id) : null,
        odometer_km:  form.odometer_km ? Number(form.odometer_km) : null,
        project_id:   form.project_id  ? Number(form.project_id)  : null,
        site_id:      form.site_id     ? Number(form.site_id)      : null,
        notes:        form.notes || null,
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
      if (field === 'project_id') next.site_id = '';
      if (field === 'asset_mode') { next.vehicle_id = ''; next.equipment_id = ''; }
      return next;
    });
  };

  const fmt = (n: number) => n.toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400" dir="ltr">
        <Link href="/dashboard/admin-gateway"          className="hover:text-slate-200 transition-colors">بوابة الإدارة</Link>
        <ChevronLeft className="w-4 h-4" />
        <Link href="/dashboard/admin-gateway/vehicles" className="hover:text-slate-200 transition-colors">المركبات والمعدات</Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-slate-200">سجلات الوقود</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Fuel className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">سجلات الوقود</h1>
            <p className="text-slate-400 text-sm">{total} سجل تعبئة</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> تسجيل تعبئة
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterFuel} onChange={e => setFilterFuel(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل أنواع الوقود</option>
          {Object.entries(FUEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          <div className="text-center py-12 text-slate-500">لا توجد سجلات — سجّل أول تعبئة وقود</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  {['التاريخ', 'المركبة / المعدة', 'نوع الوقود', 'الكمية (لتر)', 'تكلفة الوحدة', 'الإجمالي', 'المشروع', 'الموقع', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{rec.fuel_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-100">
                      {rec.vehicle_name || rec.equipment_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${FUEL_COLORS[rec.fuel_type]}`}>
                        {FUEL_LABELS[rec.fuel_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{Number(rec.quantity).toFixed(3)}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{Number(rec.unit_cost).toFixed(3)}</td>
                    <td className="px-4 py-3 text-amber-300 font-bold font-mono text-xs">{fmt(Number(rec.total_cost))}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{rec.project_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{rec.site_name    || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(rec)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors">
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
              <h2 className="text-lg font-bold text-slate-100">{editing ? 'تعديل سجل الوقود' : 'تسجيل تعبئة وقود'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Asset toggle */}
                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm mb-1.5">نوع الأصل <span className="text-red-400">*</span></label>
                  <div className="flex gap-2">
                    {(['vehicle', 'equipment'] as AssetMode[]).map(m => (
                      <button key={m} type="button"
                        onClick={() => F('asset_mode', m)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.asset_mode === m
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}>
                        {m === 'vehicle' ? '🚗 مركبة' : '🔧 معدة'}
                      </button>
                    ))}
                  </div>
                </div>

                {form.asset_mode === 'vehicle' ? (
                  <div className="md:col-span-2">
                    <label className="block text-slate-300 text-sm mb-1.5">المركبة <span className="text-red-400">*</span></label>
                    <select value={form.vehicle_id} onChange={e => F('vehicle_id', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                      <option value="">— اختر مركبة —</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicle_name} ({v.vehicle_code})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-slate-300 text-sm mb-1.5">المعدة <span className="text-red-400">*</span></label>
                    <select value={form.equipment_id} onChange={e => F('equipment_id', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                      <option value="">— اختر معدة —</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.equipment_name} ({eq.equipment_code})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">تاريخ التعبئة <span className="text-red-400">*</span></label>
                  <input type="date" value={form.fuel_date} onChange={e => F('fuel_date', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">نوع الوقود</label>
                  <select value={form.fuel_type} onChange={e => F('fuel_type', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(FUEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الكمية (لتر) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.quantity} onChange={e => F('quantity', e.target.value)}
                    min="0.001" step="0.001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">تكلفة الوحدة (د.ل) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.unit_cost} onChange={e => F('unit_cost', e.target.value)}
                    min="0" step="0.001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                {/* Preview */}
                {previewTotal > 0 && (
                  <div className="md:col-span-2 bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
                    الإجمالي المتوقع: <span className="font-bold font-mono">{fmt(previewTotal)}</span> د.ل
                    <span className="text-amber-500/70 text-xs mr-2">(يُحسب تلقائياً)</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">قراءة العداد (كم)</label>
                  <input type="number" value={form.odometer_km} onChange={e => F('odometer_km', e.target.value)}
                    min="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">المشروع <span className="text-slate-500 text-xs">(اختياري — يُورث من الأصل)</span></label>
                  <select value={form.project_id} onChange={e => F('project_id', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="">— يُورث تلقائياً —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">الموقع</label>
                  <select value={form.site_id} onChange={e => F('site_id', e.target.value)}
                    disabled={!form.project_id}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm disabled:opacity-50">
                    <option value="">— بدون تحديد —</option>
                    {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm mb-1.5">ملاحظات</label>
                  <textarea value={form.notes} onChange={e => F('notes', e.target.value)}
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
                </div>

              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'تسجيل التعبئة'}
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
