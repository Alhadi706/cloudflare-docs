'use client';

/**
 * ════════════════════════════════════════════════════════
 * إدارة التصاريح وصلاحيات الأقسام
 * Permissions & Section Access Management
 * ════════════════════════════════════════════════════════
 * يتيح للأدمن:
 *   ١. إنشاء/تسمية أقسام داخل كل إدارة
 *   ٢. دعوة رئيس قسم وربطه بقسم محدد
 *   ٣. عرض هيكل الإدارات → الأقسام → المسؤولين
 *   ٤. حذف أو تعليق مستخدم
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, UserPlus, Shield, ChevronDown, ChevronRight,
  Check, AlertCircle, Loader2, Eye, EyeOff, Copy, Trash2, RefreshCw,
  Lock, Unlock, BadgeCheck, KeyRound, Search,
} from 'lucide-react';

// ─── Department & Section registry ───────────────────────────────────────────

const DEPARTMENTS: { code: string; label: string; color: string }[] = [
  { code: 'ADMIN',  label: 'الشؤون الإدارية',          color: 'blue' },
  { code: 'HR',     label: 'الموارد البشرية',           color: 'indigo' },
  { code: 'FIN',    label: 'المالية والمحاسبة',         color: 'amber' },
  { code: 'PROC',   label: 'المشتريات',                color: 'orange' },
  { code: 'MAINT',  label: 'الصيانة والتشغيل',         color: 'rose' },
  { code: 'PROJ',   label: 'إدارة المشاريع',            color: 'purple' },
  { code: 'ASSET',  label: 'إدارة الأصول والمواد',      color: 'teal' },
  { code: 'GIS',    label: 'الجغرافيا والمعلومات',     color: 'cyan' },
  { code: 'IT',     label: 'تقنية المعلومات',           color: 'violet' },
  { code: 'OPS',    label: 'العمليات والمراقبة',        color: 'green' },
  { code: 'CORR',   label: 'إدارة التآكل',            color: 'sky' },
  { code: 'FLEET',  label: 'المركبات والمعدات',         color: 'slate' },
  { code: 'LEGAL',  label: 'الشؤون القانونية',          color: 'red' },
];

const ROLE_LABELS: Record<string, string> = {
  dept_manager:    'مدير إدارة',
  section_manager: 'رئيس قسم',
  supervisor:      'مشرف',
  employee:        'موظف',
};

const colorMap: Record<string, string> = {
  blue:   'bg-blue-900/30 border-blue-500/30 text-blue-300',
  indigo: 'bg-indigo-900/30 border-indigo-500/30 text-indigo-300',
  amber:  'bg-amber-900/30 border-amber-500/30 text-amber-300',
  orange: 'bg-orange-900/30 border-orange-500/30 text-orange-300',
  rose:   'bg-rose-900/30 border-rose-500/30 text-rose-300',
  purple: 'bg-purple-900/30 border-purple-500/30 text-purple-300',
  teal:   'bg-teal-900/30 border-teal-500/30 text-teal-300',
  cyan:   'bg-cyan-900/30 border-cyan-500/30 text-cyan-300',
  violet: 'bg-violet-900/30 border-violet-500/30 text-violet-300',
  green:  'bg-green-900/30 border-green-500/30 text-green-300',
  sky:    'bg-sky-900/30 border-sky-500/30 text-sky-300',
  slate:  'bg-slate-700/40 border-slate-500/30 text-slate-300',
  red:    'bg-red-900/30 border-red-500/30 text-red-300',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvitedUser {
  id:              string;
  full_name:       string;
  email:           string;
  username?:       string;
  role:            string;
  department_code: string;
  section_id?:     string;
  status:          string;
  job_title?:      string;
  created_at?:     number;
}

interface InviteResult {
  username:      string;
  temp_password: string;
  email:         string;
  role:          string;
  department_code: string;
}

interface FormState {
  full_name:       string;
  email:           string;
  role:            string;
  department_code: string;
  section_id:      string;
  job_title:       string;
}

const EMPTY_FORM: FormState = {
  full_name:       '',
  email:           '',
  role:            'section_manager',
  department_code: '',
  section_id:      '',
  job_title:       '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function deptColor(code: string) {
  const d = DEPARTMENTS.find(d => d.code === code);
  return d ? colorMap[d.color] ?? colorMap.slate : colorMap.slate;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [users,       setUsers]       = useState<InvitedUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [result,      setResult]      = useState<InviteResult | null>(null);
  const [showPass,    setShowPass]    = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [search,      setSearch]      = useState('');
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});

  // ── Load users ────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/invite', {
        headers: { Authorization: `Bearer ${authHeader()}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `خطأ ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Invite submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setResult(null);

    if (!form.full_name.trim() || !form.email.trim() || !form.department_code || !form.role) {
      setError('يرجى ملء الحقول المطلوبة: الاسم، البريد، الإدارة، الدور');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${authHeader()}`,
        },
        body: JSON.stringify({
          full_name:       form.full_name.trim(),
          email:           form.email.trim().toLowerCase(),
          role:            form.role,
          department_code: form.department_code,
          section_id:      form.section_id.trim() || undefined,
          job_title:       form.job_title.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `خطأ ${res.status}`);

      setResult(data);
      setSuccess(`تم إنشاء الحساب بنجاح لـ ${form.full_name}`);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'فشل إنشاء المستخدم');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Copy credentials ──────────────────────────────────────────────────────
  const copyCredentials = () => {
    if (!result) return;
    const text =
      `اسم المستخدم: ${result.username}\n` +
      `كلمة المرور المؤقتة: ${result.temp_password}\n` +
      `الإدارة: ${result.department_code}\n` +
      `الدور: ${ROLE_LABELS[result.role] || result.role}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Filtered & grouped users ──────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.department_code || '').toLowerCase().includes(q) ||
      (u.section_id || '').toLowerCase().includes(q)
    );
  });

  // Group by department_code → section_id
  const tree: Record<string, Record<string, InvitedUser[]>> = {};
  for (const u of filtered) {
    const dept    = u.department_code || 'UNASSIGNED';
    const section = u.section_id      || '__dept_level__';
    if (!tree[dept]) tree[dept] = {};
    if (!tree[dept][section]) tree[dept][section] = [];
    tree[dept][section].push(u);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-[#060c18] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-violet-400" />
              إدارة التصاريح وصلاحيات الأقسام
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              إسناد رؤساء الأقسام لأقسامهم — كل رئيس يرى قسمه فقط
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadUsers}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition"
            >
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setResult(null); setError(''); }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              <UserPlus className="w-4 h-4" />
              {showForm ? 'إغلاق النموذج' : 'إضافة رئيس قسم'}
            </button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error   && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 text-emerald-300 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            {success}
          </div>
        )}

        {/* ── Invite Form ── */}
        {showForm && (
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-violet-400" />
              إضافة مستخدم جديد وتحديد قسمه
            </h2>

            {/* Credentials result */}
            {result && (
              <div className="bg-slate-800 border border-emerald-500/40 rounded-xl p-4 space-y-2">
                <p className="text-emerald-400 text-sm font-semibold">
                  ✓ تم إنشاء الحساب — أرسل هذه البيانات للمستخدم
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">اسم المستخدم</p>
                    <p className="text-white font-mono">{result.username}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">كلمة المرور المؤقتة</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-mono">
                        {showPass ? result.temp_password : '••••••••'}
                      </p>
                      <button onClick={() => setShowPass(!showPass)} className="text-slate-400 hover:text-white">
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={copyCredentials}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs mt-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'تم النسخ!' : 'نسخ بيانات الدخول'}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full name */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">الاسم الكامل *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                  placeholder="محمد علي الوريق"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="user@organization.ly"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">الإدارة *</label>
                <select
                  value={form.department_code}
                  onChange={e => setForm(f => ({ ...f, department_code: e.target.value }))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— اختر الإدارة —</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d.code} value={d.code}>{d.label} ({d.code})</option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">الدور الوظيفي *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="dept_manager">مدير إدارة</option>
                  <option value="section_manager">رئيس قسم</option>
                  <option value="supervisor">مشرف</option>
                  <option value="employee">موظف</option>
                </select>
              </div>

              {/* Section ID */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  معرّف القسم
                  <span className="text-slate-500 mr-1">(يمنع الدخول لأقسام أخرى)</span>
                </label>
                <input
                  value={form.section_id}
                  onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
                  placeholder="مثال: SEC-MAINT-01 أو قسم الصيانة الميكانيكية"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  اتركه فارغًا إذا أردت منح صلاحية كامل الإدارة
                </p>
              </div>

              {/* Job title */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">المسمى الوظيفي</label>
                <input
                  value={form.job_title}
                  onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                  placeholder="رئيس قسم الصيانة الوقائية"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Submit */}
              <div className="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => { setForm(EMPTY_FORM); setResult(null); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm"
                >
                  مسح
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded-xl text-sm font-semibold"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ الإنشاء...</>
                    : <><KeyRound className="w-4 h-4" />إنشاء الحساب وتحديد القسم</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── How it works info box ── */}
        <div className="bg-slate-900/50 border border-violet-500/20 rounded-xl p-4 text-sm text-slate-400 space-y-1.5">
          <p className="text-violet-300 font-semibold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4" /> كيف تعمل صلاحيات الأقسام؟
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong className="text-slate-300">مدير إدارة (dept_manager)</strong> — يرى جميع أقسام إدارته، لا يرى الإدارات الأخرى</li>
            <li><strong className="text-slate-300">رئيس قسم (section_manager)</strong> — يرى قسمه فقط (المحدد في معرّف القسم)، محجوب عن باقي الأقسام</li>
            <li><strong className="text-slate-300">مشرف (supervisor)</strong> — مقيّد بإدارته وقسمه</li>
            <li>الحاجب يعمل في المسارات وفي طلبات API معاً — الفصل فعلي وليس مجرد واجهة</li>
          </ul>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المستخدم أو الإدارة أو القسم..."
            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* ── Department tree ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin ml-2" />
            جارٍ تحميل قائمة المستخدمين...
          </div>
        ) : Object.keys(tree).length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            لا يوجد مستخدمون مسجلون بعد. استخدم زر &quot;إضافة رئيس قسم&quot; للبدء.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(tree).map(([deptCode, sections]) => {
              const deptInfo = DEPARTMENTS.find(d => d.code === deptCode);
              const totalUsers = Object.values(sections).flat().length;
              const isOpen = expanded[deptCode] !== false; // open by default
              return (
                <div key={deptCode} className="bg-slate-900/60 border border-slate-700/60 rounded-2xl overflow-hidden">
                  {/* Dept header */}
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [deptCode]: !isOpen }))}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition text-right"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 text-xs font-mono rounded-md border ${deptColor(deptCode)}`}>
                        {deptCode}
                      </span>
                      <span className="font-semibold text-white">
                        {deptInfo?.label || deptCode}
                      </span>
                      <span className="text-xs text-slate-500">
                        {totalUsers} مستخدم
                      </span>
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-500" />
                      : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </button>

                  {/* Sections */}
                  {isOpen && (
                    <div className="border-t border-slate-700/60 divide-y divide-slate-800">
                      {Object.entries(sections).map(([sectionId, sectionUsers]) => (
                        <div key={sectionId} className="px-5 py-3">
                          {/* Section label */}
                          <div className="flex items-center gap-2 mb-2">
                            {sectionId === '__dept_level__' ? (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Unlock className="w-3 h-3" />
                                صلاحية كامل الإدارة (بدون قسم محدد)
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Lock className="w-3 h-3 text-amber-400" />
                                القسم:&nbsp;
                                <span className="font-mono text-amber-300">{sectionId}</span>
                              </span>
                            )}
                          </div>

                          {/* Users in section */}
                          <div className="space-y-2">
                            {sectionUsers.map(u => (
                              <UserRow key={u.id} user={u} onRefresh={loadUsers} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── User Row Component ───────────────────────────────────────────────────────

function UserRow({ user, onRefresh }: { user: InvitedUser; onRefresh: () => void }) {
  const statusColor = user.status === 'verified'
    ? 'text-emerald-400'
    : user.status === 'invited'
    ? 'text-amber-400'
    : 'text-slate-500';

  const statusLabel: Record<string, string> = {
    verified:             'نشط',
    invited:              'دعوة مرسلة',
    pending_verification: 'بانتظار التحقق',
    suspended:            'موقوف',
  };

  return (
    <div className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-2.5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {user.full_name?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Role badge */}
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
          {ROLE_LABELS[user.role] || user.role}
        </span>
        {/* Status */}
        <span className={`text-xs ${statusColor}`}>
          {statusLabel[user.status] || user.status}
        </span>
      </div>
    </div>
  );
}
