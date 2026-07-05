'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Warehouse, Wallet, ArrowUpRight, Wrench, Activity, Globe2, Cpu, Briefcase, ZapOff, Users, Package, ShoppingCart, Shield, Bell, Calendar, FileText, BarChart2, MapPin, ChevronDown, ChevronLeft, UserCircle, HardHat, Atom, ChevronRight, Smartphone, Radio, Crown, Truck } from 'lucide-react';
import { useActivatedDepartments, sidebarDepts, type ActivatedDept } from '@/store/activatedDepartments';
import { canAccessPathForScope, getDefaultRouteForScope, normalizeAppScope } from '@/lib/appScope';
import { clearServerSession } from '@/lib/client-auth-session';

interface QuickAction {
  key?: string;
  title: string;
  href: string;
  icon: typeof Building2;
  desc: string;
  source?: 'core' | 'backend';
  deptCategory?: string;
  departmentCode?: string;
}

const coreActions: QuickAction[] = [
  {
    title: 'الإدارة والحوكمة',
    href: '/dashboard/admin-gateway',
    icon: Building2,
    desc: 'البوابة الإدارية وإدارة الحوكمة المؤسسية.',
  },
  {
    title: 'المالية والمشتريات',
    href: '/dashboard/admin-gateway/finance',
    icon: Wallet,
    desc: 'الميزانيات والمحاسبة والمشتريات.',
  },
  {
    title: 'العقود والمقاولون',
    href: '/dashboard/admin-gateway/contracts',
    icon: FileText,
    desc: 'إدارة العقود والمقاولين والتتبع الجغرافي.',
  },
  {
    title: 'الموارد البشرية',
    href: '/dashboard/admin-gateway/hr/employees',
    icon: Users,
    desc: 'إدارة الموظفين والرواتب والحضور والإجازات.',
  },
  {
    title: 'الصيانة والعمليات',
    href: '/dashboard/admin-gateway/maintenance',
    icon: Wrench,
    desc: 'الممرات الميدانية وتحليل الأقمار الاصطناعية.',
  },
  {
    title: 'التقرير اليومي التشغيلي',
    href: '/dashboard/daily-operations',
    icon: Activity,
    desc: 'إدخال قراءات المحطات اليومية وتوليد تقارير التشغيل والتحليل.',
  },
  {
    title: 'أوامر العمل',
    href: '/dashboard/admin-gateway/maintenance/work-orders',
    icon: Activity,
    desc: 'إصدار ومتابعة أوامر العمل التصحيحية والوقائية.',
  },
  {
    title: 'الصيانة الوقائية',
    href: '/dashboard/admin-gateway/maintenance/preventive',
    icon: Calendar,
    desc: 'جدولة وإدارة برامج الصيانة الدورية.',
  },
  {
    title: 'إدارة التآكل',
    href: '/dashboard/admin-gateway/corrosion',
    icon: ZapOff,
    desc: 'تحليل الحماية الكاثودية CP ورصد التدهور والتنبؤ.',
  },
  {
    title: 'إدارة المشاريع',
    href: '/dashboard/admin-gateway/projects/list',
    icon: Briefcase,
    desc: 'المراحل والمهام والميزانيات ومتابعة التنفيذ.',
  },
  {
    title: 'إدارة الأصول',
    href: '/dashboard/admin-gateway/assets/registry',
    icon: Shield,
    desc: 'سجل الأصول والتصنيفات والتقييمات الميدانية.',
  },
  {
    title: 'المخزون والمستودعات',
    href: '/dashboard/admin-gateway/inventory',
    icon: Warehouse,
    desc: 'إدارة المستودعات والأصناف والاستلام والإصدار.',
  },
  {
    title: 'المشتريات',
    href: '/dashboard/admin-gateway/procurement',
    icon: ShoppingCart,
    desc: 'الموردون وطلبات الشراء وأوامر التوريد.',
  },
  {
    title: 'قطع الغيار',
    href: '/dashboard/admin-gateway/maintenance/spare-parts',
    icon: Package,
    desc: 'إدارة مخزون قطع الغيار ومستويات الحد الأدنى.',
  },
  {
    title: 'مركز القيادة',
    href: '/dashboard/command-center',
    icon: BarChart2,
    desc: 'لوحة القرار التشغيلي والمؤشرات الفورية.',
  },
  {
    title: 'السيادة الجغرافية',
    href: '/dashboard/gis-sovereignty/engineering-workspace',
    icon: Globe2,
    desc: 'مساحة العمل الهندسية والتحليل المكاني المتقدم.',
  },
  {
    title: 'التحليلات المكانية',
    href: '/dashboard/spatial-analytics',
    icon: MapPin,
    desc: 'التحليل المكاني المتقدم والذكاء الاصطناعي الجغرافي.',
  },
  {
    title: 'ذكاء الأصول',
    href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence',
    icon: Shield,
    desc: 'تحليل ذكي للأصول: الصحة والتقييم والتنبؤ بالأعطال.',
  },
  {
    title: 'الإشعارات والتنبيهات',
    href: '/dashboard/admin-gateway/notifications',
    icon: Bell,
    desc: 'التنبيهات العاجلة والمهام المعلقة.',
  },
  {
    title: 'المساعد الذكي',
    href: '/dashboard/ai-assistant',
    icon: Cpu,
    desc: 'استعلام وتحليل مباشر للبيانات باللغة العربية.',
  },
  {
    title: 'مراقبة النظام',
    href: '/dashboard/system-explorer',
    icon: Building2,
    desc: 'رصد حالة الوحدات والربط التقني للمنظومة.',
  },
];

