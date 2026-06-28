'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, RefreshCw, CheckCheck, AlertTriangle, AlertCircle, Info, Filter } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
const BASE   = '/api/v1/integration';

interface Notification {
  id: number;
  notification_type: string;
  severity: 'critical' | 'warning' | 'info';
  module: string;
  entity_type: string | null;
  entity_id: number | null;
  ref_code: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  workflow: 'الاعتمادات', revenue: 'الإيرادات', contracts: 'العقود',
  inventory: 'المخزون', procurement: 'المشتريات', hr: 'الموارد البشرية',
  system: 'النظام', projects: 'المشاريع',
};

const MODULE_LINKS: Record<string, string> = {
  workflow: '/dashboard/admin-gateway/workflow',
  revenue:  '/dashboard/admin-gateway/revenue',
  contracts:'/dashboard/admin-gateway/contracts',
  inventory:'/dashboard/admin-gateway/materials/inventory',
  procurement:'/dashboard/admin-gateway/materials/procurement',
  hr:       '/dashboard/admin-gateway/hr',
};

const SEV_CONFIG = {
  critical: { bg: 'bg-red-500/10 border-red-500/30',    icon: <AlertCircle className="w-5 h-5 text-red-400"/>,    badge: 'bg-red-500/20 text-red-300',    label: 'حرج' },
  warning:  { bg: 'bg-amber-500/10 border-amber-500/30', icon: <AlertTriangle className="w-5 h-5 text-amber-400"/>, badge: 'bg-amber-500/20 text-amber-300', label: 'تحذير' },
  info:     { bg: 'bg-slate-800/50 border-slate-700',    icon: <Info className="w-5 h-5 text-blue-400"/>,           badge: 'bg-blue-500/20 text-blue-300',   label: 'معلومة' },
};

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [counts, setCounts]       = useState({ unread: 0, critical: 0, warning: 0 });
  const [filter, setFilter]       = useState<'all'|'critical'|'warning'|'info'>('all');
  const [modFilter, setModFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [nr, cr] = await Promise.all([
      fetch(`${BASE}/notifications?is_resolved=${showResolved}&limit=100`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/notifications/unread-count`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
    ]);
    if (nr.ok) setNotifs(await nr.json());
    if (cr.ok) setCounts(await cr.json());
    setLoading(false);
  }, [showResolved]);
  useEffect(() => { load(); }, [load]);

  const triggerSync = async () => {
    setSyncing(true);
    await fetch(`${BASE}/sync`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    await load();
    setSyncing(false);
  };

  const markRead = async (id: number) => {
    await fetch(`${BASE}/notifications/${id}/read`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    setNotifs(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n));
  };

  const resolve = async (id: number) => {
    await fetch(`${BASE}/notifications/${id}/resolve`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    load();
  };

  const readAll = async () => {
    await fetch(`${BASE}/notifications/read-all`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    setNotifs(prev => prev.map(n => ({...n, is_read: true})));
    setCounts(prev => ({...prev, unread: 0}));
  };

  const filtered = notifs.filter(n => {
    if (filter !== 'all' && n.severity !== filter) return false;
    if (modFilter && n.module !== modFilter) return false;
    return true;
  });

  const modules = [...new Set(notifs.map(n => n.module))];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">مركز الإشعارات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Bell className="w-8 h-8 text-violet-400" />
              {counts.unread > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                  {counts.unread}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">مركز الإشعارات</h1>
              <p className="text-slate-400 mt-1">التنبيهات والمهام العاجلة عبر جميع وحدات المنصة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={readAll} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2">
              <CheckCheck className="w-4 h-4" /> قراءة الكل
            </button>
            <button onClick={triggerSync} disabled={syncing} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label: 'غير مقروءة',  val: counts.unread,   color: 'text-violet-400'},
            {label: 'حرجة',        val: counts.critical,  color: 'text-red-400'},
            {label: 'تحذيرات',     val: counts.warning,   color: 'text-amber-400'},
            {label: 'إجمالي نشط',  val: notifs.filter(n=>!n.is_resolved).length, color: 'text-slate-300'},
          ].map(c => (
            <div key={c.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-sm"><Filter className="w-4 h-4" /> تصفية:</div>
          {(['all','critical','warning','info'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter===f ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {f==='all'?'الكل':f==='critical'?'حرج':f==='warning'?'تحذير':'معلومة'}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          {modules.map(m => (
            <button key={m} onClick={()=>setModFilter(modFilter===m?'':m)}
              className={`px-3 py-1.5 rounded-lg text-sm ${modFilter===m ? 'bg-slate-600 text-white' : 'bg-slate-800/50 text-slate-500 hover:bg-slate-700'}`}>
              {MODULE_LABELS[m] || m}
            </button>
          ))}
          <button onClick={()=>setShowResolved(!showResolved)}
            className={`px-3 py-1.5 rounded-lg text-sm mr-auto ${showResolved ? 'bg-slate-600 text-white' : 'bg-slate-800/50 text-slate-500'}`}>
            {showResolved ? 'إخفاء المحلولة' : 'عرض المحلولة'}
          </button>
        </div>

        {/* Notification List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">لا توجد إشعارات</p>
              <button onClick={triggerSync} className="mt-4 px-4 py-2 bg-violet-600/20 text-violet-400 rounded-lg text-sm hover:bg-violet-600/30">
                مزامنة للتحقق من البيانات
              </button>
            </div>
          ) : (
            filtered.map(n => {
              const cfg = SEV_CONFIG[n.severity] || SEV_CONFIG.info;
              return (
                <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${cfg.bg} ${n.is_read ? 'opacity-70' : 'ring-1 ring-inset ring-white/5'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-100 text-sm">{n.title}</span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.badge}`}>{cfg.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                            {MODULE_LABELS[n.module] || n.module}
                          </span>
                          {n.ref_code && <span className="text-xs text-slate-500 font-mono">{n.ref_code}</span>}
                        </div>
                        {n.message && <p className="text-slate-400 text-sm mt-1">{n.message}</p>}
                        <p className="text-slate-600 text-xs mt-1">
                          {new Date(n.created_at).toLocaleString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {MODULE_LINKS[n.module] && (
                        <Link href={MODULE_LINKS[n.module]}
                          className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
                          onClick={e => e.stopPropagation()}>
                          فتح
                        </Link>
                      )}
                      {!n.is_resolved && (
                        <button onClick={e => { e.stopPropagation(); resolve(n.id); }}
                          className="px-3 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg">
                          حل
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
