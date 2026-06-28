/**
 * useRoutingSessions — React hook for design-project session management.
 *
 * Provides a dual-storage strategy:
 *   1. localStorage  → immediate autosave, works offline, private to browser
 *   2. Server API    → /api/gis/routing-sessions → team-visible persistence
 *
 * Design sessions are completely isolated from approved spatial assets.
 * Promotion to an official project requires an explicit "تحويل إلى مشروع" action.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionStatus = 'draft' | 'review' | 'approved' | 'archived' | 'converted';
export type InfraType     = 'road' | 'water_pipe' | 'sewer' | 'power_line' | 'telecom' | 'general';

export interface DesignSessionMeta {
  id:          string;
  name:        string;
  description: string;
  infraType:   InfraType;
  priority:    string;
  obstacles:   Record<string, boolean>;
  startPoint:  [number, number] | null;
  endPoint:    [number, number] | null;
  status:      SessionStatus;
  tags:        string[];
  ownerName:   string;
  notes:       string;
  hasResult:   boolean;
  convertedToProjectId: string | null;
  createdAt:   number;
  updatedAt:   number;
}

export interface DesignSessionFull extends DesignSessionMeta {
  result: Record<string, unknown> | null;
}

// ── localStorage keys ────────────────────────────────────────────────────────

const LS_KEY = 'gis_design_sessions_v1';     // list of meta (no large result)
const LS_RESULT_PREFIX = 'gis_dsn_result_';  // per-session result (can be large)

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRoutingSessions() {
  const [sessions,  setSessions]  = useState<DesignSessionMeta[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Load from localStorage on mount ───────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSessions(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // ── Persist meta list to localStorage whenever it changes ─────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sessions));
    } catch { /* ignore storage quota errors */ }
  }, [sessions]);

  // ── Create a new session ──────────────────────────────────────────────────
  const createSession = useCallback(async (params: {
    name:        string;
    description?: string;
    infraType:   InfraType;
    priority:    string;
    obstacles:   Record<string, boolean>;
    startPoint:  [number, number] | null;
    endPoint:    [number, number] | null;
    result:      Record<string, unknown> | null;
    tags?:       string[];
    notes?:      string;
  }): Promise<DesignSessionMeta> => {
    setSaving(true);
    try {
      const id = `dsn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();
      const meta: DesignSessionMeta = {
        id,
        name:        params.name,
        description: params.description ?? '',
        infraType:   params.infraType,
        priority:    params.priority,
        obstacles:   params.obstacles,
        startPoint:  params.startPoint,
        endPoint:    params.endPoint,
        status:      'draft',
        tags:        params.tags ?? [],
        ownerName:   '',
        notes:       params.notes ?? '',
        hasResult:   !!params.result,
        convertedToProjectId: null,
        createdAt:   now,
        updatedAt:   now,
      };

      // Store large result separately to avoid LocalStorage bloat
      if (params.result) {
        try {
          localStorage.setItem(LS_RESULT_PREFIX + id, JSON.stringify(params.result));
        } catch { /* quota exceeded — result won't be cached locally */ }
      }

      setSessions(prev => [meta, ...prev]);

      // Also persist to server (non-blocking)
      syncToServer('create', { ...meta, result: params.result }).catch(() => {});

      return meta;
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Update an existing session ────────────────────────────────────────────
  const updateSession = useCallback(async (id: string, patch: Partial<{
    name:       string;
    description:string;
    result:     Record<string, unknown> | null;
    tags:       string[];
    notes:      string;
    status:     SessionStatus;
  }>): Promise<void> => {
    setSaving(true);
    try {
      const now = Date.now();
      setSessions(prev => prev.map(s => s.id !== id ? s : {
        ...s, ...patch,
        hasResult: 'result' in patch ? !!patch.result : s.hasResult,
        updatedAt: now,
      }));

      if ('result' in patch && patch.result) {
        try {
          localStorage.setItem(LS_RESULT_PREFIX + id, JSON.stringify(patch.result));
        } catch { /* ignore */ }
      }

      // Sync to server
      syncToServer('update', { id, ...patch }).catch(() => {});
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Load full session (with result) from localStorage or server ───────────
  const loadSession = useCallback(async (id: string): Promise<DesignSessionFull | null> => {
    const meta = sessions.find(s => s.id === id);
    if (!meta) return null;

    // Try localStorage first
    let result: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(LS_RESULT_PREFIX + id);
      if (raw) result = JSON.parse(raw);
    } catch { /* ignore */ }

    // If not in LS, fetch from server
    if (!result && meta.hasResult) {
      try {
        const res = await fetch('/api/gis/routing-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
          // action is in query string:
        });
        // Re-try with action param
        const res2 = await fetch('/api/gis/routing-sessions?action=get_full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (res2.ok) {
          const data = await res2.json();
          result = data.session?.result ?? null;
          // Cache locally
          if (result) {
            try { localStorage.setItem(LS_RESULT_PREFIX + id, JSON.stringify(result)); } catch { /* ignore */ }
          }
        }
      } catch { /* offline — result unavailable */ }
    }

    return { ...meta, result };
  }, [sessions]);

  // ── Delete session ────────────────────────────────────────────────────────
  const deleteSession = useCallback(async (id: string): Promise<void> => {
    const session = sessions.find(s => s.id === id);
    if (session?.status === 'converted') {
      throw new Error('لا يمكن حذف جلسة محوّلة إلى مشروع');
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    try { localStorage.removeItem(LS_RESULT_PREFIX + id); } catch { /* ignore */ }
    // Sync to server
    fetch(`/api/gis/routing-sessions?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }, [sessions]);

  // ── Promote status ────────────────────────────────────────────────────────
  const promoteStatus = useCallback(async (id: string, newStatus: SessionStatus, projectId?: string): Promise<void> => {
    const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
      draft:     ['review', 'archived'],
      review:    ['draft', 'approved', 'archived'],
      approved:  ['converted', 'archived'],
      archived:  ['draft'],
      converted: [],
    };
    const session = sessions.find(s => s.id === id);
    if (!session) throw new Error('جلسة غير موجودة');
    if (!TRANSITIONS[session.status].includes(newStatus)) {
      throw new Error(`لا يمكن التحويل من "${session.status}" إلى "${newStatus}"`);
    }

    setSessions(prev => prev.map(s => s.id !== id ? s : {
      ...s, status: newStatus,
      convertedToProjectId: newStatus === 'converted' ? (projectId ?? null) : s.convertedToProjectId,
      updatedAt: Date.now(),
    }));

    // Sync to server
    fetch('/api/gis/routing-sessions?action=promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus, projectId }),
    }).catch(() => {});
  }, [sessions]);

  // ── Sync all local sessions to server (after re-login etc) ───────────────
  const syncAll = useCallback(async (): Promise<void> => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/gis/routing-sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const serverSessions: DesignSessionMeta[] = data.sessions ?? [];
      const serverIds = new Set(serverSessions.map(s => s.id));

      // Add server sessions not present locally
      setSessions(prev => {
        const localIds = new Set(prev.map(s => s.id));
        const toAdd = serverSessions.filter(s => !localIds.has(s.id));
        return [...prev, ...toAdd].sort((a, b) => b.updatedAt - a.updatedAt);
      });

      // Upload local sessions not on server
      const localOnly = sessions.filter(s => !serverIds.has(s.id));
      for (const s of localOnly) {
        let result: Record<string, unknown> | null = null;
        try {
          const raw = localStorage.getItem(LS_RESULT_PREFIX + s.id);
          if (raw) result = JSON.parse(raw);
        } catch { /* ignore */ }
        await fetch('/api/gis/routing-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...s, result }),
        }).catch(() => {});
      }
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : 'خطأ في المزامنة');
    } finally {
      setSyncing(false);
    }
  }, [sessions]);

  // ── Duplicate session ─────────────────────────────────────────────────────
  const duplicateSession = useCallback(async (id: string): Promise<DesignSessionMeta | null> => {
    const full = await loadSession(id);
    if (!full) return null;
    return createSession({
      name:        `${full.name} (نسخة)`,
      description: full.description,
      infraType:   full.infraType,
      priority:    full.priority,
      obstacles:   full.obstacles,
      startPoint:  full.startPoint,
      endPoint:    full.endPoint,
      result:      full.result,
      tags:        full.tags,
      notes:       full.notes,
    });
  }, [loadSession, createSession]);

  return {
    sessions,
    saving,
    syncing,
    syncError,
    createSession,
    updateSession,
    loadSession,
    deleteSession,
    promoteStatus,
    duplicateSession,
    syncAll,
  };
}

