'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, AlertCircle, AlertTriangle, Info, X, RefreshCw } from 'lucide-react';

const TENANT =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';
const BASE   = '/api/v1/integration';
const POLL_MS = 60_000; // re-check every 60s

interface NotifSummary {
  unread: number;
  critical: number;
  warning: number;
}

interface JoinInboxSummary {
  count: number;
}

interface NotifItem {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  module: string;
  title: string;
  message: string | null;
  ref_code: string | null;
  is_read: boolean;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  workflow: 'الاعتمادات', revenue: 'الإيرادات', contracts: 'العقود',
  inventory: 'المخزون', procurement: 'المشتريات', hr: 'الموارد البشرية', system: 'النظام',
};

const SEV_ICON = {
  critical: <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
  info:     <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
};

export function NotificationBell() {
  const [counts, setCounts]   = useState<NotifSummary>({ unread: 0, critical: 0, warning: 0 });
  const [joinInbox, setJoinInbox] = useState<JoinInboxSummary>({ count: 0 });
  const [items, setItems]     = useState<NotifItem[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadCounts = async (signal?: AbortSignal) => {
    try {
      const r = await fetch(`${BASE}/notifications/unread-count`, {
        headers: TENANT ? {'X-Tenant-ID': TENANT} : {},
        signal,
      });
      if (r.ok) setCounts(await r.json());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      /* silent */
    }
  };

  const loadJoinInboxCount = async (signal?: AbortSignal) => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || '') : '';
      if (!token) {
        setJoinInbox({ count: 0 });
        return;
      }
      const r = await fetch('/api/tenant-join-requests/inbox', {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (r.ok) {
        const data = await r.json();
        setJoinInbox({ count: Number(data?.count || 0) });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/notifications?is_resolved=false&limit=10`, { headers: {'X-Tenant-ID': TENANT} });
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadCounts(controller.signal);
    loadJoinInboxCount(controller.signal);
    const t = setInterval(() => {
      loadCounts(controller.signal);
      loadJoinInboxCount(controller.signal);
    }, POLL_MS);
    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, []);

  const handleOpen = async () => {
    setOpen(v => !v);
    if (!open) await loadItems();
  };

  const markRead = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`${BASE}/notifications/${id}/read`, { method: 'POST', headers: TENANT ? {'X-Tenant-ID': TENANT} : {} });
    setItems(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n));
    setCounts(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
  };

  const badgeColor = counts.critical > 0 ? 'bg-red-500' : counts.warning > 0 ? 'bg-amber-500' : 'bg-violet-500';
  const total = counts.unread + joinInbox.count;

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="relative p-2 hover:bg-slate-800 rounded-full transition-colors">
        <Bell className="w-5 h-5 text-slate-300" />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] ${badgeColor} text-white text-xs font-bold rounded-full flex items-center justify-center leading-none px-0.5`}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-400" />
              <span className="font-semibold text-slate-100 text-sm">الإشعارات</span>
              {total > 0 && <span className="px-1.5 py-0.5 bg-violet-600/30 text-violet-300 text-xs rounded-full">{total} جديد</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={e=>{e.stopPropagation();loadItems();}} className="p-1 text-slate-500 hover:text-slate-300">
                <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} />
              </button>
              <button onClick={()=>setOpen(false)} className="p-1 text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {(counts.critical > 0 || counts.warning > 0) && (
            <div className="flex gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-800">
              {counts.critical > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />{counts.critical} حرج
                </span>
              )}
              {counts.warning > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />{counts.warning} تحذير
                </span>
              )}
            </div>
          )}

          {joinInbox.count > 0 && (
            <div className="px-4 py-2 bg-emerald-900/20 border-b border-emerald-700/20 text-xs text-emerald-200 flex items-center justify-between">
              <span>طلبات انضمام إدارات بانتظار الموافقة: {joinInbox.count}</span>
              <Link href="/dashboard/admin-gateway/security/join-requests" onClick={() => setOpen(false)} className="text-emerald-300 hover:text-emerald-200">
                فتح الموافقات
              </Link>
            </div>
          )}

          {/* Items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">لا توجد إشعارات نشطة</p>
              </div>
            ) : (
              items.map(n => (
                <div key={n.id}
                  className={`p-3 hover:bg-slate-800/50 transition-colors ${!n.is_read ? 'bg-slate-800/20' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    {SEV_ICON[n.severity] || SEV_ICON.info}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-medium truncate ${n.is_read ? 'text-slate-400' : 'text-slate-200'}`}>{n.title}</p>
                        {!n.is_read && (
                          <button onClick={e=>markRead(n.id,e)} className="text-violet-400 hover:text-violet-300 text-xs flex-shrink-0">✓</button>
                        )}
                      </div>
                      {n.message && <p className="text-slate-500 text-xs mt-0.5 truncate">{n.message}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600 text-xs">{MODULE_LABELS[n.module] || n.module}</span>
                        {n.ref_code && <span className="text-slate-700 text-xs font-mono">{n.ref_code}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-800">
            <Link href="/dashboard/admin-gateway/notifications"
              onClick={()=>setOpen(false)}
              className="block w-full text-center text-xs text-violet-400 hover:text-violet-300 py-1">
              عرض كل الإشعارات ←
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
