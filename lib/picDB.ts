/**
 * lib/picDB.ts — Project Intelligence Center — قاعدة بيانات PIC
 * يستخدم مباشرةً schema pic في PostgreSQL
 * جميع العمليات معزولة بـ tenant_id (multi-tenant)
 */
import { pgPool } from '@/lib/db-pg';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type ProjectStatus = 'active' | 'slow' | 'stopped' | 'completed' | 'cancelled' | 'unknown' | 'delayed';
export type ProjectType   =
  | 'road' | 'bridge' | 'building' | 'earthwork' | 'utility'
  | 'airport' | 'port' | 'dam' | 'public_facility' | 'other';
export type ActivityState = 'active' | 'slow' | 'stopped' | 'unknown';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface PICProject {
  id:                        string;
  tenant_id:                 string;
  name:                      string;
  code?:                     string;
  type:                      ProjectType;
  status:                    ProjectStatus;
  geometry_json:             any;          // GeoJSON
  bbox:                      number[];     // [minLon,minLat,maxLon,maxLat]
  start_date?:               string;
  expected_end_date?:        string;
  contractor_name?:          string;
  department?:               string;
  budget_ld?:                number;
  notes?:                    string;
  // computed
  progress_pct:              number;
  health_score:              number;       // 0-100
  total_scans:               number;
  total_interruptions:       number;
  longest_interruption_days: number;
  last_scan_date?:           string;
  last_active_date?:         string;
  projects_core_id?:         number;
  created_at:                string;
  updated_at:                string;
}

export interface PICScan {
  id:               string;
  project_id:       string;
  scan_date:        string;
  scene_id?:        string;
  source:           string;               // 'planet' | 'sentinel' | 'manual'
  activity_score:   number;               // 0-1
  activity_state:   ActivityState;
  change_magnitude: number;               // 0-1
  thumbnail_url?:   string;
  notes?:           string;
  created_at:       string;
}

export interface PICEvent {
  id:             string;
  project_id:     string;
  event_type:     string;                 // 'work_started'|'work_stopped'|'resumed'|'completed'|'alert'
  event_date:     string;
  duration_days?: number;
  severity?:      AlertSeverity;
  description_ar?: string;
  auto_detected:  boolean;
  created_at:     string;
}

export interface PICAlert {
  id:              string;
  tenant_id:       string;
  project_id:      string;
  alert_type:      string;               // 'long_stoppage'|'delayed'|'slow_progress'|'resumed'
  severity:        AlertSeverity;
  message_ar:      string;
  is_read:         boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  triggered_at:    string;
}

// ─────────────────────────────────────────────
//  Projects CRUD
// ─────────────────────────────────────────────

/** Normalize DATE fields in a project row returned from PostgreSQL */
function normalizeProject(row: any): PICProject {
  const dateFields = ['start_date', 'expected_end_date', 'last_scan_date', 'last_active_date'];
  const result = { ...row };
  for (const f of dateFields) {
    if (result[f] != null) result[f] = toDateStr(result[f]);
  }
  return result as PICProject;
}

export async function listProjects(
  tenantId: string,
  opts: { status?: string; type?: string; limit?: number; offset?: number } = {}
): Promise<PICProject[]> {
  const { status, type, limit = 100, offset = 0 } = opts;
  const params: any[] = [tenantId];
  let where = 'WHERE tenant_id = $1';
  if (status) { params.push(status); where += ` AND status = $${params.length}`; }
  if (type)   { params.push(type);   where += ` AND type = $${params.length}`; }
  params.push(limit, offset);

  const res = await pgPool.query(
    `SELECT * FROM pic.projects ${where} ORDER BY updated_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return res.rows.map(normalizeProject);
}

export async function getProject(id: string, tenantId: string): Promise<PICProject | null> {
  const res = await pgPool.query(
    'SELECT * FROM pic.projects WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return res.rows[0] ? normalizeProject(res.rows[0]) : null;
}

export async function createProject(
  tenantId: string,
  data: Partial<PICProject>
): Promise<PICProject> {
  const now = new Date().toISOString();
  const res = await pgPool.query(
    `INSERT INTO pic.projects
     (id, tenant_id, name, code, type, status, geometry_json, bbox,
      start_date, expected_end_date, contractor_name, department,
      budget_ld, notes, progress_pct, health_score, total_scans,
      total_interruptions, longest_interruption_days, projects_core_id,
      created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13, 0, 50, 0, 0, 0, $14, $15, $15)
     RETURNING *`,
    [
      tenantId,
      data.name ?? 'مشروع جديد',
      data.code ?? null,
      data.type ?? 'other',
      data.status ?? 'unknown',
      data.geometry_json ? JSON.stringify(data.geometry_json) : null,
      data.bbox ?? null,
      data.start_date ?? null,
      data.expected_end_date ?? null,
      data.contractor_name ?? null,
      data.department ?? null,
      data.budget_ld ?? null,
      data.notes ?? null,
      data.projects_core_id ?? null,
      now,
    ]
  );
  return normalizeProject(res.rows[0]);
}

export async function updateProject(
  id: string,
  tenantId: string,
  patch: Partial<PICProject>
): Promise<PICProject | null> {
  const allowed = [
    'name','code','type','status','geometry_json','bbox',
    'start_date','expected_end_date','contractor_name','department',
    'budget_ld','notes','progress_pct','health_score',
    'total_scans','total_interruptions','longest_interruption_days',
    'last_scan_date','last_active_date',
  ];
  const sets: string[] = [];
  const params: any[] = [id, tenantId];

  for (const [k, v] of Object.entries(patch)) {
    if (allowed.includes(k) && v !== undefined) {
      params.push(k === 'geometry_json' ? JSON.stringify(v) : v);
      sets.push(`${k} = $${params.length}`);
    }
  }

  if (!sets.length) return getProject(id, tenantId);
  params.push(new Date().toISOString());
  sets.push(`updated_at = $${params.length}`);

  const res = await pgPool.query(
    `UPDATE pic.projects SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    params
  );
  return res.rows[0] ? normalizeProject(res.rows[0]) : null;
}

