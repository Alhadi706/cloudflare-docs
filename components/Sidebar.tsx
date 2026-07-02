"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Bot, Globe2, Building2,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Activity, Layers, Briefcase, Scale, Users, Cpu,
  ShoppingCart, Heart, Leaf, Wrench, Megaphone, Banknote,
  Target, Settings, Award, Shield, GraduationCap, Eye,
  HardHat, Fuel, MapPin, LayoutDashboard,
} from 'lucide-react';
import { useActivatedDepartments, sidebarDepts, type ActivatedDept } from '@/store/activatedDepartments';
import { useUserStore } from '@/store/useUserStore';
import { canAccessPathForScope, normalizeAppScope } from '@/lib/appScope';

// ── Icon map: catalog ui_icon → Lucide component ─────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  'landmark':        <Building2 className="w-4 h-4 shrink-0" />,
  'wrench':          <Wrench className="w-4 h-4 shrink-0" />,
  'heart-handshake': <Heart className="w-4 h-4 shrink-0" />,
  'map':             <MapPin className="w-4 h-4 shrink-0" />,
  'scale':           <Scale className="w-4 h-4 shrink-0" />,
  'id-card':         <Briefcase className="w-4 h-4 shrink-0" />,
  'shield-check':    <Shield className="w-4 h-4 shrink-0" />,
  'cpu':             <Cpu className="w-4 h-4 shrink-0" />,
  'users':           <Users className="w-4 h-4 shrink-0" />,
  'shopping-cart':   <ShoppingCart className="w-4 h-4 shrink-0" />,
  'activity':        <Activity className="w-4 h-4 shrink-0" />,
  'leaf':            <Leaf className="w-4 h-4 shrink-0" />,
  'hard-hat':        <HardHat className="w-4 h-4 shrink-0" />,
  'megaphone':       <Megaphone className="w-4 h-4 shrink-0" />,
  'banknote':        <Banknote className="w-4 h-4 shrink-0" />,
  'building':        <Building2 className="w-4 h-4 shrink-0" />,
  'target':          <Target className="w-4 h-4 shrink-0" />,
  'settings':        <Settings className="w-4 h-4 shrink-0" />,
  'award':           <Award className="w-4 h-4 shrink-0" />,
  'shield':          <Shield className="w-4 h-4 shrink-0" />,
  'graduation-cap':  <GraduationCap className="w-4 h-4 shrink-0" />,
  'eye':             <Eye className="w-4 h-4 shrink-0" />,
  'briefcase':       <Briefcase className="w-4 h-4 shrink-0" />,
  'fuel':            <Fuel className="w-4 h-4 shrink-0" />,
};

function deptIcon(icon: string): React.ReactNode {
  return ICON_MAP[icon] ?? <LayoutDashboard className="w-4 h-4 shrink-0" />;
}

function deptRoute(dept: ActivatedDept): string {
  if (dept.frontend_route) return dept.frontend_route;
  const code = dept.department_code.toLowerCase().replace('dept_', '');
  return `/dashboard/departments/${code}`;
}

function departmentToPack(dept: ActivatedDept): 'engineering' | 'administration' | 'finance' | 'executive' | null {
  const code = (dept.department_code ?? '').toLowerCase();
  const name = `${dept.name_ar ?? ''} ${dept.custom_name_ar ?? ''}`.toLowerCase();

  if (code.includes('eng') || code.includes('gis') || name.includes('هندس')) return 'engineering';
  if (code.includes('fin') || name.includes('مالي')) return 'finance';
  if (code.includes('exec') || name.includes('تنفيذي')) return 'executive';
  if (code.includes('admin') || name.includes('إدار')) return 'administration';
  return null;
}

// ── Static nav items (Phase 2: unified — no map-shell pack links) ─────────────

const STATIC_NAV = [
  { href: '/dashboard',                          icon: <Home   className="w-5 h-5 shrink-0" />, label: 'الرئيسية' },
  { href: '/dashboard/ai-assistant',             icon: <Bot    className="w-5 h-5 shrink-0" />, label: 'المساعد الذكي' },
  { href: '/dashboard/gis-sovereignty',          icon: <Globe2 className="w-5 h-5 shrink-0" />, label: 'الجغرافيا والخرائط' },
];

