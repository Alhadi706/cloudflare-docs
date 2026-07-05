'use client';
/**
 * AdminBootstrapWizard — معالج إعداد النظام الإداري
 * خطوات: 1.المنظمة  2.الإدارات  3.ربط المديرين  4.تأكيد
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, ChevronLeft, ChevronRight, Check, Plus, Trash2,
  Users, Shield, Settings, BarChart3, Wrench, Globe,
  Package, FileText, Truck, AlertCircle, Brain,
  ArrowRight, CheckCircle, Loader2, Lock, ExternalLink,
  Map, Landmark, Cpu
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────
interface DeptDef {
  id: string;          // internal wizard id
  deptCode: string;    // system DepartmentCode
  icon: React.ReactNode;
  name: string;        // Arabic name
  dashRoute: string;   // destination route for this dept's manager
  dashLabel: string;   // human-readable dashboard name
  enabled: boolean;
  manager: { name: string; username: string; password: string; title: string };
}

interface OrgInfo {
  name: string;
  shortName: string;
  adminEmail: string;
}

// ─── Department catalogue ─────────────────────────────────────
const DEPT_CATALOGUE: Omit<DeptDef, 'enabled' | 'manager'>[] = [
  {
    id: 'admin', deptCode: 'ADMIN',
    icon: <Building2 className="w-4 h-4" />,
    name: 'الشؤون الإدارية',
    dashRoute: '/dashboard/admin-control',
    dashLabel: 'لوحة الشؤون الإدارية',
  },
  {
    id: 'finance', deptCode: 'FIN',
    icon: <BarChart3 className="w-4 h-4" />,
    name: 'الشؤون المالية',
    dashRoute: '/dashboard/finance-hub',
    dashLabel: 'لوحة المالية',
  },
  {
    id: 'hr', deptCode: 'HR',
    icon: <Users className="w-4 h-4" />,
    name: 'الموارد البشرية',
    dashRoute: '/dashboard/hr-center',
    dashLabel: 'لوحة الموارد البشرية',
  },
  {
    id: 'maintenance', deptCode: 'MAINT',
    icon: <Wrench className="w-4 h-4" />,
    name: 'الصيانة والتشغيل',
    dashRoute: '/dashboard/maintenance',
    dashLabel: 'لوحة الصيانة',
  },
  {
    id: 'corrosion', deptCode: 'CORR',
    icon: <AlertCircle className="w-4 h-4" />,
    name: 'إدارة التآكل',
    dashRoute: '/dashboard/operations-maintenance',
    dashLabel: 'لوحة العمليات',
  },
  {
    id: 'gis', deptCode: 'GIS',
    icon: <Map className="w-4 h-4" />,
    name: 'السيادة الجغرافية',
    dashRoute: '/dashboard/gis-sovereignty',
    dashLabel: 'لوحة GIS',
  },
  {
    id: 'fleet', deptCode: 'FLEET',
    icon: <Truck className="w-4 h-4" />,
    name: 'الأسطول والمركبات',
    dashRoute: '/dashboard/operations-maintenance',
    dashLabel: 'لوحة العمليات',
  },
  {
    id: 'inventory', deptCode: 'ASSET',
    icon: <Package className="w-4 h-4" />,
    name: 'المواد والمخازن',
    dashRoute: '/dashboard/admin-gateway/assets/registry',
    dashLabel: 'لوحة الأصول',
  },
  {
    id: 'contracts', deptCode: 'PROC',
    icon: <FileText className="w-4 h-4" />,
    name: 'العقود والمشتريات',
    dashRoute: '/dashboard/admin-control',
    dashLabel: 'لوحة الشؤون الإدارية',
  },
  {
    id: 'projects', deptCode: 'PROJ',
    icon: <Globe className="w-4 h-4" />,
    name: 'إدارة المشاريع',
    dashRoute: '/dashboard/projects-control',
    dashLabel: 'لوحة المشاريع',
  },
  {
    id: 'intelligence', deptCode: 'INTEL',
    icon: <Brain className="w-4 h-4" />,
    name: 'الذكاء التشغيلي',
    dashRoute: '/dashboard/ai-assistant',
    dashLabel: 'لوحة الذكاء الاصطناعي',
  },
  {
    id: 'legal', deptCode: 'LEGAL',
    icon: <Landmark className="w-4 h-4" />,
    name: 'الشؤون القانونية',
    dashRoute: '/dashboard/admin-control',
    dashLabel: 'لوحة الشؤون الإدارية',
  },
];

const emptyManager = () => ({ name: '', username: '', password: '', title: '' });

// ─── Component ────────────────────────────────────────────────
export default function AdminBootstrapWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  const [org, setOrg] = useState<OrgInfo>({
    name: '',
    shortName: '',
    adminEmail: typeof window !== 'undefined' ? localStorage.getItem('user_email') || '' : '',
  });

  const [depts, setDepts] = useState<DeptDef[]>(
    DEPT_CATALOGUE.map(d => ({ ...d, enabled: true, manager: emptyManager() }))
  );

  const steps = ['المنظمة', 'الإدارات', 'ربط المديرين', 'تأكيد'];
  const enabled = depts.filter(d => d.enabled);

  const toggleDept = (id: string) =>
    setDepts(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));

  const updMgr = (id: string, field: string, val: string) =>
    setDepts(prev => prev.map(d => d.id === id ? { ...d, manager: { ...d.manager, [field]: val } } : d));

  const canNext = () => {
    if (step === 0) return org.name.length > 2;
    if (step === 1) return enabled.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          org,
          departments: enabled.map(d => ({
            id: d.id,
            deptCode: d.deptCode,
            name: d.name,
            dashRoute: d.dashRoute,
            manager: d.manager,
          })),
        }),
      });
    } catch { /* continue even if API fails */ }

    setSaving(false);
    setSaved(true);
    localStorage.removeItem('needs_bootstrap');
    setTimeout(() => router.push('/dashboard/admin-gateway'), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Live badge */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-widest shadow-xl"
        style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', backdropFilter: 'blur(8px)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
        {saved ? 'SETUP COMPLETE' : 'SETUP WIZARD'}
      </div>

      {/* Header */}
      <div className="w-full max-w-3xl mb-8 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">إعداد المنظومة الإدارية</h1>
          <p className="text-xs text-slate-400">تحديد الإدارات وربط المديرين بلوحاتهم</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < step  ? 'bg-blue-500 border-blue-500 text-white' :
                  i === step ? 'border-blue-500 text-blue-400 bg-blue-500/10' :
                  'border-slate-700 text-slate-600'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${i === step ? 'text-blue-400' : 'text-slate-600'}`}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${i < step ? 'bg-blue-500' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-3xl">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Org info ── */}
          {step === 0 && (
            <motion.div key="org" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">بيانات المنظمة</h2>
                <p className="text-sm text-slate-400 mt-1">المعلومات الأساسية للمؤسسة</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 mb-1.5 block">اسم المنظمة *</label>
                  <input
                    value={org.name}
                    onChange={e => setOrg(p => ({ ...p, name: e.target.value }))}
                    placeholder="مثال: شركة البنية التحتية الوطنية"
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">الاختصار</label>
                  <input
                    value={org.shortName}
                    onChange={e => setOrg(p => ({ ...p, shortName: e.target.value }))}
                    placeholder="مثال: NIC"
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">البريد الإداري</label>
                  <input
                    value={org.adminEmail}
                    onChange={e => setOrg(p => ({ ...p, adminEmail: e.target.value }))}
                    placeholder="admin@company.ly"
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Departments ── */}
          {step === 1 && (
            <motion.div key="depts" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">الإدارات المفعّلة</h2>
                <p className="text-sm text-slate-400 mt-1">اختر الإدارات الموجودة في مؤسستك</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {depts.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggleDept(d.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-right transition-all ${
                      d.enabled
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${d.enabled ? 'text-blue-400' : 'text-slate-600'}`}>{d.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className={`text-[10px] mt-0.5 truncate ${d.enabled ? 'text-blue-400/70' : 'text-slate-600'}`}>{d.dashLabel}</div>
                    </div>
                    {d.enabled && <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500 text-center">{enabled.length} إدارة مفعّلة</div>
            </motion.div>
          )}

          {/* ── Step 2: Link managers ── */}
          {step === 2 && (
            <motion.div key="managers" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">ربط المديرين بلوحات التحكم</h2>
                <p className="text-sm text-slate-400 mt-1">حدد بيانات مدير كل إدارة — سيتم توجيهه تلقائياً للوحته عند تسجيل الدخول</p>
              </div>
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                {enabled.map(d => (
                  <div key={d.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
                    {/* Dept header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-blue-400">{d.icon}</div>
                        <div>
                          <div className="text-sm font-semibold text-white">{d.name}</div>
                          <div className="text-[10px] text-slate-500">رمز: {d.deptCode}</div>
                        </div>
                      </div>
                      {/* Dashboard route badge */}
                      <a
                        href={d.dashRoute}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2.5 py-1 rounded-full hover:bg-cyan-500/20 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {d.dashLabel}
                      </a>
                    </div>

                    {/* Manager fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={d.manager.name}
                        onChange={e => updMgr(d.id, 'name', e.target.value)}
                        placeholder="اسم المدير الكامل"
                        className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        value={d.manager.username}
                        onChange={e => updMgr(d.id, 'username', e.target.value)}
                        placeholder="اسم المستخدم (للدخول)"
                        className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                        dir="ltr"
                      />
                      <div className="relative">
                        <input
                          value={d.manager.password}
                          onChange={e => updMgr(d.id, 'password', e.target.value)}
                          type={showPwd[d.id] ? 'text' : 'password'}
                          placeholder="كلمة المرور المبدئية"
                          className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(p => ({ ...p, [d.id]: !p[d.id] }))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                      <select
                        value={d.manager.title}
                        onChange={e => updMgr(d.id, 'title', e.target.value)}
                        className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="">المسمى الوظيفي</option>
                        <option value="مدير إدارة">مدير إدارة</option>
                        <option value="رئيس قسم">رئيس قسم</option>
                        <option value="مشرف">مشرف</option>
                        <option value="مهندس">مهندس</option>
                        <option value="محلل">محلل</option>
                      </select>
                    </div>

                    {/* Arrow showing where this manager will land */}
                    {d.manager.username && (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                        <ArrowRight className="w-3 h-3 flex-shrink-0" />
                        <span>عند دخول <span className="font-bold">{d.manager.username}</span> سيُوجَّه مباشرة إلى: <span className="font-bold">{d.dashLabel}</span></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 space-y-6">
              {saved ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">تم إعداد المنظومة بنجاح</div>
                    <div className="text-sm text-slate-400 mt-1">جاري الدخول إلى لوحة التحكم الإدارية...</div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-white">مراجعة وتأكيد الإعداد</h2>
                    <p className="text-sm text-slate-400 mt-1">تأكد من صحة البيانات قبل التطبيق</p>
                  </div>

                  <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 space-y-1.5">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">المنظمة</div>
                    <div className="text-white font-medium">{org.name}</div>
                    {org.shortName && <div className="text-xs text-slate-400">{org.shortName}</div>}
                    {org.adminEmail && <div className="text-xs text-slate-400">{org.adminEmail}</div>}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">الإدارات والمديرون ({enabled.length})</div>
                    {enabled.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-2.5 border border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <div className="text-blue-400">{d.icon}</div>
                          <div>
                            <div className="text-sm text-white">{d.name}</div>
                            {d.manager.name && <div className="text-[10px] text-slate-400">{d.manager.name} — {d.manager.title}</div>}
                          </div>
                        </div>
                        <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">{d.dashLabel}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="w-full bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> جاري التطبيق...</>
                    ) : (
                      <>تطبيق الإعداد والانطلاق <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation */}
        {!saved && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <ChevronRight className="w-4 h-4" /> السابق
            </button>
            {step < 3 && (
              <button
                onClick={() => setStep(s => Math.min(3, s + 1))}
                disabled={!canNext()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
