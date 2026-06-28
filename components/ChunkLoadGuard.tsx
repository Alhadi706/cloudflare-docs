'use client';

import { useEffect } from 'react';

const RECOVERY_META_KEY = 'chunk-load-recovery-meta';
const MAX_RECOVERIES = 2;
const RECOVERY_WINDOW_MS = 20000;
const STABLE_SESSION_RESET_MS = 12000;

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const message =
    typeof reason === 'string'
      ? reason
      : typeof reason === 'object' && reason && 'message' in reason
      ? String((reason as { message?: unknown }).message || '')
      : '';

  const lower = message.toLowerCase();
  const hasChunkKeyword =
    lower.includes('chunkloaderror') ||
    lower.includes('loading chunk') ||
    lower.includes('failed to fetch dynamically imported module');

  // Keep recovery focused on actual Next static chunk fetch failures.
  return hasChunkKeyword && (lower.includes('/_next/static/') || lower.includes('.js'));
}

function canAttemptRecovery(): boolean {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(RECOVERY_META_KEY);

    if (!raw) {
      sessionStorage.setItem(
        RECOVERY_META_KEY,
        JSON.stringify({ count: 1, firstAt: now })
      );
      return true;
    }

    const parsed = JSON.parse(raw) as { count?: number; firstAt?: number };
    const count = Number(parsed.count || 0);
    const firstAt = Number(parsed.firstAt || now);

    if (!Number.isFinite(count) || !Number.isFinite(firstAt)) {
      sessionStorage.setItem(
        RECOVERY_META_KEY,
        JSON.stringify({ count: 1, firstAt: now })
      );
      return true;
    }

    if (now - firstAt > RECOVERY_WINDOW_MS) {
      sessionStorage.setItem(
        RECOVERY_META_KEY,
        JSON.stringify({ count: 1, firstAt: now })
      );
      return true;
    }

    if (count >= MAX_RECOVERIES) {
      return false;
    }

    sessionStorage.setItem(
      RECOVERY_META_KEY,
      JSON.stringify({ count: count + 1, firstAt })
    );
    return true;
  } catch {
    return true;
  }
}

function resetRecoveryStateLater() {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RECOVERY_META_KEY);
    } catch {
      // Ignore storage failures
    }
  }, STABLE_SESSION_RESET_MS);
}

export default function ChunkLoadGuard() {
  useEffect(() => {
    const recover = () => {
      if (!canAttemptRecovery()) {
        try {
          window.location.replace(`/entry?chunk_recovery_failed=${Date.now()}`);
        } catch {
          // no-op
        }
        return;
      }

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('__chunk_recover', String(Date.now()));
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    };

    const isStaticAssetFailure = (event: Event): boolean => {
      const target = event.target as HTMLElement | null;
      if (!target) return false;

      if (target.tagName === 'LINK') {
        const href = (target as HTMLLinkElement).href || '';
        return href.includes('/_next/static/') && href.includes('.css');
      }

      if (target.tagName === 'SCRIPT') {
        const src = (target as HTMLScriptElement).src || '';
        return src.includes('/_next/static/') && src.includes('.js');
      }

      return false;
    };

    const onError = (event: Event) => {
      const asErrorEvent = event as ErrorEvent;
      if (isChunkLoadError(asErrorEvent.error || asErrorEvent.message) || isStaticAssetFailure(event)) {
        recover();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) recover();
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    resetRecoveryStateLater();

    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
