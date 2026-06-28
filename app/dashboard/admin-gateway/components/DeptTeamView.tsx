'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, UserCheck, RefreshCw, Search, X, Phone, Mail } from 'lucide-react';

const API = '/api/v1/dept-admin';

function getJsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

// ─── role definitions ─────────────────────────────────────────────────────────

const ROLE_DEFS = [
  { id: 'dept_head',     label: 'رئيس القسم',            desc: 'الاعتماد النهائي والتوقيع الرسمي',   color: 'indigo' },
  { id: 'supervisor',    label: 'مشرف',                  desc: 'مراجعة الطلبات وتقديمها لرئيس القسم', color: 'blue'   },
  { id: 'technician',    label: 'فني',                   desc: 'تنفيذ أوامر العمل الميدانية',          color: 'cyan'   },
  { id: 'hr_manager',    label: 'مدير الموارد البشرية',  desc: 'اعتماد طلبات الإجازات',               color: 'purple' },
  { id: 'documentation', label: 'التوثيق',               desc: 'ترقيم الوثائق وأرشفتها',              color: 'amber'  },
  { id: 'gm',            label: 'المدير العام',           desc: 'التوقيع النهائي للخطابات الصادرة',    color: 'rose'   },
] as const;

type RoleId = typeof ROLE_DEFS[number]['id'];

const COLORS: Record<string, { border: string; bg: string; badge: string; btn: string; count: string }> = {
  indigo: { border: 'border-indigo-700/50', bg: 'bg-indigo-900/15', badge: 'bg-indigo-700/80 text-indigo-100', btn: 'bg-indigo-600 hover:bg-indigo-500',   count: 'bg-indigo-700 text-white' },
  blue:   { border: 'border-blue-700/50',   bg: 'bg-blue-900/15',   badge: 'bg-blue-700/80 text-blue-100',     btn: 'bg-blue-600 hover:bg-blue-500',       count: 'bg-blue-700 text-white'   },
  cyan:   { border: 'border-cyan-700/50',   bg: 'bg-cyan-900/15',   badge: 'bg-cyan-700/80 text-cyan-100',     btn: 'bg-cyan-600 hover:bg-cyan-500',       count: 'bg-cyan-700 text-white'   },
  purple: { border: 'border-purple-700/50', bg: 'bg-purple-900/15', badge: 'bg-purple-700/80 text-purple-100', btn: 'bg-purple-600 hover:bg-purple-500',   count: 'bg-purple-700 text-white' },
  amber:  { border: 'border-amber-700/50',  bg: 'bg-amber-900/15',  badge: 'bg-amber-700/80 text-amber-100',   btn: 'bg-amber-600 hover:bg-amber-500',     count: 'bg-amber-700 text-white'  },
  rose:   { border: 'border-rose-700/50',   bg: 'bg-rose-900/15',   badge: 'bg-rose-700/80 text-rose-100',     btn: 'bg-rose-600 hover:bg-rose-500',       count: 'bg-rose-700 text-white'   },
};

// ─── types ────────────────────────────────────────────────────────────────────

interface TeamRole {
  id: number;
  dept: string;
  employee_id: number;
  role: string;
  assigned_at: string;
  employee_name: string;
  email: string | null;
  phone: string | null;
}

interface Employee {
  id: number;
  first_name_ar: string | null;
  last_name_ar: string | null;
  email: string;
  phone: string | null;
  employee_number: string;
}

interface Props {
  dept: string;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DeptTeamView({ dept }: Props) {
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  // picker modal
  const [pickerRole, setPickerRole] = useState<RoleId | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/${dept}/team`, { headers: getJsonHeaders() });
      if (r.ok) setRoles(await r.json());
    } finally {
      setLoading(false);
    }
  }, [dept]);

  const fetchEmployees = useCallback(async (q: string) => {
    const url = `${API}/${dept}/employees${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    const r = await fetch(url, { headers: getJsonHeaders() });
    if (r.ok) setEmployees(await r.json());
  }, [dept]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  useEffect(() => {
    if (pickerRole !== null) { fetchEmployees(''); setSearch(''); }
  }, [pickerRole, fetchEmployees]);

  const openPicker = (role: RoleId) => setPickerRole(role);
  const closePicker = () => { setPickerRole(null); setSearch(''); setEmployees([]); };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearch(q);
    fetchEmployees(q);
  };

