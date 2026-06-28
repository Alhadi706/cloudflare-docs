'use client';

/**
 * ReportLayout — هيكل تقرير موحّد لجميع صفحات التقارير
 *
 * الهيكل:
 *  1. Header          — العنوان + آخر تحديث + زر تحديث
 *  2. ExecutiveSummary — 3 بطاقات (الحالة / أهم خطر / أهم فرصة)
 *  3. KpiRow          — 4-6 مقاييس رئيسية
 *  4. MainSection     — المخطط الرئيسي الكبير
 *  5. SecondarySection — مخططان جانبيان (توزيع + مقارنة)
 *  6. DataTable       — جدول تفصيلي
 *  7. SmartInsights   — ملاحظات ذكية مولّدة تلقائياً
 */

import React, { ReactNode } from 'react';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, AlertTriangle, TrendingUp, CheckCircle,
  Info, Lightbulb,
} from 'lucide-react';

// ── أنواع البيانات ────────────────────────────────────────────────────────────

export interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
  /** blue | green | amber | rose | teal | violet | indigo | orange */
  color?: string;
  /** سهم للتغيير (up | down | neutral) */
  trend?: 'up' | 'down' | 'neutral';
}

export interface ExecutiveSummary {
  /** الحالة العامة */
  status: { label: string; detail: string; level: 'good' | 'warning' | 'critical' };
  /** أهم خطر */
  risk:   { label: string; detail: string };
  /** أهم فرصة */
  opportunity: { label: string; detail: string };
}

export interface SmartInsight {
  text: string;
  type: 'warning' | 'info' | 'success';
}

export interface ReportLayoutProps {
  /** عنوان التقرير */
  title: string;
  /** أيقونة (مكوّن SVG) */
  icon: ReactNode;
  /** لون الأيقونة الخلفي (Tailwind class مثل bg-blue-600/20) */
  iconBg?: string;
  /** لون حدود الأيقونة */
  iconBorder?: string;
  /** لون نص الأيقونة */
  iconColor?: string;
  /** مسار الصفحة للروابط التفتيتية */
  breadcrumb?: { label: string; href: string }[];
  /** آخر وقت تحديث (ISO string) */
  generatedAt?: string;
  /** حالة التحميل */
  loading?: boolean;
  /** رسالة خطأ */
  error?: string;
  /** دالة إعادة التحميل */
  onRefresh?: () => void;

  /** ملخص تنفيذي */
  executiveSummary?: ExecutiveSummary;
  /** مقاييس KPI */
  kpis?: KpiItem[];
  /** المحتوى الرئيسي (مخطط كبير أو جدول) */
  mainSection?: ReactNode;
  /** المحتوى الثانوي — عنصران جانبيان */
  secondaryLeft?: ReactNode;
  secondaryRight?: ReactNode;
  /** عنوان القسم الثانوي الأيسر */
  secondaryLeftTitle?: string;
  /** عنوان القسم الثانوي الأيمن */
  secondaryRightTitle?: string;
  /** عنوان الجدول التفصيلي */
  tableTitle?: string;
  /** الجدول التفصيلي */
  dataTable?: ReactNode;
  /** ملاحظات ذكية */
  insights?: SmartInsight[];
  /** قسم إضافي بين المخططات الثانوية والجدول */
  extraSection?: ReactNode;
  /** عنوان القسم الإضافي */
  extraSectionTitle?: string;
  /** شريط الفلاتر — يظهر تحت الـ Header (اختياري) */
  filterBar?: ReactNode;
}

// ── ألوان ────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-950/30',   text: 'text-blue-300'   },
  green:  { border: 'border-green-500/30',  bg: 'bg-green-950/30',  text: 'text-green-300'  },
  amber:  { border: 'border-amber-500/30',  bg: 'bg-amber-950/30',  text: 'text-amber-300'  },
  rose:   { border: 'border-rose-500/30',   bg: 'bg-rose-950/30',   text: 'text-rose-300'   },
  teal:   { border: 'border-teal-500/30',   bg: 'bg-teal-950/30',   text: 'text-teal-300'   },
  violet: { border: 'border-violet-500/30', bg: 'bg-violet-950/30', text: 'text-violet-300' },
  indigo: { border: 'border-indigo-500/30', bg: 'bg-indigo-950/30', text: 'text-indigo-300' },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-950/30', text: 'text-orange-300' },
};

// ── مكوّنات داخلية ────────────────────────────────────────────────────────────

