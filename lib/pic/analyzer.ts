/**
 * PIC Analysis Engine
 * pic/analyzer.ts
 *
 * Transforms Planet archive thumbnails into construction intelligence:
 * - Activity scoring per time period
 * - Work stoppage detection
 * - Progress estimation
 * - Health scoring
 * - Event detection
 */

import fs   from 'fs';
import path from 'path';
import type {
  PICProject, PICScan, PICEvent, PICAnalysisResult,
  ActivityState, ProjectStatus, AlertSeverity, EventType
} from './types';

const ARCHIVE_META  = path.join(process.cwd(), '.data', 'planet-archive', 'metadata');
const ARCHIVE_THUMB = path.join(process.cwd(), '.data', 'planet-archive', 'thumbnails');

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVITY_THRESHOLD_ACTIVE  = 0.20;  // >20% change = active
const ACTIVITY_THRESHOLD_SLOW    = 0.06;  // 6-20% = slow
const STOPPAGE_MIN_DAYS          = 14;    // 14+ days stopped = event
const HEALTH_WEIGHTS             = { progress: 0.35, consistency: 0.25, schedule: 0.25, trend: 0.15 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400_000;
}

function bboxOverlap(
  projBbox: [number,number,number,number],
  sceneBbox?: [number,number,number,number] | number[]
): boolean {
  if (!sceneBbox || sceneBbox.length < 4) return false;
  const [pMinLon, pMinLat, pMaxLon, pMaxLat] = projBbox;
  const [sMinLon, sMinLat, sMaxLon, sMaxLat] = sceneBbox;
  return !(sMaxLon < pMinLon || sMinLon > pMaxLon || sMaxLat < pMinLat || sMinLat > pMaxLat);
}

function calcAreaKm2(bbox: [number,number,number,number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const latMid = (minLat + maxLat) / 2;
  const w = (maxLon - minLon) * 111_000 * Math.cos(latMid * Math.PI / 180);
  const h = (maxLat - minLat) * 111_000;
  return Math.round(w * h / 1_000_000 * 100) / 100;
}

/** Get file size in bytes; 0 if not found */
function fileSize(fp: string): number {
  try { return fs.statSync(fp).size; } catch { return 0; }
}

// ── Activity Scoring (thumbnail comparison) ───────────────────────────────────

/**
 * Compute activity score between two thumbnail files.
 * Uses file-size differential as a robust proxy for visual change:
 *   - Construction scenes = more visual complexity = larger compressed size
 *   - Idle scenes = repetitive texture = smaller compressed size
 *
 * Returns 0–1 (0 = no change, 1 = maximum change)
 */
function computeActivityScore(thumbA: string, thumbB: string): number {
  const sA = fileSize(thumbA);
  const sB = fileSize(thumbB);
  if (sA === 0 || sB === 0) return 0;

  const maxSize = Math.max(sA, sB);
  const diff    = Math.abs(sA - sB) / maxSize;

  // Amplify sensitivity: a 5% file-size change is already significant
  return Math.min(1, diff * 3.5);
}

function scoreToState(score: number): ActivityState {
  if (score >= ACTIVITY_THRESHOLD_ACTIVE) return 'active';
  if (score >= ACTIVITY_THRESHOLD_SLOW)   return 'slow';
  return 'stopped';
}

// ── Archive query ─────────────────────────────────────────────────────────────

interface ArchiveScene {
  scene_id:     string;
  scan_date:    string;
  thumb_path:   string;
  cloud_cover:  number;
  area_key:     string;
}

function getScenesForBbox(
  bbox: [number,number,number,number],
  dateFrom?: string,
  dateTo?: string,
): ArchiveScene[] {
  if (!fs.existsSync(ARCHIVE_META)) return [];

  const scenes: ArchiveScene[] = [];
  const files = fs.readdirSync(ARCHIVE_META).filter(f => f.endsWith('.json'));

  for (const f of files) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(ARCHIVE_META, f), 'utf8'));
      const date = meta.acquisition_date ?? '';

      // Date filter
      if (dateFrom && date < dateFrom) continue;
      if (dateTo   && date > dateTo)   continue;

      // Cloud cover filter
      if ((meta.cloud_cover_pct ?? 0) > 30) continue;

      // Bbox overlap check (simple: use area_key heuristic or stored bbox)
      const sceneBbox = meta.bbox;
      if (sceneBbox && !bboxOverlap(bbox, sceneBbox)) continue;

      const thumbPath = path.join(ARCHIVE_THUMB, `${meta.scene_uid}.png`);
      if (!fs.existsSync(thumbPath)) continue;

      scenes.push({
        scene_id:    meta.scene_uid,
        scan_date:   date,
        thumb_path:  thumbPath,
        cloud_cover: meta.cloud_cover_pct ?? 0,
        area_key:    meta.area_key ?? '',
      });
    } catch { /* skip */ }
  }

  // Sort by date
  return scenes.sort((a, b) => a.scan_date.localeCompare(b.scan_date));
}

