/**
 * temporalContextHelper.ts
 * ========================
 * Pure time-aware utilities for Spatiotemporal Context Broker — Phase S9
 *
 * No side effects, no API calls. Safe to use in any component or utility.
 */

import type { SceneListItem } from "./satelliteIntelAPI";
import type { TemporalMatchClass } from "./contextBrokerTypes";

// ─── Date parsing ──────────────────────────────────────────────────────────────

export function parseISODate(isoStr: string | null | undefined): Date | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d;
}

export function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── Gap calculation ───────────────────────────────────────────────────────────

/** Returns absolute gap in days between two ISO date strings or Date objects */
export function sceneDateGapDays(
  a: string | Date | null,
  b: string | Date | null,
): number {
  const da = typeof a === "string" ? parseISODate(a) : a;
  const db = typeof b === "string" ? parseISODate(b) : b;
  if (!da || !db) return Infinity;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86_400_000));
}

// ─── Temporal match classification ────────────────────────────────────────────

/**
 * Classify how well a scene date matches a requested date.
 *
 *  exact       = same day
 *  near        = within 14 days
 *  approximate = within 90 days
 *  historical  = > 90 days
 *  none        = no scene date available
 */
export function classifyTemporalMatch(
  requestedDate: string | Date | null,
  sceneDate:     string | Date | null,
): TemporalMatchClass {
  if (!sceneDate) return "none";
  const gap = sceneDateGapDays(requestedDate, sceneDate);
  if (gap === 0)    return "exact";
  if (gap <= 14)   return "near";
  if (gap <= 90)   return "approximate";
  return "historical";
}

// ─── Arabic gap formatting ─────────────────────────────────────────────────────

export function formatTemporalGapAr(days: number | null | undefined): string {
  if (days === null || days === undefined) return "غير محدد";
  if (days === 0)    return "نفس اليوم";
  if (days === 1)    return "يوم واحد";
  if (days === 2)    return "يومان";
  if (days <= 10)   return `${days} أيام`;
  if (days <= 30)   return `${days} يومًا`;
  if (days <= 59)   return "شهر تقريبًا";
  if (days <= 89)   return `${Math.round(days / 30)} أشهر تقريبًا`;
  const months = Math.round(days / 30);
  if (months < 12)  return `${months} أشهر`;
  const years = Math.round(days / 365);
  return years === 1 ? "سنة تقريبًا" : `${years} سنوات`;
}

// ─── Best scene finder ─────────────────────────────────────────────────────────

/**
 * Find the best scene from a list for a given target date.
 *
 * Priority order:
 *   1. Real data (is_simulated === false) within date range
 *   2. Any data within date range (closest to midpoint)
 *   3. Real data closest to target date
 *   4. Any scene closest to target date
 */
export function findBestSceneForDate(
  scenes: SceneListItem[],
  targetDate: string | Date | null,
  dateFrom?:  string | Date | null,
  dateTo?:    string | Date | null,
): SceneListItem | null {
  if (!scenes.length) return null;

  const target = typeof targetDate === "string" ? parseISODate(targetDate) : targetDate;

  // Filter by date range if provided
  let pool = [...scenes];
  if (dateFrom || dateTo) {
    const dfrom = typeof dateFrom === "string" ? parseISODate(dateFrom) : (dateFrom ?? null);
    const dto   = typeof dateTo   === "string" ? parseISODate(dateTo)   : (dateTo   ?? null);
    const inRange = scenes.filter((s) => {
      const sd = parseISODate(s.acquisition_date);
      if (!sd) return false;
      if (dfrom && sd < dfrom) return false;
      if (dto   && sd > dto)   return false;
      return true;
    });
    if (inRange.length > 0) pool = inRange;
  }

  // Sort: real data first, then by gap to target
  pool.sort((a, b) => {
    const realA = !(a as any).is_simulated ? 0 : 1;
    const realB = !(b as any).is_simulated ? 0 : 1;
    if (realA !== realB) return realA - realB;
    if (!target) return 0;
    const gA = sceneDateGapDays(a.acquisition_date, target);
    const gB = sceneDateGapDays(b.acquisition_date, target);
    return gA - gB;
  });

  return pool[0] ?? null;
}

// ─── Date range helpers ────────────────────────────────────────────────────────

export function dateRangeMidpoint(from: string, to: string): string | null {
  const da = parseISODate(from);
  const db = parseISODate(to);
  if (!da || !db) return null;
  const mid = new Date((da.getTime() + db.getTime()) / 2);
  return toISO(mid);
}

export function addDays(date: string | Date, days: number): string {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function defaultDateRange(): { from: string; to: string } {
  const to  = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { from: toISO(from), to: toISO(to) };
}

// ─── Temporal quality score (0–1) ─────────────────────────────────────────────

/** 1.0 = exact, 0.8 = near, 0.5 = approximate, 0.2 = historical, 0 = none */
export const TEMPORAL_QUALITY_SCORE: Record<TemporalMatchClass, number> = {
  exact:       1.0,
  near:        0.8,
  approximate: 0.5,
  historical:  0.2,
  none:        0.0,
};

export function temporalQualityLabel(score: number): string {
  if (score >= 0.9) return "ممتازة";
  if (score >= 0.7) return "جيدة";
  if (score >= 0.4) return "مقبولة";
  if (score >= 0.1) return "ضعيفة";
  return "لا تتوفر بيانات";
}

// ─── Format ISO date to Arabic readable ───────────────────────────────────────

const AR_MONTH: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
  5: "مايو",  6: "يونيو",  7: "يوليو", 8: "أغسطس",
  9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

export function formatDateAr(isoStr: string | null | undefined): string {
  const d = parseISODate(isoStr ?? null);
  if (!d) return "—";
  return `${d.getDate()} ${AR_MONTH[d.getMonth() + 1]} ${d.getFullYear()}`;
}
