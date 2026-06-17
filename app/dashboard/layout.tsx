'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useGisEngine } from '@/store/gisEngine';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const passThroughToMap = pathname === '/dashboard';
  // Hub page (/dashboard/admin-gateway/maintenance exact) should behave like
  // other admin-gateway pages — only sub-pages need GIS workspace treatment.
  const isAdminGateway = pathname.startsWith('/dashboard/admin-gateway') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance/');
  const isGisWorkspace = pathname.startsWith('/dashboard/gis-sovereignty') ||
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

  return (
    /* الخريطة تأتي من GlobalMapBackground في RootShell (z-0) */
    <div className={`${(passThroughToMap || isAdminGateway) ? 'pointer-events-none' : 'pointer-events-auto'} flex flex-1 w-full min-h-0 overflow-hidden flex-row-reverse`}>
      {!hideLegacySidebar && <Sidebar />}
      {/* GIS workspaces need overflow-hidden; other pages allow scroll */}
      <main className={`${isGisWorkspace ? 'overflow-hidden' : 'overflow-y-auto h-full'} ${(passThroughToMap || isAdminGateway) ? 'pointer-events-none' : 'pointer-events-auto'} flex-1 min-h-0 bg-transparent`}>{children}</main>
    </div>
  );
}
