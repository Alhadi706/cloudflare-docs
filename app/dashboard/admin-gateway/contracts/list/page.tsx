'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileSignature, Plus, Search, X, Edit2, CheckCircle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE = '/api/v1/contracts';

type ContractStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
type ContractType = 'lump_sum' | 'unit_rate' | 'cost_plus' | 'time_material' | 'framework';

interface Project { id: number; project_name: string; }
interface Site { id: number; site_name: string; }
interface Contractor { id: number; contractor_code: string; contractor_name: string; status: string; }
interface Contract {
  id: number; contract_number: string; contract_title: string;
  contractor_id: number; contractor_name?: string;
  project_id: number; project_name?: string;
  site_id?: number; site_name?: string;
  contract_type: ContractType; contract_value: number; currency: string;
  start_date?: string; end_date?: string; status: ContractStatus;
  description?: string; notes?: string; created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  lump_sum: 'مبلغ مقطوع', unit_rate: 'سعر وحدة', cost_plus: 'تكلفة + ربح',
  time_material: 'وقت ومواد', framework: 'عقد إطاري',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  on_hold: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة', active: 'نشط', on_hold: 'موقوف', completed: 'منتهي', cancelled: 'ملغى',
};

const emptyForm = {
  contract_title: '', contractor_id: '', project_id: '', site_id: '',
  contract_type: 'lump_sum' as ContractType, contract_value: '', currency: 'LYD',
  start_date: '', end_date: '', status: 'draft' as ContractStatus, description: '', notes: '',
};

export default function ContractsListPage() {
  const { activeProjectId } = useErpContextStore();
  const [rows, setRows] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterContractor, setFilterContractor] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDropdowns = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`${BASE}/projects`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
      fetch(`${BASE}/contractors?limit=500`, { headers: { 'X-Tenant-ID': getTenantId() || '' } }),
    ]);
    const pd = await pRes.json(); setProjects(pd.projects || []);
    const cd = await cRes.json(); setContractors(cd.contractors || []);
  }, []);

  const loadSites = useCallback(async (projectId: string) => {
    if (!projectId) { setSites([]); return; }
    const r = await fetch(`${BASE}/projects/${projectId}/sites`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
    const d = await r.json(); setSites(d.sites || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (activeProjectId) params.set('project_id', String(activeProjectId));
      if (filterContractor) params.set('contractor_id', filterContractor);
      const r = await fetch(`${BASE}/list?${params}`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const d = await r.json();
      setRows(d.contracts || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  }, [search, filterStatus, activeProjectId, filterContractor]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { loadSites(form.project_id); }, [form.project_id, loadSites]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, project_id: activeProjectId ? String(activeProjectId) : '' }); setError(''); setShowForm(true); };
  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({
      contract_title: c.contract_title, contractor_id: String(c.contractor_id),
      project_id: String(c.project_id), site_id: c.site_id ? String(c.site_id) : '',
      contract_type: c.contract_type, contract_value: String(c.contract_value),
      currency: c.currency, start_date: c.start_date || '', end_date: c.end_date || '',
      status: c.status, description: c.description || '', notes: c.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async () => {
    if (!form.contract_title.trim()) { setError('عنوان العقد مطلوب'); return; }
    if (!form.contractor_id) { setError('المقاول مطلوب'); return; }
    if (!form.project_id) { setError('المشروع مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        contractor_id: parseInt(form.contractor_id),
        project_id: parseInt(form.project_id),
        site_id: form.site_id ? parseInt(form.site_id) : null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const url = editing ? `${BASE}/list/${editing.id}` : `${BASE}/list`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || 'حدث خطأ'); return; }
      setShowForm(false); load();
    } catch { setError('خطأ في الاتصال'); } finally { setSaving(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('ar-LY', { minimumFractionDigits: 3 }).format(v);

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <FileSignature className="w-8 h-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">قائمة العقود</h1>
            <p className="text-slate-400 text-sm">{total} عقد مسجل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportButton module="contracts" onSuccess={load} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة عقد
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم العقد أو العنوان..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-slate-100 placeholder-slate-500 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
          <option value="">كل المقاولين</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.contractor_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">لا توجد عقود — أضف أول عقد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  {['رقم العقد', 'العنوان', 'المقاول', 'المشروع', 'الموقع', 'النوع', 'القيمة', 'تبدأ', 'تنتهي', 'الحالة', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-green-300 font-mono text-xs whitespace-nowrap">{c.contract_number}</td>
                    <td className="px-4 py-3 text-slate-100 font-medium max-w-48 truncate">{c.contract_title}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{c.contractor_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-36 truncate">{c.project_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-36 truncate">{c.site_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{TYPE_LABELS[c.contract_type] || c.contract_type}</td>
                    <td className="px-4 py-3 text-slate-100 font-mono whitespace-nowrap">{fmt(c.contract_value)} {c.currency}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{c.start_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{c.end_date || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-green-400 transition-colors">
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
              <h2 className="text-lg font-bold text-slate-100">{editing ? 'تعديل عقد' : 'إضافة عقد جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-slate-400 text-xs mb-1 block">عنوان العقد *</label>
                  <input value={form.contract_title} onChange={e => setForm(f => ({ ...f, contract_title: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">المقاول *</label>
                  <select value={form.contractor_id} onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="">اختر مقاولاً...</option>
                    {contractors.filter(c => c.status !== 'blacklisted').map(c => (
                      <option key={c.id} value={c.id}>{c.contractor_name} ({c.contractor_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">المشروع *</label>
                  <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value, site_id: '' }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="">اختر مشروعاً...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الموقع</label>
                  <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
                    disabled={!form.project_id}>
                    <option value="">اختر موقعاً...</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">نوع العقد</label>
                  <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value as ContractType }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">قيمة العقد</label>
                  <input value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
                    type="number" min="0" step="0.001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">العملة</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    <option value="LYD">دينار ليبي (LYD)</option>
                    <option value="USD">دولار (USD)</option>
                    <option value="EUR">يورو (EUR)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">تاريخ البداية</label>
                  <input value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">تاريخ الانتهاء</label>
                  <input value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-slate-400 text-xs mb-1 block">وصف</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-slate-400 text-xs mb-1 block">ملاحظات</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                <CheckCircle className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة العقد'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
