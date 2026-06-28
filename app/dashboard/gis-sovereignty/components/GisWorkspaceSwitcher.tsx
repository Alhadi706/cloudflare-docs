'use client';

import { usePathname } from 'next/navigation';

const WORKSPACES = [
  { key: 'satellite', label: 'الفضائي', href: '/dashboard/gis-sovereignty/satellite-intelligence-center' },
  { key: 'engineering', label: 'الهندسي', href: '/dashboard/gis-sovereignty/engineering-workspace' },
  { key: 'maintenance', label: 'الصيانة', href: '/dashboard/gis-sovereignty/maintenance-workspace' },
  { key: 'executive', label: 'التنفيذي', href: '/dashboard/gis-sovereignty/command-center' },
  { key: 'remote_sensing', label: 'الاستشعار عن بُعد', href: '/dashboard/gis-sovereignty/remote-sensing-center' },
];

export function GisWorkspaceSwitcher() {
  const pathname = usePathname();

  const navigateHard = (href: string) => {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('__nav', String(Date.now()));
    window.location.assign(url.toString());
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 p-1">
      {WORKSPACES.map((ws) => {
        const active = pathname?.startsWith(ws.href);
        return (
          <button
            key={ws.key}
            type="button"
            onClick={() => navigateHard(ws.href)}
            className={[
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800',
            ].join(' ')}
          >
            {ws.label}
          </button>
        );
      })}
    </div>
  );
}
