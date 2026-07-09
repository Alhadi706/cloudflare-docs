'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Wallet, Wrench, Briefcase, FileText, Brain,
  ShoppingCart, Warehouse, BookOpen, CheckSquare, FileSignature,
  DollarSign, Truck, ClipboardList, Bell, Building2,
  MapPin, Activity, ChevronLeft, ZapOff, BarChart2, Upload, Layers, AlertTriangle,
  X, Crown,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGisEngine } from '@/store/gisEngine';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubModule {
  title: string;
  icon: React.ReactNode;
  description: string;
  href: string;
  badge?: string;
  pendingCount?: number;
  iconBg: string;
}

interface Department {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  accentBar: string;
  accentText: string;
  subModules: SubModule[];
  pendingCount: number;
  approvalCard?: { label: string; href: string; role?: string };
}

// ─── Department Data ──────────────────────────────────────────────────────────

const DEPARTMENTS_BASE = [
  {
    id: 'admin-affairs',
    name: 'الشؤون الإدارية',
    subtitle: 'الموظفون — المراسلات — العقود — الموافقات',
    icon: <Building2 className="w-7 h-7" />,
    accentBar: 'bg-blue-500',
    accentText: 'text-blue-300',
    approvalCard: { label: 'موافقات إدارية', href: '/dashboard/admin-gateway/workflow/approvals?role=admin_officer&dept=admin-affairs' },
    subModules: [
      { title: 'الموارد البشرية',      icon: <Users className="w-5 h-5 text-blue-400" />,          iconBg: 'bg-blue-900/40 border-blue-500/30',      description: 'الموظفون — الرواتب — الحضور — الإجازات',          href: '/dashboard/admin-gateway/hr/employees' },
      { title: 'الهيكل التنظيمي',     icon: <Building2 className="w-5 h-5 text-violet-400" />,     iconBg: 'bg-violet-900/40 border-violet-500/30',  description: 'تعيين مدراء الإدارات ورؤساء الأقسام والمشرفين',  href: '/dashboard/admin-gateway/org-structure', badge: 'جديد' },
      { title: 'الاتصالات الإدارية',  icon: <FileText className="w-5 h-5 text-sky-400" />,         iconBg: 'bg-sky-900/40 border-sky-500/30',         description: 'الصادر — الوارد — الداخلية — الأرشيف',            href: '/dashboard/admin-gateway/correspondence/incoming' },
      { title: 'الاعتماد والموافقات', icon: <CheckSquare className="w-5 h-5 text-violet-400" />,   iconBg: 'bg-violet-900/40 border-violet-500/30',   description: 'سير العمل — موافقات متعددة المستويات',            href: '/dashboard/admin-gateway/workflow', badge: 'حوكمة' },
      { title: 'العقود والمقاولون',   icon: <FileSignature className="w-5 h-5 text-green-400" />,  iconBg: 'bg-green-900/40 border-green-500/30',     description: 'سجل المقاولين — إدارة العقود',                    href: '/dashboard/admin-gateway/contracts' },
      { title: 'إدارة الأقسام والتسمية', icon: <Building2 className="w-5 h-5 text-indigo-400" />, iconBg: 'bg-indigo-900/40 border-indigo-500/30', description: 'تسمية الإدارات والأقسام، تعيين رؤساء الأقسام والمدراء', href: '/dashboard/admin-gateway/system', badge: 'إعداد' },
      { title: 'موافقات الانضمام',   icon: <Shield className="w-5 h-5 text-emerald-400" />,       iconBg: 'bg-emerald-900/40 border-emerald-500/30', description: 'اعتماد/رفض إضافة إدارة جديدة لنفس المؤسسة',      href: '/dashboard/admin-gateway/security/join-requests', badge: 'أمني' },
    ],
  },
  {
    id: 'finance',
    name: 'المالية',
    subtitle: 'الميزانيات — المحاسبة — الإيرادات — المشتريات',
    icon: <Wallet className="w-7 h-7" />,
    accentBar: 'bg-amber-500',
    accentText: 'text-amber-300',
    approvalCard: { label: 'موافقات مالية', href: '/dashboard/admin-gateway/workflow/approvals?role=finance_controller&dept=finance' },
    subModules: [
      { title: 'الميزانية والمصروفات', icon: <Wallet className="w-5 h-5 text-amber-400" />,        iconBg: 'bg-amber-900/40 border-amber-500/30',     description: 'الميزانيات — المصروفات — التخصيصات',             href: '/dashboard/admin-gateway/finance/budgets' },
      { title: 'المحاسبة المالية',    icon: <BookOpen className="w-5 h-5 text-indigo-400" />,      iconBg: 'bg-indigo-900/40 border-indigo-500/30',   description: 'دليل الحسابات — مراكز التكلفة — القيود',         href: '/dashboard/admin-gateway/accounting' },
      { title: 'الإيرادات والتحصيلات',icon: <DollarSign className="w-5 h-5 text-emerald-400" />,  iconBg: 'bg-emerald-900/40 border-emerald-500/30', description: 'الفواتير — التحصيلات — العملاء',                  href: '/dashboard/admin-gateway/revenue' },
      { title: 'المشتريات',            icon: <ShoppingCart className="w-5 h-5 text-orange-400" />, iconBg: 'bg-orange-900/40 border-orange-500/30',   description: 'الموردون — طلبات الشراء — أوامر الشراء',         href: '/dashboard/admin-gateway/procurement' },
    ],
  },
  {
    id: 'materials',
    name: 'إدارة المواد',
    subtitle: 'الأصول — المخزون — المركبات والمعدات',
    icon: <Warehouse className="w-7 h-7" />,
    accentBar: 'bg-teal-500',
    accentText: 'text-teal-300',
    approvalCard: { label: 'موافقات المواد', href: '/dashboard/admin-gateway/workflow/approvals?role=supervisor&dept=materials' },
    subModules: [
      { title: 'إدارة الأصول',         icon: <Shield className="w-5 h-5 text-teal-400" />,         iconBg: 'bg-teal-900/40 border-teal-500/30',       description: 'سجل الأصول — الفئات — التقييمات',                 href: '/dashboard/admin-gateway/assets/registry' },
      { title: 'المواقع التشغيلية',    icon: <MapPin className="w-5 h-5 text-emerald-400" />,       iconBg: 'bg-emerald-900/40 border-emerald-500/30', description: 'محطات — مرافق — مخازن — المواقع التشغيلية',       href: '/dashboard/admin-gateway/sites', badge: 'جديد' },
      { title: 'المخزون والمستودعات', icon: <Warehouse className="w-5 h-5 text-cyan-400" />,       iconBg: 'bg-cyan-900/40 border-cyan-500/30',       description: 'المستودعات — الأصناف — الاستلام والإصدار',        href: '/dashboard/admin-gateway/inventory' },
      { title: 'المركبات والمعدات',   icon: <Truck className="w-5 h-5 text-orange-400" />,         iconBg: 'bg-orange-900/40 border-orange-500/30',   description: 'سجل المركبات — التعيين للمشاريع — الوقود',        href: '/dashboard/admin-gateway/vehicles' },
    ],
  },
  {
    id: 'maintenance',
    name: 'الصيانة والمشاريع',
    subtitle: 'أوامر العمل — المشاريع الميدانية — مراقبة التنفيذ',
    icon: <Wrench className="w-7 h-7" />,
    accentBar: 'bg-rose-500',
    accentText: 'text-rose-300',
    approvalCard: { label: 'موافقات الصيانة', href: '/dashboard/admin-gateway/workflow/approvals?role=supervisor&dept=maintenance' },
    subModules: [
      { title: 'الصيانة والتشغيل',     icon: <Wrench className="w-5 h-5 text-rose-400" />,         iconBg: 'bg-rose-900/40 border-rose-500/30',       description: 'أوامر العمل — الصيانة الوقائية — الفرق',          href: '/dashboard/admin-gateway/maintenance/work-orders' },
      { title: 'بلاغات الأعطال',       icon: <AlertTriangle className="w-5 h-5 text-red-400" />,   iconBg: 'bg-red-900/40 border-red-500/30',         description: 'بلاغات الفريق الميداني — إنشاء أوامر عمل تلقائياً', href: '/dashboard/admin-gateway/fault-reports', badge: 'جديد' },
      { title: 'إدارة المشاريع',       icon: <Briefcase className="w-5 h-5 text-purple-400" />,    iconBg: 'bg-purple-900/40 border-purple-500/30',   description: 'المراحل — المهام — الوثائق — المواقع',             href: '/dashboard/admin-gateway/projects/list' },
      { title: 'مراقبة التنفيذ',      icon: <Activity className="w-5 h-5 text-cyan-400" />,        iconBg: 'bg-cyan-900/40 border-cyan-500/30',       description: 'نسب الإنجاز — المراحل — أداء المقاولين',          href: '/dashboard/admin-gateway/project-control', badge: 'مراقبة' },
    ],
  },
  {
    id: 'services',
    name: 'الذكاء والخدمات',
    subtitle: 'الذكاء الرقمي — التقارير — الخرائط — الإشعارات',
    icon: <Brain className="w-7 h-7" />,
    accentBar: 'bg-fuchsia-500',
    accentText: 'text-fuchsia-300',
    approvalCard: { label: 'مراجعات GIS', href: '/dashboard/admin-gateway/assets/reviews' },
    subModules: [
      { title: 'منصة الذكاء الرقمي', icon: <Brain className="w-5 h-5 text-fuchsia-400" />,        iconBg: 'bg-fuchsia-900/40 border-fuchsia-500/30', description: 'ذكاء الأصول — التحليلات — إدارة المخاطر',          href: '/dashboard/admin-gateway/platform-intelligence', badge: 'AI' },
      { title: 'التقارير الرسمية',    icon: <ClipboardList className="w-5 h-5 text-indigo-400" />, iconBg: 'bg-indigo-900/40 border-indigo-500/30',   description: 'تقارير تنفيذية — مالية — عمليات',                  href: '/dashboard/admin-gateway/reports' },
      { title: 'الذكاء المكاني',      icon: <MapPin className="w-5 h-5 text-teal-400" />,          iconBg: 'bg-teal-900/40 border-teal-500/30',       description: 'مراجعة واعتماد البيانات الجغرافية',               href: '/dashboard/admin-gateway/assets/reviews' },
      { title: 'مركز الإشعارات',      icon: <Bell className="w-5 h-5 text-violet-400" />,          iconBg: 'bg-violet-900/40 border-violet-500/30',   description: 'التنبيهات العاجلة — المهام المعلقة',               href: '/dashboard/admin-gateway/notifications' },
    ],
  },
  {
    id: 'corrosion',
    name: 'إدارة التآكل',
    subtitle: 'رصد التدهور — التحميل — التنبؤ — تحليل المخاطر',
    icon: <ZapOff className="w-7 h-7" />,
    accentBar: 'bg-orange-500',
    accentText: 'text-orange-300',
    subModules: [
      { title: 'تحميل بيانات التآكل', icon: <Upload className="w-5 h-5 text-orange-400" />,       iconBg: 'bg-orange-900/40 border-orange-500/30',   description: 'رفع ملفات CSV / XLS للقياسات الميدانية',          href: '/dashboard/admin-gateway/corrosion?tab=upload', badge: 'CSV/XLS' },
      { title: 'قائمة الأصول',        icon: <Layers className="w-5 h-5 text-amber-400" />,         iconBg: 'bg-amber-900/40 border-amber-500/30',     description: 'حالة التدهور — العمر المتبقي — التسارع',          href: '/dashboard/admin-gateway/corrosion?tab=assets' },
      { title: 'تحليل التآكل',        icon: <Activity className="w-5 h-5 text-red-400" />,         iconBg: 'bg-red-900/40 border-red-500/30',         description: 'رسوم بيانية — منحنى تدهور — شذوذات',              href: '/dashboard/admin-gateway/corrosion?tab=charts' },
      { title: 'مقارنة التنبؤ',       icon: <BarChart2 className="w-5 h-5 text-blue-400" />,       iconBg: 'bg-blue-900/40 border-blue-500/30',       description: 'التوقع مقابل الواقع — دقة النموذج — التعلم',      href: '/dashboard/admin-gateway/corrosion?tab=prediction', badge: 'AI' },
      { title: 'مستويات الخطر',       icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,   iconBg: 'bg-rose-900/40 border-rose-500/30',       description: 'تصنيف المخاطر — أعلى الأصول خطورة',              href: '/dashboard/admin-gateway/corrosion?tab=risk' },
    ],
  },
] as const;

