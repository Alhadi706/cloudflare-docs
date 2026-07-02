'use client';
/**
 * GmOfficeTabBar — Phase 7
 * ════════════════════════════════════════════════════════════════
 * Persistent tab navigation shown at the top of all GM Office pages.
 * Renders as a sticky bar with 5 tabs that link between:
 *   1. لوحة القيادة     /dashboard/gm-office
 *   2. الإحاطة التنفيذية /dashboard/admin-gateway/intelligence/briefing
 *   3. إدارة المخاطر     /dashboard/admin-gateway/intelligence/risk
 *   4. التوقعات          /dashboard/admin-gateway/intelligence/forecast
 *   5. تحليل الأداء      /dashboard/admin-gateway/intelligence/performance
 */
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, FileText, AlertTriangle, TrendingUp, Activity } from 'lucide-react';

const TABS = [
  {
    key: 'dashboard',
    label: 'لوحة القيادة',
    icon: Crown,
    href: '/dashboard/gm-office',
    matchPaths: ['/dashboard/gm-office', '/dashboard/admin-gateway/gm-office'],
  },
  {
    key: 'briefing',
    label: 'الإحاطة التنفيذية',
    icon: FileText,
    href: '/dashboard/admin-gateway/intelligence/briefing',
    matchPaths: ['/dashboard/admin-gateway/intelligence/briefing'],
  },
  {
    key: 'risk',
    label: 'إدارة المخاطر',
    icon: AlertTriangle,
    href: '/dashboard/admin-gateway/intelligence/risk',
    matchPaths: ['/dashboard/admin-gateway/intelligence/risk'],
  },
  {
    key: 'forecast',
    label: 'التوقعات',
    icon: TrendingUp,
    href: '/dashboard/admin-gateway/intelligence/forecast',
    matchPaths: ['/dashboard/admin-gateway/intelligence/forecast'],
  },
  {
    key: 'performance',
    label: 'تحليل الأداء',
    icon: Activity,
    href: '/dashboard/admin-gateway/intelligence/performance',
    matchPaths: ['/dashboard/admin-gateway/intelligence/performance'],
  },
] as const;

export default function GmOfficeTabBar() {
  const pathname = usePathname() || '';

  return (
    <div
      className="sticky top-0 z-30 w-full border-b border-amber-500/20 bg-[#080d1a]/95 backdrop-blur-sm"
      dir="rtl"
    >
      {/* Office header strip */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/40 flex items-center justify-center">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">مكتب المدير العام</span>
      </div>

      {/* Tab row */}
      <div className="flex items-end gap-0 overflow-x-auto px-2 pb-0">
        {TABS.map((tab) => {
          const isActive = tab.matchPaths.some(p => pathname === p || pathname.startsWith(p));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap
                transition-all border-b-2 -mb-px
                ${isActive
                  ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-800/30'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
