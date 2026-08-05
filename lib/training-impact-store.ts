import fs from 'fs';
import path from 'path';

export interface TrainingSurveyRecord {
  id: string;
  tenant_id: string;
  nomination_id: string;
  employee_no: string;
  department_code: string;
  section_code: string;
  score_relevance: number;
  score_trainer: number;
  score_content: number;
  score_overall: number;
  comments: string;
  submitted_by: string;
  submitted_role: string;
  submitted_at: string;
}

export interface TrainingFollowupRecord {
  id: string;
  tenant_id: string;
  nomination_id: string;
  employee_no: string;
  department_code: string;
  section_code: string;
  checkpoint_days: 30 | 60 | 90;
  manager_id: string;
  manager_role: string;
  behavior_change_score: number;
  application_score: number;
  performance_signal: string;
  notes: string;
  submitted_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'training-impact');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function surveysFile(tenantId: string): string {
  return path.join(DATA_DIR, `surveys_${tenantId}.json`);
}

function followupsFile(tenantId: string): string {
  return path.join(DATA_DIR, `followups_${tenantId}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson(filePath: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function toScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function listTrainingSurveys(tenantId: string): TrainingSurveyRecord[] {
  return readArray<TrainingSurveyRecord>(surveysFile(tenantId)).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

export function createTrainingSurvey(
  tenantId: string,
  payload: {
    nomination_id: string;
    employee_no: string;
    department_code?: string;
    section_code?: string;
    score_relevance: number;
    score_trainer: number;
    score_content: number;
    score_overall: number;
    comments?: string;
    submitted_by: string;
    submitted_role: string;
  },
): TrainingSurveyRecord {
  const rows = readArray<TrainingSurveyRecord>(surveysFile(tenantId));
  const next: TrainingSurveyRecord = {
    id: newId('survey'),
    tenant_id: tenantId,
    nomination_id: String(payload.nomination_id || '').trim(),
    employee_no: String(payload.employee_no || '').trim(),
    department_code: String(payload.department_code || '').trim().toUpperCase(),
    section_code: String(payload.section_code || '').trim().toUpperCase(),
    score_relevance: toScore(payload.score_relevance),
    score_trainer: toScore(payload.score_trainer),
    score_content: toScore(payload.score_content),
    score_overall: toScore(payload.score_overall),
    comments: String(payload.comments || '').trim(),
    submitted_by: String(payload.submitted_by || 'system').trim(),
    submitted_role: String(payload.submitted_role || 'employee').trim(),
    submitted_at: nowIso(),
  };
  rows.push(next);
  writeJson(surveysFile(tenantId), rows);
  return next;
}

export function listTrainingFollowups(tenantId: string): TrainingFollowupRecord[] {
  return readArray<TrainingFollowupRecord>(followupsFile(tenantId)).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

export function submitTrainingFollowup(
  tenantId: string,
  payload: {
    nomination_id: string;
    employee_no: string;
    department_code?: string;
    section_code?: string;
    checkpoint_days: 30 | 60 | 90;
    manager_id: string;
    manager_role: string;
    behavior_change_score: number;
    application_score: number;
    performance_signal: string;
    notes?: string;
  },
): TrainingFollowupRecord {
  const rows = readArray<TrainingFollowupRecord>(followupsFile(tenantId));
  const next: TrainingFollowupRecord = {
    id: newId('followup'),
    tenant_id: tenantId,
    nomination_id: String(payload.nomination_id || '').trim(),
    employee_no: String(payload.employee_no || '').trim(),
    department_code: String(payload.department_code || '').trim().toUpperCase(),
    section_code: String(payload.section_code || '').trim().toUpperCase(),
    checkpoint_days: payload.checkpoint_days,
    manager_id: String(payload.manager_id || 'system').trim(),
    manager_role: String(payload.manager_role || 'manager').trim(),
    behavior_change_score: toScore(payload.behavior_change_score),
    application_score: toScore(payload.application_score),
    performance_signal: String(payload.performance_signal || '').trim(),
    notes: String(payload.notes || '').trim(),
    submitted_at: nowIso(),
  };

  const existingIdx = rows.findIndex(
    (r) =>
      r.nomination_id === next.nomination_id &&
      r.employee_no === next.employee_no &&
      r.checkpoint_days === next.checkpoint_days,
  );

  if (existingIdx >= 0) {
    rows[existingIdx] = { ...next, id: rows[existingIdx].id };
  } else {
    rows.push(next);
  }

  writeJson(followupsFile(tenantId), rows);
  return existingIdx >= 0 ? rows[existingIdx] : next;
}
