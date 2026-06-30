'use client';
/**
 * usePushSubscription
 * يسجّل المتصفح/WebView في نظام Web Push VAPID
 * يُستدعى عند دخول أي مستخدم GIS/مشرف
 */
import { useEffect, useRef } from 'react';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription(token: string | null) {
  const registered = useRef(false);

  useEffect(() => {
    if (!token || !VAPID_PUBLIC || registered.current) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    registered.current = true;

    (async () => {
      try {
        // 1. سجّل الـ service worker
        const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        // 2. اطلب إذن الإشعارات
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;

        // 3. اشترك في Web Push
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });

        // 4. أرسل الاشتراك للخادم
        await fetch('/api/auth/mobile/push-subscribe', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch (err) {
        // صامت — الإشعارات اختيارية
        console.debug('[push] subscription skipped:', err);
      }
    })();
  }, [token]);
}
