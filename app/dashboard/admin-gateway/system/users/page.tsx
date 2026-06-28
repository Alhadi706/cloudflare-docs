'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Copy, Check, Eye, EyeOff,
  Shield, RefreshCw, X, ChevronDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  department_code?: string;
  job_title?: string;
  username?: string;
  invited_by?: string;
  last_login?: number;
  created_at?: number;
  is_founder?: boolean;
}

interface InviteResult {
  username: string;
  temp_password: string;
  email: string;
  role: string;
  department_code: string;
}

const ROLE_LABELS: Record<string, string> = {
  founder:         'مؤسس',
  admin:           'مسؤول',
  dept_manager:    'مدير إدارة',
  section_manager: 'مدير قسم',
  supervisor:      'مشرف',
  employee:        'موظف',
  member:          'عضو',
};

const ROLE_COLORS: Record<string, string> = {
  founder:         'bg-amber-500/20 text-amber-300 border-amber-500/30',
  admin:           'bg-violet-500/20 text-violet-300 border-violet-500/30',
  dept_manager:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  section_manager: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  supervisor:      'bg-green-500/20 text-green-300 border-green-500/30',
  employee:        'bg-slate-500/20 text-slate-300 border-slate-500/30',
  member:          'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const DEPT_OPTIONS = [
  { code: 'MAINT', label: 'الصيانة' },
  { code: 'CORR',  label: 'التآكل' },
  { code: 'ADMIN', label: 'الشؤون الإدارية' },
  { code: 'HR',    label: 'الموارد البشرية' },
  { code: 'FIN',   label: 'المالية' },
  { code: 'MAT',   label: 'المواد والمشتريات' },
  { code: 'SRV',   label: 'الخدمات الذكية' },
  { code: 'GIS',   label: 'الاستشعار عن بعد' },
  { code: 'IT',    label: 'تقنية المعلومات' },
];

const INVITABLE_ROLES = [
  { value: 'admin',           label: 'مسؤول نظام' },
  { value: 'dept_manager',    label: 'مدير إدارة' },
  { value: 'section_manager', label: 'مدير قسم' },
  { value: 'supervisor',      label: 'مشرف' },
  { value: 'employee',        label: 'موظف' },
];

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {label}
    </button>
  );
}

// ─── InviteModal ─────────────────────────────────────────────────────────────

function InviteModal({
  token,
  onClose,
  onSuccess,
}: {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'dept_manager',
    department_code: 'MAINT',
    job_title: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'حدث خطأ');
      } else {
        setResult(data);
        onSuccess();
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <UserPlus size={18} className="text-blue-400" />
            دعوة مستخدم جديد
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {result ? (
          // ── Success card ─────────────────────────────────────────────────
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <Check size={18} />
              تم إنشاء الحساب بنجاح
            </div>
            <p className="text-slate-400 text-sm">
              أرسل بيانات الدخول التالية للمستخدم عبر قناة آمنة:
            </p>
            <div className="bg-slate-800 rounded-lg p-4 space-y-3 text-sm font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">اسم المستخدم</span>
                <div className="flex items-center gap-2">
                  <span className="text-white">{result.username}</span>
                  <CopyButton value={result.username} label="نسخ" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">كلمة المرور المؤقتة</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-300">
                    {showPass ? result.temp_password : '••••••••'}
                  </span>
                  <button
                    onClick={() => setShowPass(s => !s)}
                    className="text-slate-400 hover:text-white"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <CopyButton value={result.temp_password} label="نسخ" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <CopyButton
                value={`اسم المستخدم: ${result.username}\nكلمة المرور: ${result.temp_password}`}
                label="نسخ الكل"
              />
              <button
                onClick={() => { setResult(null); setForm({ full_name: '', email: '', role: 'dept_manager', department_code: 'MAINT', job_title: '' }); }}
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white"
              >
                دعوة آخر
              </button>
              <button onClick={onClose} className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          // ── Form ────────────────────────────────────────────────────────
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">الاسم الكامل *</label>
                <input
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="محمد أحمد..."
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="user@company.ly"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الدور</label>
                <select
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {INVITABLE_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الإدارة</label>
                <select
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.department_code}
                  onChange={e => setForm(f => ({ ...f, department_code: e.target.value }))}
                >
                  {DEPT_OPTIONS.map(d => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">المسمى الوظيفي (اختياري)</label>
                <input
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="مدير إدارة الصيانة..."
                  value={form.job_title}
                  onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [token, setToken] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('auth_token') ||
      ''
    );
  }, []);

  const fetchUsers = useCallback(async (tok: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/invite', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'تعذر تحميل المستخدمين');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tok = getToken();
    setToken(tok);
    fetchUsers(tok);
  }, [getToken, fetchUsers]);

  const filteredUsers = filterRole === 'all'
    ? users
    : users.filter(u => u.role === filterRole);

  const roleGroups: Record<string, number> = {};
  users.forEach(u => { roleGroups[u.role] = (roleGroups[u.role] || 0) + 1; });

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: '#020617', color: '#f8fafc' }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Users size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة المستخدمين</h1>
            <p className="text-slate-400 text-sm">
              {users.length} مستخدم في المؤسسة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchUsers(token)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <UserPlus size={16} />
            دعوة مستخدم
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilterRole('all')}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            filterRole === 'all'
              ? 'bg-slate-700 border-slate-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          الكل ({users.length})
        </button>
        {Object.entries(roleGroups).map(([role, count]) => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              filterRole === role
                ? 'bg-slate-700 border-slate-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {ROLE_LABELS[role] || role} ({count})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-red-400">
          {error}
          <button
            onClick={() => fetchUsers(token)}
            className="block mt-3 mx-auto text-sm underline hover:text-red-300"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا يوجد مستخدمون</p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            دعوة أول مستخدم
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="text-right px-4 py-3 font-medium">المستخدم</th>
                <th className="text-right px-4 py-3 font-medium">الدور</th>
                <th className="text-right px-4 py-3 font-medium">الإدارة</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${
                    i === filteredUsers.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {u.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-white font-medium">{u.full_name}</div>
                        <div className="text-slate-500 text-xs">{u.email}</div>
                        {u.username && (
                          <div className="text-slate-600 text-xs font-mono">@{u.username}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${ROLE_COLORS[u.role] || ROLE_COLORS.member}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {u.is_founder && (
                      <span className="mr-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        مؤسس
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {u.department_code
                      ? DEPT_OPTIONS.find(d => d.code === u.department_code)?.label || u.department_code
                      : <span className="text-slate-600">—</span>
                    }
                    {u.job_title && (
                      <div className="text-slate-600 text-xs">{u.job_title}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.status === 'verified' || u.status === 'active'
                        ? 'bg-green-500/10 text-green-400'
                        : u.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {u.status === 'verified' ? 'مفعّل'
                        : u.status === 'active' ? 'نشط'
                        : u.status === 'pending' ? 'معلّق'
                        : u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {u.last_login
                      ? new Date(u.last_login).toLocaleDateString('ar-LY', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })
                      : <span className="text-slate-700">لم يدخل بعد</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          token={token}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            fetchUsers(token);
          }}
        />
      )}
    </div>
  );
}
