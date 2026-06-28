'use client';

import { useState, useEffect, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import {
  Mail, Plus, Trash2, RefreshCw, Megaphone, CalendarCheck,
  FileText, BookOpen, AlertTriangle, Clock, ClipboardCheck,
  X, Send, Users, Star, ChevronDown, ChevronUp,
} from 'lucide-react';

type CircularType = 'announcement' | 'holiday' | 'schedule' | 'policy' | 'survey' | 'training' | 'urgent';
type Priority = 'normal' | 'high' | 'urgent';

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'text' | 'rating';
  options?: string[];
  required?: boolean;
}

interface Circular {
  id: string;
  type: CircularType;
  title: string;
  body: string;
  created_by_name?: string;
  source_dept?: string;
  priority: Priority;
  created_at: string;
  expires_at?: string;
  target_roles?: string[];
  target_departments?: string[];
  target_employee_nos?: string[];
  target_count?: number;
  questions?: SurveyQuestion[];
  read_by: string[];
  responses?: { employee_no: string; answers: Record<string, unknown>; submitted_at: string }[];
}

type AudienceMode = 'all' | 'roles' | 'departments' | 'hybrid';

interface AudienceEmployee {
  employeeNo: string;
  fullName: string;
  department: string;
}

interface DraftAttachment {
  name: string;
  type: string;
  size: number;
  data_url: string;
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'employee', label: 'الموظفون' },
  { value: 'supervisor', label: 'مشرفون' },
  { value: 'section_manager', label: 'مدراء أقسام' },
  { value: 'dept_manager', label: 'مدراء إدارات' },
  { value: 'manager', label: 'مدراء عامون' },
  { value: 'admin', label: 'الإدارة العليا' },
];

const TYPE_CONFIG: Record<CircularType, { icon: React.ReactNode; label: string; color: string }> = {
  announcement: { icon: <Megaphone className="h-4 w-4" />, label: 'إعلان عام',      color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
  holiday:      { icon: <CalendarCheck className="h-4 w-4" />, label: 'إجازة / عطلة', color: 'text-green-300 bg-green-500/10 border-green-500/30' },
  schedule:     { icon: <Clock className="h-4 w-4" />, label: 'تغيير توقيت',      color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  policy:       { icon: <FileText className="h-4 w-4" />, label: 'تعميم / سياسة',  color: 'text-purple-300 bg-purple-500/10 border-purple-500/30' },
  survey:       { icon: <ClipboardCheck className="h-4 w-4" />, label: 'استبيان',       color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  training:     { icon: <BookOpen className="h-4 w-4" />, label: 'تدريب',           color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30' },
  urgent:       { icon: <AlertTriangle className="h-4 w-4" />, label: 'تنبيه عاجل', color: 'text-red-300 bg-red-500/10 border-red-500/30' },
};

function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token') || '';
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferUserDepartment(): string {
  const cookieDept = getCookieValue('user_dept').trim();
  if (cookieDept) return cookieDept;

  const localDept = (localStorage.getItem('user_dept') || '').trim();
  if (localDept) return localDept;

  const token = localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token') || '';
  if (token) {
    const claims = decodeJwtPayload(token);
    const dept = String(
      claims?.department_name ?? claims?.department ?? claims?.dept_name ?? claims?.dept ?? claims?.department_code ?? ''
    ).trim();
    if (dept) return dept;
  }

  return '';
}

async function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('failed_to_read_file'));
    reader.readAsDataURL(file);
  });
}

