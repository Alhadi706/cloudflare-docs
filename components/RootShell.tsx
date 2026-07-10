'use client';
/**
 * RootShell — conditionally renders Sidebar + Header.
 * Routes that match ISOLATED_PATHS get a plain full-screen wrapper.
 */
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ToastProvider from '@/components/ToastProvider';
import { OperationalContextSync } from '@/components/OperationalContextSync';
import GlobalMapBackground from '@/components/GlobalMapBackground';

const ISOLATED_PATHS = ['/', '/entry', '/m', '/owner', '/operations-maintenance-demo'];

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const dashboardIsolated = pathname.startsWith('/dashboard');
  const passThroughToMap = pathname === '/dashboard';
  const isAdminGateway = pathname.startsWith('/dashboard/admin-gateway') &&
                          !pathname.startsWith('/dashboard/admin-gateway/maintenance');
  const isolated = ISOLATED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (dashboardIsolated) {
    return (
      <ToastProvider>
        <OperationalContextSync />
        {/* الخريطة كطبقة صفرية دائمة — z-0 */}
          {/* GIS workspace pages and maintenance page have their own map engine — exclude from background map */}
          {!pathname.startsWith('/dashboard/gis-sovereignty') &&
           !pathname.startsWith('/dashboard/admin-gateway/maintenance') &&
           <GlobalMapBackground />}

        {/* المحتوى فوق الخريطة — z-10 وما فوق */}
        <div className={`${(passThroughToMap || isAdminGateway) ? 'pointer-events-none' : 'pointer-events-auto'} flex flex-col h-screen w-full overflow-y-auto relative`} style={{ zIndex: 10 }}>
          {children}
        </div>
      </ToastProvider>
    );
  }

  if (isolated) {
    // No chrome — allow natural document scroll
    return (
      <div className="w-screen min-h-screen bg-black">
        {children}
      </div>
    );
  }

  return (
    <ToastProvider>
      <OperationalContextSync />
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 flex flex-col min-h-screen relative z-10">
        <Header />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </ToastProvider>
  );
}
