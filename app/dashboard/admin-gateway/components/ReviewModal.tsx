'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, XCircle, RotateCcw, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetItem {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  source_type: string;
  review_level: string;
  created_at: string;
  change_request_notes: string | null;
  properties: Record<string, unknown>;
}

interface PendingResponse {
  total: number;
  count: number;
  data: AssetItem[];
}

interface BatchResult {
  processed: number;
  auto_approved: number;
  requires_review: number;
}

interface ReviewModalProps {
  onClose: () => void;
  department: 'gis' | 'admin' | 'finance';
}

const DEPT_LABELS: Record<string, string> = {
  gis: 'مراجعة GIS',
  admin: 'مراجعة إدارية',
  finance: 'مراجعة مالية',
};

const SOURCE_LABELS: Record<string, string> = {
  file_upload: 'استيراد ملف',
  map_drawing: 'رسم خريطة',
  admin_manual_entry: 'إدخال إداري',
  finance_manual_entry: 'إدخال مالي',
};

// ── Sub-component: single asset card ─────────────────────────────────────────

function AssetCard({
  item,
  department,
  onApproved,
  onRejected,
}: {
  item: AssetItem;
  department: string;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [action, setAction] = useState<'idle' | 'approve' | 'reject' | 'loading'>('idle');
  const [expanded, setExpanded] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<null | {
    auto_approvable: boolean;
    recommendations: string[];
  }>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const props = item.properties ?? {};
  const matchResults = props._auto_match_results as { recommendations?: string[]; auto_approvable?: boolean } | undefined;

  async function runAutoMatch() {
    setMatchLoading(true);
    try {
      // asset_id is now always set (COALESCE(asset_id, id::text) from backend)
      // For UUID-style IDs, auto-match uses them directly as internal IDs
      const matchRes = await fetch(
        `/api/v1/review/auto-match/${item.asset_id}?tenant_id=${getTenantId() || ''}`,
        { method: 'POST', headers: { 'X-Tenant-ID': getTenantId() || '' } }
      );
      const matchData = await matchRes.json();
      setAutoMatchResult({
        auto_approvable: matchData.auto_approvable,
        recommendations: matchData.recommendations ?? [],
      });
      if (matchData.auto_approvable) {
        onApproved(item.asset_id);
      }
    } catch {
      // silently fall through — reviewer can still approve manually
    } finally {
      setMatchLoading(false);
    }
  }

  async function submitApprove() {
    setAction('loading');
    try {
      await fetch(`/api/v1/review/approve/${item.asset_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({
          department,
          notes,
          tenant_id: getTenantId() || '',
          reviewer_id: 'dashboard_user',
        }),
      });
      onApproved(item.asset_id);
    } finally {
      setAction('idle');
    }
  }

  async function submitReject() {
    if (!rejectReason.trim()) return;
    setAction('loading');
    try {
      await fetch(`/api/v1/review/reject/${item.asset_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({
          department,
          reason: rejectReason,
          tenant_id: getTenantId() || '',
          reviewer_id: 'dashboard_user',
        }),
      });
      onRejected(item.asset_id);
    } finally {
      setAction('idle');
    }
  }

  const isLoading = action === 'loading' || matchLoading;

  return (
    <div className="border border-slate-700 rounded-xl bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate">{item.asset_name || item.asset_id}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs text-slate-400">{item.asset_type}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">
              {SOURCE_LABELS[item.source_type] ?? item.source_type}
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-500 dir-ltr">
              {new Date(item.created_at).toLocaleDateString('ar')}
            </span>
          </div>
        </div>

        {/* Auto-match button */}
        <button
          onClick={runAutoMatch}
          disabled={isLoading}
          title="مطابقة ذكية"
          className="shrink-0 text-xs bg-indigo-700/40 hover:bg-indigo-700/70 text-indigo-300 border border-indigo-600/50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40"
        >
          <Zap className="w-3 h-3" />
          {matchLoading ? '...' : 'مطابقة'}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Change request notes */}
      {item.change_request_notes && (
        <div className="mx-4 mb-3 p-2 bg-amber-900/20 border border-amber-700/50 rounded text-xs text-amber-300">
          ⚠️ طلب تعديل: {item.change_request_notes}
        </div>
      )}

      {/* Auto-match result banner */}
      {autoMatchResult && !autoMatchResult.auto_approvable && (
        <div className="mx-4 mb-3 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs space-y-1">
          <p className="text-yellow-300 font-medium">نتائج المطابقة:</p>
          {autoMatchResult.recommendations.map((r, i) => (
            <p key={i} className="text-yellow-400/80">{r}</p>
          ))}
        </div>
      )}

      {/* Stored auto-match from DB */}
      {!autoMatchResult && matchResults?.recommendations && matchResults.recommendations.length > 0 && (
        <div className="mx-4 mb-3 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs space-y-1">
          <p className="text-yellow-300 font-medium">💡 توصيات المطابقة:</p>
          {matchResults.recommendations.map((r: string, i: number) => (
            <p key={i} className="text-yellow-400/80">{r}</p>
          ))}
        </div>
      )}

      {/* Expanded properties */}
      {expanded && (
        <div className="mx-4 mb-3">
          <pre className="text-xs bg-slate-950/60 border border-slate-800 rounded p-3 overflow-auto max-h-40 text-slate-400 leading-relaxed">
            {JSON.stringify(
              Object.fromEntries(
                Object.entries(props).filter(([k]) => !k.startsWith('_'))
              ),
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Action area */}
      {action === 'reject' ? (
        <div className="border-t border-slate-800 p-4 space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="سبب الرفض (مطلوب)"
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-2">
            <button
              onClick={submitReject}
              disabled={!rejectReason.trim() || isLoading}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-1.5 rounded-lg transition-colors"
            >
              تأكيد الرفض
            </button>
            <button
              onClick={() => setAction('idle')}
              className="px-3 text-slate-400 hover:text-slate-200 text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : action === 'approve' ? (
        <div className="border-t border-slate-800 p-4 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات الاعتماد (اختياري)"
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={submitApprove}
              disabled={isLoading}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm py-1.5 rounded-lg transition-colors"
            >
              {isLoading ? 'جارٍ الاعتماد...' : 'تأكيد الاعتماد'}
            </button>
            <button
              onClick={() => setAction('idle')}
              className="px-3 text-slate-400 hover:text-slate-200 text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 px-4 py-3 flex gap-2">
          <button
            onClick={() => setAction('approve')}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-green-800/40 hover:bg-green-700/60 text-green-300 border border-green-700/50 text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> اعتماد
          </button>
          <button
            onClick={() => setAction('reject')}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-red-800/40 hover:bg-red-700/60 text-red-300 border border-red-700/50 text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> رفض
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function ReviewModal({ onClose, department }: ReviewModalProps) {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/review/pending/${department}?tenant_id=${getTenantId() || ''}&limit=50`,
        { headers: { 'X-Tenant-ID': getTenantId() || '' } }
      );
      const data: PendingResponse = await res.json();
      setItems(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  async function handleBatchMatch() {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await fetch(
        `/api/v1/review/auto-match/batch/pending?tenant_id=${getTenantId() || ''}&limit=100`,
        { method: 'POST', headers: { 'X-Tenant-ID': getTenantId() || '' } }
      );
      const data: BatchResult = await res.json();
      setBatchResult(data);
      // Refresh list after batch
      await fetchPending();
    } finally {
      setBatchLoading(false);
    }
  }

  function removeItem(assetId: string) {
    setItems((prev) => prev.filter((i) => i.asset_id !== assetId));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{DEPT_LABELS[department]}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {loading ? 'جارٍ التحميل...' : `${total} عنصر في قائمة الانتظار`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchMatch}
              disabled={batchLoading || loading}
              className="flex items-center gap-1.5 bg-indigo-700/40 hover:bg-indigo-700/70 text-indigo-300 border border-indigo-600/50 text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5" />
              {batchLoading ? 'جارٍ المعالجة...' : 'مطابقة تلقائية للكل'}
            </button>
            <button
              onClick={fetchPending}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
              title="تحديث"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Batch result banner */}
        {batchResult && (
          <div className="mx-5 mt-4 p-3 bg-indigo-900/30 border border-indigo-700/50 rounded-lg text-sm shrink-0">
            <p className="text-indigo-300 font-medium">نتيجة المطابقة التلقائية</p>
            <div className="flex gap-4 mt-1 text-xs">
              <span className="text-green-400">✓ {batchResult.auto_approved} اعتمدوا تلقائيًا</span>
              <span className="text-yellow-400">⏳ {batchResult.requires_review} يحتاجون مراجعة</span>
              <span className="text-slate-400">المجموع: {batchResult.processed}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RotateCcw className="w-5 h-5 animate-spin ml-2" />
              جارٍ التحميل...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <CheckCircle className="w-10 h-10 text-green-600/50" />
              <p>لا توجد عناصر تنتظر المراجعة</p>
            </div>
          ) : (
            items.map((item) => (
              <AssetCard
                key={item.asset_id}
                item={item}
                department={department}
                onApproved={removeItem}
                onRejected={removeItem}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
