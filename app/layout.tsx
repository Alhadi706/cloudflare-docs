export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import RootShell from '@/components/RootShell';
import TenantFetchGuard from '@/components/TenantFetchGuard';
import ChunkLoadGuard from '@/components/ChunkLoadGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DSF Gateway — المنصة الرقمية',
  description: 'منصة إدارة الأعمال الرقمية — Digital Sovereignty Force',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DSF Gateway',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#0a0a0f',
    'theme-color': '#0a0a0f',
  },
};

const EARLY_ASSET_RECOVERY_SCRIPT = `
(() => {
  const KEY = 'dsf-asset-recovery';
  const CLEANUP_KEY = 'dsf-asset-recovery-cleanup-done';
  const MAX = 2;
  const WINDOW_MS = 20000;

  const hasRecoveryParam = () => {
    try {
      const url = new URL(window.location.href);
      return (
        url.searchParams.has('__asset_recover') ||
        url.searchParams.has('__chunk_recover') ||
        url.searchParams.has('_asset_recover') ||
        url.searchParams.has('_chunk_recover')
      );
    } catch {
      return false;
    }
  };

  const stripRecoveryParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('__asset_recover');
    url.searchParams.delete('__chunk_recover');
    url.searchParams.delete('_asset_recover');
    url.searchParams.delete('_chunk_recover');
    return url.toString();
  };

  const cleanupStaleClientCaches = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        }).catch(() => {});
      }

      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      }
    } catch {
      // Ignore cleanup failures
    }
  };

  try {
    if (hasRecoveryParam()) {
      const cleanUrl = stripRecoveryParams();
      const done = sessionStorage.getItem(CLEANUP_KEY) === '1';

      // First recovery pass: clear stale caches/workers then force a clean navigation.
      if (!done) {
        sessionStorage.setItem(CLEANUP_KEY, '1');
        cleanupStaleClientCaches();
      }

      if (cleanUrl !== window.location.href) {
        window.location.replace(cleanUrl);
        return;
      }

      sessionStorage.removeItem(CLEANUP_KEY);
    }
  } catch {
    // Continue with normal bootstrapping if storage is unavailable.
  }

  const canRecover = () => {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem(KEY);
      if (!raw) {
        sessionStorage.setItem(KEY, JSON.stringify({ count: 1, firstAt: now }));
        return true;
      }

      const parsed = JSON.parse(raw);
      const count = Number(parsed && parsed.count || 0);
      const firstAt = Number(parsed && parsed.firstAt || now);

      if (!Number.isFinite(count) || !Number.isFinite(firstAt) || now - firstAt > WINDOW_MS) {
        sessionStorage.setItem(KEY, JSON.stringify({ count: 1, firstAt: now }));
        return true;
      }

      if (count >= MAX) return false;
      sessionStorage.setItem(KEY, JSON.stringify({ count: count + 1, firstAt }));
      return true;
    } catch {
      return true;
    }
  };

  const recover = () => {
    if (!canRecover()) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('__asset_recover', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  window.addEventListener('error', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLLinkElement || target instanceof HTMLScriptElement)) return;

    const source = target instanceof HTMLLinkElement ? target.href : target.src;
    if (!source || !source.includes('/_next/static/')) return;
    recover();
  }, true);

  // If page renders without valid Next CSS chunks (unstyled HTML), trigger recovery.
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      try {
        const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const nextLinks = cssLinks.filter((l) => {
          const href = (l.getAttribute('href') || '');
          return href.includes('/_next/static/css/');
        });

        const hasLoadedSheet = nextLinks.some((l) => !!l.sheet);

        if (!nextLinks.length || !hasLoadedSheet) recover();
      } catch {
        // no-op
      }
    }, 1400);
  });
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <Script id="early-asset-recovery" strategy="beforeInteractive">
          {EARLY_ASSET_RECOVERY_SCRIPT}
        </Script>
      </head>
      <body className={`${inter.className} bg-slate-900 text-white min-h-screen flex flex-row bg-gradient-radial from-slate-900 via-slate-950 to-black`}>
        <ChunkLoadGuard />
        <TenantFetchGuard />
        <RootShell>{children}</RootShell>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              var path = window.location.pathname || '/';
              var enableMobilePwa = path === '/m' || path.indexOf('/entry/') === 0;

              if (enableMobilePwa) {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
                return;
              }

              // Keep SW disabled on the dashboard app to avoid stale chunk/css cache issues.
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                regs.forEach(function(r) { r.unregister(); });
              }).catch(function(){});

              if ('caches' in window) {
                caches.keys().then(function(keys) {
                  return Promise.all(keys.map(function(k) { return caches.delete(k); }));
                }).catch(function(){});
              }
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