// ── Scoring pipeline ──────────────────────────────────────────────────────────

function buildScans(
  scenes:    ArchiveScene[],
  projectId: string,
): PICScan[] {
  if (scenes.length < 2) return [];

  const scans: PICScan[] = [];

  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];

    // Skip if gap is too large (>90 days — likely different seasons)
    const gapDays = daysBetween(prev.scan_date, curr.scan_date);
    if (gapDays > 90) continue;

    const score     = computeActivityScore(prev.thumb_path, curr.thumb_path);
    const smoothed  = Math.round(score * 100) / 100;

    scans.push({
      id:               `${projectId}_${curr.scan_date}`,
      project_id:       projectId,
      scan_date:        curr.scan_date,
      activity_score:   smoothed,
      change_magnitude: smoothed,
      activity_state:   scoreToState(smoothed),
      thumbnail_url:    `/api/v1/satellite/planet-thumbnail?scene_id=${curr.scene_id}&item_type=PSScene`,
      scene_id:         curr.scene_id,
      source:           'planet_archive',
      created_at:       new Date().toISOString(),
    });
  }

  return scans;
}

// ── Event detection ───────────────────────────────────────────────────────────

function detectEvents(scans: PICScan[], projectId: string): PICEvent[] {
  const events: PICEvent[] = [];
  if (scans.length === 0) return events;

  let prevState: ActivityState = scans[0].activity_state;
  let stoppedSince: string | null = prevState === 'stopped' ? scans[0].scan_date : null;
  let stoppedDays = 0;

  // Detect work start (first active scan)
  const firstActive = scans.find(s => s.activity_state === 'active');
  if (firstActive) {
    events.push({
      id:             `evt_start_${projectId}`,
      project_id:     projectId,
      event_type:     'work_started',
      event_date:     firstActive.scan_date,
      description_ar: 'رُصد بداية أعمال البناء بالصور الفضائية',
      severity:       'info',
      auto_detected:  true,
      created_at:     new Date().toISOString(),
    });
  }

  // Detect transitions
  for (let i = 1; i < scans.length; i++) {
    const curr = scans[i];
    const prev = scans[i - 1];
    const gap  = daysBetween(prev.scan_date, curr.scan_date);

    if (prevState !== 'stopped' && curr.activity_state === 'stopped') {
      stoppedSince = curr.scan_date;
      stoppedDays  = 0;
    }

    if (prevState === 'stopped' && curr.activity_state !== 'stopped' && stoppedSince) {
      stoppedDays = Math.round(daysBetween(stoppedSince, curr.scan_date));
      if (stoppedDays >= STOPPAGE_MIN_DAYS) {
        events.push({
          id:             `evt_stop_${projectId}_${stoppedSince}`,
          project_id:     projectId,
          event_type:     'work_stopped',
          event_date:     stoppedSince,
          duration_days:  stoppedDays,
          description_ar: `توقف العمل لمدة ${stoppedDays} يوماً`,
          severity:       stoppedDays > 30 ? 'critical' : 'warning',
          auto_detected:  true,
          created_at:     new Date().toISOString(),
        });
        events.push({
          id:             `evt_resume_${projectId}_${curr.scan_date}`,
          project_id:     projectId,
          event_type:     'work_resumed',
          event_date:     curr.scan_date,
          duration_days:  stoppedDays,
          description_ar: `استُؤنف العمل بعد توقف ${stoppedDays} يوماً`,
          severity:       'info',
          auto_detected:  true,
          created_at:     new Date().toISOString(),
        });
      }
      stoppedSince = null;
    }

    if (stoppedSince) stoppedDays += gap;
    prevState = curr.activity_state;
  }

  // Check for current stoppage (still stopped at end)
  if (stoppedSince && stoppedDays >= STOPPAGE_MIN_DAYS) {
    events.push({
      id:             `evt_stop_current_${projectId}`,
      project_id:     projectId,
      event_type:     'work_stopped',
      event_date:     stoppedSince,
      duration_days:  Math.round(stoppedDays),
      description_ar: `العمل متوقف حالياً منذ ${Math.round(stoppedDays)} يوماً`,
      severity:       stoppedDays > 30 ? 'critical' : 'warning',
      auto_detected:  true,
      created_at:     new Date().toISOString(),
    });
  }

  return events.sort((a, b) => a.event_date.localeCompare(b.event_date));
}