export async function deleteProject(id: string, tenantId: string): Promise<boolean> {
  const res = await pgPool.query(
    'DELETE FROM pic.projects WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────
//  Scans
// ─────────────────────────────────────────────

/** Normalize a DB date value (Date object or string) to 'YYYY-MM-DD' */
function toDateStr(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export async function listScans(projectId: string, limit = 50): Promise<PICScan[]> {
  const res = await pgPool.query(
    'SELECT * FROM pic.scans WHERE project_id = $1 ORDER BY scan_date DESC LIMIT $2',
    [projectId, limit]
  );
  return res.rows.map(r => ({ ...r, scan_date: toDateStr(r.scan_date) }));
}

export async function createScan(scan: Omit<PICScan, 'id' | 'created_at'>): Promise<PICScan> {
  const res = await pgPool.query(
    `INSERT INTO pic.scans
     (id, project_id, scan_date, scene_id, source, activity_score, activity_state,
      change_magnitude, thumbnail_url, notes, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (project_id, scan_date, source) DO UPDATE
       SET activity_score   = EXCLUDED.activity_score,
           activity_state   = EXCLUDED.activity_state,
           change_magnitude = EXCLUDED.change_magnitude,
           thumbnail_url    = COALESCE(EXCLUDED.thumbnail_url, pic.scans.thumbnail_url)
     RETURNING *`,
    [
      scan.project_id, scan.scan_date, scan.scene_id ?? null, scan.source,
      scan.activity_score, scan.activity_state, scan.change_magnitude,
      scan.thumbnail_url ?? null, scan.notes ?? null,
    ]
  );
  const row = res.rows[0];
  return { ...row, scan_date: toDateStr(row.scan_date) };
}

// ─────────────────────────────────────────────
//  Events
// ─────────────────────────────────────────────

export async function listEvents(projectId: string): Promise<PICEvent[]> {
  const res = await pgPool.query(
    'SELECT * FROM pic.events WHERE project_id = $1 ORDER BY event_date DESC',
    [projectId]
  );
  return res.rows.map(r => ({ ...r, event_date: toDateStr(r.event_date) }));
}

export async function createEvent(evt: Omit<PICEvent, 'id' | 'created_at'>): Promise<PICEvent> {
  const res = await pgPool.query(
    `INSERT INTO pic.events
     (id, project_id, event_type, event_date, duration_days, severity,
      description_ar, auto_detected, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [
      evt.project_id, evt.event_type, evt.event_date,
      evt.duration_days ?? null, evt.severity ?? null,
      evt.description_ar ?? null, evt.auto_detected ?? true,
    ]
  );
  return res.rows[0];
}

// ─────────────────────────────────────────────
//  Alerts
// ─────────────────────────────────────────────

export async function listAlerts(tenantId: string, unreadOnly = false): Promise<PICAlert[]> {
  const res = await pgPool.query(
    `SELECT a.*, p.name as project_name
     FROM pic.alerts a
     JOIN pic.projects p ON a.project_id = p.id
     WHERE a.tenant_id = $1 ${unreadOnly ? 'AND a.is_read = false' : ''}
     ORDER BY a.triggered_at DESC LIMIT 100`,
    [tenantId]
  );
  return res.rows;
}

export async function createAlert(alert: Omit<PICAlert, 'id' | 'triggered_at'>): Promise<PICAlert> {
  const res = await pgPool.query(
    `INSERT INTO pic.alerts
     (id, tenant_id, project_id, alert_type, severity, message_ar, is_read, triggered_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())
     RETURNING *`,
    [alert.tenant_id, alert.project_id, alert.alert_type, alert.severity, alert.message_ar]
  );
  return res.rows[0];
}

export async function acknowledgeAlert(id: string, userId: string): Promise<void> {
  await pgPool.query(
    'UPDATE pic.alerts SET is_read = true, acknowledged_at = NOW(), acknowledged_by = $2 WHERE id = $1',
    [id, userId]
  );
}

// ─────────────────────────────────────────────
//  Dashboard stats
// ─────────────────────────────────────────────

export async function getDashboardStats(tenantId: string) {
  const res = await pgPool.query(
    `SELECT
      COUNT(*)                                         AS total,
      COUNT(*) FILTER (WHERE status = 'active')        AS active,
      COUNT(*) FILTER (WHERE status = 'stopped')       AS stopped,
      COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
      COUNT(*) FILTER (WHERE status = 'delayed')       AS delayed,
      ROUND(AVG(progress_pct))                         AS avg_progress,
      ROUND(AVG(health_score))                         AS avg_health,
      COUNT(*) FILTER (WHERE health_score < 40)        AS at_risk
     FROM pic.projects WHERE tenant_id = $1`,
    [tenantId]
  );
  const alerts = await pgPool.query(
    'SELECT COUNT(*) FROM pic.alerts WHERE tenant_id = $1 AND is_read = false',
    [tenantId]
  );
  return {
    ...res.rows[0],
    unread_alerts: parseInt(alerts.rows[0]?.count ?? '0'),
  };
}
