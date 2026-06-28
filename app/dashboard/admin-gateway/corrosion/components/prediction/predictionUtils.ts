import { CpPredictedSegment } from '../../types';

export const PROTECTED_THRESHOLD = -850;
export const MARGINAL_THRESHOLD = -700;

export function trendColor(v: number | null) {
  if (v === null) return 'text-slate-400';
  return v > 0 ? 'text-red-400' : 'text-emerald-400';
}

export function accColor(v: number) {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function segColor(cls: string) {
  if (cls === 'PROTECTED') return '#10b981';
  if (cls === 'MARGINAL') return '#f59e0b';
  return '#ef4444';
}

export function segBgClass(cls: string) {
  if (cls === 'PROTECTED') return 'bg-emerald-500';
  if (cls === 'MARGINAL') return 'bg-amber-500';
  return 'bg-red-500';
}

export function parseSegmentRange(segId: string): { start: number; end: number } {
  const m = segId.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { start: Math.min(start, end), end: Math.max(start, end) };
    }
  }
  return { start: 0, end: 100 };
}

export function escapeHtml(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function healthScore(segs: CpPredictedSegment[]): number {
  if (!segs.length) return 0;
  const score = segs.reduce((acc, s) => {
    if (s.predicted_class === 'PROTECTED') return acc + 100;
    if (s.predicted_class === 'MARGINAL') return acc + 45;
    return acc;
  }, 0);
  return Math.round(score / segs.length);
}

export function healthLabel(score: number) {
  if (score >= 80) return { label: 'سليم', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (score >= 50) return { label: 'متوسط', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
  if (score >= 20) return { label: 'ضعيف', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { label: 'حرج', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
}

export function monthsToMarginal(avgMv: number, trendMvPerYear: number): number | null {
  if (trendMvPerYear <= 0) return null;
  if (avgMv >= MARGINAL_THRESHOLD) return 0;
  const delta = MARGINAL_THRESHOLD - avgMv;
  return Math.round((delta / trendMvPerYear) * 12);
}

export function buildAlerts(segs: CpPredictedSegment[], trend: number | null, score: number): string[] {
  const alerts: string[] = [];
  const risk = segs.filter((s) => s.predicted_class === 'NOT_PROTECTED');
  const marg = segs.filter((s) => s.predicted_class === 'MARGINAL');

  if (risk.length === segs.length && segs.length > 0) {
    alerts.push('جميع المقاطع بلا حماية كافية — يُوصى بفحص نظام الحماية الكاثودية فوراً');
  } else if (risk.length > segs.length * 0.5) {
    alerts.push(`${risk.length} من ${segs.length} مقطع بلا حماية (${Math.round((risk.length / segs.length) * 100)}%) — خطر تآكل مرتفع`);
  }

  if (trend !== null && trend > 0) alerts.push(`اتجاه الجهد تصاعدي (+${trend.toFixed(1)} mV/سنة) — الحماية تتراجع`);
  if (trend !== null && trend > 50) alerts.push('معدل تدهور الحماية حاد جداً — يلزم مراجعة مصادر التيار الكاثودي');
  if (marg.length > 0) alerts.push(`${marg.length} مقطع هامشي (−850 ↔ −700 mV) تحتاج مراقبة دورية`);
  if (score < 30) alerts.push('مؤشر سلامة الخط حرج — الأولوية القصوى للصيانة');

  return alerts;
}
