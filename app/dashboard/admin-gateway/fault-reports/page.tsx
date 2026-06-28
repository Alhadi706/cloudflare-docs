'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  Wrench, MapPin, User, Calendar, ExternalLink, Filter,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type FaultSeverity = 'critical' | 'high' | 'medium' | 'low';
type FaultStatus   = 'open' | 'acknowledged' | 'resolved';

interface FaultReport {
  id: string;
  employee_no: string;
  employee_name?: string;
  title: string;
  description: string;
  location_name?: string;
  severity: FaultSeverity;
  reported_at: string;
  status: FaultStatus;
  linked_work_order_id?: number;
  linked_work_order_number?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('auth_token') || '';
    if (t) h['Authorization'] = `Bearer ${t}`;
  }
  return h;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ar-LY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEVERITY_CONFIG: Record<FaultSeverity, { label: string; dot: string; badge: string }> = {
  critical: { label: 'حرج',    dot: 'bg-red-400',    badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  high:     { label: 'عالي',   dot: 'bg-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  medium:   { label: 'متوسط',  dot: 'bg-amber-400',  badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  low:      { label: 'منخفض',  dot: 'bg-green-400',  badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
};

const STATUS_CONFIG: Record<FaultStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  open:         { label: 'مفتوح',       icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  acknowledged: { label: 'تم الاستلام', icon: <Clock className="w-3.5 h-3.5" />,         badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  resolved:     { label: 'مغلق',        icon: <CheckCircle2 className="w-3.5 h-3.5" />,  badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
};

// ── FaultCard ─────────────────────────────────────────────────────────────────

function FaultCard({
  report,
  onAcknowledge,
  onResolve,
  busy,
}: {
  report: FaultReport;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  busy: string | null;
}) {
  const sev = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.medium;
  const sts = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open;
  const isBusy = busy === report.id;

  return (
    <div className={`rounded-2xl border bg-slate-900/60 p-4 space-y-3 transition-all ${
      report.status === 'resolved' ? 'border-slate-700/40 opacity-70' : 'border-slate-700/60'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${sev.dot} shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[11px] rounded-full border px-2 py-0.5 font-semibold flex items-center gap-1 ${sev.badge}`}>
              {sev.label}
            </span>
            <span className={`text-[11px] rounded-full border px-2 py-0.5 font-semibold flex items-center gap-1 ${sts.badge}`}>
              {sts.icon} {sts.label}
            </span>
          </div>
          <h3 className="font-bold text-white text-sm leading-snug">{report.title}</h3>
        </div>
        <span className="text-[10px] text-slate-500 shrink-0 font-mono mt-0.5">
          {report.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-300 leading-5 line-clamp-3">{report.description}</p>

      {/* Meta rows */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <User className="w-3.5 h-3.5 shrink-0" />
          <span>{report.employee_name || report.employee_no}</span>
        </div>
        {report.location_name && (
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{report.location_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-400 col-span-2">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{formatDate(report.reported_at)}</span>
        </div>
      </div>

      {/* Linked WO */}
      {report.linked_work_order_number && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-xs text-cyan-300">
            أمر عمل مرتبط: <span className="font-mono font-bold">{report.linked_work_order_number}</span>
          </span>
          {report.acknowledged_by && (
            <span className="mr-auto text-[10px] text-slate-400">بواسطة {report.acknowledged_by}</span>
          )}
        </div>
      )}

      {/* Actions */}
      {report.status === 'open' && (
        <button
          onClick={() => onAcknowledge(report.id)}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-700/80 hover:bg-amber-600 py-2.5 text-xs font-black text-white transition-colors disabled:opacity-60"
        >
          {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          {isBusy ? 'جارٍ المعالجة...' : 'استلام البلاغ وإنشاء أمر عمل تلقائياً'}
        </button>
      )}
      {report.status === 'acknowledged' && (
        <button
          onClick={() => onResolve(report.id)}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 py-2.5 text-xs font-black text-white transition-colors disabled:opacity-60"
        >
          {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isBusy ? 'جارٍ المعالجة...' : 'إغلاق البلاغ يدوياً'}
        </button>
      )}
      {report.status === 'resolved' && report.resolved_at && (
        <p className="text-[11px] text-emerald-400 text-center">
          ✓ تم الإغلاق في {formatDate(report.resolved_at)}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FaultReportsDashboard() {
  const [reports, setReports]   = useState<FaultReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState<string | null>(null);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState<'all' | FaultStatus>('all');
  const [toast, setToast]       = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mobile/fault-report?mode=all', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('ليس لديك صلاحية لعرض بلاغات العطل. تأكد من أن دورك مشرف أو مدير.');
        } else {
          setError(`خطأ في جلب البيانات (${res.status})`);
        }
        return;
      }
      const data = await res.json().catch(() => ({}));
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const acknowledge = async (faultId: string) => {
    setBusy(faultId);
    try {
      const res = await fetch('/api/auth/mobile/fault-report', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'update_status', fault_id: faultId, status: 'acknowledged' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          data.work_order_number
            ? `✓ تم الاستلام — أمر عمل ${data.work_order_number} أُنشئ تلقائياً`
            : '✓ تم تسجيل الاستلام',
        );
        await load();
      } else {
        showToast(`خطأ: ${data.detail || 'فشل التحديث'}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (faultId: string) => {
    setBusy(faultId);
    try {
      const res = await fetch('/api/auth/mobile/fault-report', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'update_status', fault_id: faultId, status: 'resolved' }),
      });
      if (res.ok) {
        showToast('✓ تم إغلاق البلاغ');
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(`خطأ: ${data.detail || 'فشل الإغلاق'}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  const counts = {
    all:         reports.length,
    open:        reports.filter(r => r.status === 'open').length,
    acknowledged:reports.filter(r => r.status === 'acknowledged').length,
    resolved:    reports.filter(r => r.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-emerald-500/30 bg-emerald-950/90 px-5 py-3 text-sm text-emerald-300 font-semibold shadow-xl backdrop-blur">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-white transition-colors">
            لوحة الإدارة
          </Link>
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span className="text-white font-semibold">بلاغات الأعطال</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">بلاغات الأعطال الميدانية</h1>
            <p className="text-sm text-slate-400 mt-1">
              استلام البلاغات من الفريق الميداني — إنشاء أوامر العمل — إغلاق البلاغات
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'all',          label: 'الكل',        count: counts.all,          color: 'text-slate-300' },
            { key: 'open',         label: 'مفتوحة',      count: counts.open,         color: 'text-rose-300' },
            { key: 'acknowledged', label: 'تحت المعالجة',count: counts.acknowledged, color: 'text-amber-300' },
            { key: 'resolved',     label: 'مغلقة',       count: counts.resolved,     color: 'text-emerald-300' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key as any)}
              className={`rounded-2xl border p-3 text-center transition-all ${
                filter === s.key
                  ? 'border-slate-500 bg-slate-800'
                  : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
              }`}
            >
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          {(['all', 'open', 'acknowledged', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs rounded-full px-3 py-1.5 border font-semibold transition-colors ${
                filter === f
                  ? 'bg-slate-700 border-slate-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {f === 'all' ? 'الكل' : STATUS_CONFIG[f].label}
              {' '}({counts[f]})
            </button>
          ))}
        </div>

        {/* Content */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 w-8 h-8 text-rose-400" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {!error && loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-400">جارٍ تحميل البلاغات…</p>
          </div>
        )}

        {!error && !loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 w-10 h-10 text-emerald-400" />
            <p className="text-base font-bold text-slate-300">
              {filter === 'all' ? 'لا توجد بلاغات مسجلة' : `لا توجد بلاغات ${STATUS_CONFIG[filter as FaultStatus]?.label || ''}`}
            </p>
          </div>
        )}

        {!error && !loading && filtered.length > 0 && (
          <div className="space-y-4">
            {/* Critical first */}
            {['critical', 'high', 'medium', 'low'].flatMap(sev =>
              filtered
                .filter(r => r.severity === sev)
                .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
                .map(r => (
                  <FaultCard
                    key={r.id}
                    report={r}
                    onAcknowledge={acknowledge}
                    onResolve={resolve}
                    busy={busy}
                  />
                ))
            )}
          </div>
        )}

        {/* Link to work orders */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/30 px-4 py-3 flex items-center gap-3">
          <Wrench className="w-5 h-5 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300">أوامر العمل المرتبطة تجدها في لوحة الصيانة</p>
          </div>
          <Link
            href="/dashboard/admin-gateway/maintenance/work-orders"
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
          >
            فتح <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
