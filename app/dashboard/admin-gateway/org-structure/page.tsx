'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Building2, Users, UserCheck, ChevronDown, Plus,
  Save, RefreshCw, Trash2, Shield, User, Loader2, Check, X,
  ChevronRight, Briefcase,
} from 'lucide-react';
import { applyServerSession } from '@/lib/client-auth-session';

// ── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  employee_no: string;
  name_ar: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  org_roles: { org_role: string; department_code: string; section_id: string | null }[];
}

interface Department {
  id: string;
  name_ar: string;
  name_en: string;
  code: string;
  dept_manager_employee_no: string | null;
  dept_manager_name: string | null;
  is_active: boolean;
}

interface Section {
  id: string;
  department_id: string;
  department_code: string;
  name_ar: string;
  name_en: string;
  code: string;
  section_manager_employee_no: string | null;
  section_manager_name: string | null;
  is_active: boolean;
}

// ── Predefined org structure (editable via UI) ───────────────────────────────

const DEFAULT_DEPARTMENTS: Omit<Department, 'id' | 'is_active' | 'dept_manager_employee_no' | 'dept_manager_name'>[] = [
  { name_ar: 'إدارة التحكم',              name_en: 'Control Center',         code: 'CTRL' },
  { name_ar: 'إدارة الصيانة',             name_en: 'Maintenance',             code: 'MAINT' },
  { name_ar: 'إدارة الموارد البشرية',     name_en: 'Human Resources',         code: 'HR' },
  { name_ar: 'إدارة المالية',             name_en: 'Finance',                 code: 'FIN' },
  { name_ar: 'إدارة الهندسة والدعم الفني', name_en: 'Engineering & Technical Support', code: 'ENG' },
  { name_ar: 'إدارة المشاريع',           name_en: 'Project Management',      code: 'PROJ' },
  { name_ar: 'إدارة تقنية المعلومات',    name_en: 'IT',                       code: 'IT' },
  { name_ar: 'إدارة المشتريات',          name_en: 'Procurement',             code: 'PROC' },
  { name_ar: 'إدارة الأصول',            name_en: 'Asset Management',        code: 'ASSET' },
  { name_ar: 'إدارة العمليات',          name_en: 'Operations',              code: 'OPS' },
];

const DEFAULT_SECTIONS: Record<string, Omit<Section, 'id' | 'is_active' | 'department_id' | 'section_manager_employee_no' | 'section_manager_name'>[]> = {
  CTRL:  [
    { department_code: 'CTRL', name_ar: 'قسم رصد الضغوط',       name_en: 'Pressure Monitoring', code: 'CTRL-PRES' },
    { department_code: 'CTRL', name_ar: 'قسم إدارة المحطات',    name_en: 'Station Management',  code: 'CTRL-STA'  },
    { department_code: 'CTRL', name_ar: 'قسم التحكم والسيطرة',  name_en: 'SCADA Control',       code: 'CTRL-SCAD' },
  ],
  MAINT: [
    { department_code: 'MAINT', name_ar: 'قسم صيانة الخطوط',    name_en: 'Pipeline Maintenance', code: 'MAINT-PL'  },
    { department_code: 'MAINT', name_ar: 'قسم صيانة المضخات',   name_en: 'Pump Maintenance',     code: 'MAINT-PMP' },
    { department_code: 'MAINT', name_ar: 'قسم الصيانة الكهربائية', name_en: 'Electrical Maint',  code: 'MAINT-EL'  },
  ],
  HR:    [
    { department_code: 'HR', name_ar: 'قسم التوظيف',            name_en: 'Recruitment',         code: 'HR-REC'  },
    { department_code: 'HR', name_ar: 'قسم الرواتب والمزايا',   name_en: 'Payroll & Benefits',  code: 'HR-PAY'  },
  ],
  ENG:   [
    { department_code: 'ENG', name_ar: 'قسم الهندسة المدنية',   name_en: 'Civil Engineering',   code: 'ENG-CIV' },
    { department_code: 'ENG', name_ar: 'قسم الدعم الفني',       name_en: 'Technical Support',   code: 'ENG-TS'  },
  ],
  PROJ:  [
    { department_code: 'PROJ', name_ar: 'قسم إدارة المشاريع',   name_en: 'Project Management',  code: 'PROJ-PM'  },
    { department_code: 'PROJ', name_ar: 'قسم متابعة المقاولين', name_en: 'Contractor Follow-up', code: 'PROJ-CON' },
  ],
};

const ORG_ROLE_LABELS: Record<string, string> = {
  dept_manager:    'مدير إدارة',
  section_manager: 'رئيس قسم',
  supervisor:      'مشرف',
};

