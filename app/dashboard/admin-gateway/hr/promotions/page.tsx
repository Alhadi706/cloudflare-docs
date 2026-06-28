'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, Plus, ChevronLeft, Trash2, AlertCircle, X } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/hr-structure';

interface Promotion {
  id: number;
  employee_id: number;
  employee_name: string;
  from_grade_id: number | null;
  from_grade_name: string | null;
  from_grade_level: number | null;
  to_grade_id: number;
  to_grade_name: string;
  to_grade_level: number;
  promotion_date: string;
  decision_number: string | null;
  decision_date: string | null;
  notes: string | null;
  created_at: string;
}

interface EmpRef   { id: number; full_name: string; employee_code: string; }
interface GradeRef { id: number; grade_name: string; grade_level: number; rank_order: number; }

const EMPTY = { employee_id:'', from_grade_id:'', to_grade_id:'', promotion_date: new Date().toISOString().slice(0,10), decision_number:'', decision_date:'', notes:'' };

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [employees, setEmployees]   = useState<EmpRef[]>([]);
  const [grades, setGrades]         = useState<GradeRef[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState<typeof EMPTY>({...EMPTY});
  const [err, setErr]               = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [pr, er, gr] = await Promise.all([
      fetch(`${BASE}/promotions`,    { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/ref/employees`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/grades`,        { headers: {'X-Tenant-ID': getTenantId() || ''} }),
    ]);
    if (pr.ok) setPromotions(await pr.json());
    if (er.ok) setEmployees(await er.json());
    if (gr.ok) { const gd = await gr.json(); setGrades([...gd].sort((a,b)=>a.rank_order-b.rank_order)); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const body = {
      employee_id:     Number(form.employee_id),
      from_grade_id:   form.from_grade_id ? Number(form.from_grade_id) : null,
      to_grade_id:     Number(form.to_grade_id),
      promotion_date:  form.promotion_date,
      decision_number: form.decision_number || null,
      decision_date:   form.decision_date   || null,
      notes:           form.notes           || null,
    };
    const r = await fetch(`${BASE}/promotions`, { method:'POST', headers:{'Content-Type':'application/json','X-Tenant-ID': getTenantId() || ''}, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d.detail||'خطأ في الحفظ'); return; }
    setShowForm(false); setForm({...EMPTY}); load();
  };

  const del = async (id: number) => {
    if (!confirm('حذف هذا السجل؟')) return;
    const r = await fetch(`${BASE}/promotions/${id}`, { method:'DELETE', headers:{'X-Tenant-ID': getTenantId() || ''} });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.detail||'خطأ في الحذف'); return; }
    load();
  };

  const fmt = (s: string | null) => s ? new Date(s).toLocaleDateString('ar-SA') : '—';

  const toGradeOptions = grades.filter(g => {
    if (!form.from_grade_id) return true;
    const from = grades.find(x=>x.id===Number(form.from_grade_id));
    return from ? g.rank_order > from.rank_order : true;
  });

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">سجلات الترقيات</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-4 rounded-xl border border-amber-500/50">
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">سجلات الترقيات</h1>
              <p className="text-slate-400 mt-1">توثيق الترقيات بأرقام القرارات والدرجات المرتبطة</p>
            </div>
          </div>
          <button onClick={()=>{setForm({...EMPTY});setErr('');setShowForm(true);}} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2">
            <Plus className="w-5 h-5" /><span>تسجيل ترقية</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            {label:'إجمالي الترقيات', val: promotions.length, color:'text-amber-400'},
            {label:'هذا العام', val: promotions.filter(p=>new Date(p.promotion_date).getFullYear()===new Date().getFullYear()).length, color:'text-emerald-400'},
            {label:'موثقة برقم قرار', val: promotions.filter(p=>p.decision_number).length, color:'text-blue-400'},
          ].map(c=>(
            <div key={c.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            : promotions.length === 0 ? (
              <div className="p-12 text-center">
                <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد ترقيات مسجلة بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['الموظف','من درجة','إلى درجة','تاريخ الترقية','رقم القرار','تاريخ القرار','إجراءات'].map(h=>(
                      <th key={h} className="px-4 py-4 text-right text-sm font-medium text-slate-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {promotions.map(p=>(
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-200">{p.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {p.from_grade_name ? <span className="px-2 py-1 rounded-full text-xs bg-slate-500/10 text-slate-400">م{p.from_grade_level} — {p.from_grade_name}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400">م{p.to_grade_level} — {p.to_grade_name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmt(p.promotion_date)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-300">{p.decision_number||'—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmt(p.decision_date)}</td>
                      <td className="px-4 py-3">
                        <button onClick={()=>del(p.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-xl font-bold text-slate-100">تسجيل ترقية جديدة</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5"/>{err}</div>}
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">الموظف *</label>
                  <select required value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value,to_grade_id:''})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر موظفاً —</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">من درجة (قبل الترقية)</label>
                  <select value={form.from_grade_id} onChange={e=>setForm({...form,from_grade_id:e.target.value,to_grade_id:''})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— استلم بدون درجة —</option>
                    {grades.map(g=><option key={g.id} value={g.id}>م{g.grade_level} — {g.grade_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">إلى درجة (بعد الترقية) *</label>
                  <select required value={form.to_grade_id} onChange={e=>setForm({...form,to_grade_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر الدرجة الجديدة —</option>
                    {toGradeOptions.map(g=><option key={g.id} value={g.id}>م{g.grade_level} — {g.grade_name}</option>)}
                  </select>
                  {form.from_grade_id && toGradeOptions.length===0 && (
                    <p className="text-xs text-amber-400 mt-1">لا توجد درجات أعلى من الدرجة المحددة</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">تاريخ الترقية *</label>
                  <input type="date" required value={form.promotion_date} onChange={e=>setForm({...form,promotion_date:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">رقم قرار الترقية</label>
                  <input value={form.decision_number} onChange={e=>setForm({...form,decision_number:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="2026/123" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">تاريخ القرار</label>
                  <input type="date" value={form.decision_date} onChange={e=>setForm({...form,decision_date:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium">تسجيل الترقية</button>
                <button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