type DeptGroup = {
  id: 'administrative' | 'financial' | 'technical' | 'planning';
  title: string;
  subtitle: string;
  ids: string[];
  ring: string;
  chip: string;
};

const DEPARTMENT_GROUPS: DeptGroup[] = [
  {
    id: 'administrative',
    title: 'الإدارات الإدارية',
    subtitle: 'الحوكمة، الموارد البشرية، الاتصالات، العقود',
    ids: ['admin-affairs'],
    ring: 'border-blue-400/25',
    chip: 'text-blue-200 bg-blue-500/10 border-blue-400/25',
  },
  {
    id: 'financial',
    title: 'الإدارات المالية',
    subtitle: 'الميزانيات، المحاسبة، الإيرادات، المشتريات',
    ids: ['finance'],
    ring: 'border-amber-400/25',
    chip: 'text-amber-200 bg-amber-500/10 border-amber-400/25',
  },
  {
    id: 'technical',
    title: 'الإدارات الفنية',
    subtitle: 'الأصول، المخزون، الذكاء المكاني، التآكل والتحليلات',
    ids: ['materials', 'services', 'corrosion'],
    ring: 'border-cyan-400/25',
    chip: 'text-cyan-200 bg-cyan-500/10 border-cyan-400/25',
  },
  {
    id: 'planning',
    title: 'إدارات التخطيط والتنفيذ',
    subtitle: 'الصيانة، المشاريع، ومراقبة التنفيذ',
    ids: ['maintenance'],
    ring: 'border-rose-400/25',
    chip: 'text-rose-200 bg-rose-500/10 border-rose-400/25',
  },
];

