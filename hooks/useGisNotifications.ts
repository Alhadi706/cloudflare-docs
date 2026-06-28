'use client';
/**
 * useGisNotifications — hook لإدارة إشعارات GIS
 * يجلب من /api/gis/notifications كل 60 ثانية ويحفظ في state
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface GisNotification {
  id:             string;
  created_at:     string;
  read:           boolean;
  alert_id:       string;
  alert_name:     string;
  corridor:       string;
  severity:       'critical' | 'warning' | 'info';
  summary:        string;
  total_events:   number;
  critical_count: number;
  warning_count:  number;
  events:         any[];
  geojson:        any | null;
  image_source:   string;
  checked_at:     string;
  triggered_by:   'manual' | 'cron';
  image_quality?: { ssim_enhanced?: number; overall_change_pct?: number } | null;
}

const POLL_INTERVAL = 60_000; // 60 ثانية

export function useGisNotifications() {
  const [notifications, setNotifications] = useState<GisNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetch50 = useCallback(async () => {
    try {
      const res = await fetch('/api/gis/notifications?limit=50');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch { /* silent */ }
  }, []);

  // أضف إشعار يدوي (بعد فحص يدوي)
  const addNotification = useCallback(async (payload: Omit<GisNotification, 'id' | 'created_at' | 'read'>) => {
    try {
      setLoading(true);
      await fetch('/api/gis/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetch50();
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [fetch50]);

  const markRead = useCallback(async (id: string | 'all') => {
    try {
      await fetch(`/api/gis/notifications?id=${id}`, { method: 'PATCH' });
      setNotifications(prev =>
        id === 'all'
          ? prev.map(n => ({ ...n, read: true }))
          : prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(id === 'all' ? 0 : prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, []);

  const deleteNotif = useCallback(async (id: string | 'all') => {
    try {
      await fetch(`/api/gis/notifications?id=${id}`, { method: 'DELETE' });
      setNotifications(prev => id === 'all' ? [] : prev.filter(n => n.id !== id));
      if (id === 'all') setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  // polling
  useEffect(() => {
    fetch50();
    timerRef.current = setInterval(fetch50, POLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch50]);

  return { notifications, unreadCount, loading, addNotification, markRead, deleteNotif, refetch: fetch50 };
}
