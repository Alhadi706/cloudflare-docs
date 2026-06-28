'use client';
/**
 * GisNotificationBell
 * جرس الإشعارات في رأس لوحة مركز الاستخبارات الفضائية
 * يعرض: عدد الإشعارات غير المقروءة، لوحة القائمة عند الضغط
 */
import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, CheckCheck, Trash2, ChevronDown, ShieldAlert, AlertCircle, Info, X } from 'lucide-react';
import type { GisNotification } from '@/hooks/useGisNotifications';

interface Props {
  notifications: GisNotification[];
  unreadCount:   number;
  onMarkRead:    (id: string | 'all') => void;
  onDelete:      (id: string | 'all') => void;
  onSelect?:     (n: GisNotification) => void;
}

const SEV_ICON: Record<string, React.ElementType> = {
  critical: ShieldAlert,
  warning:  AlertCircle,
  info:     Info,
};
const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  warning:  'text-amber-400',
  info:     'text-blue-400',
};
const SEV_BG: Record<string, string> = {
  critical: 'border-red-700/40 bg-red-900/20',
  warning:  'border-amber-700/40 bg-amber-900/15',
  info:     'border-blue-700/30 bg-blue-900/10',
};
const SEV_AR: Record<string, string> = {
  critical: 'حرج', warning: 'تحذير', info: 'معلومة',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

export default function GisNotificationBell({ notifications, unreadCount, onMarkRead, onDelete, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // إغلاق عند النقر خارجاً
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const BellIcon = unreadCount > 0 ? BellRing : Bell;

  return (
    <div ref={ref} className="relative" dir="rtl">
      {/* زر الجرس */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          open ? 'bg-slate-700' : 'hover:bg-slate-800'
        }`}
        title="الإشعارات"
      >
        <BellIcon size={16} className={unreadCount > 0 ? 'text-yellow-400' : 'text-slate-400'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* لوحة الإشعارات */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 max-h-[480px] overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/50 flex flex-col z-50">
          {/* رأس اللوحة */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
            <BellIcon size={13} className="text-yellow-400" />
            <span className="text-[11px] font-bold text-slate-200">الإشعارات</span>
            {unreadCount > 0 && (
              <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-700/40 rounded px-1.5 py-0.5">
                {unreadCount} غير مقروء
              </span>
            )}
            <div className="mr-auto flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={() => onMarkRead('all')} title="تحديد الكل كمقروء"
                  className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
                  <CheckCheck size={11} /> قراءة الكل
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={() => onDelete('all')} title="مسح الكل"
                  className="text-[9px] text-slate-600 hover:text-red-400 mr-1">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>

          {/* قائمة الإشعارات */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-[10px] text-slate-600">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map(n => {
                const SevIcon = SEV_ICON[n.severity];
                return (
                  <div
                    key={n.id}
                    onClick={() => { onMarkRead(n.id); onSelect?.(n); setOpen(false); }}
                    className={`relative flex gap-2.5 px-3 py-2.5 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40 transition-colors ${
                      !n.read ? 'bg-slate-800/20' : ''
                    }`}
                  >
                    {/* مؤشر غير مقروء */}
                    {!n.read && (
                      <span className="absolute top-3 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}

                    <div className={`shrink-0 mt-0.5 ${SEV_COLOR[n.severity]}`}>
                      <SevIcon size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SEV_BG[n.severity]} ${SEV_COLOR[n.severity]}`}>
                          {SEV_AR[n.severity]}
                        </span>
                        <span className="text-[9px] text-slate-500 truncate">{n.alert_name}</span>
                        <span className="mr-auto text-[8px] text-slate-600 shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2">{n.summary}</p>
                      {n.total_events > 0 && (
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {n.critical_count > 0 && <span className="text-red-400">{n.critical_count} حرج </span>}
                          {n.warning_count > 0  && <span className="text-amber-400">{n.warning_count} تحذير </span>}
                          · {n.corridor}
                          · {n.triggered_by === 'cron' ? '🤖 تلقائي' : '👤 يدوي'}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); onDelete(n.id); }}
                      className="shrink-0 self-start mt-0.5 text-slate-700 hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
