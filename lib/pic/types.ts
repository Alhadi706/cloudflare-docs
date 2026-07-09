/**
 * Project Intelligence Center — Type Definitions
 * pic/types.ts
 */

export type ProjectType =
  | 'road' | 'bridge' | 'building' | 'earthwork'
  | 'utility' | 'airport' | 'port' | 'dam'
  | 'public_facility' | 'other';

export type ProjectStatus = 'active' | 'slow' | 'stopped' | 'completed' | 'cancelled' | 'delayed' | 'unknown';
export type ActivityState = 'active' | 'slow' | 'stopped' | 'unknown';
export type AlertSeverity  = 'info' | 'warning' | 'critical';
export type EventType =
  | 'work_started' | 'work_stopped' | 'work_resumed'
  | 'acceleration' | 'deceleration' | 'completed'
  | 'delay_warning' | 'major_change';

// ── Arabic labels ─────────────────────────────────────────────────────────────

export const PROJECT_TYPE_AR: Record<ProjectType, string> = {
  road:             '🛣️ طريق',
  bridge:           '🌉 جسر',
  building:         '🏗️ مبنى',
  earthwork:        '🚜 أعمال ترابية',
  utility:          '⚡ مرافق',
  airport:          '✈️ مطار',
  port:             '⚓ ميناء',
  dam:              '🌊 سد',
  public_facility:  '🏛️ منشأة عامة',
  other:            '📌 أخرى',
};

export const PROJECT_STATUS_AR: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  active:    { label: '🟢 نشط',       color: 'text-green-300',  bg: 'bg-green-500/20 border-green-500/40'  },
  slow:      { label: '🟡 بطيء',      color: 'text-amber-300',  bg: 'bg-amber-500/20 border-amber-500/40'  },
  stopped:   { label: '🔴 متوقف',     color: 'text-red-300',    bg: 'bg-red-500/20 border-red-500/40'      },
  delayed:   { label: '🟠 متأخر',     color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40'},
  completed: { label: '✅ مكتمل',     color: 'text-teal-300',   bg: 'bg-teal-500/20 border-teal-500/40'   },
  cancelled: { label: '⛔ ملغي',      color: 'text-slate-400',  bg: 'bg-slate-500/20 border-slate-500/40' },
  unknown:   { label: '⚪ غير محدد',  color: 'text-slate-400',  bg: 'bg-slate-500/20 border-slate-500/30' },
};

export const STATUS_MAP_COLOR: Record<ProjectStatus, string> = {
  active:    '#22c55e',
  slow:      '#f59e0b',
  delayed:   '#f97316',
  stopped:   '#ef4444',
  completed: '#14b8a6',
  cancelled: '#64748b',
  unknown:   '#94a3b8',
};

export const EVENT_TYPE_AR: Record<EventType, { label: string; icon: string; severity: AlertSeverity }> = {
  work_started:  { label: 'بدء العمل',              icon: '🚀', severity: 'info'    },
  work_stopped:  { label: 'توقف العمل',             icon: '⏸️', severity: 'warning' },
  work_resumed:  { label: 'استئناف العمل',           icon: '▶️', severity: 'info'    },
  acceleration:  { label: 'تسارع في الإنجاز',       icon: '⚡', severity: 'info'    },
  deceleration:  { label: 'تباطؤ في الإنجاز',       icon: '🐌', severity: 'warning' },
  completed:     { label: 'اكتمال المشروع',          icon: '✅', severity: 'info'    },
  delay_warning: { label: 'تحذير: تأخر في الموعد',  icon: '⚠️', severity: 'critical'},
  major_change:  { label: 'تغيير كبير رُصد',        icon: '🔍', severity: 'info'    },
};

// ── Core types ────────────────────────────────────────────────────────────────

export interface PICProject {
  id:                       string;
  tenant_id:                string;
  name:                     string;
  code?:                    string;
  type:                     ProjectType;
  status:                   ProjectStatus;
  geometry_json?:           any;  // GeoJSON
  bbox:                     [number, number, number, number];  // [minLon, minLat, maxLon, maxLat]
  start_date?:              string;
  expected_end_date?:       string;
  contractor_name?:         string;
  budget_ld?:               number;
  department?:              string;
  notes?:                   string;
  // Intelligence
  progress_pct:             number;
  health_score:             number;
  last_active_date?:        string;
  last_scan_date?:          string;
  total_scans:              number;
  total_interruptions:      number;
  longest_interruption_days: number;
  // Meta
  created_by?:              string;
  created_at:               string;
  updated_at:               string;
  projects_core_id?:        number;
  // Computed (not in DB)
  area_km2?:                number;
  days_elapsed?:            number;
  days_remaining?:          number;
  is_overdue?:              boolean;
  trend?:                   'improving' | 'declining' | 'stable';
  alert_count?:             number;
}

export interface PICScan {
  id:               string;
  project_id:       string;
  scan_date:        string;
  activity_score:   number;   // 0–1
  change_magnitude: number;   // 0–1
  activity_state:   ActivityState;
  thumbnail_url?:   string;
  scene_id?:        string;
  source:           string;
  notes?:           string;
  created_at:       string;
}

export interface PICEvent {
  id:             string;
  project_id:     string;
  event_type:     EventType;
  event_date:     string;
  duration_days?: number;
  description_ar?: string;
  severity:       AlertSeverity;
  auto_detected:  boolean;
  created_at:     string;
}

export interface PICAlert {
  id:               string;
  project_id:       string;
  tenant_id:        string;
  alert_type:       string;
  message_ar:       string;
  severity:         AlertSeverity;
  is_read:          boolean;
  triggered_at:     string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  // Joined
  project_name?:    string;
}

export interface PICAnalysisResult {
  project_id:           string;
  analyzed_at:          string;
  scans:                PICScan[];
  events:               PICEvent[];
  progress_pct:         number;
  health_score:         number;
  status:               ProjectStatus;
  total_interruptions:  number;
  longest_interruption_days: number;
  last_active_date?:    string;
  trend:                'improving' | 'declining' | 'stable';
  summary_ar:           string;
}

export interface PICDashboardStats {
  total_projects:       number;
  active_projects:      number;
  stopped_projects:     number;
  completed_projects:   number;
  avg_progress_pct:     number;
  avg_health_score:     number;
  total_alerts:         number;
  critical_alerts:      number;
  projects_overdue:     number;
  total_area_km2:       number;
  by_type:              Record<string, number>;
  by_status:            Record<string, number>;
  by_department:        Record<string, number>;
}