// ── Server sync helper (fire-and-forget) ─────────────────────────────────────

async function syncToServer(
  action: 'create' | 'update',
  data:   Record<string, unknown>,
): Promise<void> {
  const url    = action === 'create' ? '/api/gis/routing-sessions' : '/api/gis/routing-sessions';
  const method = action === 'create' ? 'POST' : 'PUT';
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Status helpers ────────────────────────────────────────────────────────────

export const SESSION_STATUS_META: Record<SessionStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  draft:     { label: 'مسودة',         color: 'text-slate-300',  bg: 'bg-slate-800/50',   border: 'border-slate-600/40', icon: '✏️' },
  review:    { label: 'قيد المراجعة',  color: 'text-amber-300',  bg: 'bg-amber-900/30',   border: 'border-amber-700/50', icon: '🔍' },
  approved:  { label: 'معتمد',         color: 'text-green-300',  bg: 'bg-green-900/30',   border: 'border-green-700/50', icon: '✅' },
  archived:  { label: 'مؤرشف',         color: 'text-slate-500',  bg: 'bg-slate-800/30',   border: 'border-slate-700/40', icon: '📦' },
  converted: { label: 'محوّل لمشروع',  color: 'text-cyan-300',   bg: 'bg-cyan-900/30',    border: 'border-cyan-700/50',  icon: '🏗️' },
};

export const INFRA_LABELS: Record<InfraType, string> = {
  road:       '🛣️ طريق',
  water_pipe: '💧 أنبوب مياه',
  sewer:      '🔩 صرف صحي',
  power_line: '⚡ خط كهرباء',
  telecom:    '📡 اتصالات',
  general:    '📍 عام',
};
