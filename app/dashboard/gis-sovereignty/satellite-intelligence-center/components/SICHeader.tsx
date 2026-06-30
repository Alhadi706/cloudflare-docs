'use client';
import React from 'react';
import { Satellite, ChevronRight, Activity, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import GisNotificationBell from '@/components/gis/GisNotificationBell';
import { useGisNotifications } from '@/hooks/useGisNotifications';
import type { GisNotification } from '@/hooks/useGisNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';

interface Props {
  systemOnline: boolean;
  activeSceneUid: string | null;
  onNotificationSelect?: (n: GisNotification) => void;
}

export default function SICHeader({ systemOnline, activeSceneUid, onNotificationSelect }: Props) {
  const { notifications, unreadCount, markRead, deleteNotif } = useGisNotifications();

  // تسجيل المتصفح/WebView في Web Push تلقائياً عند فتح SIC
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('auth_token') ?? null)
    : null;
  usePushSubscription(token);

  return (
    <div className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center px-5 justify-between shrink-0 z-20">
      {/* Left: Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/gis-sovereignty"
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
        <div className="h-7 w-0.5 bg-blue-500 rounded-full" />
        <Satellite className="w-5 h-5 text-blue-400 shrink-0" />
        <div>
          <h1 className="text-base font-bold font-mono text-white tracking-tight">
            مركز قيادة الاستخبارات الفضائية
          </h1>
          <p className="text-[10px] text-slate-500 font-mono">
            SATELLITE INTELLIGENCE COMMAND CENTER · S6
          </p>
        </div>
      </div>

      {/* Center: Active Scene */}
      {activeSceneUid && (
        <div className="hidden md:flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] font-mono text-slate-300 max-w-[220px] truncate">
            {activeSceneUid}
          </span>
        </div>
      )}

      {/* Right: Notifications + System status */}
      <div className="flex items-center gap-3">
        {/* جرس الإشعارات */}
        <GisNotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={markRead}
          onDelete={deleteNotif}
          onSelect={onNotificationSelect}
        />
        <div className="h-5 w-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          {systemOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono text-emerald-400">متصل</span>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-[10px] font-mono text-rose-400">غير متصل</span>
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
            </>
          )}
        </div>
        <div className="h-5 w-px bg-slate-700" />
        <span className="text-[10px] font-mono text-slate-500">INFRA_OPS</span>
      </div>
    </div>
  );
}
