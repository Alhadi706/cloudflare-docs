/**
 * PIC Analysis Engine
 * pic/analyzer.ts
 *
 * Construction Intelligence Pipeline — Phases 2-4:
 *   ArchiveScene[] → SVQE → FeatureEngine → ReasoningEngine → ConstructionIntelligence
 *
 * Phase 2: Signal Validation (lib/svqe/engine.ts)
 * Phase 3: Physical Feature Extraction (lib/features/engine.ts)
 * Phase 4: Evidence & Construction Reasoning (lib/reasoning/engine.ts)
 */

import fs   from 'fs';
import path from 'path';
import type {
  PICProject, PICScan, PICEvent, PICAnalysisResult,
  ActivityState, ProjectStatus, AlertSeverity, EventType
} from './types';
import {
  listScans, createScan, updateProject as dbUpdateProject,
  createEvent as dbCreateEvent, createAlert as dbCreateAlert,
} from '@/lib/picDB';
import { computePixelActivityScore, decodePixels, extractFeatures, computeCropRegion } from '@/lib/sal/adapters/planet';
import { SignalValidationEngine } from '@/lib/svqe/engine';
import { FeatureEngine } from '@/lib/features/engine';
import { ConstructionReasoningEngine } from '@/lib/reasoning/engine';
import type { SceneObservation } from '@/lib/svqe/engine';

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

// ── Activity Scoring — now uses real pixel analysis via PlanetAdapter ─────────

/**
 * PHASE 1 (revised): replaced the old file-size comparison with proper
 * pixel-level analysis using sharp, with spatial crop to project bbox.
 * Falls back to file-size ratio if sharp decode fails.
 */
async function computeActivityScore(
  thumbA: string,
  thumbB: string,
  projectBbox: [number, number, number, number],
  sceneBbox:   [number, number, number, number],
): Promise<number> {
  const result = await computePixelActivityScore(thumbA, thumbB, projectBbox, sceneBbox);
  if (result.method === 'failed_decode') {
    const sA = fileSize(thumbA);
    const sB = fileSize(thumbB);
    if (sA === 0 || sB === 0) return 0;
    return Math.min(1, (Math.abs(sA - sB) / Math.max(sA, sB)) * 3.5);
  }
  return result.score;
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
  scene_bbox:   [number, number, number, number];  // [minLon, minLat, maxLon, maxLat]
}

function getScenesForBbox(
  bbox: [number,number,number,number],
  dateFrom?: string,
  dateTo?: string,
  maxCloud = 30,
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
      if ((meta.cloud_cover_pct ?? 0) > maxCloud) continue;

      // Always compute bbox from geometry (actual scene footprint).
      // meta.bbox is a coarse area-level approximation and must NOT be used.
      let sceneBbox: number[] = [];
      if (meta.geometry?.coordinates?.[0]) {
        const coords: number[][] = meta.geometry.coordinates[0];
        const lons = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        sceneBbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      }

      // Bbox overlap check — skip scenes with no geometry
      if (sceneBbox.length !== 4) continue;
      if (!bboxOverlap(bbox, sceneBbox)) continue;

      const thumbPath = path.join(ARCHIVE_THUMB, `${meta.scene_uid}.png`);
      if (!fs.existsSync(thumbPath)) continue;

      scenes.push({
        scene_id:    meta.scene_uid,
        scan_date:   date,
        thumb_path:  thumbPath,
        cloud_cover: meta.cloud_cover_pct ?? 0,
        area_key:    meta.area_key ?? '',
        scene_bbox:  sceneBbox as [number, number, number, number],
      });
    } catch { /* skip */ }
  }

  // Sort by date
  return scenes.sort((a, b) => a.scan_date.localeCompare(b.scan_date));
}

// ── Scoring pipeline ──────────────────────────────────────────────────────────

async function buildScans(
  scenes:      ArchiveScene[],
  projectId:   string,
  projectBbox: [number, number, number, number],
): Promise<PICScan[]> {
  if (scenes.length < 2) return [];

  const scans: PICScan[] = [];

  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];

    const gapDays = daysBetween(prev.scan_date, curr.scan_date);
    if (gapDays > 90) continue;

    const score    = await computeActivityScore(prev.thumb_path, curr.thumb_path, projectBbox, curr.scene_bbox);
    const smoothed = Math.round(score * 100) / 100;

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

  // 2. Build activity scans (async — uses sharp pixel analysis with spatial crop)
  const scans = await buildScans(scenes, projectId, project.bbox);

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

