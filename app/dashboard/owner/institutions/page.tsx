'use client';
/**
 * /dashboard/owner/institutions
 * صفحة اعتماد مؤسسات جديدة — founder فقط
 * Wizard ثلاث خطوات: بيانات المؤسسة → الإدارات → المدير المؤسسي
 */
import React, { useEffect, useState } from 'react';
import {
  Building2, ChevronLeft, ChevronRight, Check, Copy,
  Users, Layers, UserPlus, RefreshCw, AlertCircle,
  CheckCircle2, Shield, Briefcase, Wrench, DollarSign,
  ShoppingCart, FolderKanban, MapPin, Cpu, Truck,
  FileText, Droplets, Package, Power, PowerOff,
} from 'lucide-react';

// ── أسماء الإدارات ─────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { code: 'HR',    label: 'الموارد البشرية',  icon: Users,       color: 'indigo'  },
  { code: 'FIN',   label: 'المالية',           icon: DollarSign,  color: 'emerald' },
  { code: 'PROC',  label: 'المشتريات',         icon: ShoppingCart,color: 'amber'   },
  { code: 'MAINT', label: 'الصيانة',           icon: Wrench,      color: 'orange'  },
  { code: 'PROJ',  label: 'المشاريع',          icon: FolderKanban,color: 'violet'  },
  { code: 'ASSET', label: 'الأصول',            icon: Package,     color: 'cyan'    },
  { code: 'GIS',   label: 'الجغرافيا / GIS',  icon: MapPin,      color: 'teal'    },
  { code: 'IT',    label: 'تقنية المعلومات',   icon: Cpu,         color: 'blue'    },
  { code: 'OPS',   label: 'العمليات',          icon: Briefcase,   color: 'rose'    },
  { code: 'CORR',  label: 'المراسلات',         icon: FileText,    color: 'slate'   },
  { code: 'FLEET', label: 'الأسطول',           icon: Truck,       color: 'yellow'  },
  { code: 'LEGAL', label: 'الشؤون القانونية',  icon: Shield,      color: 'red'     },
  { code: 'ADMIN', label: 'الإدارة العامة',    icon: Layers,      color: 'purple'  },
] as const;

const COLOR_MAP: Record<string, string> = {
  indigo:  'border-indigo-500/40  bg-indigo-500/10  text-indigo-300',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  amber:   'border-amber-500/40   bg-amber-500/10   text-amber-300',
  orange:  'border-orange-500/40  bg-orange-500/10  text-orange-300',
  violet:  'border-violet-500/40  bg-violet-500/10  text-violet-300',
  cyan:    'border-cyan-500/40    bg-cyan-500/10    text-cyan-300',
  teal:    'border-teal-500/40    bg-teal-500/10    text-teal-300',
  blue:    'border-blue-500/40    bg-blue-500/10    text-blue-300',
  rose:    'border-rose-500/40    bg-rose-500/10    text-rose-300',
  slate:   'border-slate-500/40   bg-slate-500/10   text-slate-300',
  yellow:  'border-yellow-500/40  bg-yellow-500/10  text-yellow-300',
  red:     'border-red-500/40     bg-red-500/10     text-red-300',
  purple:  'border-purple-500/40  bg-purple-500/10  text-purple-300',
};

// ── أنواع البيانات ──────────────────────────────────────────────────────────
interface Tenant {
  id: string; code: string; name: string;
  status: string; created_at: number;
  user_count: number; admin_count: number;
  enabled_departments: string[];
  first_admin_email: string;
}

interface CreatedResult {
  tenant: { id: string; code: string; name: string };
  admin:  { username: string; temp_password: string; email: string };
}

