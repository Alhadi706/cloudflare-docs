/**
 * DSF Satellite Intelligence Push Service Worker
 * يستقبل إشعارات الأقمار الصناعية ويعرضها على الهاتف/المتصفح
 */

const CACHE_NAME = 'dsf-push-v1';

// استقبال رسالة push من الخادم
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'تنبيه DSF', body: event.data.text() };
  }

  const title   = payload.title  || 'مركز الاستشعار عن بعد';
  const options = {
    body:    payload.body    || '',
    icon:    payload.icon    || '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    tag:     payload.tag     || 'dsf-alert',
    data:    { url: payload.url || '/dashboard/gis-sovereignty' },
    vibrate: [200, 100, 200],
    requireInteraction: payload.urgency === 'critical',
    actions: [
      { action: 'open',    title: 'فتح الخريطة' },
      { action: 'dismiss', title: 'إغلاق'       },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard/gis-sovereignty';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // إذا كانت النافذة مفتوحة مسبقاً، انقل التركيز إليها
      for (const win of wins) {
        if (win.url.includes(self.location.origin) && 'focus' in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      // وإلا افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// تثبيت الـ service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