const ORG_ROLE_COLORS: Record<string, string> = {
  dept_manager:    'bg-violet-500/20 text-violet-300 border-violet-500/40',
  section_manager: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  supervisor:      'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function OrgStructurePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections]       = useState<Section[]>([]);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [showAddDept, setShowAddDept]   = useState(false);
  const [showAddSection, setShowAddSection] = useState<string | null>(null); // dept id
  const [toast, setToast]               = useState('');
  const [refreshing, setRefreshing]     = useState(false);

  // New dept form
  const [newDeptNameAr, setNewDeptNameAr] = useState('');
  const [newDeptNameEn, setNewDeptNameEn] = useState('');
  const [newDeptCode, setNewDeptCode]     = useState('');
  // New section form
  const [newSectNameAr, setNewSectNameAr] = useState('');
  const [newSectCode, setNewSectCode]     = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function refreshMyToken() {
    setRefreshing(true);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || '') : '';
      const res = await fetch('/api/auth/me/refresh-token', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        localStorage.setItem('auth_token', data.token);
        const appScope = localStorage.getItem('launch_app') || null;
        await applyServerSession(data.token, appScope);
        showToast(`✓ تم تحديث صلاحياتك — دورك الحالي: ${data.role}`);
      } else {
        showToast('تعذر تحديث الصلاحيات — أعد تسجيل الدخول');
      }
    } finally { setRefreshing(false); }
  }

  function getAuthHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token') || '';
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, sectRes, empRes] = await Promise.all([
        fetch('/api/org/departments', { headers: getAuthHeaders() }),
        fetch('/api/org/section-heads', { headers: getAuthHeaders() }),
        fetch('/api/org/employees', { headers: getAuthHeaders() }),
      ]);
      const deptData = deptRes.ok ? await deptRes.json() : { departments: [], sections: [] };
      const sectData = sectRes.ok ? await sectRes.json() : { roles: [] };
      const empData  = empRes.ok  ? await empRes.json()  : { employees: [] };

      // If no departments yet, seed defaults
      let depts: Department[] = deptData.departments ?? [];
      if (depts.length === 0) {
        depts = await seedDefaults();
      }
      setDepartments(depts);
      // Sections come from /api/org/departments response
      let sects: Section[] = deptData.sections ?? [];
      // If no sections exist, seed them now using loaded departments
      if (sects.length === 0 && depts.length > 0) {
        sects = await seedSections(depts);
      }
      setSections(sects);
      setEmployees(empData.employees ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  async function seedDefaults(): Promise<Department[]> {
    const created: Department[] = [];
    for (const d of DEFAULT_DEPARTMENTS) {
      try {
        const res = await fetch('/api/org/departments', {
          method: 'POST', headers: getAuthHeaders(),
          body: JSON.stringify({ ...d }),
        });
        const data = await res.json();
        if (data.department) {
          created.push(data.department);
        }
      } catch { /* ignore */ }
    }
    return created;
  }

  async function seedSections(depts: Department[]): Promise<Section[]> {
    const created: Section[] = [];
    const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]));
    for (const [deptCode, sects] of Object.entries(DEFAULT_SECTIONS)) {
      const deptId = deptMap[deptCode];
      if (!deptId) continue;
      for (const s of sects) {
        try {
          const res = await fetch('/api/org/section-heads', {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ ...s, department_id: deptId, department_code: deptCode }),
          });
          const data = await res.json();
          if (data.ok && data.id) {
            created.push({
              id: data.id, code: data.code || s.code, name_ar: data.name_ar || s.name_ar,
              name_en: s.name_en || s.name_ar, department_id: deptId, department_code: deptCode,
              section_manager_employee_no: null, section_manager_name: null, is_active: true,
            });
          }
        } catch { /* ignore */ }
      }
    }
    // Reload after seeding
    if (created.length > 0) {
      try {
        const res = await fetch('/api/org/departments', { headers: getAuthHeaders() });
        if (res.ok) { const d = await res.json(); return d.sections ?? created; }
      } catch { /* ignore */ }
    }
    return created;
  }

  useEffect(() => { void load(); }, [load]);

  async function assignManager(
    type: 'dept_manager' | 'section_manager' | 'supervisor',
    employeeNo: string,
    deptCode: string,
    sectionId: string | null,
    entityId: string,
  ) {
    if (!employeeNo) return;
    setSaving(entityId);
    const emp = employees.find(e => e.employee_no === employeeNo);
    try {
      const res = await fetch('/api/org/section-heads', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'assign_role',
          employee_no: employeeNo,
          full_name: emp?.name_ar ?? employeeNo,
          org_role: type,
          department_code: deptCode,
          section_id: sectionId,
          assigned_by: 'admin',
        }),
      });
      if (res.ok) {
        showToast(`✓ تم تعيين ${emp?.name_ar || employeeNo} — يجب عليه تحديث صلاحياته (زر التحديث في الأعلى)`);
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function removeManager(employeeNo: string, deptCode: string, entityId: string) {
    setSaving(entityId);
    try {
      await fetch('/api/org/section-heads', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'remove_role', employee_no: employeeNo, department_code: deptCode }),
      });
      await load();
    } finally { setSaving(null); }
  }

  async function createDept() {
    if (!newDeptNameAr || !newDeptCode) return;
    setSaving('new-dept');
    try {
      const res = await fetch('/api/org/departments', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ name_ar: newDeptNameAr, name_en: newDeptNameEn, code: newDeptCode }),
      });
      const data = await res.json();
      if (data.success) {
        // Seed sections if any
        const sects = DEFAULT_SECTIONS[newDeptCode.toUpperCase()] ?? [];
        for (const s of sects) {
          await fetch('/api/org/section-heads', {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ ...s, department_id: data.department.id }),
          });
        }
        setNewDeptNameAr(''); setNewDeptNameEn(''); setNewDeptCode('');
        setShowAddDept(false);
        await load();
      }
    } finally { setSaving(null); }
  }

  async function createSection(deptId: string, deptCode: string) {
    if (!newSectNameAr || !newSectCode) return;
    setSaving('new-sect');
    try {
      await fetch('/api/org/section-heads', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ name_ar: newSectNameAr, name_en: '', code: newSectCode, department_id: deptId, department_code: deptCode }),
      });
      setNewSectNameAr(''); setNewSectCode('');
      setShowAddSection(null);
      await load();
    } finally { setSaving(null); }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-violet-500/40 bg-slate-900/95 px-5 py-3 text-sm text-violet-200 font-semibold shadow-xl backdrop-blur max-w-sm text-center">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/admin-gateway" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
            <ArrowRight className="w-4 h-4" /> لوحة الإدارة
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-violet-400" /> الهيكل التنظيمي
            </h1>
            <p className="text-slate-400 text-sm mt-1">تعيين مدراء الإدارات ورؤساء الأقسام والمشرفين</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void refreshMyToken()} disabled={refreshing} title="تحديث الصلاحيات للمستخدم الحالي" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-700/40 text-sm text-cyan-300 transition-colors disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> تحديث صلاحياتي
            </button>
            <button onClick={() => void load()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors">
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
            <button onClick={() => setShowAddDept(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white transition-colors">
              <Plus className="w-4 h-4" /> إضافة إدارة
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'إدارة', value: departments.filter(d => d.is_active).length, icon: Building2, color: 'text-violet-400' },
            { label: 'قسم', value: sections.filter(s => s.is_active).length, icon: Briefcase, color: 'text-cyan-400' },
            { label: 'موظف في قائمة HR', value: employees.length, icon: Users, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Add Dept Form */}
        {showAddDept && (
          <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-violet-300 mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة إدارة جديدة</h3>
            <div className="grid grid-cols-3 gap-3">
              <input value={newDeptNameAr} onChange={e => setNewDeptNameAr(e.target.value)} placeholder="اسم الإدارة (عربي) *" className="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
              <input value={newDeptNameEn} onChange={e => setNewDeptNameEn(e.target.value)} placeholder="Department Name (English)" className="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
              <input value={newDeptCode} onChange={e => setNewDeptCode(e.target.value.toUpperCase())} placeholder="الكود (مثل: CTRL) *" className="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => void createDept()} disabled={!newDeptNameAr || !newDeptCode || saving === 'new-dept'} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm text-white">
                {saving === 'new-dept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
              </button>
              <button onClick={() => setShowAddDept(false)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-400">إلغاء</button>
            </div>
          </div>
        )}

        {/* Departments List */}
        <div className="space-y-4">
          {departments.filter(d => d.is_active).map(dept => {
            const deptSections = sections.filter(s => s.department_id === dept.id && s.is_active);
            const isExpanded = expandedDept === dept.id;

            return (
              <div key={dept.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Dept Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15 border border-violet-500/30`}>
                        <Building2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{dept.name_ar}</p>
                        <p className="text-xs text-slate-500 font-mono">{dept.code} · {dept.name_en}</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dept Manager Selector */}
                    <div className="flex items-center gap-2 mr-4">
                      <Shield className="w-4 h-4 text-violet-400 shrink-0" />
                      <select
                        value={dept.dept_manager_employee_no ?? ''}
                        onChange={e => void assignManager('dept_manager', e.target.value, dept.code, null, dept.id)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500 min-w-[160px]"
                        disabled={saving === dept.id}
                      >
                        <option value="">— اختر مدير الإدارة —</option>
                        {employees.map(e => (
                          <option key={e.employee_no} value={e.employee_no}>{e.name_ar}</option>
                        ))}
                      </select>
                      {dept.dept_manager_employee_no && (
                        <span className={`px-2 py-0.5 rounded-full border text-xs ${ORG_ROLE_COLORS.dept_manager}`}>
                          {ORG_ROLE_LABELS.dept_manager}
                        </span>
                      )}
                      {saving === dept.id && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
                    </div>
                  </div>

                  {dept.dept_manager_employee_no && (
                    <div className="mt-2 mr-13 flex items-center gap-2">
                      <User className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-400">
                        مدير الإدارة: <span className="text-violet-300 font-medium">{dept.dept_manager_name ?? dept.dept_manager_employee_no}</span>
                      </span>
                      <button
                        onClick={() => void removeManager(dept.dept_manager_employee_no!, dept.code, dept.id + '-rm')}
                        className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> إزالة
                      </button>
                    </div>
                  )}
                </div>

                {/* Sections */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" /> الأقسام ({deptSections.length})
                      </p>
                      <button
                        onClick={() => setShowAddSection(showAddSection === dept.id ? null : dept.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> قسم جديد
                      </button>
                    </div>

                    {showAddSection === dept.id && (
                      <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-3 mb-3">
                        <div className="flex gap-2">
                          <input value={newSectNameAr} onChange={e => setNewSectNameAr(e.target.value)} placeholder="اسم القسم *" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                          <input value={newSectCode} onChange={e => setNewSectCode(e.target.value.toUpperCase())} placeholder="الكود *" className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono" />
                          <button onClick={() => void createSection(dept.id, dept.code)} disabled={!newSectNameAr || !newSectCode || saving === 'new-sect'} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-sm text-white">
                            {saving === 'new-sect' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                          <button onClick={() => setShowAddSection(null)} className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-sm"><X className="w-3 h-3" /></button>
                        </div>
                      </div>
                    )}

                    {deptSections.length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-4">لا توجد أقسام — اضغط "قسم جديد" لإضافة قسم</p>
                    )}

                    {deptSections.map(section => (
                      <div key={section.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                              <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{section.name_ar}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{section.code}</p>
                            </div>
                          </div>

                          {/* Section Manager Selector */}
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                            <select
                              value={section.section_manager_employee_no ?? ''}
                              onChange={e => void assignManager('section_manager', e.target.value, dept.code, section.id, section.id)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 min-w-[150px]"
                              disabled={saving === section.id}
                            >
                              <option value="">— اختر رئيس القسم —</option>
                              {employees.map(e => (
                                <option key={e.employee_no} value={e.employee_no}>{e.name_ar}</option>
                              ))}
                            </select>
                            {section.section_manager_employee_no && (
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] ${ORG_ROLE_COLORS.section_manager}`}>
                                {ORG_ROLE_LABELS.section_manager}
                              </span>
                            )}
                            {saving === section.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                          </div>
                        </div>

                        {section.section_manager_employee_no && (
                          <div className="mt-1.5 flex items-center gap-2 mr-9">
                            <span className="text-[11px] text-slate-400">
                              رئيس القسم: <span className="text-cyan-300 font-medium">{section.section_manager_name ?? section.section_manager_employee_no}</span>
                            </span>
                            <button
                              onClick={() => void removeManager(section.section_manager_employee_no!, dept.code, section.id + '-rm')}
                              className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                            >
                              <X className="w-2.5 h-2.5" /> إزالة
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Role Legend */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 mb-3">الأدوار والصلاحيات في النظام</p>
          <div className="grid grid-cols-1 gap-2 text-xs text-slate-400">
            {[
              { role: 'dept_manager',    desc: 'يرى لوحة الإدارة كاملة، يعتمد القراءات والطلبات، يعين رؤساء الأقسام' },
              { role: 'section_manager', desc: 'يرى تبويب اعتماد في التطبيق والداشبورد، يراجع أعمال المشرفين' },
              { role: 'supervisor',      desc: 'يرى تبويب اعتماد للقراءات الميدانية وأوامر العمل' },
            ].map(r => (
              <div key={r.role} className="flex items-start gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] shrink-0 mt-0.5 ${ORG_ROLE_COLORS[r.role]}`}>{ORG_ROLE_LABELS[r.role]}</span>
                <span>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