// ── Public: findScenesForBbox (used by archive API) ───────────────────────────

export interface ArchivedScenePublic {
  scene_uid:          string;
  acquisition_date:   string;
  cloud_cover_pct:    number;
  bbox:               number[];
  thumb_path:         string;
}

/** Public export matching the interface expected by the API route */
export function findScenesForBbox(
  bbox:     number[],
  dateFrom: string,
  dateTo:   string,
  maxCloud = 30,
): ArchivedScenePublic[] {
  const b = bbox as [number, number, number, number];
  const scenes = getScenesForBbox(b, dateFrom, dateTo, maxCloud);
  return scenes.map(s => ({
    scene_uid:        s.scene_id,
    acquisition_date: s.scan_date,
    cloud_cover_pct:  s.cloud_cover,
    bbox:             b,  // approximate — scene bbox not stored in ArchiveScene
    thumb_path:       s.thumb_path,
  }));
}

// ── Public: buildTimeline (used by ?include=timeline API) ─────────────────────

export interface TimelinePoint {
  date:        string;
  scene_id:    string;
  magnitude:   number;
  score:       number;
  state:       ActivityState;
  thumb_url:   string;
}

export interface Interruption {
  start_date: string;
  end_date:   string | 'ongoing';
  days:       number;
  confidence: number;
}

export interface ProjectTimeline {
  project_id:            string;
  points:                TimelinePoint[];
  interruptions:         Interruption[];
  progress_pct:          number;
  health_score:          number;
  last_active:           string | null;
  trend:                 'improving' | 'declining' | 'stable' | 'unknown';
  total_active_periods:  number;
  total_inactive_periods: number;
  active_days:           number;
  inactive_days:         number;
}

export function buildTimeline(
  project: { id: string; progress_pct: number; health_score: number; start_date?: string; expected_end_date?: string },
  scans:   PICScan[],
): ProjectTimeline {
  if (scans.length < 2) {
    return {
      project_id:            project.id,
      points:                [],
      interruptions:         [],
      progress_pct:          project.progress_pct,
      health_score:          project.health_score,
      last_active:           null,
      trend:                 'unknown',
      total_active_periods:  0,
      total_inactive_periods: 0,
      active_days:           0,
      inactive_days:         0,
    };
  }

  const sorted = [...scans].sort((a, b) =>
    (typeof a.scan_date === 'string' ? a.scan_date : String(a.scan_date)).localeCompare(
      typeof b.scan_date === 'string' ? b.scan_date : String(b.scan_date)
    )
  );

  const points: TimelinePoint[] = sorted.map(s => ({
    date:      typeof s.scan_date === 'string' ? s.scan_date : String(s.scan_date).slice(0, 10),
    scene_id:  s.scene_id ?? '',
    magnitude: s.change_magnitude,
    score:     s.activity_score,
    state:     s.activity_state as ActivityState,
    thumb_url: s.thumbnail_url ?? '',
  }));

  // Detect interruptions
  const interruptions: Interruption[] = [];
  let stoppedSince: string | null = null;

  for (const p of points) {
    if (p.state === 'stopped') {
      if (!stoppedSince) stoppedSince = p.date;
    } else if (stoppedSince) {
      const d = daysBetween(stoppedSince, p.date);
      if (d >= 14) {
        interruptions.push({ start_date: stoppedSince, end_date: p.date, days: d, confidence: Math.min(1, d / 30) });
      }
      stoppedSince = null;
    }
  }
  if (stoppedSince) {
    const d = daysBetween(stoppedSince, new Date().toISOString().slice(0, 10));
    if (d >= 14) interruptions.push({ start_date: stoppedSince, end_date: 'ongoing', days: d, confidence: 0.9 });
  }

  // Active/inactive days
  let activeDays = 0, inactiveDays = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i-1].scan_date.slice(0,10), sorted[i].scan_date.slice(0,10));
    if (sorted[i-1].activity_state === 'active') activeDays += gap;
    else inactiveDays += gap;
  }

  const activePoints  = points.filter(p => p.state === 'active');
  const stoppedPoints = points.filter(p => p.state === 'stopped');
  const totalDays = activeDays + inactiveDays || 1;
  let prog = Math.min(95, Math.round((activeDays / totalDays) * 100));
  if (project.start_date && project.expected_end_date) {
    const total = daysBetween(project.start_date, project.expected_end_date);
    const elapsed = daysBetween(project.start_date, new Date().toISOString().slice(0, 10));
    const timePct = Math.min(100, (elapsed / Math.max(total, 1)) * 100);
    prog = Math.min(100, Math.round(prog * 0.6 + timePct * 0.4));
  }

  const recent = points.slice(-3).map(p => p.score);
  const prev   = points.slice(-6, -3).map(p => p.score);
  const rAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
  const pAvg = prev.reduce((a, b) => a + b, 0) / (prev.length || 1);
  const trend = prev.length === 0 ? 'unknown'
    : rAvg > pAvg + 0.05 ? 'improving'
    : rAvg < pAvg - 0.05 ? 'declining' : 'stable';

  return {
    project_id:            project.id,
    points,
    interruptions,
    progress_pct:          prog,
    health_score:          project.health_score,
    last_active:           activePoints.length ? activePoints[activePoints.length-1].date : null,
    trend,
    total_active_periods:  activePoints.length,
    total_inactive_periods: stoppedPoints.length,
    active_days:           activeDays,
    inactive_days:         inactiveDays,
  };
}