export default function CircularsPage() {
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all');
  const [audienceEmployees, setAudienceEmployees] = useState<AudienceEmployee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeNos, setSelectedEmployeeNos] = useState<string[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [currentUserDept, setCurrentUserDept] = useState('');

  // Form state
  const [fType, setFType] = useState<CircularType>('announcement');
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fPriority, setFPriority] = useState<Priority>('normal');
  const [fExpires, setFExpires] = useState('');
  const [fAttachments, setFAttachments] = useState<DraftAttachment[]>([]);
  const [fQuestions, setFQuestions] = useState<SurveyQuestion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const toggleValue = (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const resetAudience = () => {
    setAudienceMode('all');
    setSelectedRoles([]);
    setSelectedDepartments([]);
    setSelectedEmployeeNos([]);
  };

  const loadAudienceData = async () => {
    setLoadingAudience(true);
    try {
      const employeesRes = await fetch('/api/v1/workspace/employees', { headers: getAdminHeaders() });
      if (!employeesRes.ok) return;

      const rows = await employeesRes.json();
      const mapped: AudienceEmployee[] = Array.isArray(rows)
        ? rows
            .map((row: Record<string, unknown>) => {
              const employeeNo = String(
                row.employee_no ?? row.employee_number ?? row.employeeNumber ?? row.emp_no ?? ''
              ).trim();
              const fullName = String(
                row.full_name ?? row.name ?? row.name_ar ?? row.employee_name ?? row.first_name ?? ''
              ).trim();
              const department = String(
                row.department_name ?? row.department ?? row.dept_name ?? row.dept ?? row.section_name ?? 'غير محدد'
              ).trim();
              return { employeeNo, fullName, department };
            })
            .filter((emp: AudienceEmployee) => emp.employeeNo)
        : [];

      setAudienceEmployees(mapped);
      const deptList = Array.from(new Set(mapped.map((emp) => emp.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
      setDepartments(deptList);

      // Always infer sender department from trusted session context (cookie/token), not manual entry.
      setCurrentUserDept(inferUserDepartment());
    } catch {
      // keep form usable even if audience data endpoint fails
    } finally {
      setLoadingAudience(false);
    }
  };

  const handleAttachmentSelect = async (evt: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;

    const maxBytes = 2 * 1024 * 1024;
    const accepted = files.filter((file) => file.size <= maxBytes);
    if (accepted.length !== files.length) {
      showToast('بعض الملفات أكبر من 2MB وتم تجاهلها');
    }

    try {
      const next = await Promise.all(
        accepted.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data_url: await toDataUrl(file),
        }))
      );
      setFAttachments((prev) => [...prev, ...next]);
    } catch {
      showToast('تعذّر قراءة أحد الملفات');
    } finally {
      evt.target.value = '';
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/circulars?action=all', { headers: getAdminHeaders() });
      if (res.ok) setCirculars(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { void fetchAll(); }, []);
  useEffect(() => { setCurrentUserDept(inferUserDepartment()); }, []);
  useEffect(() => { void loadAudienceData(); }, []);

  const addQuestion = () => {
    setFQuestions(prev => [...prev, {
      id: crypto.randomUUID(),
      text: '',
      type: 'single',
      options: ['خيار 1', 'خيار 2'],
      required: false,
    }]);
  };

  const removeQuestion = (id: string) => setFQuestions(prev => prev.filter(q => q.id !== id));

  const handleCreate = async () => {
    if (!fTitle.trim() || !fBody.trim()) return;
    if (audienceMode !== 'all' && selectedDepartments.length === 0 && selectedRoles.length === 0) {
      showToast('حدد جهات الاستقبال (إدارات أو صلاحيات)');
      return;
    }

    const deptTargets = audienceMode === 'departments' || audienceMode === 'hybrid' ? selectedDepartments : [];
    const roleTargets = audienceMode === 'roles' || audienceMode === 'hybrid' ? selectedRoles : [];

    const employeeTargetsFromDept = deptTargets.length
      ? audienceEmployees
          .filter((emp) => deptTargets.includes(emp.department))
          .map((emp) => emp.employeeNo)
      : [];

    const explicitEmployeeTargets = audienceMode === 'hybrid' ? selectedEmployeeNos : [];
    const mergedEmployeeTargets = Array.from(new Set([...employeeTargetsFromDept, ...explicitEmployeeTargets]));

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mobile/circulars', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          action: 'create',
          type: fType,
          title: fTitle.trim(),
          body: fBody.trim(),
          priority: fPriority,
          source_dept: currentUserDept || undefined,
          expires_at: fExpires || undefined,
          target_roles: roleTargets,
          target_departments: deptTargets,
          target_employee_nos: mergedEmployeeTargets,
          target_count: mergedEmployeeTargets.length > 0 ? mergedEmployeeTargets.length : undefined,
          questions: fType === 'survey' && fQuestions.length > 0 ? fQuestions : undefined,
          attachments: fAttachments.length > 0 ? fAttachments : undefined,
        }),
      });
      if (res.ok) {
        showToast('تم إرسال المراسلة بنجاح');
        setShowForm(false);
        setFTitle(''); setFBody(''); setFExpires(''); setFQuestions([]); setFAttachments([]);
        resetAudience();
        void fetchAll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.detail === 'forbidden' ? 'ليس لديك صلاحية' : 'حدث خطأ في الإرسال');
      }
    } catch { showToast('تعذّر الإرسال'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المنشور؟')) return;
    const res = await fetch(`/api/auth/mobile/circulars?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    if (res.ok) { showToast('تم الحذف'); void fetchAll(); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-xl border border-green-500/30 bg-green-950/80 px-4 py-3 text-sm font-bold text-green-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            إدارة المراسلات والمناشير
          </h1>
          <p className="text-sm text-slate-400 mt-1">إرسال مناشير، إعلانات، واستبيانات لموظفي التطبيق النقال</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void fetchAll()} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-slate-600">
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            منشور جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: 'الكل', value: circulars.length, color: 'text-slate-300' },
          { label: 'استبيانات', value: circulars.filter(c => c.type === 'survey').length, color: 'text-cyan-300' },
          { label: 'عاجل', value: circulars.filter(c => c.priority === 'urgent').length, color: 'text-red-300' },
          { label: 'متوسط القراءة', value: circulars.length ? Math.round(circulars.reduce((s, c) => s + c.read_by.length, 0) / circulars.length) : 0, color: 'text-green-300' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">منشور / مراسلة جديدة</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">النوع</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_CONFIG) as CircularType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setFType(t)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      fType === t ? TYPE_CONFIG[t].color : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {TYPE_CONFIG[t].icon}
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">الأولوية</label>
              <div className="flex gap-2">
                {(['normal', 'high', 'urgent'] as Priority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setFPriority(p)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      fPriority === p
                        ? p === 'urgent' ? 'border-red-500 bg-red-500/20 text-red-300'
                          : p === 'high' ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p === 'normal' ? 'عادي' : p === 'high' ? 'عالي' : '🚨 عاجل'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-800/40 p-3">
              <label className="block text-xs font-bold text-slate-300">الفئة المستهدفة</label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'all', label: 'تعميم لكل الموظفين' },
                  { value: 'roles', label: 'حسب الصلاحيات' },
                  { value: 'departments', label: 'حسب الإدارات' },
                  { value: 'hybrid', label: 'مزيج (صلاحيات + إدارات + أفراد)' },
                ] as Array<{ value: AudienceMode; label: string }>).map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setAudienceMode(mode.value)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      audienceMode === mode.value
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {(audienceMode === 'roles' || audienceMode === 'hybrid') && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-2">استهداف حسب الصلاحيات</p>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => toggleValue(option.value, setSelectedRoles)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          selectedRoles.includes(option.value)
                            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(audienceMode === 'departments' || audienceMode === 'hybrid') && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-2">استهداف حسب الإدارة</p>
                  {loadingAudience ? (
                    <p className="text-xs text-slate-500">جارٍ تحميل الإدارات...</p>
                  ) : departments.length === 0 ? (
                    <p className="text-xs text-amber-300">تعذّر جلب الإدارات من بيانات الموظفين.</p>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) toggleValue(value, setSelectedDepartments);
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">اختر الإدارة من القائمة...</option>
                        {departments
                          .filter((dept) => !selectedDepartments.includes(dept))
                          .map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                      </select>
                      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                        {selectedDepartments.map((dept) => (
                          <button
                            key={dept}
                            onClick={() => toggleValue(dept, setSelectedDepartments)}
                            className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300"
                          >
                            {dept} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {audienceMode === 'hybrid' && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-2">استثناء/إضافة موظفين محددين</p>
                  <select
                    value=""
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) toggleValue(value, setSelectedEmployeeNos);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">اختر موظفاً للإضافة...</option>
                    {audienceEmployees.slice(0, 500).map((emp) => (
                      <option key={emp.employeeNo} value={emp.employeeNo}>
                        {emp.fullName || emp.employeeNo} - {emp.department}
                      </option>
                    ))}
                  </select>
                  {selectedEmployeeNos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedEmployeeNos.map((empNo) => (
                        <button
                          key={empNo}
                          onClick={() => toggleValue(empNo, setSelectedEmployeeNos)}
                          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-300"
                        >
                          {empNo} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">العنوان *</label>
              <input
                value={fTitle}
                onChange={e => setFTitle(e.target.value)}
                placeholder="عنوان المنشور..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">المحتوى *</label>
              <textarea
                value={fBody}
                onChange={e => setFBody(e.target.value)}
                rows={4}
                placeholder="نص المنشور أو الإعلان..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            {/* From Department (Read-only) + Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">من الإدارة (تلقائي)</label>
                <div className="w-full rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-sm text-slate-300 opacity-70 flex items-center">
                  <span>{currentUserDept || 'غير محدد'}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  value={fExpires}
                  onChange={e => setFExpires(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* File Attachments */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">المرفقات والصور (اختياري)</label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleAttachmentSelect}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white file:cursor-pointer"
              />
              {fAttachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fAttachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-slate-300">{file.name}</span>
                      <span className="text-slate-500">({Math.round(file.size / 1024)}KB)</span>
                      <button
                        onClick={() => setFAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Survey Questions */}
            {fType === 'survey' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-cyan-400">أسئلة الاستبيان</label>
                  <button onClick={addQuestion} className="flex items-center gap-1 rounded-lg bg-cyan-600/20 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30">
                    <Plus className="h-3 w-3" /> إضافة سؤال
                  </button>
                </div>
                {fQuestions.map((q, qi) => (
                  <div key={q.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">س{qi + 1}</span>
                      <input
                        value={q.text}
                        onChange={e => setFQuestions(prev => prev.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))}
                        placeholder="نص السؤال..."
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                      />
                      <select
                        value={q.type}
                        onChange={e => setFQuestions(prev => prev.map(x => x.id === q.id ? { ...x, type: e.target.value as SurveyQuestion['type'] } : x))}
                        className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="single">اختيار واحد</option>
                        <option value="multi">متعدد</option>
                        <option value="text">نص حر</option>
                        <option value="rating">تقييم (1-5)</option>
                      </select>
                      <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-300 p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {(q.type === 'single' || q.type === 'multi') && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-500">الخيارات (سطر لكل خيار)</p>
                        <textarea
                          value={(q.options || []).join('\n')}
                          onChange={e => setFQuestions(prev => prev.map(x => x.id === q.id ? { ...x, options: e.target.value.split('\n').filter(Boolean) } : x))}
                          rows={3}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => void handleCreate()}
                disabled={submitting || !fTitle.trim() || !fBody.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'جارٍ الإرسال...' : 'إرسال وإشعار الموظفين'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm text-slate-400 hover:text-white">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Circulars list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : circulars.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-16 text-center">
          <Mail className="mx-auto mb-3 h-12 w-12 text-slate-700" />
          <p className="text-slate-500 font-bold">لا توجد مناشير</p>
          <p className="text-sm text-slate-600 mt-1">اضغط "منشور جديد" لإرسال أول مراسلة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {circulars.map(c => {
            const tc = TYPE_CONFIG[c.type] || TYPE_CONFIG.announcement;
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/60">
                <div className="flex items-start gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tc.color}`}>
                    {tc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 border ${tc.color}`}>{tc.label}</span>
                      {c.priority === 'urgent' && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 border text-red-300 bg-red-500/10 border-red-500/30">🚨 عاجل</span>}
                    </div>
                    <p className="font-bold text-white text-sm">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.body.slice(0, 80)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>{new Date(c.created_at).toLocaleDateString('ar-SA')}</span>
                      {c.source_dept && <span>• {c.source_dept}</span>}
                      {c.target_roles && c.target_roles.length > 0 && (
                        <span>• صلاحيات: {c.target_roles.join('، ')}</span>
                      )}
                      {c.target_departments && c.target_departments.length > 0 && (
                        <span>• إدارات: {c.target_departments.join('، ')}</span>
                      )}
                      {c.target_employee_nos && c.target_employee_nos.length > 0 && (
                        <span>• أفراد: {c.target_employee_nos.length}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.target_count && c.target_count > 0 ? `${c.read_by.length} / ${c.target_count} قراءة` : `${c.read_by.length} قرأها`}
                      </span>
                      {c.type === 'survey' && c.responses && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <ClipboardCheck className="h-3 w-3" />
                          {c.responses.length} إجابة
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => void handleDelete(c.id)}
                      className="rounded-lg border border-red-900/40 bg-red-950/30 p-1.5 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 space-y-3">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.body}</p>

                    {Array.isArray((c as Circular & { attachments?: DraftAttachment[] }).attachments)
                      && (c as Circular & { attachments?: DraftAttachment[] }).attachments!.length > 0 && (
                      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                        <p className="text-xs text-slate-400 mb-2">المرفقات</p>
                        <div className="flex flex-wrap gap-2">
                          {(c as Circular & { attachments?: DraftAttachment[] }).attachments!.map((file, idx) => (
                            <a
                              key={`${c.id}-att-${idx}`}
                              href={file.data_url || '#'}
                              download={file.name}
                              target={file.data_url ? '_blank' : undefined}
                              rel={file.data_url ? 'noreferrer' : undefined}
                              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-indigo-500/50"
                            >
                              {file.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                        <p className="text-xs text-slate-400 mb-1">حالة الوارد</p>
                        <p className="text-sm font-bold text-emerald-300">
                          {c.target_count && c.target_count > 0
                            ? `${c.read_by.length} من ${c.target_count} استلم/قرأ`
                            : `${c.read_by.length} قراءة مسجلة`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                        <p className="text-xs text-slate-400 mb-1">نوع التوجيه</p>
                        <p className="text-sm font-bold text-slate-200">
                          {c.target_roles?.length || c.target_departments?.length || c.target_employee_nos?.length
                            ? 'موجه'
                            : 'تعميم شامل'}
                        </p>
                      </div>
                    </div>

                    {c.type === 'survey' && c.questions && c.questions.length > 0 && c.responses && c.responses.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          نتائج الاستبيان ({c.responses.length} مشارك)
                        </h4>
                        {c.questions.map(q => {
                          const answers = c.responses!.map(r => r.answers[q.id]).filter(Boolean);
                          const flat = answers.flatMap(a => Array.isArray(a) ? a : [a as string]);
                          const counts: Record<string, number> = {};
                          flat.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
                          return (
                            <div key={q.id} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                              <p className="text-xs font-bold text-slate-300 mb-2">{q.text}</p>
                              {q.type === 'text' ? (
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {answers.map((a, i) => (
                                    <p key={i} className="text-xs text-slate-400 border-r-2 border-slate-600 pr-2">{String(a)}</p>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([opt, cnt]) => (
                                    <div key={opt} className="flex items-center gap-2">
                                      <div className="flex-1 rounded-full bg-slate-700 h-2 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-cyan-500"
                                          style={{ width: `${Math.round((cnt / c.responses!.length) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-[11px] text-slate-300 w-20 truncate">{opt}</span>
                                      <span className="text-[11px] font-bold text-cyan-300 w-10 text-left">{cnt}</span>
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
