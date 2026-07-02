'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useGisEngine } from '@/store/gisEngine';
import { clearServerSession } from '@/lib/client-auth-session';
import { LogOut, User, Shield } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();

  // ── User context from localStorage ───────────────────────────────────────
  const [userName, setUserName]   = useState('');
  const [deptCode, setDeptCode]   = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem('user_name') || localStorage.getItem('user_email') || '');
    setDeptCode(localStorage.getItem('dept_code') || '');
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    localStorage.clear();
    await clearServerSession();
    router.push('/entry');
  };
  const passThroughToMap = pathname === '/dashboard';
  // Hub page (/dashboard/admin-gateway/maintenance exact) should behave like
  // other admin-gateway pages — only sub-pages need GIS workspace treatment.
  const isAdminGateway = pathname.startsWith('/dashboard/admin-gateway') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/');
  const isGisWorkspace = (pathname.startsWith('/dashboard/gis-sovereignty/') &&
                         !pathname.startsWith('/dashboard/gis-sovereignty/manager')) ||
                         (pathname.startsWith('/dashboard/admin-gateway/maintenance/') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/preventive') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/admin') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/work-orders') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/spare-parts') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/teams') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/executive'));
  const setBasemap   = useGisEngine((s) => s.setBasemap);
  const setWorkspace = useGisEngine((s) => s.setWorkspace);
  const setCenter    = useGisEngine((s) => s.setCenter);
  const setZoom      = useGisEngine((s) => s.setZoom);

  useEffect(() => {
    setBasemap('satellite');
    setWorkspace('satellite');
    setCenter([17.00, 26.00]);
    setZoom(5);
  }, [setBasemap, setWorkspace, setCenter, setZoom]);

  useEffect(() => {
    // Redirect to installer only during explicit bootstrap flow.
    // Normal users should be able to enter dashboard routes directly.
    if (localStorage.getItem('needs_bootstrap') === '1') {
      router.replace('/entry/install');
    }
  }, [router]);

  // Hide legacy global sidebar on all dashboard routes (new vertical dept list replaces it)
  const hideLegacySidebar = pathname.startsWith('/dashboard');

  // Hide topbar on the main /dashboard page (it has its own full-screen UI)
  // and on GIS workspace pages (full-screen map)
  const showTopBar = !passThroughToMap && !isGisWorkspace;

  // Dept display name map
  const DEPT_LABELS: Record<string, string> = {
    CORR: 'مكافحة التآكل', MAINT: 'الصيانة', FIN: 'المالية',
    HR: 'الموارد البشرية', GIS: 'نظم المعلومات', PROJ: 'المشاريع',
    OPS: 'العمليات', ASSET: 'الأصول', PROC: 'المشتريات',
    CTRL: 'التحكم', ENG: 'الهندسة', FLEET: 'الأسطول',
    IT: 'تقنية المعلومات', ADMIN: 'الشؤون الإدارية', LEGAL: 'الشؤون القانونية',
  };

  return (
    <div className="flex flex-col flex-1 w-full min-h-0 overflow-hidden" dir="rtl">

      {/* ── Persistent top bar ─────────────────────────────────────────── */}
      {showTopBar && (
        <div
          className="shrink-0 flex items-center justify-between px-4 h-11 z-50 pointer-events-auto"
          style={{
            background: 'rgba(6, 12, 28, 0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Left: brand + dept badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-300 hidden sm:block">DSF</span>
            {deptCode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 font-medium">
                {DEPT_LABELS[deptCode] ?? deptCode}
              </span>
            )}
          </div>

          {/* Right: user name + logout */}
          <div className="flex items-center gap-3">
            {userName && (
              <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs truncate max-w-[140px]">{userName}</span>
              </div>
            )}
            <button
              onClick={logout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className={`${(passThroughToMap || isAdminGateway) ? 'pointer-events-none' : 'pointer-events-auto'} flex flex-1 w-full min-h-0 overflow-hidden flex-row-reverse`}>
        {!hideLegacySidebar && <Sidebar />}
        <main className={`${isGisWorkspace ? 'overflow-hidden' : 'overflow-y-auto h-full'} ${(passThroughToMap || isAdminGateway) ? 'pointer-events-none' : 'pointer-events-auto'} flex-1 min-h-0 bg-transparent`}>{children}</main>
      </div>
    </div>
  );
}