// ── Progress estimation ────────────────────────────────────────────────────────

function estimateProgress(scans: PICScan[], startDate?: string, expectedEnd?: string): number {
  if (scans.length === 0) return 0;

  // Method 1: Cumulative activity accumulation
  const totalScore = scans.reduce((sum, s) => sum + s.activity_score, 0);
  const maxPossible = scans.length * ACTIVITY_THRESHOLD_ACTIVE * 2;
  const activityBased = Math.min(95, Math.round(totalScore / maxPossible * 100));

  // Method 2: Time-based (if we have dates)
  if (startDate && expectedEnd) {
    const now      = new Date().toISOString().slice(0, 10);
    const total    = daysBetween(startDate, expectedEnd);
    const elapsed  = daysBetween(startDate, now);
    if (total > 0) {
      const timeBased = Math.min(100, Math.round(elapsed / total * 100));
      // Blend: 60% activity, 40% time
      return Math.round(activityBased * 0.6 + timeBased * 0.4);
    }
  }

  return activityBased;
}

// ── Health score ──────────────────────────────────────────────────────────────

function calculateHealthScore(
  scans:        PICScan[],
  progress_pct: number,
  project:      Partial<PICProject>,
  events:       PICEvent[],
): number {
  if (scans.length === 0) return 0;

  // Progress score (0–1)
  const progressScore = progress_pct / 100;

  // Consistency score: ratio of active scans
  const activeCount = scans.filter(s => s.activity_state === 'active').length;
  const consistencyScore = activeCount / scans.length;

  // Schedule score: are we on time?
  let scheduleScore = 0.5;
  if (project.start_date && project.expected_end_date) {
    const now      = new Date().toISOString().slice(0, 10);
    const total    = daysBetween(project.start_date, project.expected_end_date);
    const elapsed  = daysBetween(project.start_date, now);
    if (total > 0) {
      const expectedProgress = Math.min(1, elapsed / total);
      const actualProgress   = progress_pct / 100;
      scheduleScore = Math.min(1, actualProgress / Math.max(0.01, expectedProgress));
    }
  }

  // Trend score: recent activity vs. average
  const recentScans = scans.slice(-5);
  const recentAvg   = recentScans.reduce((s, x) => s + x.activity_score, 0) / recentScans.length;
  const overallAvg  = scans.reduce((s, x) => s + x.activity_score, 0) / scans.length;
  const trendScore  = overallAvg > 0 ? Math.min(1, recentAvg / overallAvg) : 0.5;

  const health = (
    progressScore    * HEALTH_WEIGHTS.progress    +
    consistencyScore * HEALTH_WEIGHTS.consistency +
    scheduleScore    * HEALTH_WEIGHTS.schedule    +
    trendScore       * HEALTH_WEIGHTS.trend
  );

  return Math.round(health * 100);
}

// ── Status derivation ─────────────────────────────────────────────────────────

function deriveStatus(scans: PICScan[], project: Partial<PICProject>): ProjectStatus {
  if (!scans.length) return 'unknown';

  // Check recent scans (last 14 days worth)
  const sortedByDate = [...scans].sort((a, b) => b.scan_date.localeCompare(a.scan_date));
  const recent = sortedByDate.slice(0, 5);
  const recentAvg = recent.reduce((s, x) => s + x.activity_score, 0) / recent.length;

  if (recentAvg >= ACTIVITY_THRESHOLD_ACTIVE) return 'active';
  if (recentAvg >= ACTIVITY_THRESHOLD_SLOW)   return 'slow';

  // Check if completed (progress >= 95)
  if ((project.progress_pct ?? 0) >= 95) return 'completed';

  return 'stopped';
}

// ── Generate AI summary ───────────────────────────────────────────────────────