function departmentToRoute(dept: ActivatedDept): string {
  if (dept.frontend_route) return dept.frontend_route;
  const code = (dept.department_code ?? '').toLowerCase();
  const name = `${dept.name_ar ?? ''} ${dept.custom_name_ar ?? ''}`.toLowerCase();

  if (code.includes('eng') || code.includes('gis') || name.includes('هندس')) return '/dashboard/map-shell?pack=engineering';
  if (code.includes('fin') || name.includes('مالي')) return '/dashboard/map-shell?pack=finance';
  if (code.includes('exec') || name.includes('تنفيذي')) return '/dashboard/map-shell?pack=executive';
  if (code.includes('admin') || name.includes('إدار')) return '/dashboard/map-shell?pack=administration';

  return `/dashboard/departments/${code.replace('dept_', '')}`;
}

function classifyBackendDepartment(dept: ActivatedDept): 'administrative' | 'financial' | 'technical' | 'planning' | 'other' {
  const category = String(dept.category ?? '').toLowerCase();
  const code = String(dept.department_code ?? '').toLowerCase();
  const label = `${dept.name_ar ?? ''} ${dept.custom_name_ar ?? ''}`.toLowerCase();

  if (
    category.includes('admin') ||
    category.includes('govern') ||
    code.includes('admin') ||
    label.includes('إدار') ||
    label.includes('حوكمة') ||
    label.includes('موارد')
  ) return 'administrative';

  if (
    category.includes('fin') ||
    category.includes('account') ||
    code.includes('fin') ||
    label.includes('مالي') ||
    label.includes('محاسب') ||
    label.includes('إيراد') ||
    label.includes('مشتري')
  ) return 'financial';

  if (
    category.includes('maint') ||
    category.includes('project') ||
    code.includes('maint') ||
    code.includes('project') ||
    label.includes('صيانة') ||
    label.includes('مشاريع') ||
    label.includes('تشغيل') ||
    label.includes('تخطيط')
  ) return 'planning';

  if (
    category.includes('tech') ||
    category.includes('engine') ||
    category.includes('gis') ||
    code.includes('eng') ||
    code.includes('gis') ||
    label.includes('فني') ||
    label.includes('هندس') ||
    label.includes('أصول') ||
    label.includes('تآكل')
  ) return 'technical';

  return 'other';
}