function KpiCard({ item }: { item: KpiItem }) {
  const c = COLOR_MAP[item.color ?? 'blue'] ?? COLOR_MAP.blue;
  const trend =
    item.trend === 'up'      ? <span className="text-green-400 text-sm">▲</span>
    : item.trend === 'down'  ? <span className="text-rose-400 text-sm">▼</span>
    : null;
  return (
    <div className={`rounded-xl border p-5 ${c.border} ${c.bg} flex flex-col gap-1.5`}>
      <p className="text-sm text-slate-400 leading-snug">{item.label}</p>
      <p className="text-2xl font-bold text-slate-100 flex items-center gap-1">
        {item.value} {trend}
      </p>
      {item.sub && <p className="text-sm text-slate-500">{item.sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
      {children}
    </h2>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function ExecSummaryCards({ summary }: { summary: ExecutiveSummary }) {
  const statusStyle = {
    good:     { bg: 'bg-green-950/40',  border: 'border-green-500/40',  icon: <CheckCircle  className="w-5 h-5 text-green-400" />, badge: 'text-green-400' },
    warning:  { bg: 'bg-amber-950/40',  border: 'border-amber-500/40',  icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, badge: 'text-amber-400' },
    critical: { bg: 'bg-rose-950/40',   border: 'border-rose-500/40',   icon: <AlertTriangle className="w-5 h-5 text-rose-400"  />, badge: 'text-rose-400'  },
  }[summary.status.level];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* الحالة العامة */}
      <div className={`rounded-xl border p-5 ${statusStyle.bg} ${statusStyle.border}`}>
        <div className="flex items-center gap-2 mb-2">
          {statusStyle.icon}
          <span className={`text-base font-semibold ${statusStyle.badge}`}>الحالة العامة</span>
        </div>
        <p className="text-slate-100 font-bold text-lg">{summary.status.label}</p>
        <p className="text-slate-400 text-sm mt-1.5">{summary.status.detail}</p>
      </div>

      {/* أهم خطر */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <span className="text-base font-semibold text-rose-300">أهم خطر</span>
        </div>
        <p className="text-slate-100 font-bold text-lg">{summary.risk.label}</p>
        <p className="text-slate-400 text-sm mt-1.5">{summary.risk.detail}</p>
      </div>

      {/* أهم فرصة */}
      <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-teal-400" />
          <span className="text-base font-semibold text-teal-300">أهم فرصة</span>
        </div>
        <p className="text-slate-100 font-bold text-lg">{summary.opportunity.label}</p>
        <p className="text-slate-400 text-sm mt-1.5">{summary.opportunity.detail}</p>
      </div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: SmartInsight[] }) {
  if (!insights.length) return null;
  const style = {
    warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />, bg: 'bg-amber-950/20 border-amber-500/20' },
    info:    { icon: <Info          className="w-4 h-4 text-blue-400  flex-shrink-0 mt-0.5" />, bg: 'bg-blue-950/20  border-blue-500/20'  },
    success: { icon: <CheckCircle   className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />, bg: 'bg-green-950/20 border-green-500/20' },
  };
  return (
    <Panel>
      <SectionTitle>
        <Lightbulb className="w-5 h-5 text-yellow-400" /> ملاحظات ذكية
      </SectionTitle>
      <div className="space-y-2">
        {insights.map((ins, i) => {
          const s = style[ins.type];
          return (
            <div key={i} className={`flex items-start gap-3 rounded-lg border p-4 text-base text-slate-300 ${s.bg}`}>
              {s.icon}
              <span>{ins.text}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── شاشة التحميل ─────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* filter bar skeleton */}
      <div className="h-12 rounded-xl bg-slate-800/50" />
      {/* exec summary */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_,i) => <div key={i} className="h-28 rounded-xl bg-slate-800/60" />)}
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_,i) => <div key={i} className="h-[76px] rounded-xl bg-slate-800/40" />)}
      </div>
      {/* main chart */}
      <div className="h-72 rounded-2xl bg-slate-800/40" />
      {/* secondary charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-52 rounded-2xl bg-slate-800/30" />
        <div className="h-52 rounded-2xl bg-slate-800/30" />
      </div>
    </div>
  );
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────────────────

export default function ReportLayout({
  title,
  icon,
  iconBg     = 'bg-blue-600/20',
  iconBorder = 'border-blue-500/50',
  iconColor  = 'text-blue-400',
  breadcrumb = [],
  generatedAt,
  loading     = false,
  error,
  onRefresh,
  executiveSummary,
  kpis        = [],
  mainSection,
  secondaryLeft,
  secondaryRight,
  secondaryLeftTitle  = 'التوزيع',
  secondaryRightTitle = 'المقارنة',
  tableTitle  = 'التفاصيل',
  dataTable,
  insights          = [],
  extraSection,
  extraSectionTitle = 'تحليلات إضافية',
  filterBar,
}: ReportLayoutProps) {
  const defaultCrumb = [
    { label: 'بوابة الإدارة', href: '/dashboard/admin-gateway' },
    { label: 'التقارير', href: '/dashboard/admin-gateway/reports' },
  ];
  const crumbs = [...defaultCrumb, ...breadcrumb];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-base text-slate-400">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronLeft className="w-4 h-4 flex-shrink-0" />}
              {i < crumbs.length - 1
                ? <Link href={c.href} className="hover:text-slate-200 transition-colors">{c.label}</Link>
                : <span className="text-slate-200">{c.label}</span>
              }
            </React.Fragment>
          ))}
        </nav>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className={`${iconBg} p-4 rounded-xl border ${iconBorder}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
            {generatedAt && (
              <p className="text-sm text-slate-400 mt-1.5">
                آخر تحديث: {new Date(generatedAt).toLocaleString('ar-LY')}
              </p>
            )}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-base text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'جاري التحميل...' : 'تحديث'}
            </button>
          )}
        </div>

        {/* ── Filter Bar ──────────────────────────────────────────────── */}
        {filterBar && <div>{filterBar}</div>}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-4 text-red-300 text-base flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Loading skeleton ────────────────────────────────────────── */}
        {loading && !error && <Skeleton />}

        {/* ── Content ─────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* 2. Executive Summary */}
            {executiveSummary && (
              <section>
                <SectionTitle>الملخص التنفيذي</SectionTitle>
                <ExecSummaryCards summary={executiveSummary} />
              </section>
            )}

            {/* 3. KPI Row */}
            {kpis.length > 0 && (
              <section>
                <SectionTitle>المقاييس الرئيسية</SectionTitle>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  {kpis.map((k, i) => <KpiCard key={i} item={k} />)}
                </div>
              </section>
            )}

            {/* 4. Main Section */}
            {mainSection && (
              <Panel>
                {mainSection}
              </Panel>
            )}

            {/* 5. Secondary Sections */}
            {(secondaryLeft || secondaryRight) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secondaryLeft && (
                  <Panel>
                    <SectionTitle>{secondaryLeftTitle}</SectionTitle>
                    {secondaryLeft}
                  </Panel>
                )}
                {secondaryRight && (
                  <Panel>
                    <SectionTitle>{secondaryRightTitle}</SectionTitle>
                    {secondaryRight}
                  </Panel>
                )}
              </div>
            )}

            {/* 5.5 Extra Section */}
            {extraSection && (
              <Panel>
                <SectionTitle>{extraSectionTitle}</SectionTitle>
                {extraSection}
              </Panel>
            )}

            {/* 6. Data Table */}
            {dataTable && (
              <Panel>
                <SectionTitle>{tableTitle}</SectionTitle>
                <div className="overflow-x-auto -mx-1">
                  {dataTable}
                </div>
              </Panel>
            )}

            {/* 7. Smart Insights */}
            {insights.length > 0 && <InsightsPanel insights={insights} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── صادرات مساعِدة تُستخدم في صفحات التقرير ─────────────────────────────────

/** شريط نسبة مئوية بسيط */
export function PercentBar({ value, max, color = '#3b82f6' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/** خلية الحالة (badge) */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-500/20 text-green-300',
    draft:  'bg-slate-600/40 text-slate-400',
    issued: 'bg-violet-500/20 text-violet-300',
    completed: 'bg-blue-500/20 text-blue-300',
    pending: 'bg-amber-500/20 text-amber-300',
    approved: 'bg-green-500/20 text-green-300',
    rejected: 'bg-rose-500/20 text-rose-300',
    terminated: 'bg-rose-500/20 text-rose-300',
    maintenance: 'bg-orange-500/20 text-orange-300',
    planning: 'bg-indigo-500/20 text-indigo-300',
    on_hold: 'bg-amber-500/20 text-amber-300',
  };
  const cls = map[status?.toLowerCase()] ?? 'bg-slate-600/40 text-slate-400';
  return <span className={`text-sm px-2.5 py-0.5 rounded-full ${cls}`}>{status ?? '—'}</span>;
}

/** تنسيق الأرقام */
export function fmt(v?: number | null, decimals = 0): string {
  if (v == null) return '—';
  return v.toLocaleString('ar-LY', { maximumFractionDigits: decimals });
}
