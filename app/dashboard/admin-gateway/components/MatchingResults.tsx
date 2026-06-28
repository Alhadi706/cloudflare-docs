'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7860';
const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

// ── Types ────────────────────────────────────────────────────────────────────

interface CheckDetail {
  ok: boolean;
  message?: string;
  [key: string]: unknown;
}

interface MatchResultData {
  asset_internal_id: string;
  asset_id_label: string;
  asset_name: string;
  asset_type: string;
  auto_approvable: boolean;
  checks: {
    staff: CheckDetail & {
      staff_total_in_data?: number;
      employees_in_admin_db?: number;
      deviation_pct?: number;
    };
    location: CheckDetail & {
      conflicting_assets?: { asset_id: string; name: string; distance_m: number }[];
    };
    budget: CheckDetail & {
      new_budget?: number;
      avg_similar_assets?: number;
      deviation_pct?: number;
    };
    duplicate: CheckDetail & {
      existing_names?: string[];
    };
  };
  recommendations: string[];
  routing: {
    requires_gis_review: boolean;
    requires_admin_review: boolean;
    requires_finance_review: boolean;
  };
}

interface Props {
  assetInternalId: string;
  onAutoApproved?: () => void;
  onNeedsReview?: (result: MatchResultData) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CheckBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        ok
          ? 'bg-green-900/40 text-green-300 border border-green-700'
          : 'bg-red-900/40 text-red-300 border border-red-700'
      }`}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MatchingResults({ assetInternalId, onAutoApproved, onNeedsReview }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<number | null>(null);

  // ── Run matching ────────────────────────────────────────────────────────────

  async function runMatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/v1/review/auto-match/${assetInternalId}?tenant_id=${getTenantId() || ''}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MatchResultData = await res.json();
      setResult(data);
      if (data.auto_approvable) {
        onAutoApproved?.();
      } else {
        onNeedsReview?.(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطأ في المطابقة');
    } finally {
      setLoading(false);
    }
  }

  // ── Transfer employee ───────────────────────────────────────────────────────

  async function handleTransfer(employeeId: number, fromAssetId: string) {
    setTransferring(employeeId);
    try {
      await fetch(`${API}/employee/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          from_asset_id: fromAssetId,
          to_asset_id: assetInternalId,
          tenant_id: getTenantId() || '',
          reason: 'تأكيد من لوحة المراجعة',
        }),
      });
    } finally {
      setTransferring(null);
    }
  }

  // ── Idle state ──────────────────────────────────────────────────────────────

  if (!result) {
    return (
      <button
        onClick={runMatch}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <span className="animate-spin">⟳</span> جارٍ المطابقة...
          </>
        ) : (
          <>🔍 تشغيل المطابقة الذكية</>
        )}
      </button>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
        ⚠️ {error}
        <button onClick={runMatch} className="ml-3 underline text-xs">إعادة المحاولة</button>
      </div>
    );
  }

  // ── Auto-approved ───────────────────────────────────────────────────────────

  if (result.auto_approvable) {
    return (
      <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-400 text-xl">✅</span>
          <h3 className="text-green-300 font-semibold">اعتماد تلقائي</h3>
        </div>
        <p className="text-green-400/80 text-sm">
          جميع فحوصات المطابقة اجتازت بنجاح — تمت الموافقة التلقائية على هذا الأصل.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CheckBadge ok={result.checks.duplicate.ok} label="لا تكرار" />
          <CheckBadge ok={result.checks.location.ok} label="الموقع سليم" />
          <CheckBadge ok={result.checks.staff.ok} label="الموظفون" />
          <CheckBadge ok={result.checks.budget.ok} label="الميزانية" />
        </div>
      </div>
    );
  }

  // ── Needs review ────────────────────────────────────────────────────────────

  return (
    <div className="bg-yellow-900/10 border border-yellow-700/50 rounded-lg p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-yellow-300 font-semibold flex items-center gap-2">
          📋 نتائج المطابقة الذكية
        </h3>
        <div className="flex flex-wrap gap-2">
          <CheckBadge ok={result.checks.duplicate.ok} label="لا تكرار" />
          <CheckBadge ok={result.checks.location.ok} label="الموقع" />
          <CheckBadge ok={result.checks.staff.ok} label="الموظفون" />
          <CheckBadge ok={result.checks.budget.ok} label="الميزانية" />
        </div>
      </div>

      {/* Duplicate conflict */}
      {!result.checks.duplicate.ok && result.checks.duplicate.existing_names && (
        <div className="bg-red-900/20 border border-red-800 rounded p-3">
          <p className="text-red-300 font-medium mb-1">
            🔁 تكرار في الاسم ({result.checks.duplicate.existing_names.length} سجل مشابه)
          </p>
          <ul className="list-disc list-inside text-red-400/80 space-y-0.5">
            {result.checks.duplicate.existing_names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Location conflicts */}
      {!result.checks.location.ok && result.checks.location.conflicting_assets && (
        <div className="bg-orange-900/20 border border-orange-800 rounded p-3">
          <p className="text-orange-300 font-medium mb-1">
            📍 تعارض جغرافي ({result.checks.location.conflicting_assets.length} أصل قريب)
          </p>
          <div className="space-y-1">
            {result.checks.location.conflicting_assets.map((a) => (
              <div key={a.asset_id} className="flex justify-between text-orange-400/80">
                <span>{a.name}</span>
                <span className="text-xs">{a.distance_m} م</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff deviation */}
      {!result.checks.staff.ok && (
        <div className="bg-blue-900/20 border border-blue-800 rounded p-3">
          <p className="text-blue-300 font-medium mb-1">👥 فارق في عدد الموظفين</p>
          <div className="text-blue-400/80 space-y-0.5">
            <p>في البيانات الجديدة: <strong>{result.checks.staff.staff_total_in_data}</strong></p>
            <p>في سجلات الإدارة: <strong>{result.checks.staff.employees_in_admin_db}</strong></p>
            <p>الانحراف: <strong>{result.checks.staff.deviation_pct}%</strong></p>
          </div>
        </div>
      )}

      {/* Budget deviation */}
      {!result.checks.budget.ok && (
        <div className="bg-purple-900/20 border border-purple-800 rounded p-3">
          <p className="text-purple-300 font-medium mb-1">💰 انحراف في الميزانية</p>
          <div className="text-purple-400/80 space-y-0.5">
            <p>الميزانية الجديدة: <strong>{result.checks.budget.new_budget?.toLocaleString('ar')}</strong></p>
            <p>متوسط المشابهة: <strong>{result.checks.budget.avg_similar_assets?.toLocaleString('ar')}</strong></p>
            <p>الانحراف: <strong>{result.checks.budget.deviation_pct}%</strong></p>
          </div>
        </div>
      )}

      {/* Routing badges */}
      {(result.routing.requires_gis_review || result.routing.requires_admin_review || result.routing.requires_finance_review) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {result.routing.requires_gis_review && (
            <span className="text-xs bg-green-900/30 text-green-300 border border-green-700 px-2 py-0.5 rounded-full">
              → مطلوب مراجعة GIS
            </span>
          )}
          {result.routing.requires_admin_review && (
            <span className="text-xs bg-yellow-900/30 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded-full">
              → مطلوب مراجعة الإدارة
            </span>
          )}
          {result.routing.requires_finance_review && (
            <span className="text-xs bg-purple-900/30 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full">
              → مطلوب مراجعة المالية
            </span>
          )}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="pt-2 border-t border-yellow-800/40">
          <p className="text-yellow-400 font-medium mb-1">💡 التوصيات:</p>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-yellow-300/80 text-xs">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-run button */}
      <button
        onClick={runMatch}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-200 underline"
      >
        إعادة تشغيل المطابقة
      </button>
    </div>
  );
}

// ── Batch trigger component ───────────────────────────────────────────────────

export function BatchMatchTrigger({ onComplete }: { onComplete?: (summary: unknown) => void }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<null | {
    processed: number;
    auto_approved: number;
    requires_review: number;
  }>(null);

  async function runBatch() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/v1/review/auto-match/batch/pending?tenant_id=${getTenantId() || ''}&limit=100`,
        { method: 'POST' }
      );
      const data = await res.json();
      setSummary(data);
      onComplete?.(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={runBatch}
        disabled={loading}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? (
          <><span className="animate-spin">⟳</span> جارٍ المعالجة...</>
        ) : (
          <>⚡ مطابقة دفعية — كل الانتظار</>
        )}
      </button>
      {summary && !loading && (
        <div className="text-xs text-gray-400 space-x-3 space-x-reverse flex gap-3">
          <span className="text-green-400">✓ {summary.auto_approved} اعتمد تلقائيًا</span>
          <span className="text-yellow-400">⏳ {summary.requires_review} يحتاج مراجعة</span>
        </div>
      )}
    </div>
  );
}