export default function DashboardHome() {
  const router = useRouter();
  const { departments } = useActivatedDepartments();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [appScope, setAppScope] = useState<string>('all');

  useEffect(() => {
    setAppScope(normalizeAppScope(localStorage.getItem('launch_app') || process.env.NEXT_PUBLIC_APP_SCOPE || ''));
  }, []);

  useEffect(() => {
    if (appScope === 'all') return;
    const target = getDefaultRouteForScope(appScope);
    if (target && target !== '/dashboard') {
      router.replace(target);
    }
  }, [appScope, router]);

  const logout = async () => {
    localStorage.clear();
    await clearServerSession();
    router.push('/entry');
  };

  const activeDepartments = sidebarDepts(departments).filter((dept) => {
    const route = departmentToRoute(dept);
    return canAccessPathForScope(route.split('?')[0], appScope);
  });
  const dynamicActions: QuickAction[] = activeDepartments.map((dept) => ({
    key: `dept-${dept.activation_id}-${dept.department_code}`,
    title: dept.custom_name_ar ?? dept.name_ar,
    href: departmentToRoute(dept),
    icon: Building2,
    desc: `الدخول إلى ${dept.custom_name_ar ?? dept.name_ar}`,
    source: 'backend',
    deptCategory: dept.category,
    departmentCode: dept.department_code,
  }));

  const coreMap = new Map<string, QuickAction>();
  coreActions
    .filter((item) => canAccessPathForScope(item.href.split('?')[0], appScope))
    .forEach((item) => {
    if (!coreMap.has(item.href)) coreMap.set(item.href, { ...item, source: 'core' });
    });
  const quickActions = [...Array.from(coreMap.values()), ...dynamicActions];

  const groupedActions = useMemo(() => {
    const groups: Record<'administrative' | 'financial' | 'technical' | 'planning' | 'other', QuickAction[]> = {
      administrative: [],
      financial: [],
      technical: [],
      planning: [],
      other: [],
    };

    for (const action of quickActions) {
      const href = action.href.toLowerCase();

      if (action.source === 'backend') {
        const cls = classifyBackendDepartment({
          activation_id: 0,
          catalog_id: 0,
          department_code: action.departmentCode || '',
          name_ar: action.title,
          name_en: null,
          category: action.deptCategory || '',
          ui_icon: '',
          ui_color: '',
          frontend_route: action.href,
          is_mandatory: null,
          status: 'active',
          manager_user_id: null,
          custom_name_ar: null,
          activated_by: '',
          display_order: 0,
        });
        groups[cls].push(action);
        continue;
      }

      if (
        href === '/dashboard/admin-gateway' ||
        href.includes('/hr') ||
        href.includes('/correspondence') ||
        href.includes('/contracts') ||
        href.includes('/workflow')
      ) {
        groups.administrative.push(action);
      } else if (
        href.includes('/finance') ||
        href.includes('/accounting') ||
        href.includes('/revenue') ||
        href.includes('/procurement')
      ) {
        groups.financial.push(action);
      } else if (
        href.includes('/assets') ||
        href.includes('/inventory') ||
        href.includes('/vehicles') ||
        href.includes('/corrosion') ||
        href.includes('/gis-sovereignty') ||
        href.includes('/system-explorer') ||
        href.includes('/ai-assistant')
      ) {
        groups.technical.push(action);
      } else if (
        href.includes('/maintenance') ||
        href.includes('/projects') ||
        href.includes('/project-control') ||
        href.includes('/command-center')
      ) {
        groups.planning.push(action);
      } else {
        groups.other.push(action);
      }
    }

    return [
      { key: 'administrative', title: 'الإدارات الإدارية', items: groups.administrative },
      { key: 'financial', title: 'الإدارات المالية', items: groups.financial },
      { key: 'technical', title: 'الإدارات الفنية', items: groups.technical },
      { key: 'planning', title: 'إدارات التخطيط والتنفيذ', items: groups.planning },
      { key: 'other', title: 'أخرى', items: groups.other },
    ].filter((g) => g.items.length > 0);
  }, [quickActions]);

  const totals = useMemo(() => {
    const values = groupedActions.map((group) => ({ key: group.key, title: group.title, count: group.items.length }));
    return {
      total: quickActions.length,
      values,
    };
  }, [groupedActions, quickActions.length]);

  return (
    <div className="pointer-events-auto relative min-h-screen overflow-hidden bg-slate-950/70 px-4 py-6 md:px-6" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_left,rgba(14,165,233,0.12),transparent_20%),linear-gradient(180deg,rgba(2,6,23,0.2),rgba(2,6,23,0.82))]" />

      <button
        type="button"
        onClick={logout}
        className="pointer-events-auto fixed top-4 left-4 z-30 rounded-xl border border-slate-300/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-900 backdrop-blur-xl transition-colors hover:bg-white"
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 30,
          border: '1px solid rgba(203, 213, 225, 0.75)',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.82)',
          color: '#0f172a',
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        تسجيل الخروج
      </button>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 pt-16">

        {/* ══ الإدارات الأساسية ══════════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          {/* إدارة الموارد البشرية */}
          <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/30">
                <Users className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <p className="text-xs text-blue-300 font-semibold">الإدارة الأولى</p>
                <h2 className="text-base font-black text-white">الموارد البشرية</h2>
              </div>
            </div>
            <Link href="/dashboard/hr-center/manager"
              className="rounded-xl border border-blue-400/40 bg-blue-800/30 px-3 py-2.5 text-xs font-bold text-blue-100 hover:bg-blue-700/30 hover:border-blue-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-blue-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'شؤون الموظفين',     href: '/dashboard/hr-center/personnel' },
                { label: 'التدريب والتطوير',   href: '/dashboard/hr-center/training' },
                { label: 'النظم والملاكات',    href: '/dashboard/hr-center/staffing' },
                { label: 'البيانات والإحصاء',  href: '/dashboard/hr-center/data' },
                { label: 'الشؤون الطبية',      href: '/dashboard/hr-center/medical' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-blue-500/20 bg-blue-900/20 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-800/30 hover:border-blue-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-blue-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/hr-center"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 py-2 text-sm font-bold text-blue-200 hover:bg-blue-500/20 transition-all">
              دخول إدارة الموارد البشرية <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة الصيانة */}
          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30">
                <HardHat className="h-5 w-5 text-orange-300" />
              </div>
              <div>
                <p className="text-xs text-orange-300 font-semibold">الإدارة الثانية</p>
                <h2 className="text-base font-black text-white">إدارة الصيانة</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'أوامر العمل',     href: '/dashboard/admin-gateway/maintenance/work-orders' },
                { label: 'فرق العمل',        href: '/dashboard/admin-gateway/maintenance/teams' },
                { label: 'الصيانة الوقائية', href: '/dashboard/admin-gateway/maintenance/preventive' },
                { label: 'قطع الغيار',       href: '/dashboard/admin-gateway/maintenance/spare-parts' },
                { label: 'الأصول',           href: '/dashboard/admin-gateway/assets/registry' },
                { label: 'المستودعات',       href: '/dashboard/admin-gateway/inventory' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-orange-500/20 bg-orange-900/20 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-800/30 hover:border-orange-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-orange-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/maintenance"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 py-2 text-sm font-bold text-orange-200 hover:bg-orange-500/20 transition-all">
              دخول إدارة الصيانة <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة التآكل */}
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/30">
                <Atom className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <p className="text-xs text-violet-300 font-semibold">الإدارة الثالثة</p>
                <h2 className="text-base font-black text-white">إدارة التآكل</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'الحماية الكاثودية', href: '/dashboard/admin-gateway/corrosion' },
                { label: 'أوامر العمل',        href: '/dashboard/admin-gateway/corrosion?tab=work-orders' },
                { label: 'المسوحات',           href: '/dashboard/admin-gateway/corrosion?tab=surveys' },
                { label: 'التنبؤات',           href: '/dashboard/admin-gateway/corrosion?tab=prediction' },
                { label: 'خط الزمن',          href: '/dashboard/admin-gateway/corrosion?tab=timeline' },
                { label: 'التقارير',           href: '/dashboard/admin-gateway/corrosion?tab=reports' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-violet-500/20 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-800/30 hover:border-violet-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-violet-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/corrosion"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 py-2 text-sm font-bold text-violet-200 hover:bg-violet-500/20 transition-all">
              دخول إدارة التآكل <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة التحكم */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                <Radio className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-cyan-300 font-semibold">الإدارة الرابعة</p>
                <h2 className="text-base font-black text-white">إدارة التحكم</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'المراقبة اللحظية',  href: '/dashboard/control-center/real-time' },
                { label: 'سجل الوردية',        href: '/dashboard/control-center/shift-log' },
                { label: 'إدارة الإنذارات',   href: '/dashboard/control-center/alarm-management' },
                { label: 'مناطق الضغط',       href: '/dashboard/control-center/pressure-zones' },
                { label: 'جدولة الإنتاج',     href: '/dashboard/control-center/production-schedule' },
                { label: 'SCADA الكامل',       href: '/dashboard/control-center/scada' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-900/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-800/30 hover:border-cyan-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-cyan-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/control-center"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/20 transition-all">
              دخول إدارة التحكم <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* ══ بوابة الموظف ════════════════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/my-portal"
            className="group rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/50 to-yellow-950/40 p-5 backdrop-blur-xl shadow-xl hover:border-amber-400/50 hover:from-amber-900/50 transition-all flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 group-hover:bg-amber-500/25 transition-all">
              <UserCircle className="h-7 w-7 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-300 font-semibold mb-0.5">بوابة الموظف</p>
              <h3 className="text-lg font-black text-white">أوامري — لوحتي الشخصية</h3>
              <p className="text-xs text-slate-400 mt-1">مهامك · إجازاتك · أوامر العمل المخصصة لك · إشعاراتك</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-amber-400 shrink-0 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link href="/m"
            className="group rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 to-teal-950/40 p-5 backdrop-blur-xl shadow-xl hover:border-emerald-400/50 hover:from-emerald-900/50 transition-all flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 group-hover:bg-emerald-500/25 transition-all">
              <Smartphone className="h-7 w-7 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-300 font-semibold mb-0.5">الميدان</p>
              <h3 className="text-lg font-black text-white">تطبيق الجوال الميداني</h3>
              <p className="text-xs text-slate-400 mt-1">واجهة مبسّطة للموظف الميداني · موقع التنفيذ · رفع الصور · إغلاق الأمر</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-emerald-400 shrink-0 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* ══ الإدارات الإضافية ══════════════════════════════════════════ */}
        <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase mt-2">الإدارات الأخرى</p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {/* إدارة المالية */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                <Wallet className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs text-emerald-300 font-semibold">الإدارة الخامسة</p>
                <h2 className="text-base font-black text-white">إدارة المالية</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/finance/manager"
              className="rounded-xl border border-emerald-400/40 bg-emerald-800/30 px-3 py-2.5 text-xs font-bold text-emerald-100 hover:bg-emerald-700/30 hover:border-emerald-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-emerald-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'الميزانيات',       href: '/dashboard/admin-gateway/finance/budgets' },
                { label: 'المصروفات',        href: '/dashboard/admin-gateway/finance/expenses' },
                { label: 'التحويلات',        href: '/dashboard/admin-gateway/finance/transfers' },
                { label: 'التقارير المالية', href: '/dashboard/admin-gateway/finance/reports' },
                { label: 'تتبع الأصول',      href: '/dashboard/admin-gateway/assets/valuations' },
                { label: 'التخصيصات',        href: '/dashboard/admin-gateway/finance/allocations' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-800/30 hover:border-emerald-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-emerald-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/finance"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 transition-all">
              دخول إدارة المالية <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة الأصول */}
          <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30">
                <Shield className="h-5 w-5 text-rose-300" />
              </div>
              <div>
                <p className="text-xs text-rose-300 font-semibold">الإدارة السادسة</p>
                <h2 className="text-base font-black text-white">إدارة الأصول</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/assets/manager"
              className="rounded-xl border border-rose-400/40 bg-rose-800/30 px-3 py-2.5 text-xs font-bold text-rose-100 hover:bg-rose-700/30 hover:border-rose-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-rose-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'سجل الأصول',        href: '/dashboard/admin-gateway/assets/registry' },
                { label: 'التصنيفات',          href: '/dashboard/admin-gateway/assets/categories' },
                { label: 'صيانة الأصول',      href: '/dashboard/admin-gateway/assets/maintenance' },
                { label: 'التقييمات',          href: '/dashboard/admin-gateway/assets/valuations' },
                { label: 'المراجعات الدورية',  href: '/dashboard/admin-gateway/assets/reviews' },
                { label: 'التصنيفات',          href: '/dashboard/admin-gateway/assets/categories' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-rose-500/20 bg-rose-900/20 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-800/30 hover:border-rose-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-rose-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/assets"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 py-2 text-sm font-bold text-rose-200 hover:bg-rose-500/20 transition-all">
              دخول إدارة الأصول <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة المواد والمشتريات والمخازن */}
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-500/30">
                <Package className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <p className="text-xs text-teal-300 font-semibold">الإدارة السابعة</p>
                <h2 className="text-base font-black text-white">المواد والمشتريات والمخازن</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/materials/manager"
              className="rounded-xl border border-teal-400/40 bg-teal-800/30 px-3 py-2.5 text-xs font-bold text-teal-100 hover:bg-teal-700/30 hover:border-teal-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-teal-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'طلبات المواد',    href: '/dashboard/admin-gateway/materials/requests' },
                { label: 'أوامر الشراء',     href: '/dashboard/admin-gateway/procurement/orders' },
                { label: 'المستودعات',       href: '/dashboard/admin-gateway/inventory/warehouses' },
                { label: 'الأصناف والمواد',  href: '/dashboard/admin-gateway/inventory/items' },
                { label: 'الموردون',        href: '/dashboard/admin-gateway/procurement/suppliers' },
                { label: 'الموافقات',       href: '/dashboard/admin-gateway/workflow/approvals?role=supervisor&dept=materials' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-teal-500/20 bg-teal-900/20 px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-800/30 hover:border-teal-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-teal-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/materials"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 py-2 text-sm font-bold text-teal-200 hover:bg-teal-500/20 transition-all">
              دخول إدارة المواد <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة المشاريع */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <Briefcase className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-xs text-amber-300 font-semibold">الإدارة الثامنة</p>
                <h2 className="text-base font-black text-white">إدارة المشاريع</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/projects/manager"
              className="rounded-xl border border-amber-400/40 bg-amber-800/30 px-3 py-2.5 text-xs font-bold text-amber-100 hover:bg-amber-700/30 hover:border-amber-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-amber-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'قائمة المشاريع',  href: '/dashboard/admin-gateway/projects/list' },
                { label: 'الجداول الزمنية', href: '/dashboard/admin-gateway/projects/milestones' },
                { label: 'الميزانيات',       href: '/dashboard/admin-gateway/projects/budget' },
                { label: 'الوثائق',          href: '/dashboard/admin-gateway/projects/documents' },
                { label: 'المواقع الميدانية',href: '/dashboard/admin-gateway/projects/sites' },
                { label: 'المهام',           href: '/dashboard/admin-gateway/projects/tasks' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-amber-500/20 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-800/30 hover:border-amber-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-amber-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/projects/list"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 transition-all">
              دخول إدارة المشاريع <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة الأسطول */}
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/30">
                <Truck className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <p className="text-xs text-sky-300 font-semibold">الإدارة التاسعة</p>
                <h2 className="text-base font-black text-white">إدارة الأسطول</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/fleet/manager"
              className="rounded-xl border border-sky-400/40 bg-sky-800/30 px-3 py-2.5 text-xs font-bold text-sky-100 hover:bg-sky-700/30 hover:border-sky-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-sky-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'السيارات والمركبات', href: '/dashboard/admin-gateway/fleet/vehicles' },
                { label: 'المعدات الثقيلة',    href: '/dashboard/admin-gateway/vehicles/equipment' },
                { label: 'استهلاك الوقود',     href: '/dashboard/admin-gateway/vehicles/fuel' },
                { label: 'متابعة الأسطول',     href: '/dashboard/admin-gateway/vehicles/vehicles' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-sky-500/20 bg-sky-900/20 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-800/30 hover:border-sky-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-sky-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/fleet"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2 text-sm font-bold text-sky-200 hover:bg-sky-500/20 transition-all">
              دخول إدارة الأسطول <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة المحاسبة */}
          <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-500/15 border border-yellow-500/30">
                <BarChart2 className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <p className="text-xs text-yellow-300 font-semibold">الإدارة العاشرة</p>
                <h2 className="text-base font-black text-white">إدارة المحاسبة</h2>
              </div>
            </div>
            <Link href="/dashboard/admin-gateway/accounting/manager"
              className="rounded-xl border border-yellow-400/40 bg-yellow-800/30 px-3 py-2.5 text-xs font-bold text-yellow-100 hover:bg-yellow-700/30 hover:border-yellow-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-yellow-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'دليل الحسابات',  href: '/dashboard/admin-gateway/accounting/chart-of-accounts' },
                { label: 'مراكز التكلفة',  href: '/dashboard/admin-gateway/accounting/cost-centers' },
                { label: 'القيود اليومية', href: '/dashboard/admin-gateway/accounting/journal-entries' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-yellow-500/20 bg-yellow-900/20 px-3 py-2 text-xs font-semibold text-yellow-100 hover:bg-yellow-800/30 hover:border-yellow-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-yellow-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/accounting"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 py-2 text-sm font-bold text-yellow-200 hover:bg-yellow-500/20 transition-all">
              دخول إدارة المحاسبة <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* إدارة GIS والسيادة الجغرافية */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-slate-950/80 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                <Globe2 className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-cyan-300 font-semibold">الإدارة الحادية عشرة</p>
                <h2 className="text-base font-black text-white">إدارة GIS</h2>
              </div>
            </div>
            <Link href="/dashboard/gis-sovereignty/manager"
              className="rounded-xl border border-cyan-400/40 bg-cyan-800/30 px-3 py-2.5 text-xs font-bold text-cyan-100 hover:bg-cyan-700/30 hover:border-cyan-400/60 transition-all flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                دخول مدير الإدارة
              </span>
              <ChevronLeft className="h-3 w-3 text-cyan-400 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: 'الاستخبارات الفضائية', href: '/dashboard/gis-sovereignty/satellite-intelligence-center' },
                { label: 'مساحة العمل الهندسية',  href: '/dashboard/gis-sovereignty/engineering-workspace' },
                { label: 'مركز القيادة الجغرافي', href: '/dashboard/gis-sovereignty/command-center' },
                { label: 'مساحة الصيانة',         href: '/dashboard/gis-sovereignty/maintenance-workspace' },
                { label: 'لوحة المشاريع',          href: '/dashboard/gis-sovereignty/erp-dashboard' },
                { label: 'التحليل المكاني',        href: '/dashboard/gis-sovereignty/spatial-analytics' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-900/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-800/30 hover:border-cyan-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-cyan-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/gis-sovereignty"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/20 transition-all">
              دخول السيادة الجغرافية <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* مكتب المدير العام */}
          <div className="xl:col-span-3 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-slate-950/80 to-amber-950/30 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40">
                <Crown className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-xs text-amber-300 font-semibold">الإدارة العليا</p>
                <h2 className="text-base font-black text-white">مكتب المدير العام</h2>
              </div>
              <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">لوحة تنفيذية</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'التقارير التنفيذية', href: '/dashboard/admin-gateway/reports/executive' },
                { label: 'الإيجاز التشغيلي',  href: '/dashboard/admin-gateway/intelligence/briefing' },
                { label: 'تقارير مالية',      href: '/dashboard/admin-gateway/reports/financial' },
                { label: 'تقارير العمليات',   href: '/dashboard/admin-gateway/reports/operations' },
                { label: 'توقعات الأداء',     href: '/dashboard/admin-gateway/intelligence/forecast' },
                { label: 'مركز القيادة',      href: '/dashboard/command-center' },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl border border-amber-500/20 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-800/30 hover:border-amber-400/40 transition-all flex items-center justify-between gap-1">
                  {item.label}
                  <ChevronLeft className="h-3 w-3 text-amber-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href="/dashboard/admin-gateway/gm-office"
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 transition-all">
              دخول مكتب المدير العام <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

        </div>

        {/* ══ أدوات ومسارات سريعة ════════════════════════════════════════ */}
        <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase mt-2">أدوات وأنظمة</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { title: 'السيادة الجغرافية (GIS)', href: '/dashboard/gis-sovereignty', icon: Globe2, desc: 'مركز الاستخبارات الفضائية والتحليل الجغرافي المتقدم' },
            { title: 'مركز القيادة',            href: '/dashboard/command-center',                         icon: BarChart2, desc: 'لوحة القرار التشغيلي والمؤشرات الفورية' },
            { title: 'المساعد الذكي',           href: '/dashboard/ai-assistant',                           icon: Cpu,       desc: 'استعلام وتحليل البيانات بالذكاء الاصطناعي' },
            { title: 'التقرير اليومي',          href: '/dashboard/daily-operations',                       icon: Activity,  desc: 'قراءات المحطات والتقارير التشغيلية اليومية' },
            { title: 'مراقبة النظام',           href: '/dashboard/system-explorer',                        icon: Building2, desc: 'حالة الوحدات والربط التقني للمنظومة' },
            { title: 'ذكاء الأصول',            href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence',     icon: Shield,    desc: 'تحليل الأصول والتنبؤ بالأعطال' },
            { title: 'العقود والمقاولون',       href: '/dashboard/admin-gateway/contracts',                icon: FileText,  desc: 'إدارة العقود والمقاولين' },
            { title: 'الإشعارات والتنبيهات',    href: '/dashboard/admin-gateway/notifications',            icon: Bell,      desc: 'التنبيهات العاجلة والمهام المعلقة' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className="group rounded-2xl border border-white/10 bg-slate-950/65 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-500/40 hover:bg-slate-900/90">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </div>
                <p className="mt-3 text-sm font-bold text-white">{item.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">{item.desc}</p>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}
