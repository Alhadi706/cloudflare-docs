'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Plus, ChevronLeft, Save, Trash2, AlertCircle, X } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/hr-structure';

interface JobTitle {
  id: number;
  title_code: string;
  title_name: string;
  title_name_ar: string;
  category: string | null;
  is_active: boolean;
  notes: string | null;
}

const EMPTY = { title_code:'', title_name:'', title_name_ar:'', category:'technical', is_active:true, notes:'' };

const CATEGORIES: Record<string,string> = {
  administrative: 'إداري', technical: 'فني', financial: 'مالي',
  legal: 'قانوني', engineering: 'هندسي', service: 'خدمي', other: 'أخرى'
};

export default function JobTitlesPage() {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState<number|null>(null);
  const [form, setForm]       = useState<{title_code:string;title_name:string;title_name_ar:string;category:string;is_active:boolean;notes:string}>({...EMPTY});
  const [err, setErr]         = useState('');
  const [catFilter, setCatFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${BASE}/job-titles`, { headers: {'X-Tenant-ID': getTenantId() || ''} });
    if (r.ok) setTitles(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm({...EMPTY}); setEditId(null); setErr(''); setShowForm(true); };
  const openEdit = (t: JobTitle) => {
    setForm({ title_code: t.title_code||'', title_name: t.title_name||'', title_name_ar: t.title_name_ar||'',
      category: t.category||'technical', is_active: t.is_active, notes: t.notes||'' });
    setEditId(t.id); setErr(''); setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const url    = editId ? `${BASE}/job-titles/${editId}` : `${BASE}/job-titles`;
    const method = editId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json','X-Tenant-ID': getTenantId() || ''}, body: JSON.stringify(form) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d.detail||'خطأ في الحفظ'); return; }
    setShowForm(false); load();
  };

  const del = async (id: number) => {
    if (!confirm('حذف هذا المسمى؟')) return;
    const r = await fetch(`${BASE}/job-titles/${id}`, { method:'DELETE', headers:{'X-Tenant-ID': getTenantId() || ''} });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.detail||'لا يمكن الحذف'); return; }
    load();
  };

  const filtered = catFilter ? titles.filter(t=>t.category===catFilter) : titles;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المسميات الوظيفية</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50">
              <FileText className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المسميات الوظيفية الرسمية</h1>
              <p className="text-slate-400 mt-1">الأكواد والتصنيفات الوظيفية المعتمدة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="job_titles" onSuccess={load} />
            <button onClick={openNew} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-2">
              <Plus className="w-5 h-5" /><span>مسمى جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:'إجمالي المسميات', val: titles.length, color:'text-indigo-400'},
            {label:'نشطة', val: titles.filter(t=>t.is_active).length, color:'text-emerald-400'},
            {label:'فنية', val: titles.filter(t=>t.category==='technical').length, color:'text-blue-400'},
            {label:'إدارية', val: titles.filter(t=>t.category==='administrative').length, color:'text-amber-400'},
          ].map(c=>(
            <div key={c.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={()=>setCatFilter('')} className={`px-4 py-2 rounded-lg text-sm ${!catFilter?'bg-indigo-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>الكل</button>
          {Object.entries(CATEGORIES).map(([k,v])=>(
            <button key={k} onClick={()=>setCatFilter(k)} className={`px-4 py-2 rounded-lg text-sm ${catFilter===k?'bg-indigo-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{v}</button>
          ))}
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد مسميات بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['الرمز','المسمى','المسمى بالعربي','التصنيف','الحالة','ملاحظات','إجراءات'].map(h=>(
                      <th key={h} className="px-4 py-4 text-right text-sm font-medium text-slate-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map(t=>(
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-300">{t.title_code}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{t.title_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{t.title_name_ar}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-indigo-500/10 text-indigo-400">
                          {CATEGORIES[t.category||'other']||t.category||'—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${t.is_active?'bg-emerald-500/10 text-emerald-400':'bg-slate-500/10 text-slate-400'}`}>
                          {t.is_active?'نشط':'موقوف'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{t.notes||'—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>openEdit(t)} className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40"><Save className="w-4 h-4" /></button>
                          <button onClick={()=>del(t.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">{editId?'تعديل مسمى':'مسمى وظيفي جديد'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5"/>{err}</div>}
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الرمز *</label>
                  <input required value={form.title_code} onChange={e=>setForm({...form,title_code:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="DIR" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الاسم (إنجليزي) *</label>
                  <input required value={form.title_name} onChange={e=>setForm({...form,title_name:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الاسم (عربي) *</label>
                  <input required value={form.title_name_ar} onChange={e=>setForm({...form,title_name_ar:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">التصنيف</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الحالة</label>
                  <select value={form.is_active ? 'true' : 'false'} onChange={e=>setForm({...form,is_active:e.target.value==='true'})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="true">نشط</option><option value="false">موقوف</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium">{editId?'حفظ التعديلات':'إضافة المسمى'}</button>
                <button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
