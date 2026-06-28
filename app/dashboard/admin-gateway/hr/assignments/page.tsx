'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { UserCheck, Plus, ChevronLeft, Trash2, AlertCircle, X, AlertTriangle } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/hr-structure';

interface Assignment {
  id: number;
  employee_id: number;
  employee_name: string;
  position_id: number;
  position_name: string;
  position_name_ar: string;
  grade_name: string | null;
  project_id: number | null;
  project_name: string | null;
  site_id: number | null;
  assigned_at: string;
  is_active: boolean;
  notes: string | null;
}

interface EmpRef  { id: number; full_name: string; employee_code: string; }
interface PosRef  { id: number; position_name: string; position_name_ar: string; authorized_headcount: number; occupied_headcount: number; }
interface ProjRef { id: number; name: string; }

const EMPTY = { employee_id:'', position_id:'', project_id:'', site_id:'', assigned_at: new Date().toISOString().slice(0,10), notes:'' };

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees]     = useState<EmpRef[]>([]);
  const [positions, setPositions]     = useState<PosRef[]>([]);
  const [projects, setProjects]       = useState<ProjRef[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState<typeof EMPTY>({...EMPTY});
  const [err, setErr]                 = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ar, er, pr, pjr] = await Promise.all([
      fetch(`${BASE}/assignments`,     { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/ref/employees`,   { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/positions`,       { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/ref/projects`,    { headers: {'X-Tenant-ID': getTenantId() || ''} }),
    ]);
    if (ar.ok) {
      setAssignments(await ar.json());
      setFallbackMode(ar.headers.get('X-Fallback-Mode') === 'true');
    }
    if (er.ok)  setEmployees(await er.json());
    if (pr.ok)  setPositions(await pr.json());
    if (pjr.ok) setProjects(await pjr.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectedPos = positions.find(p => p.id === Number(form.position_id));
  const posIsFull   = selectedPos ? selectedPos.occupied_headcount >= selectedPos.authorized_headcount : false;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const body = {
      employee_id: Number(form.employee_id),
      position_id: Number(form.position_id),
      project_id:  form.project_id  ? Number(form.project_id)  : null,
      site_id:     form.site_id     ? Number(form.site_id)     : null,
      assigned_at: form.assigned_at,
      notes:       form.notes || null,
    };
    const r = await fetch(`${BASE}/assignments`, { method:'POST', headers:{'Content-Type':'application/json','X-Tenant-ID': getTenantId() || ''}, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d.detail||'خطأ في الحفظ'); return; }
    setShowForm(false); setForm({...EMPTY}); load();
  };

  const del = async (id: number) => {
    if (!confirm('إلغاء هذا التعيين؟')) return;
    const r = await fetch(`${BASE}/assignments/${id}`, { method:'DELETE', headers:{'X-Tenant-ID': getTenantId() || ''} });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.detail||'خطأ في الحذف'); return; }
    load();
  };

  const fmt = (s: string) => new Date(s).toLocaleDateString('ar-SA');

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">التعيينات على الوظائف</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-teal-600/20 p-4 rounded-xl border border-teal-500/50">
              <UserCheck className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">تعيين على الوظائف</h1>
              <p className="text-slate-400 mt-1">ربط الموظفين بالوظائف المعتمدة مع تتبع الطاقة الاستيعابية</p>
            </div>
          </div>
          <button onClick={()=>{setForm({...EMPTY});setErr('');setShowForm(true);}} className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl flex items-center gap-2">
            <Plus className="w-5 h-5" /><span>تعيين جديد</span>
          </button>
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            {label:'إجمالي التعيينات', val: assignments.length, color:'text-teal-400'},
            {label:'نشطة', val: assignments.filter(a=>a.is_active).length, color:'text-emerald-400'},
            {label:'مرتبطة بمشاريع', val: assignments.filter(a=>a.project_id).length, color:'text-blue-400'},
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
            : assignments.length === 0 ? (
              <div className="p-12 text-center">
                <UserCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد تعيينات بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['اسم الموظف','الوظيفة','الدرجة','المشروع','تاريخ التعيين','الحالة','إجراءات'].map(h=>(
                      <th key={h} className="px-4 py-4 text-right text-sm font-medium text-slate-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {assignments.map(a=>(
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-200">{a.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{a.position_name_ar||a.position_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{a.grade_name||'—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{a.project_name||'—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmt(a.assigned_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${a.is_active?'bg-emerald-500/10 text-emerald-400':'bg-slate-500/10 text-slate-400'}`}>
                          {a.is_active?'نشط':'منتهي'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={()=>del(a.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-xl font-bold text-slate-100">تعيين موظف على وظيفة</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5"/>{err}</div>}
            {posIsFull && (
              <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex gap-2 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5"/>هذا الوظيفة ممتلئ ({selectedPos?.occupied_headcount}/{selectedPos?.authorized_headcount}) — التعيين قد يُرفض
              </div>
            )}
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الموظف *</label>
                  <select required value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر موظفاً —</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الوظيفة *</label>
                  <select required value={form.position_id} onChange={e=>setForm({...form,position_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر الوظيفة —</option>
                    {positions.map(p=><option key={p.id} value={p.id}>{p.position_name_ar||p.position_name} ({p.occupied_headcount}/{p.authorized_headcount})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">المشروع</label>
                  <select value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— لا يوجد مشروع —</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">تاريخ التعيين *</label>
                  <input type="date" required value={form.assigned_at} onChange={e=>setForm({...form,assigned_at:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium">تأكيد التعيين</button>
                <button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
