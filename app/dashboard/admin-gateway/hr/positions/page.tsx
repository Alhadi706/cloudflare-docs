'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Briefcase, Plus, ChevronLeft, Save, Trash2, AlertCircle, X, Users, AlertTriangle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE   = '/api/v1/hr-structure';

interface Position {
  id: number;
  position_code: string;
  position_name: string;
  position_name_ar: string;
  department_id: number | null;
  department_name: string | null;
  grade_id: number | null;
  grade_name: string | null;
  grade_level: number | null;
  authorized_headcount: number;
  occupied_headcount: number;
  base_salary_min: number | null;
  base_salary_max: number | null;
  description: string | null;
  status: string;
  mobile_role?: string | null;
}

interface GradeRef { id: number; grade_name: string; grade_level: number; }
interface DeptRef  { id: number; department_name: string; }

const EMPTY = { position_code:'', position_name:'', position_name_ar:'', department_id:'', grade_id:'', authorized_headcount:'1', description:'', status:'active', mobile_role:'' };

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [grades, setGrades]       = useState<GradeRef[]>([]);
  const [depts, setDepts]         = useState<DeptRef[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<number|null>(null);
  const [form, setForm]           = useState<typeof EMPTY>({...EMPTY});
  const [err, setErr]             = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pr, gr, dr] = await Promise.all([
      fetch(`${BASE}/positions`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/grades`,    { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/ref/departments`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
    ]);
    if (pr.ok) {
      setPositions(await pr.json());
      setFallbackMode(pr.headers.get('X-Fallback-Mode') === 'true');
    }
    if (gr.ok) { const gd = await gr.json(); setGrades(gd); }
    if (dr.ok) { const dd = await dr.json(); setDepts(dd); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm({...EMPTY}); setEditId(null); setErr(''); setShowForm(true); };
  const openEdit = (p: Position) => {
    setForm({ position_code: p.position_code||'', position_name: p.position_name||'', position_name_ar: p.position_name_ar||'',
      department_id: p.department_id ? String(p.department_id) : '',
      grade_id: p.grade_id ? String(p.grade_id) : '',
      authorized_headcount: String(p.authorized_headcount||1),
      description: p.description||'', status: p.status||'active',
      mobile_role: p.mobile_role || '' });
    setEditId(p.id); setErr(''); setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const body = { ...form,
      authorized_headcount: Number(form.authorized_headcount)||1,
      department_id: form.department_id ? Number(form.department_id) : null,
      grade_id: form.grade_id ? Number(form.grade_id) : null };
    const url    = editId ? `${BASE}/positions/${editId}` : `${BASE}/positions`;
    const method = editId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json','X-Tenant-ID': getTenantId() || ''}, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d.detail||'خطأ في الحفظ'); return; }
    setShowForm(false); load();
  };

  const del = async (id: number) => {
    if (!confirm('حذف هذا الوظيفة؟')) return;
    const r = await fetch(`${BASE}/positions/${id}`, { method:'DELETE', headers:{'X-Tenant-ID': getTenantId() || ''} });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.detail||'لا يمكن الحذف'); return; }
    load();
  };

  const occupancyColor = (occ: number, auth: number) => {
    const pct = auth > 0 ? occ/auth : 0;
    if (pct >= 1) return 'text-red-400 bg-red-500/10';
    if (pct >= 0.8) return 'text-amber-400 bg-amber-500/10';
    return 'text-emerald-400 bg-emerald-500/10';
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الوظائف المرخصة</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600/20 p-4 rounded-xl border border-purple-500/50">
              <Briefcase className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الوظائف المرخصة</h1>
              <p className="text-slate-400 mt-1">خطة الوظائف الحكومية والطاقة الاستيعابية المعتمدة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="positions" onSuccess={load} />
            <button onClick={openNew} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center gap-2">
              <Plus className="w-5 h-5" /><span>وظيفة جديد</span>
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
            {label:'إجمالي الوظائف', val: positions.length, color:'text-purple-400'},
            {label:'نشطة', val: positions.filter(p=>p.status==='active').length, color:'text-emerald-400'},
            {label:'الطاقة المرخصة', val: positions.reduce((s,p)=>s+p.authorized_headcount,0), color:'text-blue-400'},
            {label:'مُشغل', val: positions.reduce((s,p)=>s+p.occupied_headcount,0), color:'text-amber-400'},
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
            : positions.length === 0 ? (
              <div className="p-12 text-center">
                <Briefcase className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد وظائف بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['الرمز','المسمى','المسمى بالعربي','القسم','الدرجة','مرخص','مُشغل','الشواغر','الحالة','دور التطبيق','إجراءات'].map(h=>(
                      <th key={h} className="px-4 py-4 text-right text-sm font-medium text-slate-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {positions.map(p => {
                    const vacant = p.authorized_headcount - p.occupied_headcount;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-slate-300">{p.position_code}</td>
                        <td className="px-4 py-3 text-sm text-slate-200">{p.position_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-200">{p.position_name_ar}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{p.department_name||p.department_id||'—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{p.grade_name ? `${p.grade_name} (م${p.grade_level})` : '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-center">{p.authorized_headcount}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${occupancyColor(p.occupied_headcount, p.authorized_headcount)}`}>
                            {p.occupied_headcount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${vacant>0?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}`}>
                            {vacant}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${p.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-slate-500/10 text-slate-400'}`}>
                            {p.status==='active'?'نشط':'موقوف'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.mobile_role ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-indigo-500/10 text-indigo-400">
                              {p.mobile_role === 'employee' ? 'موظف' : p.mobile_role === 'supervisor' ? 'مشرف' : p.mobile_role === 'section_manager' ? 'رئيس قسم' : p.mobile_role === 'dept_manager' ? 'مدير إدارة' : p.mobile_role === 'admin' ? 'مدير نظام' : p.mobile_role}
                            </span>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={()=>openEdit(p)} className="p-1.5 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/40"><Save className="w-4 h-4" /></button>
                            <button onClick={()=>del(p.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <h2 className="text-xl font-bold text-slate-100">{editId?'تعديل وظيفة':'وظيفة جديد'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5"/>{err}</div>}
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">رمز الوظيفة *</label>
                  <input required value={form.position_code} onChange={e=>setForm({...form,position_code:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الاسم (إنجليزي) *</label>
                  <input required value={form.position_name} onChange={e=>setForm({...form,position_name:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الاسم (عربي) *</label>
                  <input required value={form.position_name_ar} onChange={e=>setForm({...form,position_name_ar:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الطاقة المرخصة *</label>
                  <input type="number" min="1" required value={form.authorized_headcount} onChange={e=>setForm({...form,authorized_headcount:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">القسم</label>
                  <select value={form.department_id} onChange={e=>setForm({...form,department_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر القسم —</option>
                    {depts.map(d=><option key={d.id} value={d.id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الدرجة الوظيفية</label>
                  <select value={form.grade_id} onChange={e=>setForm({...form,grade_id:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر الدرجة —</option>
                    {grades.map(g=><option key={g.id} value={g.id}>م{g.grade_level} — {g.grade_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">الحالة</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="active">نشط</option><option value="inactive">موقوف</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">دور التطبيق المحمول</label>
                  <select value={form.mobile_role} onChange={e=>setForm({...form,mobile_role:e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                    <option value="">— اختر الدور —</option>
                    <option value="employee">موظف عادي</option>
                    <option value="supervisor">مشرف</option>
                    <option value="section_manager">رئيس قسم</option>
                    <option value="dept_manager">مدير إدارة</option>
                    <option value="admin">مدير نظام</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">يُحدد صلاحيات الموظف في التطبيق المحمول</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">الوصف</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium">{editId?'حفظ التعديلات':'إضافة الوظيفة'}</button>
                <button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
