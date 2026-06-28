'use client';

/**
 * DesignSessionsPanel — sidebar panel for managing routing design sessions.
 *
 * Displays saved sessions, allows load/save/delete/promote.
 * Completely isolated from approved spatial assets.
 */

import React, { useState } from 'react';
import {
  useRoutingSessions,
  SESSION_STATUS_META,
  INFRA_LABELS,
  type DesignSessionMeta,
  type SessionStatus,
  type InfraType,
} from '@/lib/gis/useRoutingSessions';
import { Loader2, Plus, FolderOpen, Copy, Trash2, ArrowUpCircle, RefreshCw, ChevronDown, ChevronUp, Tag } from 'lucide-react';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Current routing state to save */
  currentState: {
    infraType:  InfraType;
    priority:   string;
    obstacles:  Record<string, boolean>;
    startPoint: [number, number] | null;
    endPoint:   [number, number] | null;
    result:     Record<string, unknown> | null;
  } | null;

  /** Called when user clicks "Load" on a session — restores full state */
  onLoad: (session: {
    infraType:  InfraType;
    priority:   string;
    obstacles:  Record<string, boolean>;
    startPoint: [number, number] | null;
    endPoint:   [number, number] | null;
    result:     Record<string, unknown> | null;
  }) => void;
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Intl.DateTimeFormat('ar-LY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

// ── Save modal ────────────────────────────────────────────────────────────────

function SaveModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, description: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const [name, setName]   = useState('');
  const [desc, setDesc]   = useState('');
  const [tag,  setTag]    = useState('');
  const [tags, setTags]   = useState<string[]>([]);

  const addTag = () => {
    const t = tag.trim();
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTag(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" dir="rtl">
      <div className="w-80 rounded-2xl border border-cyan-700/50 bg-slate-900 shadow-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-cyan-300">💾 حفظ جلسة التصميم</h3>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">اسم المشروع / الجلسة *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: طريق جبل نفوسة – الخيار أ"
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">وصف (اختياري)</label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="ملاحظات حول هذا الخيار..."
            rows={2}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">الوسوم</label>
          <div className="flex gap-1">
            <input
              value={tag}
              onChange={e => setTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="أضف وسم..."
              className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button onClick={addTag} className="px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600">+</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  <Tag size={8} />{t}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="text-slate-500 hover:text-rose-400">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { if (name.trim()) onSave(name.trim(), desc, tags); }}
            disabled={!name.trim()}
            className="flex-1 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs font-bold transition-colors"
          >
            حفظ
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Promote modal ─────────────────────────────────────────────────────────────

function PromoteModal({
  session,
  onPromote,
  onClose,
}: {
  session: DesignSessionMeta;
  onPromote: (status: SessionStatus, projectId?: string) => void;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const TRANSITIONS: Record<SessionStatus, { label: string; status: SessionStatus; icon: string; color: string }[]> = {
    draft:     [{ label: 'إرسال للمراجعة', status: 'review',   icon: '🔍', color: 'bg-amber-700' }, { label: 'أرشفة', status: 'archived', icon: '📦', color: 'bg-slate-700' }],
    review:    [{ label: 'اعتماد',         status: 'approved', icon: '✅', color: 'bg-green-700'  }, { label: 'إعادة للمسودة', status: 'draft', icon: '✏️', color: 'bg-slate-700' }, { label: 'أرشفة', status: 'archived', icon: '📦', color: 'bg-slate-600' }],
    approved:  [{ label: 'تحويل إلى مشروع', status: 'converted', icon: '🏗️', color: 'bg-cyan-700' }, { label: 'أرشفة', status: 'archived', icon: '📦', color: 'bg-slate-700' }],
    archived:  [{ label: 'استعادة كمسودة', status: 'draft', icon: '✏️', color: 'bg-slate-700' }],
    converted: [],
  };
  const actions = TRANSITIONS[session.status] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" dir="rtl">
      <div className="w-72 rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-200">تغيير حالة الجلسة</h3>
        <p className="text-xs text-slate-400 border-r-2 border-slate-600 pr-2 leading-relaxed">{session.name}</p>

        {actions.length === 0 && (
          <p className="text-xs text-slate-500">لا توجد إجراءات متاحة لهذه الحالة</p>
        )}

        {actions.map(a => (
          <div key={a.status}>
            {a.status === 'converted' && (
              <div className="mb-1.5">
                <label className="text-[10px] text-slate-500 mb-1 block">رقم المشروع (اختياري)</label>
                <input
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  placeholder="مثال: PRJ-2026-017"
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
            <button
              onClick={() => onPromote(a.status, a.status === 'converted' ? projectId : undefined)}
              className={`w-full py-1.5 rounded-lg text-white text-xs font-bold transition-colors ${a.color} hover:opacity-90`}
            >
              {a.icon} {a.label}
            </button>
          </div>
        ))}

        <button onClick={onClose} className="w-full py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 transition-colors">إلغاء</button>

        <p className="text-[9px] text-slate-600 border-t border-slate-800 pt-2">
          {session.status === 'approved'
            ? '⚠️ التحويل إلى مشروع دائم — لن تتأثر الأصول المعتمدة الحالية'
            : 'الجلسات المصنّفة لا تُؤثّر في الأصول المكانية المعتمدة'}
        </p>
      </div>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onLoad,
  onDelete,
  onDuplicate,
  onPromote,
}: {
  session:     DesignSessionMeta;
  onLoad:      () => void;
  onDelete:    () => void;
  onDuplicate: () => void;
  onPromote:   () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sm = SESSION_STATUS_META[session.status];

  return (
    <div className={`rounded-xl border ${sm.border} ${sm.bg} p-2.5 space-y-2`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${sm.border} ${sm.bg} ${sm.color} font-semibold`}>
              {sm.icon} {sm.label}
            </span>
            <span className="text-[9px] text-slate-500">{INFRA_LABELS[session.infraType] ?? session.infraType}</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 mt-1 leading-snug">{session.name}</p>
          {session.description && (
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{session.description}</p>
          )}
        </div>
        <button onClick={() => setExpanded(o => !o)} className="text-slate-600 hover:text-slate-400 mt-0.5 shrink-0">
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Tags */}
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {session.tags.map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 flex items-center gap-0.5">
              <Tag size={7} />{t}
            </span>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-1 text-[10px] text-slate-500">
          {session.startPoint && <p>من: <span className="text-slate-400 font-mono">{session.startPoint.map(v => v.toFixed(4)).join(', ')}</span></p>}
          {session.endPoint   && <p>إلى: <span className="text-slate-400 font-mono">{session.endPoint.map(v => v.toFixed(4)).join(', ')}</span></p>}
          {session.hasResult  && <p className="text-green-500">✓ يحتوي على نتائج حساب</p>}
          {session.notes && <p className="border-r-2 border-slate-700 pr-1.5 leading-relaxed">{session.notes}</p>}
          {session.convertedToProjectId && (
            <p className="text-cyan-400">🏗️ مرتبط بالمشروع: {session.convertedToProjectId}</p>
          )}
          <p className="text-slate-600">آخر تعديل: {fmtDate(session.updatedAt)}</p>
          <p className="text-slate-600">أُنشئ: {fmtDate(session.createdAt)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1">
        {session.status !== 'converted' && (
          <button
            onClick={onLoad}
            className="flex-1 py-1 rounded-lg bg-cyan-900/50 border border-cyan-700/50 text-cyan-300 hover:bg-cyan-800/60 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <FolderOpen size={9} /> فتح
          </button>
        )}
        <button
          onClick={onDuplicate}
          title="نسخ"
          className="px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 text-[10px] transition-colors"
        >
          <Copy size={9} />
        </button>
        {session.status !== 'converted' && (
          <button
            onClick={onPromote}
            title="تغيير الحالة"
            className="px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-green-400 text-[10px] transition-colors"
          >
            <ArrowUpCircle size={9} />
          </button>
        )}
        {['draft','archived'].includes(session.status) && (
          <button
            onClick={onDelete}
            title="حذف"
            className="px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-rose-400 text-[10px] transition-colors"
          >
            <Trash2 size={9} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function DesignSessionsPanel({ currentState, onLoad }: Props) {
  const {
    sessions, saving, syncing, syncError,
    createSession, updateSession, loadSession,
    deleteSession, promoteStatus, duplicateSession, syncAll,
  } = useRoutingSessions();

  const [showSave,    setShowSave]    = useState(false);
  const [promoteFor,  setPromoteFor]  = useState<DesignSessionMeta | null>(null);
  const [filter,      setFilter]      = useState<'all' | 'draft' | 'review' | 'approved' | 'archived' | 'converted'>('all');
  const [loadingId,   setLoadingId]   = useState<string | null>(null);

  const filteredSessions = filter === 'all'
    ? sessions
    : sessions.filter(s => s.status === filter);

  const handleSave = async (name: string, description: string, tags: string[]) => {
    if (!currentState) return;
    setShowSave(false);
    await createSession({
      name, description, tags,
      infraType:  currentState.infraType,
      priority:   currentState.priority,
      obstacles:  currentState.obstacles,
      startPoint: currentState.startPoint,
      endPoint:   currentState.endPoint,
      result:     currentState.result,
    });
  };

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const full = await loadSession(id);
      if (!full) return;
      onLoad({
        infraType:  full.infraType,
        priority:   full.priority,
        obstacles:  full.obstacles,
        startPoint: full.startPoint,
        endPoint:   full.endPoint,
        result:     full.result,
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
    await deleteSession(id).catch(e => alert(e.message));
  };

  const handlePromote = async (session: DesignSessionMeta, status: SessionStatus, projectId?: string) => {
    setPromoteFor(null);
    await promoteStatus(session.id, status, projectId).catch(e => alert(e.message));
  };

  const statusCounts = sessions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <span className="text-[12px] font-bold text-slate-200">مشاريع التصميم</span>
          {sessions.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">{sessions.length}</span>
          )}
        </div>
        <button
          onClick={syncAll}
          disabled={syncing}
          title="مزامنة مع الخادم"
          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
        >
          {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
        </button>
      </div>

      {/* Save current session */}
      <button
        onClick={() => setShowSave(true)}
        disabled={!currentState || saving}
        className="w-full py-2 rounded-xl bg-cyan-700/40 hover:bg-cyan-700/60 disabled:opacity-40 border border-cyan-700/50 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
      >
        {saving
          ? <Loader2 size={11} className="animate-spin" />
          : <Plus size={11} />}
        حفظ الجلسة الحالية
      </button>

      {!currentState && (
        <p className="text-[10px] text-slate-600 text-center">احسب مساراً أولاً لحفظه</p>
      )}

      {/* Sync error */}
      {syncError && (
        <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-3 py-2">
          <p className="text-[10px] text-rose-300">⚠️ {syncError}</p>
        </div>
      )}

      {/* Isolation notice */}
      <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 px-3 py-2">
        <p className="text-[9px] text-slate-500 leading-relaxed">
          🔒 جلسات التصميم معزولة تماماً عن الأصول المكانية المعتمدة — لن تؤثر على المشاريع القائمة حتى تحويلها صراحةً.
        </p>
      </div>

      {/* Status filter */}
      {sessions.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(['all', 'draft', 'review', 'approved', 'archived', 'converted'] as const).map(f => {
            const count = f === 'all' ? sessions.length : (statusCounts[f] ?? 0);
            if (f !== 'all' && count === 0) return null;
            const sm = f === 'all' ? null : SESSION_STATUS_META[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[9px] px-2 py-1 rounded-lg whitespace-nowrap transition-colors border font-semibold ${
                  filter === f
                    ? (sm ? `${sm.bg} ${sm.border} ${sm.color}` : 'bg-slate-700 border-slate-500 text-slate-200')
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? 'الكل' : sm?.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Sessions list */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-2xl">📂</p>
          <p className="text-xs text-slate-500">لا توجد جلسات {filter !== 'all' ? 'بهذا الفلتر' : 'محفوظة'}</p>
          <p className="text-[10px] text-slate-600">احسب مساراً ثم احفظه كجلسة تصميم</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map(s => (
            <div key={s.id} className="relative">
              {loadingId === s.id && (
                <div className="absolute inset-0 rounded-xl bg-slate-900/70 flex items-center justify-center z-10">
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                </div>
              )}
              <SessionCard
                session={s}
                onLoad={() => handleLoad(s.id)}
                onDelete={() => handleDelete(s.id)}
                onDuplicate={() => duplicateSession(s.id)}
                onPromote={() => setPromoteFor(s)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Status lifecycle legend */}
      {sessions.length > 0 && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-2.5">
          <p className="text-[9px] text-slate-600 mb-1.5 font-semibold">دورة حياة الجلسة:</p>
          <div className="flex items-center gap-1 text-[8px] flex-wrap">
            {(['draft','review','approved','converted'] as SessionStatus[]).map((s, i) => (
              <React.Fragment key={s}>
                <span className={`px-1.5 py-0.5 rounded-full border ${SESSION_STATUS_META[s].border} ${SESSION_STATUS_META[s].bg} ${SESSION_STATUS_META[s].color}`}>
                  {SESSION_STATUS_META[s].icon} {SESSION_STATUS_META[s].label}
                </span>
                {i < 3 && <span className="text-slate-700">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showSave   && <SaveModal onSave={handleSave} onClose={() => setShowSave(false)} />}
      {promoteFor && (
        <PromoteModal
          session={promoteFor}
          onPromote={(status, pid) => handlePromote(promoteFor, status, pid)}
          onClose={() => setPromoteFor(null)}
        />
      )}
    </div>
  );
}