// ── مكون نسخ ────────────────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="text-slate-400 hover:text-white transition-colors p-1">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 gap-3">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <span className="font-mono text-sm text-white flex-1 truncate" dir="ltr">{value}</span>
      <CopyBtn value={value} />
    </div>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function InstitutionsPage() {
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState<CreatedResult | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── نموذج الخطوة ١ ────────────────────────────────────────────────────────
  const [orgName,  setOrgName]  = useState('');
  const [orgCode,  setOrgCode]  = useState('');
  const [plan,     setPlan]     = useState<'basic' | 'advanced' | 'enterprise'>('advanced');

  // ── الخطوة ٢ — الإدارات ──────────────────────────────────────────────────
  const [depts, setDepts] = useState<Set<string>>(new Set(['ADMIN', 'HR', 'FIN']));

  // ── الخطوة ٣ — المدير ────────────────────────────────────────────────────
  const [adminName,  setAdminName]  = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  function getToken() {
    return localStorage.getItem('auth_token') || '';
  }

  // تغيير حالة مؤسسة
  async function toggleStatus(t: Tenant) {
    setTogglingId(t.id);
    try {
      const newStatus = t.status === 'active' ? 'suspended' : 'active';
      const res = await fetch(`/api/auth/tenants/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) await loadTenants();
    } catch { /* صامت */ } finally { setTogglingId(null); }
  }

  // جلب قائمة المؤسسات
  async function loadTenants() {
    setListLoading(true);
    try {
      const res = await fetch('/api/auth/tenants', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTenants(data.tenants ?? []);
    } catch {
      // صامت — الصفحة تعمل بدون قائمة
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { loadTenants(); }, []);

  // تبديل إدارة في الخطوة ٢
  const toggleDept = (code: string) =>
    setDepts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // إرسال النموذج
  async function handleSubmit() {
    setError('');
    if (!orgName.trim())  { setError('أدخل اسم المؤسسة'); return; }
    if (!adminName.trim())  { setError('أدخل اسم المدير المؤسسي'); return; }
    if (!adminEmail.trim()) { setError('أدخل البريد الإلكتروني للمدير'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          org_name:            orgName.trim(),
          org_code:            orgCode.trim() || undefined,
          admin_name:          adminName.trim(),
          admin_email:         adminEmail.trim(),
          enabled_departments: Array.from(depts),
          plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'فشل الإنشاء'); return; }
      setResult(data);
      loadTenants();
    } catch {
      setError('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  // إعادة الضبط
  function reset() {
    setStep(1); setResult(null); setError('');
    setOrgName(''); setOrgCode(''); setPlan('advanced');
    setDepts(new Set(['ADMIN', 'HR', 'FIN']));
    setAdminName(''); setAdminEmail('');
  }

  const stepLabels = ['بيانات المؤسسة', 'الإدارات المفعّلة', 'المدير المؤسسي'];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">اعتماد المؤسسات</h1>
          <p className="text-sm text-slate-400">إنشاء مؤسسات جديدة وتفعيل إدارتها</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* ── Wizard ── */}
        <div className="xl:col-span-3">
          {/* شريط التقدم */}
          {!result && (
            <div className="flex items-center gap-2 mb-8">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done   = step > n;
                return (
                  <React.Fragment key={n}>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                        ${done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                          active ? 'bg-indigo-500 border-indigo-500 text-white' :
                                   'bg-transparent border-white/20 text-white/30'}`}>
                        {done ? <Check className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className={`text-sm hidden sm:block ${active ? 'text-white font-medium' : done ? 'text-emerald-400' : 'text-white/30'}`}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px ${done ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* ── نتيجة النجاح ── */}
          {result ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-bold text-emerald-300">تم إنشاء المؤسسة بنجاح</h2>
                  <p className="text-sm text-slate-400">{result.tenant.name}</p>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                <p className="text-xs text-slate-400 mb-3">بيانات دخول المدير المؤسسي — احتفظ بها في مكان آمن:</p>
                <CredRow label="اسم المستخدم" value={result.admin.username} />
                <CredRow label="كلمة المرور المؤقتة" value={result.admin.temp_password} />
                <CredRow label="البريد الإلكتروني" value={result.admin.email} />
                <CredRow label="رمز المؤسسة" value={result.tenant.code} />
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                اعتماد مؤسسة جديدة
              </button>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
              {/* ── الخطوة ١: بيانات المؤسسة ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white/90 mb-6">بيانات المؤسسة</h2>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">اسم المؤسسة *</label>
                    <input
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      placeholder="مثال: شركة النهر الصناعي"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">
                      رمز المؤسسة <span className="text-white/30">(اختياري — يُستخدم في صفحة الدخول)</span>
                    </label>
                    <input
                      value={orgCode}
                      onChange={e => setOrgCode(e.target.value)}
                      placeholder="مثال: nahr-co"
                      dir="ltr"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors font-mono"
                    />
                    <p className="text-[11px] text-white/25 mt-1.5">إذا تُرك فارغاً يُولَّد تلقائياً من اسم المؤسسة</p>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-2">الباقة</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['basic', 'advanced', 'enterprise'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setPlan(p)}
                          className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors
                            ${plan === p
                              ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                              : 'bg-transparent border-white/10 text-white/40 hover:text-white/60'}`}
                        >
                          {p === 'basic' ? 'أساسية' : p === 'advanced' ? 'متقدمة' : 'مؤسسية'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── الخطوة ٢: الإدارات ── */}
              {step === 2 && (
                <div>
                  <h2 className="text-base font-semibold text-white/90 mb-2">الإدارات المفعّلة</h2>
                  <p className="text-xs text-slate-500 mb-6">المدير المؤسسي يرى فقط الإدارات المفعّلة في لوحة تحكمه</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {DEPARTMENTS.map(({ code, label, icon: Icon, color }) => {
                      const active = depts.has(code);
                      return (
                        <button
                          key={code}
                          onClick={() => toggleDept(code)}
                          className={`relative flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all
                            ${active
                              ? COLOR_MAP[color] + ' border-opacity-60'
                              : 'bg-transparent border-white/8 text-white/30 hover:text-white/50 hover:border-white/15'}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="text-xs leading-tight">{label}</span>
                          {active && <Check className="w-3 h-3 absolute top-2 left-2" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-4">{depts.size} إدارة مفعّلة</p>
                </div>
              )}

              {/* ── الخطوة ٣: المدير ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white/90 mb-6">المدير المؤسسي</h2>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">الاسم الكامل *</label>
                    <input
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="مثال: أحمد محمد الأمين"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">البريد الإلكتروني *</label>
                    <input
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@company.com"
                      type="email"
                      dir="ltr"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors font-mono"
                    />
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-xs text-indigo-300/80 leading-relaxed">
                      سيُنشأ حساب تلقائياً بكلمة مرور مؤقتة تظهر لك بعد الإنشاء.
                      المدير المؤسسي يرى فقط مؤسسته ولا يمكنه الوصول لمؤسسات أخرى.
                    </p>
                  </div>
                </div>
              )}

              {/* رسالة الخطأ */}
              {error && (
                <div className="mt-5 flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* أزرار التنقل */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
                <button
                  onClick={() => { setError(''); setStep(s => Math.max(1, s - 1) as 1 | 2 | 3); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-colors
                    ${step === 1 ? 'invisible' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>

                {step < 3 ? (
                  <button
                    onClick={() => {
                      setError('');
                      if (step === 1 && !orgName.trim()) { setError('أدخل اسم المؤسسة'); return; }
                      setStep(s => (s + 1) as 2 | 3);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                  >
                    التالي
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    اعتماد المؤسسة
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── قائمة المؤسسات ── */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/70">المؤسسات المعتمدة</h2>
            <button onClick={loadTenants} className="text-white/30 hover:text-white/60 transition-colors" title="تحديث">
              <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pl-1">
            {listLoading ? (
              <div className="text-center py-10 text-white/20 text-sm">جاري التحميل...</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-10 text-white/20 text-sm">لا توجد مؤسسات بعد</div>
            ) : (
              tenants.map(t => (
                <div key={t.id} className={`border rounded-xl p-4 transition-colors ${
                  t.status === 'active'
                    ? 'bg-white/[0.03] border-white/8 hover:border-white/15'
                    : 'bg-red-950/10 border-red-500/15 hover:border-red-500/25'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 font-mono" dir="ltr">{t.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        t.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {t.status === 'active' ? 'نشطة' : 'موقوفة'}
                      </span>
                      <button
                        onClick={() => toggleStatus(t)}
                        disabled={togglingId === t.id}
                        title={t.status === 'active' ? 'تعطيل المؤسسة' : 'تفعيل المؤسسة'}
                        className={`p-1 rounded-lg transition-colors disabled:opacity-40 ${
                          t.status === 'active'
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {togglingId === t.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : t.status === 'active'
                            ? <PowerOff className="w-3.5 h-3.5" />
                            : <Power className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {t.user_count} مستخدم
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {t.enabled_departments?.length ?? 0} إدارة
                    </span>
                    <span>{new Date(t.created_at).toLocaleDateString('ar-LY')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