function generateSummaryAr(
  project:   Partial<PICProject>,
  scans:     PICScan[],
  events:    PICEvent[],
  progress:  number,
  health:    number,
  status:    ProjectStatus,
): string {
  const name         = project.name ?? 'المشروع';
  const typeAr       = project.type ? { road:'الطريق', bridge:'الجسر', building:'المبنى', earthwork:'الأعمال الترابية', utility:'المرافق', airport:'المطار', port:'الميناء', dam:'السد', public_facility:'المنشأة العامة', other:'المشروع' }[project.type] ?? 'المشروع' : 'المشروع';

  const stoppages    = events.filter(e => e.event_type === 'work_stopped').length;
  const totalStopDays = events.filter(e => e.event_type === 'work_stopped').reduce((s, e) => s + (e.duration_days ?? 0), 0);
  const lastActive   = scans.filter(s => s.activity_state === 'active').at(-1)?.scan_date;

  let summary = '';

  if (status === 'active') {
    summary = `مشروع ${typeAr} "${name}" يسير بشكل طبيعي بنسبة إنجاز ${progress}%.`;
  } else if (status === 'slow') {
    summary = `مشروع ${typeAr} "${name}" يُظهر تباطؤاً في الإنجاز، نسبة الإتمام ${progress}%.`;
  } else if (status === 'stopped') {
    const stopDays = lastActive ? Math.round(daysBetween(lastActive, new Date().toISOString().slice(0,10))) : '؟';
    summary = `⚠️ مشروع ${typeAr} "${name}" متوقف منذ ~${stopDays} يوماً. نسبة الإنجاز ${progress}%.`;
  } else if (status === 'completed') {
    summary = `✅ مشروع ${typeAr} "${name}" مكتمل بنسبة ${progress}%.`;
  } else {
    summary = `مشروع ${typeAr} "${name}" — بيانات غير كافية للتحليل.`;
  }

  if (stoppages > 0) {
    summary += ` رُصدت ${stoppages} انقطاعات تراكمية بمجموع ${totalStopDays} يوماً.`;
  }

  summary += ` درجة الصحة: ${health}/100.`;

  return summary;
}

// ── Main analysis function ────────────────────────────────────────────────────

export async function analyzeProject(
  project: PICProject,
  dateFrom?: string,
  dateTo?:   string,
): Promise<PICAnalysisResult> {
  const projectId = project.id;
  const from      = dateFrom ?? project.start_date ?? '2020-01-01';
  const to        = dateTo   ?? new Date().toISOString().slice(0, 10);

  // 1. Get archived scenes
  const scenes = getScenesForBbox(project.bbox, from, to);

  // 2. Build activity scans
  const scans = buildScans(scenes, projectId);

  // 3. Detect events
  const events = detectEvents(scans, projectId);

  // 4. Estimate progress
  const progress_pct = estimateProgress(scans, project.start_date, project.expected_end_date);

  // 5. Derive status
  const status = deriveStatus(scans, { ...project, progress_pct });

  // 6. Calculate health score
  const health_score = calculateHealthScore(scans, progress_pct, project, events);

  // 7. Count interruptions
  const interruptions  = events.filter(e => e.event_type === 'work_stopped');
  const total_interruptions = interruptions.length;
  const longest_interruption_days = interruptions.reduce((max, e) => Math.max(max, e.duration_days ?? 0), 0);

  // 8. Last active date
  const activeScans      = scans.filter(s => s.activity_state === 'active');
  const last_active_date = activeScans.at(-1)?.scan_date;

  // 9. Trend
  const recent   = scans.slice(-5);
  const earlier  = scans.slice(-10, -5);
  const recentAvg  = recent.length  ? recent.reduce((s, x)  => s + x.activity_score, 0) / recent.length  : 0;
  const earlierAvg = earlier.length ? earlier.reduce((s, x) => s + x.activity_score, 0) / earlier.length : recentAvg;
  const trend: 'improving' | 'declining' | 'stable' =
    recentAvg > earlierAvg * 1.1 ? 'improving' :
    recentAvg < earlierAvg * 0.9 ? 'declining' : 'stable';

  // 10. Summary
  const summary_ar = generateSummaryAr(project, scans, events, progress_pct, health_score, status);

  return {
    project_id:                projectId,
    analyzed_at:               new Date().toISOString(),
    scans,
    events,
    progress_pct,
    health_score,
    status,
    total_interruptions,
    longest_interruption_days,
    last_active_date,
    trend,
    summary_ar,
  };
}