// ─── Sub-module card ───────────────────────────────────────────────────────────

function SubModCard({ mod }: { mod: SubModule }) {
  return (
    <Link
      href={mod.href}
      className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl transition-all hover:bg-white/10"
    >
      {mod.badge && (
        <span className="absolute top-2 left-2 rounded-full border border-slate-600 bg-slate-900/70 px-1.5 py-0.5 text-xs font-bold leading-none text-slate-200">
          {mod.badge}
        </span>
      )}
      {(mod.pendingCount ?? 0) > 0 && (
        <span className="absolute top-2 left-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white shadow-lg">
          {mod.pendingCount}
        </span>
      )}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${mod.iconBg}`}>
        {mod.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">{mod.title}</p>
        <p className="truncate text-xs text-slate-400">{mod.description}</p>
      </div>
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:-translate-x-0.5 group-hover:text-slate-300" />
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminGateway() {
  const router = useRouter();
  const gisStore = useGisEngine((s) => s as unknown as Record<string, unknown>);

  const [selectedDeptId, setSelectedDeptId]   = useState<string | null>(null);
  const [totalPending,   setTotalPending]      = useState(0);
  const [pendingByDept,  setPendingByDept]     = useState<Record<string, number>>({});
  const [joinPendingCount, setJoinPendingCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('needs_bootstrap') === '1') {
      router.replace('/dashboard/admin-gateway/system');
    }
  }, [router]);

  useEffect(() => {
    const tenantId =
      (typeof window !== 'undefined'
        ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id'))
        : null) ||
      'aaaaaaaa-0000-4000-a000-000000000001';

    const H = { 'X-Tenant-ID': tenantId };

    fetch('/api/v1/approval/summary', { headers: H })
      .then(r => r.json())
      .then((d: { totals?: { pending?: number }; pending_by_role?: Record<string, number> }) => {
        setTotalPending(d.totals?.pending ?? 0);
        const byRole = d.pending_by_role ?? {};
        setPendingByDept(prev => ({
          ...prev,
          'admin-affairs': (byRole.admin_officer ?? 0) + (byRole.admin_manager ?? 0),
        }));
      })
      .catch(() => {});

    fetch('/api/v1/approval/requests/pending?role=finance_controller', { headers: H })
      .then(r => r.json())
      .then((d: { pending?: unknown[] }) => {
        setPendingByDept(prev => ({ ...prev, finance: (d.pending ?? []).length }));
      })
      .catch(() => {});

    fetch('/api/v1/approval/requests/pending?role=supervisor', { headers: H })
      .then(r => r.json())
      .then((d: { pending?: Array<{ entity_type: string }> }) => {
        const items = d.pending ?? [];
        setPendingByDept(prev => ({
          ...prev,
          materials:   items.filter(i => ['stock_issue', 'purchase_request'].includes(i.entity_type)).length,
          maintenance: items.filter(i => ['contract', 'purchase_order'].includes(i.entity_type)).length,
        }));
      })
      .catch(() => {});

    fetch(`/api/v1/review/stats?tenant_id=${tenantId}`, { headers: H })
      .then(r => r.json())
      .then((d: { pending_gis?: number; pending_admin?: number }) => {
        setPendingByDept(prev => ({ ...prev, services: (d.pending_gis ?? 0) + (d.pending_admin ?? 0) }));
      })
      .catch(() => {});

    const authToken = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || '') : '';
    if (authToken) {
      fetch('/api/tenant-join-requests/inbox', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then(r => r.json())
        .then((d: { count?: number }) => {
          setJoinPendingCount(Number(d?.count ?? 0));
        })
        .catch(() => {});
    }
  }, []);

  async function handleSelectDept(id: string) {
    setSelectedDeptId(id);
    try {
      if (id === 'admin-affairs') { (gisStore.loadEmployees as (() => Promise<void>) | undefined)?.(); return; }
      if (id === 'finance')       { (gisStore.loadUnifiedGeojson as ((a: object) => Promise<void>) | undefined)?.({ department: 'finance' }); return; }
      if (id === 'maintenance')   {
        await Promise.all([
          (gisStore.loadProjects as (() => Promise<void>) | undefined)?.(),
          (gisStore.loadWorkOrders as (() => Promise<void>) | undefined)?.(),
        ]);
        return;
      }
      (gisStore.loadDepartmentInventory as (() => Promise<void>) | undefined)?.();
    } catch { /* non-fatal */ }
  }

  // Enrich departments with live pending counts
  const depts = DEPARTMENTS_BASE.map(dept => ({
    ...dept,
    pendingCount: pendingByDept[dept.id] ?? 0,
    subModules: dept.subModules.map(mod => ({
      ...mod,
      pendingCount:
        ('href' in mod && (mod.href as string).startsWith('/dashboard/admin-gateway/workflow') && totalPending > 0)
          ? totalPending
          : ('href' in mod && (mod.href as string).startsWith('/dashboard/admin-gateway/security/join-requests') && joinPendingCount > 0)
            ? joinPendingCount
            : undefined,
    })) as SubModule[],
  })) as Department[];

  const groupedDepts = DEPARTMENT_GROUPS.map(group => ({
    ...group,
    items: depts.filter(d => group.ids.includes(d.id)),
  })).filter(group => group.items.length > 0);

  const groupedIds = new Set(groupedDepts.flatMap(group => group.items.map(item => item.id)));
  const ungroupedDepts = depts.filter(d => !groupedIds.has(d.id));

  const selectedDept   = depts.find(d => d.id === selectedDeptId) ?? null;

  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col items-center justify-center gap-4">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/35 p-4 shadow-2xl backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-slate-900/40 text-indigo-300">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest text-slate-400">WAR ROOM ERP</p>
                <h1 className="text-xl font-bold text-white">بوابة الإدارة والحوكمة</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                {DEPARTMENTS_BASE.length} إدارات
              </span>
              <Link
                href="/dashboard/admin-gateway/gm-office"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-amber-200 font-semibold transition hover:bg-amber-500/25"
              >
                <Crown className="h-3.5 w-3.5" /> مكتب المدير العام
              </Link>
              <Link
                href="/dashboard/admin-gateway/my-dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-indigo-200 transition hover:bg-indigo-500/20"
              >
                <Activity className="h-3.5 w-3.5" /> لوحتي
              </Link>
            </div>
          </div>

          {totalPending > 0 && (
            <Link
              href="/dashboard/admin-gateway/workflow/approvals"
              className="mt-3 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm transition hover:bg-red-500/15"
            >
              <Bell className="h-4 w-4 shrink-0 animate-pulse text-red-300" />
              <p className="flex-1 font-semibold text-red-200">{totalPending} طلب موافقة بانتظار الإجراء</p>
              <ChevronLeft className="h-4 w-4 text-red-300" />
            </Link>
          )}
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        {!selectedDept ? (
          <>
            <div className="w-full">
              <DepartmentAssetInbox department="administrative" title="أصول الشؤون الإدارية" compact />
            </div>

            {/* Grouped department cards */}
            {groupedDepts.map(group => (
              <section key={group.id} className={`w-full rounded-3xl border bg-white/5 p-3.5 backdrop-blur-xl ${group.ring}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{group.title}</h3>
                    <p className="text-xs text-slate-400">{group.subtitle}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${group.chip}`}>
                    {group.items.length} إدارة
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {group.items.map(dept => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => void handleSelectDept(dept.id)}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 p-4 text-right shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/10"
                    >
                      <div className={`absolute inset-y-4 right-3.5 w-1 rounded-full ${dept.accentBar}`} />
                      <div className="flex flex-col gap-3 pr-4">
                        <div className="flex items-start justify-between">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-900/40 ${dept.accentText}`}>
                            {dept.icon}
                          </div>
                          {dept.pendingCount > 0 && (
                            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-200">
                              {dept.pendingCount}
                            </span>
                          )}
                        </div>
                        <div>
                          <h2 className={`text-base font-bold leading-tight ${dept.accentText}`}>{dept.name}</h2>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{dept.subtitle}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-xs text-slate-300">
                            {dept.subModules.length} وحدات
                          </span>
                          <span className="flex items-center gap-1 text-xs text-white/70">
                            دخول <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {ungroupedDepts.length > 0 && (
              <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xl">
                <h3 className="text-sm font-bold text-slate-100 mb-2">إدارات أخرى</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {ungroupedDepts.map(dept => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => void handleSelectDept(dept.id)}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 p-4 text-right shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/10"
                    >
                      <div className={`absolute inset-y-4 right-3.5 w-1 rounded-full ${dept.accentBar}`} />
                      <div className="flex flex-col gap-3 pr-4">
                        <div className="flex items-start justify-between">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-900/40 ${dept.accentText}`}>
                            {dept.icon}
                          </div>
                          {dept.pendingCount > 0 && (
                            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-200">
                              {dept.pendingCount}
                            </span>
                          )}
                        </div>
                        <div>
                          <h2 className={`text-base font-bold leading-tight ${dept.accentText}`}>{dept.name}</h2>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{dept.subtitle}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-xs text-slate-300">
                            {dept.subModules.length} وحدات
                          </span>
                          <span className="flex items-center gap-1 text-xs text-white/70">
                            دخول <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ── Sub-modules overlay ──────────────────────────────────────────── */
          <div className="w-full rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
            {/* Panel header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedDeptId(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="رجوع"
              >
                <X className="h-4 w-4" />
              </button>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-900/40 ${selectedDept.accentText}`}>
                {selectedDept.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`text-lg font-bold ${selectedDept.accentText}`}>{selectedDept.name}</h2>
                <p className="truncate text-xs text-slate-400">{selectedDept.subtitle}</p>
              </div>
              {selectedDept.pendingCount > 0 && (
                <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">
                  {selectedDept.pendingCount} معلق
                </span>
              )}
            </div>

            {/* Sub-modules */}
            <div className="grid gap-2 p-4 md:grid-cols-2">
              {selectedDept.subModules.map(mod => (
                <SubModCard key={mod.href} mod={mod} />
              ))}
            </div>

            {/* Approval link */}
            {selectedDept.approvalCard && (
              <div className="border-t border-white/10 px-4 pb-4 pt-3">
                <Link
                  href={selectedDept.approvalCard.href}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                >
                  <CheckSquare className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-100">{selectedDept.approvalCard.label}</p>
                    <p className="text-xs text-slate-400">
                      {selectedDept.pendingCount > 0
                        ? `${selectedDept.pendingCount} طلب بانتظار إجراء`
                        : 'لا توجد طلبات معلقة'}
                    </p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-slate-500" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