// ── Singletons (shared across calls for performance) ─────────────────────────
const _svqe      = new SignalValidationEngine();
const _features  = new FeatureEngine();
const _reasoning = new ConstructionReasoningEngine();

// ── Public: analyzeProjectAndPersist (Phase 2-4 Pipeline) ────────────────────

export async function analyzeProjectAndPersist(
  project:  PICProject,
  tenantId: string,
  opts:     { dateFrom?: string; dateTo?: string; maxCloud?: number } = {}
): Promise<{ scans_added: number; timeline: ProjectTimeline; alerts: string[] }> {
  const dateFrom  = opts.dateFrom ?? (project.start_date ?? '2020-01-01');
  const dateTo    = opts.dateTo   ?? new Date().toISOString().slice(0, 10);
  const maxCloud  = opts.maxCloud ?? 25;

  if (!project.bbox?.length) {
    return { scans_added: 0, timeline: buildTimeline(project, []), alerts: [] };
  }

  const scenes = getScenesForBbox(project.bbox, dateFrom, dateTo, maxCloud);
  if (scenes.length < 2) {
    return { scans_added: 0, timeline: buildTimeline(project, []), alerts: ['لا توجد صور كافية في الأرشيف'] };
  }

  // ── Phase 2-3: Decode each scene → SVQE validate → extract features ────────
  const observations: SceneObservation[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prev  = i > 0 ? scenes[i-1] : null;
    const gapDays = prev ? daysBetween(prev.scan_date, scene.scan_date) : 0;
    if (gapDays > 90 && i > 0) continue;  // skip large temporal gaps

    const crop = computeCropRegion(project.bbox, scene.scene_bbox);
    const decoded = await decodePixels(scene.thumb_path, crop);
    if (!decoded) continue;

    const features = extractFeatures(decoded);

    observations.push({
      scene_id:           scene.scene_id,
      scan_date:          scene.scan_date,
      cloud_cover_pct:    scene.cloud_cover,
      features,
      crop,
      gap_days_from_prev: gapDays,
      pixel_resolution_m: 3,  // PlanetScope default
    });
  }

  // Phase 2: Validate all observations
  const validated = _svqe.validateBatch(observations);
  const usable    = validated.filter(v => v.is_usable);
  const rejected  = validated.length - usable.length;

  // Phase 3: Extract physical features from validated observations
  const featureRecords = _features.extractBatch(usable);

  // ── Phase 4: Reasoning Engine ─────────────────────────────────────────────
  const intelligence = _reasoning.analyze({
    project_id:          project.id,
    project_name:        project.name,
    project_type:        project.type,
    start_date:          project.start_date,
    expected_end:        project.expected_end_date,
    records:             featureRecords,
    total_scenes_found:  scenes.length,
    rejected_scenes:     rejected,
  });

  // ── Persist new scans to DB ────────────────────────────────────────────────
  // Only load existing v2 scans (not old buggy planet_archive ones)
  const existingScans = (await listScans(project.id, 500)).filter((s: any) => s.source === 'planet_archive_v2');
  const existingDates = new Set(existingScans.map((s: any) =>
    typeof s.scan_date === 'string' ? s.scan_date.slice(0, 10) : String(s.scan_date).slice(0, 10)
  ));

  let scansAdded = 0;
  const newScans: PICScan[] = [];

  // Build a scene_id lookup by date for accurate assignment
  const sceneByDate = new Map<string, string>();
  for (const scene of scenes) {
    if (!sceneByDate.has(scene.scan_date)) {
      sceneByDate.set(scene.scan_date, scene.scene_id);
    }
  }

  for (const rec of featureRecords) {
    const scanDate = rec.date;
    if (existingDates.has(scanDate)) {
      const found = existingScans.find((s: any) =>
        (typeof s.scan_date === 'string' ? s.scan_date.slice(0,10) : String(s.scan_date).slice(0,10)) === scanDate
      );
      if (found) newScans.push(found as unknown as PICScan);
      continue;
    }

    // Map phase 3 outputs to existing DB columns
    const cai    = rec.bundle.construction_activity_index;
    const state  = cai >= 0.25 ? 'active' : cai >= 0.08 ? 'slow' : 'stopped';
    // Use scene_id from the observation that was actually analyzed
    const correctSceneId = rec.bundle.scene_id || sceneByDate.get(scanDate) || null;
    const scene  = scenes.find(s => s.scene_id === correctSceneId);

    const saved = await createScan({
      project_id:       project.id,
      scan_date:        scanDate,
      scene_id:         correctSceneId,
      source:           'planet_archive_v2',  // v2 = phase 2-4 pipeline
      activity_score:   Math.round(cai * 1000) / 1000,
      activity_state:   state,
      change_magnitude: Math.round(rec.bundle.construction_disturbance.value * 1000) / 1000,
      thumbnail_url:    correctSceneId ? `/api/v1/satellite/planet-thumbnail?scene_id=${correctSceneId}&item_type=PSScene` : null,
      notes:            rec.bundle.construction_disturbance.interpretation_ar,
    } as any);

    newScans.push({
      id: saved.id, project_id: project.id, scan_date: scanDate,
      activity_score: cai, change_magnitude: rec.bundle.construction_disturbance.value,
      activity_state: state as ActivityState, thumbnail_url: saved.thumbnail_url ?? undefined,
      scene_id: correctSceneId ?? undefined, source: 'planet_archive_v2', created_at: saved.created_at,
    });
    scansAdded++;
  }

  // ── Update project stats in DB ────────────────────────────────────────────
  const allScans  = [...existingScans, ...newScans] as unknown as PICScan[];
  const timeline  = buildTimeline(project, allScans);

  await dbUpdateProject(project.id, tenantId, {
    progress_pct:              intelligence.progress.value,
    health_score:              intelligence.health.score,
    total_scans:               allScans.length,
    total_interruptions:       intelligence.interruptions.length,
    longest_interruption_days: intelligence.interruptions.length
      ? Math.max(...intelligence.interruptions.map(i => i.duration_days)) : 0,
    last_scan_date:            dateTo,
    last_active_date:          intelligence.last_activity_date ?? undefined,
    status:                    intelligence.status as any,
  });

  // ── Generate alerts from intelligence ────────────────────────────────────
  const alertMessages: string[] = [];
  const ongoing = intelligence.interruptions.find(i => i.end_date === 'ongoing');
  if (ongoing && ongoing.duration_days >= 14) {
    const msg = `⏸️ ${ongoing.detail_ar} — "${project.name}"`;
    alertMessages.push(msg);
    await dbCreateAlert({
      tenant_id:  tenantId,
      project_id: project.id,
      alert_type: 'long_stoppage',
      severity:   ongoing.duration_days > 30 ? 'critical' : 'warning',
      message_ar: msg,
      is_read:    false,
    } as any);
  }
  if (intelligence.trend.direction === 'declining' && intelligence.trend.significance > 0.4) {
    alertMessages.push(`📉 ${intelligence.trend.detail_ar} — "${project.name}"`);
  }
  if (intelligence.status === 'delayed') {
    alertMessages.push(`⚠️ المشروع "${project.name}" متأخر عن الموعد المُخطَّط`);
  }

  // Include intelligence summary in alerts if quality is low
  if (rejected > usable.length * 0.5) {
    alertMessages.push(`🔴 جودة البيانات منخفضة: ${rejected}/${validated.length} مشهد مرفوض`);
  }

  return { scans_added: scansAdded, timeline, alerts: alertMessages };
}
