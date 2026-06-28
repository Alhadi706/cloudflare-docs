'use client';
// ─── useSatelliteRefresh ──────────────────────────────────────────────────────
// Controlled polling hook for Satellite Intelligence Center
// - 30-second interval by default
// - Pauses automatically when the browser tab is hidden
// - Returns lastRefreshed timestamp and manual trigger

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSatelliteRefreshOptions {
  /** Interval in milliseconds. Default: 30000 (30s) */
  intervalMs?: number;
  /** Whether polling is enabled at all. Default: true */
  enabled?: boolean;
  /** Called on every auto-refresh tick */
  onRefresh: () => void | Promise<void>;
}

interface UseSatelliteRefreshReturn {
  /** ISO timestamp of the last successful refresh, or null if never refreshed */
  lastRefreshed: string | null;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Manually trigger a refresh (also resets the interval timer) */
  triggerRefresh: () => void;
  /** Human-readable freshness label, e.g. "Just now", "2m ago" */
  freshnessLabel: string;
}

export function useSatelliteRefresh({
  intervalMs = 30_000,
  enabled = true,
  onRefresh,
}: UseSatelliteRefreshOptions): UseSatelliteRefreshReturn {
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Update "now" every 15 seconds so freshnessLabel stays current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const doRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
      setLastRefreshed(new Date().toISOString());
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!enabled) return;
    timerRef.current = setInterval(async () => {
      // Pause when the tab is hidden
      if (document.visibilityState === 'hidden') return;
      await doRefresh();
    }, intervalMs);
  }, [enabled, intervalMs, doRefresh]);

  // Start/restart timer whenever enabled or intervalMs changes
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  // Pause/resume on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Immediate refresh when coming back into view, then reset timer
        doRefresh().then(resetTimer);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [doRefresh, resetTimer]);

  const triggerRefresh = useCallback(() => {
    doRefresh().then(resetTimer);
  }, [doRefresh, resetTimer]);

  // Freshness label
  const freshnessLabel = (() => {
    if (!lastRefreshed) return 'لم يُحدَّث بعد';
    const diffMs = now - new Date(lastRefreshed).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 30) return 'الآن للتو';
    if (diffSec < 90) return 'منذ ثانية';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    return `منذ ${diffHr} س`;
  })();

  return { lastRefreshed, isRefreshing, triggerRefresh, freshnessLabel };
}
