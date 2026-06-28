/**
 * Circulars & Surveys store
 * Storage: .data/mobile-field/circulars_{tenantId}.json
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export type CircularType =
  | 'announcement'   // إعلان عام
  | 'holiday'        // إجازة / عطلة
  | 'schedule'       // تغيير توقيت
  | 'policy'         // تعميم / سياسة
  | 'survey'         // استبيان
  | 'training'       // تدريب
  | 'urgent';        // تنبيه عاجل

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'text' | 'rating';
  options?: string[];
  required?: boolean;
}

export interface SurveyResponse {
  employee_no: string;
  answers: Record<string, string | string[]>;
  submitted_at: string;
}

export interface CircularAttachment {
  name: string;
  type?: string;
  size?: number;
  data_url?: string;
}

export interface Circular {
  id: string;
  tenant_id: string;
  type: CircularType;
  title: string;
  body: string;
  created_by: string;          // employee_no
  created_by_name?: string;
  source_dept?: string;        // e.g. 'HR', 'Training', 'Statistics'
  target_roles?: string[];     // undefined = all employees
  target_departments?: string[];
  target_employee_nos?: string[];
  target_count?: number;
  priority: 'normal' | 'high' | 'urgent';
  created_at: string;
  expires_at?: string;
  // Survey
  questions?: SurveyQuestion[];
  responses?: SurveyResponse[];
  // Tracking
  read_by: string[];           // employee_nos who opened/read
  pinned?: boolean;
  attachments?: CircularAttachment[];
}

// ── File helpers ─────────────────────────────────────────────────────────────

function getPath(tenantId: string): string {
  const dir = path.join(process.cwd(), '.data', 'mobile-field');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `circulars_${tenantId}.json`);
}

function readAll(tenantId: string): Circular[] {
  const p = getPath(tenantId);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function writeAll(tenantId: string, data: Circular[]): void {
  fs.writeFileSync(getPath(tenantId), JSON.stringify(data, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get circulars visible to a given employee (by role).
 * Returns newest-first, skipping expired items.
 */
export function getCircularsForEmployee(
  tenantId: string,
  employeeNo: string,
  role: string,
  department?: string,
): Circular[] {
  const now = new Date().toISOString();
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedDept = String(department || '').trim().toLowerCase();

  const includesNormalized = (arr: string[] | undefined, value: string): boolean => {
    if (!arr || arr.length === 0) return true;
    if (!value) return false;
    return arr.some((item) => String(item || '').trim().toLowerCase() === value);
  };

  return readAll(tenantId)
    .filter(c => {
      if (c.expires_at && c.expires_at < now) return false;

      const byRole = includesNormalized(c.target_roles, normalizedRole);
      const byDept = includesNormalized(c.target_departments, normalizedDept);
      const byEmployee = !c.target_employee_nos || c.target_employee_nos.length === 0
        ? true
        : c.target_employee_nos.some((no) => String(no || '').trim() === employeeNo);

      return byRole && byDept && byEmployee;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Get all circulars (admin view). */
export function getAllCirculars(tenantId: string): Circular[] {
  return readAll(tenantId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Get a single circular by id. */
export function getCircularById(tenantId: string, id: string): Circular | undefined {
  return readAll(tenantId).find(c => c.id === id);
}

/** Create a new circular/survey. */
export function createCircular(
  tenantId: string,
  data: Omit<Circular, 'id' | 'tenant_id' | 'created_at' | 'read_by' | 'responses'>,
): Circular {
  const all = readAll(tenantId);
  const rec: Circular = {
    ...data,
    id: randomUUID(),
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
    read_by: [],
    responses: data.questions?.length ? [] : undefined,
  };
  all.unshift(rec);
  writeAll(tenantId, all);
  return rec;
}

/** Mark a circular as read by an employee. */
export function markCircularRead(tenantId: string, circularId: string, employeeNo: string): boolean {
  const all = readAll(tenantId);
  const idx = all.findIndex(c => c.id === circularId);
  if (idx === -1) return false;
  if (!all[idx].read_by.includes(employeeNo)) {
    all[idx].read_by.push(employeeNo);
    writeAll(tenantId, all);
  }
  return true;
}

/** Submit a survey response. Returns false if already submitted. */
export function submitSurveyResponse(
  tenantId: string,
  circularId: string,
  employeeNo: string,
  answers: Record<string, string | string[]>,
): { ok: boolean; reason?: string } {
  const all = readAll(tenantId);
  const idx = all.findIndex(c => c.id === circularId);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  const c = all[idx];
  if (c.type !== 'survey') return { ok: false, reason: 'not_survey' };
  if (!c.responses) c.responses = [];
  if (c.responses.some(r => r.employee_no === employeeNo)) {
    return { ok: false, reason: 'already_submitted' };
  }
  c.responses.push({ employee_no: employeeNo, answers, submitted_at: new Date().toISOString() });
  // also mark as read
  if (!c.read_by.includes(employeeNo)) c.read_by.push(employeeNo);
  writeAll(tenantId, all);
  return { ok: true };
}

/** Delete a circular (admin). */
export function deleteCircular(tenantId: string, circularId: string): boolean {
  const all = readAll(tenantId);
  const filtered = all.filter(c => c.id !== circularId);
  if (filtered.length === all.length) return false;
  writeAll(tenantId, filtered);
  return true;
}

/** Count unread circulars for an employee. */
export function unreadCount(tenantId: string, employeeNo: string, role: string, department?: string): number {
  return getCircularsForEmployee(tenantId, employeeNo, role, department)
    .filter(c => !c.read_by.includes(employeeNo)).length;
}
