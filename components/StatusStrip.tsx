'use client';

import { useEffect, useState } from 'react';
import { Bell, Clock, Activity } from 'lucide-react';

type SystemStatus = 'online' | 'partial' | 'offline' | 'loading';

export default function StatusStrip() {
  const [pending,       setPending]       = useState<number | null>(null);
  const [notifications, setNotifications] = useState<number | null>(null);
  const [sysStatus,     setSysStatus]     = useState<SystemStatus>('loading');
  const [lastSync,      setLastSync]      = useState<Date | null>(null);

  useEffect(() => {
    const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
    const h = tenantId ? { 'X-Tenant-ID': tenantId } : {};

    const fetchStats = async () => {
      let ok = 0; let total = 0;

      // Pending actions from approval summary
      try {
        total++;
        const r = await fetch('/api/v1/approval/summary', { headers: h });
        if (r.ok) {
          const d = await r.json();
          setPending(d.pending ?? 0);
          ok++;
        }
      } catch {}

      // Notification count from alerts summary
      try {
        total++;
        const r = await fetch('/api/v1/alerts/summary', { headers: h });
        if (r.ok) {
          const d = await r.json();
          setNotifications(d.total_alerts ?? 0);
          ok++;
        }
      } catch {}

      setLastSync(new Date());
      setSysStatus(ok === 0 ? 'offline' : ok < total ? 'partial' : 'online');
    };

    fetchStats();
  }, []);

  const syncLabel = lastSync
    ? `منذ ${Math.max(0, Math.floor((Date.now() - lastSync.getTime()) / 60000))} دقيقة`
    : 'جارٍ التحميل...';

  const statusLabel =
    sysStatus === 'online'  ? '● شغّال' :
    sysStatus === 'partial' ? '◐ جزئي — بعض الخدمات غير متاحة' :
    sysStatus === 'offline' ? '○ غير متاح' :
    '…';

  const statusColor =
    sysStatus === 'online'  ? 'text-emerald-400' :
    sysStatus === 'partial' ? 'text-amber-400'   :
    sysStatus === 'offline' ? 'text-rose-400'    :
    'text-slate-500';

  return (
    <div className="w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 bg-slate-800/40 border border-slate-700/50 rounded-xl px-6 py-3">

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Bell className="w-4 h-4 text-yellow-400" />
          <span>
            الإشعارات:{' '}
            <span className="text-white font-semibold">
              {notifications === null ? '—' : notifications}
            </span>
            {notifications === 0 && <span className="text-slate-500 text-sm mr-1">(لا توجد تنبيهات نشطة)</span>}
          </span>
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>
            إجراءات معلّقة:{' '}
            <span className="text-white font-semibold">
              {pending === null ? '—' : pending}
            </span>
            {pending === 0 && <span className="text-slate-500 text-sm mr-1">(لا إجراءات معلّقة)</span>}
          </span>
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>حالة النظام: <span className={`font-semibold ${statusColor}`}>{statusLabel}</span></span>
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-700"></div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>آخر تحديث: <span className="text-white font-semibold">{syncLabel}</span></span>
        </div>

      </div>
    </div>
  );
}
