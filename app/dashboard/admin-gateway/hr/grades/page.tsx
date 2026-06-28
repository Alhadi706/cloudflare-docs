'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Award, Plus, ChevronLeft, Save, Trash2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/hr-structure';

interface Grade {
  id: number;
  grade_code: string;
  grade_name: string;
  grade_name_ar: string;
  grade_level: number;
  rank_order: number;
  base_salary_min: number | null;
  base_salary_max: number | null;
  description: string | null;
  status: string;
}

const EMPTY = { grade_code:'', grade_name:'', grade_name_ar:'', grade_level:'', rank_order:'', base_salary_min:'', base_salary_max:'', description:'', status:'active' };

export default function GradesPage() {
  const [grades, setGrades]   = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState<number|null>(null);
  const [form, setForm]       = useState<typeof EMPTY>({...EMPTY});
  const [err, setErr]         = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${BASE}/grades`, { headers: {'X-Tenant-ID': getTenantId() || ''} });
    if (r.ok) {
      setGrades(await r.json());
      setFallbackMode(r.headers.get('X-Fallback-Mode') === 'true');
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm({...EMPTY}); setEditId(null); setErr(''); setShowForm(true); };
  const openEdit = (g: Grade) => {
    setForm({ grade_code: g.grade_code||'', grade_name: g.grade_name||'', grade_name_ar: g.grade_name_ar||'',
      grade_level: String(g.grade_level||''), rank_order: String(g.rank_order||''),
      base_salary_min: g.base_salary_min!=null?String(g.base_salary_min):'',
      base_salary_max: g.base_salary_max!=null?String(g.base_salary_max):'',
      description: g.description||'', status: g.status||'active' });
    setEditId(g.id); setErr(''); setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const body = { ...form, grade_level: Number(form.grade_level), rank_order: Number(form.rank_order),
      base_salary_min: form.base_salary_min ? Number(form.base_salary_min) : null,
      base_salary_max: form.base_salary_max ? Number(form.base_salary_max) : null };
    const url    = editId ? `${BASE}/grades/${editId}` : `${BASE}/grades`;
    const method = editId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json','X-Tenant-ID': getTenantId() || ''}, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d.detail||'خطأ في الحفظ'); return; }
    setShowForm(false); load();
  };

  const del = async (id: number) => {
    if (!confirm('حذف هذه الدرجة؟')) return;
    const r = await fetch(`${BASE}/grades/${id}`, { method:'DELETE', headers:{'X-Tenant-ID': getTenantId() || ''} });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.detail||'لا يمكن الحذف'); return; }
    load();
  };

  const fmt = (n: number|null) => n ? n.toLocaleString('ar-SA') + ' د.ل' : '—';

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الدرجات الوظيفية</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-4 rounded-xl border border-amber-500/50">
              <Award className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الدرجات الوظيفية</h1>
              <p className="text-slate-400 mt-1">السلم الوظيفي الحكومي ونطاقات الرواتب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="grades" onSuccess={load} />
            <button onClick={openNew} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" /><span>درجة جديدة</span>
            </button>
          </div>
        </div>

        {fallbackMode && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-400">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">⚠️ وضع احتياطي نشط</p>
              <p className="text-xs text-amber-300 mt-1">الخدمة الرئيسية غير متاحة حالياً، تعرض البيانات من مخزن احتياطي محلي. قد تظهر بعض المميزات محدودة.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:'إجمالي الدرجات', val: grades.length, color:'text-amber-400'},
            {label:'نشطة', val: grades.filter(g=>g.status==='active').length, color:'text-emerald-400'},
            {label:'أعلى مستوى', val: grades.length ? Math.max(...grades.map(g=>g.grade_level)) : 0, color:'text-blue-400'},
            {label:'أعلى راتب', val: grades.length ? fmt(Math.max(...grades.map(g=>g.base_salary_max??0))) : '—', color:'text-violet-400'},
          ].map(c => (
            <div key={c.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            : grades.length === 0 ? (
              <div className="p-12 text-center">
                <Award className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد درجات بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['الرمز','الاسم','الاسم بالعربي','المستوى','الترتيب','الراتب الأدنى','الراتب الأعلى','الحالة','إجراءات'].map(h=>(
                      <th key={h} className="px-4 py-4 text-right text-sm font-medium text-slate-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {grades.map(g => (
                    <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-300">{g.grade_code}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{g.grade_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{g.grade_name_ar}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400">م{g.grade_level}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-400">{g.rank_order}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fmt(g.base_salary_min)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fmt(g.base_salary_max)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${g.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-slate-500/10 text-slate-400'}`}>
                          {g.status==='active'?'نشط':'موقوف'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>openEdit(g)} className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/40"><Save className="w-4 h-4" /></button>
                          <button onClick={()=>del(g.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-xl font-bold text-slate-100">{editId?'تعديل درجة':'درجة جديدة'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5"/>{err}</div>}
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[['grade_code','رمز الدرجة','text',true],['grade_name','الاسم (إنجليزي)','text',true],['grade_name_ar','الاسم (عربي)','text',true],['grade_level','المستوى الوظيفي','number',true],['rank_order','الترتيب في السلم','number',true],['base_salary_min','الراتب الأدنى','number',false],['base_salary_max','الراتب الأعلى','number',false]].map(([field,label,type,req])=>(
                  <div key={String(field)}>
                    <label className="block text-sm font-medium text-slate-300 mb-1">{label}{req?' *':''}</label>
                    <input type={String(type)} required={!!req} value={(form as any)[String(field)]}
                      onChange={e=>setForm({...form,[String(field)]:e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الحالة</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="active">نشط</option><option value="inactive">موقوف</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">الوصف</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium">{editId?'حفظ التعديلات':'إضافة الدرجة'}</button>
                <button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