  const assignRole = async (emp: Employee) => {
    if (!pickerRole) return;
    setAdding(true);
    try {
      const r = await fetch(`${API}/${dept}/team`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({ employee_id: emp.id, role: pickerRole, assigned_by: 'dept_manager' }),
      });
      if (r.ok) { closePicker(); fetchTeam(); }
    } finally {
      setAdding(false);
    }
  };

  const removeRole = async (id: number) => {
    setRemoving(id);
    try {
      await fetch(`${API}/${dept}/team/${id}`, { method: 'DELETE', headers: getJsonHeaders() });
      setRoles((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setRemoving(null);
    }
  };

  const byRole = (roleId: string) => roles.filter((r) => r.role === roleId);
  const pickerDef = ROLE_DEFS.find((r) => r.id === pickerRole);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">تكوين فريق العمل</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            توزيع الأدوار الوظيفية وبيانات الاتصال لتفعيل الربط الرقمي
          </p>
        </div>
        <button
          onClick={fetchTeam}
          className="rounded-lg p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Role cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ROLE_DEFS.map((roleDef) => {
          const clr = COLORS[roleDef.color];
          const members = byRole(roleDef.id);
          return (
            <div key={roleDef.id} className={`rounded-xl border ${clr.border} ${clr.bg} p-4`}>
              {/* Card header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${clr.count}`}>
                      {members.length}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-200">{roleDef.label}</h3>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{roleDef.desc}</p>
                </div>
                <button
                  onClick={() => openPicker(roleDef.id)}
                  className={`flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-white transition-colors ${clr.btn}`}
                >
                  <Plus className="h-3 w-3" />
                  إضافة
                </button>
              </div>

              {/* Members list */}
              {members.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 py-4">
                  <p className="text-xs text-slate-600">لم يُعيَّن أحد بعد</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                        {(m.employee_name || '?')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{m.employee_name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {m.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="h-3 w-3" />{m.email}
                            </span>
                          )}
                          {m.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="h-3 w-3" />{m.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeRole(m.id)}
                        disabled={removing === m.id}
                        className="shrink-0 text-slate-600 hover:text-red-400 transition-colors"
                      >
                        {removing === m.id
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      {roles.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
          <p className="text-xs text-slate-400">
            <span className="text-slate-200 font-medium">{roles.length} تعيين</span>
            {' '}على {new Set(roles.map((r) => r.role)).size} أدوار مختلفة
            {' '}· بيانات الاتصال متوفرة لـ{' '}
            <span className="text-slate-200 font-medium">
              {roles.filter((r) => r.phone || r.email).length}
            </span> موظف
          </p>
        </div>
      )}

      {/* ── Employee Picker Modal ── */}
      {pickerRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" dir="rtl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">تعيين موظف</h3>
                {pickerDef && (
                  <p className="text-xs text-slate-400 mt-0.5">الدور: {pickerDef.label}</p>
                )}
              </div>
              <button onClick={closePicker} className="rounded p-1 text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  autoFocus
                  value={search}
                  onChange={handleSearch}
                  placeholder="ابحث بالاسم أو البريد أو الرقم الوظيفي…"
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                {search && (
                  <button onClick={() => { setSearch(''); fetchEmployees(''); }} className="text-slate-500 hover:text-slate-300">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Employee list */}
            <div className="max-h-80 overflow-y-auto py-1">
              {employees.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
                  <UserCheck className="h-8 w-8 opacity-30" />
                  <p className="text-sm">لا توجد نتائج</p>
                </div>
              )}
              {employees.map((emp) => {
                const alreadyAssigned = roles.some(
                  (r) => r.employee_id === emp.id && r.role === pickerRole,
                );
                const fullName = [emp.first_name_ar, emp.last_name_ar].filter(Boolean).join(' ');
                return (
                  <button
                    key={emp.id}
                    onClick={() => !alreadyAssigned && !adding && assignRole(emp)}
                    disabled={alreadyAssigned || adding}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-right transition-colors ${
                      alreadyAssigned ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                      {(fullName || '?')[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{fullName || emp.email}</p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">{emp.employee_number}</span>
                        {emp.email && <span className="text-xs text-slate-600 truncate">{emp.email}</span>}
                      </div>
                    </div>
                    {alreadyAssigned
                      ? <span className="shrink-0 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">مُعيَّن</span>
                      : adding
                        ? <RefreshCw className="shrink-0 h-4 w-4 animate-spin text-slate-500" />
                        : null
                    }
                  </button>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="border-t border-slate-800 px-5 py-3">
              <p className="text-xs text-slate-600">اضغط على موظف لتعيينه في هذا الدور</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