// Admin-only static items (shown below dept list)
const ADMIN_STATIC_NAV = [
  { href: '/dashboard/spatial-analytics',        icon: <Layers    className="w-5 h-5 shrink-0" />, label: 'التحليلات المكانية' },
  { href: '/dashboard/system-explorer',          icon: <Activity  className="w-5 h-5 shrink-0" />, label: 'مراقبة النظام' },
  { href: '/dashboard/admin-gateway',            icon: <Building2 className="w-5 h-5 shrink-0" />, label: 'إعدادات النظام' },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ className }: { className?: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deptsOpen, setDeptsOpen] = useState(true);
  const pathname = usePathname();
  const { current: currentUser } = useUserStore();
  const [appScope, setAppScope] = useState<string>('all');

  useEffect(() => {
    setAppScope(normalizeAppScope(localStorage.getItem('launch_app') || process.env.NEXT_PUBLIC_APP_SCOPE || ''));
  }, []);

  const { departments, loading } = useActivatedDepartments();
  // Phase 2: dept routing uses deptRoute directly — no map-shell pack mapping
  const visible = sidebarDepts(departments).filter((dept) => {
    const route = deptRoute(dept);
    return canAccessPathForScope(route, appScope);
  });
  const isAdmin =
    currentUser?.role === 'super_admin' ||
    !!currentUser?.roles?.includes('admin') ||
    !!currentUser?.roles?.includes('super_admin');
  const isSupervisorOrAbove =
    isAdmin ||
    ['supervisor', 'section_manager', 'dept_manager', 'site_manager',
     'project_manager', 'hr_manager', 'finance_manager', 'tenant_admin']
      .some(r => currentUser?.role === r || !!currentUser?.roles?.includes(r));
  // ── Scope-aware nav items ─────────────────────────────────────────────────
  // The app-scope isolation principle:
  //   appScope = 'all'  → user has full platform access (super_admin / tenant_admin)
  //                        → show all static nav items gated by role
  //   appScope = anything else → user is in a departmental app
  //                        → show ONLY: Home + AI Assistant
  //                          (dept items come from the dynamic activated-depts list)
  //                          GIS and system tools are platform-level, not dept-level
  //
  // This respects the "each department feels like its own application" principle.
  const isDeptScope = appScope !== 'all';

  // GM Office: only super_admin / tenant_admin AND full-platform scope
  const gmNavItem = (isAdmin && !isDeptScope)
    ? { href: '/dashboard/admin-gateway/gm-office', icon: <Award className="w-5 h-5 shrink-0" />, label: 'مكتب المدير العام', highlight: true }
    : null;

  // Static nav per scope:
  // - Full platform (scope=all): Home + AI + GIS
  // - Departmental scope: Home + AI only (no cross-dept GIS/system tools)
  const scopedStaticNav = isDeptScope
    ? [
        { href: '/dashboard',              icon: <Home className="w-5 h-5 shrink-0" />, label: 'الرئيسية' },
        { href: '/dashboard/ai-assistant', icon: <Bot  className="w-5 h-5 shrink-0" />, label: 'المساعد الذكي' },
      ]
    : STATIC_NAV;

  const topNavItems = [
    ...(gmNavItem ? [gmNavItem] : []),
    ...scopedStaticNav,
  ].filter((item) => canAccessPathForScope(item.href.split('?')[0], appScope));

  // Admin system tools: only for full-platform admins (not dept scope)
  const bottomNavItems = (isAdmin && !isDeptScope ? ADMIN_STATIC_NAV : [])
    .filter((item) => canAccessPathForScope(item.href.split('?')[0], appScope));

  // Keep navItems alias for backward-compat with render below
  const navItems = topNavItems;

  return (
    <aside
      className={`relative ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-950 border-l border-slate-800 flex flex-col h-screen transition-all duration-300 z-50 shrink-0 hidden md:flex ${className ?? ''}`}
      dir="rtl"
    >
      {/* Logo */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-center h-20">
        {!isCollapsed ? (
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Digital</span>
            <span className="text-xs text-slate-400 tracking-widest uppercase mt-1">Sovereignty Force</span>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg text-lg">D</div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-[-16px] top-6 w-8 h-8 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 z-50 shadow-md transition-colors"
      >
        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden mt-4">
        {/* ── Static links ── */}
        {navItems.map((item) => (
          (() => {
            const hrefPath = item.href.split('?')[0];
            const isActive = hrefPath === '/'
              ? pathname === '/'
              : pathname?.startsWith(hrefPath);
            return (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
            active={isActive}
            highlight={'highlight' in item ? (item as any).highlight : false}
          />
            );
          })()
        ))}

        {/* ── Activated departments section ── */}
        {!isCollapsed && visible.length > 0 && (
          <div className="pt-3">
            <button
              onClick={() => setDeptsOpen(!deptsOpen)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors rounded-lg"
            >
              <span className="uppercase tracking-widest font-semibold">الإدارات المفعلة</span>
              <span className="flex items-center gap-1">
                <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">{visible.length}</span>
                {deptsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>

            {deptsOpen && (
              <div className="mt-1 space-y-0.5">
                {visible.map((dept) => (
                  <DeptNavItem
                    key={dept.department_code}
                    dept={dept}
                    pathname={pathname ?? ''}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed: show dept icons without section header */}
        {isCollapsed && visible.length > 0 && (
          <div className="pt-2 border-t border-slate-800/50 mt-2 space-y-0.5">
            {visible.map((dept) => (
              <DeptNavItem
                key={dept.department_code}
                dept={dept}
                pathname={pathname ?? ''}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !isCollapsed && (
          <div className="pt-3 space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Admin / system tools (bottom of nav, admin-only) ── */}
        {bottomNavItems.length > 0 && (
          <div className="pt-3 border-t border-slate-800/50 mt-2 space-y-0.5">
            {!isCollapsed && (
              <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">إدارة النظام</p>
            )}
            {bottomNavItems.map((item) => {
              const hrefPath = item.href.split('?')[0];
              const isActive = pathname?.startsWith(hrefPath) ?? false;
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isCollapsed={isCollapsed}
                  active={isActive}
                  highlight={false}
                />
              );
            })}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-slate-800 mt-auto flex justify-center">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 w-full'}`}>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-base font-bold shrink-0 shadow-inner">A</div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-base font-medium text-slate-200 truncate">Administrator</p>
              <p className="text-sm text-slate-500 truncate">admin@d-me.ly</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Nav item components ───────────────────────────────────────────────────────

function NavItem({
  href, icon, label, isCollapsed, active, highlight,
}: {
  href: string; icon: React.ReactNode; label: string;
  isCollapsed: boolean; active?: boolean; highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <span
        title={isCollapsed ? label : undefined}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative min-w-0 overflow-hidden
          ${active
            ? 'bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]'
            : highlight
              ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-700/30 hover:bg-cyan-900/40 hover:text-cyan-200'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
      >
        <span className={`${active ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : highlight ? 'text-cyan-400' : 'group-hover:text-blue-400'} transition-colors`}>
          {icon}
        </span>
        {!isCollapsed && <span className="font-medium truncate text-sm min-w-0">{label}</span>}
        {active && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-l-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
        )}
      </span>
    </Link>
  );
}

function DeptNavItem({
  dept, pathname, isCollapsed,
}: {
  dept: ActivatedDept; pathname: string; isCollapsed: boolean;
}) {
  // Phase 2: use deptRoute directly — no map-shell pack mapping
  const route = deptRoute(dept);
  const active = pathname.startsWith(route);
  const displayName = dept.custom_name_ar ?? dept.name_ar;

  return (
    <Link href={route}>
      <span
        title={isCollapsed ? displayName : undefined}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group text-sm
          ${active
            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
            : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
          }`}
      >
        <span
          className="shrink-0 transition-colors"
          style={{ color: active ? undefined : dept.ui_color }}
        >
          {deptIcon(dept.ui_icon)}
        </span>
        {!isCollapsed && (
          <span className="truncate">{displayName}</span>
        )}
        {!isCollapsed && dept.status === 'pending_manager' && (
          <span className="mr-auto shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-400 opacity-70" title="في انتظار تعيين المدير" />
        )}
      </span>
    </Link>
  );
}

