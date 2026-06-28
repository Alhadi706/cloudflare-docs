import fs from 'fs';
import path from 'path';

export interface HrPositionRecord {
  id: number;
  tenant_id: string;
  position_code: string;
  position_name: string;
  position_name_ar: string;
  department_id: number | null;
  department_name: string | null;
  grade_id: number | null;
  grade_name: string | null;
  grade_level: number | null;
  authorized_headcount: number;
  occupied_headcount: number;
  base_salary_min: number | null;
  base_salary_max: number | null;
  description: string | null;
  status: string;
  mobile_role?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HrGradeRecord {
  id: number;
  tenant_id: string;
  grade_name: string;
  grade_name_ar: string;
  grade_level: number;
  base_salary_min: number;
  base_salary_max: number;
  annual_increment: number;
  housing_allowance: number;
  transport_allowance: number;
  description: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface HrAssignmentRecord {
  id: number;
  tenant_id: string;
  employee_id: number;
  employee_name: string;
  position_id: number;
  position_name: string;
  position_name_ar: string;
  grade_name: string | null;
  project_id: number | null;
  project_name: string | null;
  site_id: number | null;
  assigned_at: string;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'hr-structure');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function positionsFile(tenantId: string): string {
  return path.join(DATA_DIR, `positions_${tenantId}.json`);
}

function gradesFile(tenantId: string): string {
  return path.join(DATA_DIR, `grades_${tenantId}.json`);
}

function assignmentsFile(tenantId: string): string {
  return path.join(DATA_DIR, `assignments_${tenantId}.json`);
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
}

export function listHrPositions(tenantId: string): HrPositionRecord[] {
  return safeReadJson<HrPositionRecord[]>(positionsFile(tenantId), []);
}

export function createHrPosition(
  tenantId: string,
  input: Partial<HrPositionRecord>,
): HrPositionRecord {
  const all = listHrPositions(tenantId);
  const now = new Date().toISOString();

  const record: HrPositionRecord = {
    id: nextId(all),
    tenant_id: tenantId,
    position_code: String(input.position_code || '').trim(),
    position_name: String(input.position_name || '').trim(),
    position_name_ar: String(input.position_name_ar || '').trim(),
    department_id: input.department_id ?? null,
    department_name: input.department_name ?? null,
    grade_id: input.grade_id ?? null,
    grade_name: input.grade_name ?? null,
    grade_level: input.grade_level ?? null,
    authorized_headcount: Number(input.authorized_headcount ?? 1) || 1,
    occupied_headcount: Number(input.occupied_headcount ?? 0) || 0,
    base_salary_min: input.base_salary_min ?? null,
    base_salary_max: input.base_salary_max ?? null,
    description: input.description ?? null,
    status: String(input.status || 'active'),
    mobile_role: input.mobile_role ?? null,
    created_at: now,
    updated_at: now,
  };

  all.push(record);
  safeWriteJson(positionsFile(tenantId), all);
  return record;
}

export function updateHrPosition(
  tenantId: string,
  id: number,
  patch: Partial<HrPositionRecord>,
): HrPositionRecord | null {
  const all = listHrPositions(tenantId);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const current = all[idx];
  const next: HrPositionRecord = {
    ...current,
    ...patch,
    id: current.id,
    tenant_id: current.tenant_id,
    authorized_headcount: Number(patch.authorized_headcount ?? current.authorized_headcount) || 1,
    occupied_headcount: Number(patch.occupied_headcount ?? current.occupied_headcount) || 0,
    updated_at: new Date().toISOString(),
  };

  all[idx] = next;
  safeWriteJson(positionsFile(tenantId), all);
  return next;
}

export function deleteHrPosition(tenantId: string, id: number): boolean {
  const all = listHrPositions(tenantId);
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  safeWriteJson(positionsFile(tenantId), next);
  return true;
}

export function findHrPosition(tenantId: string, id: number): HrPositionRecord | null {
  const all = listHrPositions(tenantId);
  return all.find((p) => p.id === id) || null;
}

export function listHrGrades(tenantId: string): HrGradeRecord[] {
  return safeReadJson<HrGradeRecord[]>(gradesFile(tenantId), []);
}

export function createHrGrade(
  tenantId: string,
  input: Partial<HrGradeRecord>,
): HrGradeRecord {
  const all = listHrGrades(tenantId);
  const now = new Date().toISOString();

  const record: HrGradeRecord = {
    id: nextId(all),
    tenant_id: tenantId,
    grade_name: String(input.grade_name || '').trim(),
    grade_name_ar: String(input.grade_name_ar || '').trim(),
    grade_level: Number(input.grade_level ?? 1) || 1,
    base_salary_min: Number(input.base_salary_min ?? 0) || 0,
    base_salary_max: Number(input.base_salary_max ?? 0) || 0,
    annual_increment: Number(input.annual_increment ?? 0) || 0,
    housing_allowance: Number(input.housing_allowance ?? 0) || 0,
    transport_allowance: Number(input.transport_allowance ?? 0) || 0,
    description: input.description ?? null,
    status: String(input.status || 'active'),
    created_at: now,
    updated_at: now,
  };

  all.push(record);
  safeWriteJson(gradesFile(tenantId), all);
  return record;
}

export function updateHrGrade(
  tenantId: string,
  id: number,
  patch: Partial<HrGradeRecord>,
): HrGradeRecord | null {
  const all = listHrGrades(tenantId);
  const idx = all.findIndex((g) => g.id === id);
  if (idx < 0) return null;

  const current = all[idx];
  const next: HrGradeRecord = {
    ...current,
    ...patch,
    id: current.id,
    tenant_id: current.tenant_id,
    grade_level: Number(patch.grade_level ?? current.grade_level) || 1,
    base_salary_min: Number(patch.base_salary_min ?? current.base_salary_min) || 0,
    base_salary_max: Number(patch.base_salary_max ?? current.base_salary_max) || 0,
    annual_increment: Number(patch.annual_increment ?? current.annual_increment) || 0,
    housing_allowance: Number(patch.housing_allowance ?? current.housing_allowance) || 0,
    transport_allowance: Number(patch.transport_allowance ?? current.transport_allowance) || 0,
    updated_at: new Date().toISOString(),
  };

  all[idx] = next;
  safeWriteJson(gradesFile(tenantId), all);
  return next;
}

export function deleteHrGrade(tenantId: string, id: number): boolean {
  const all = listHrGrades(tenantId);
  const next = all.filter((g) => g.id !== id);
  if (next.length === all.length) return false;
  safeWriteJson(gradesFile(tenantId), next);
  return true;
}

export function listHrAssignments(tenantId: string): HrAssignmentRecord[] {
  return safeReadJson<HrAssignmentRecord[]>(assignmentsFile(tenantId), []);
}

export function createHrAssignment(
  tenantId: string,
  input: Omit<HrAssignmentRecord, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean },
): HrAssignmentRecord {
  const all = listHrAssignments(tenantId);
  const now = new Date().toISOString();

  const record: HrAssignmentRecord = {
    id: nextId(all),
    tenant_id: tenantId,
    employee_id: Number(input.employee_id),
    employee_name: String(input.employee_name || ''),
    position_id: Number(input.position_id),
    position_name: String(input.position_name || ''),
    position_name_ar: String(input.position_name_ar || ''),
    grade_name: input.grade_name ?? null,
    project_id: input.project_id ?? null,
    project_name: input.project_name ?? null,
    site_id: input.site_id ?? null,
    assigned_at: String(input.assigned_at || now.slice(0, 10)),
    is_active: input.is_active ?? true,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  all.push(record);
  safeWriteJson(assignmentsFile(tenantId), all);

  const positions = listHrPositions(tenantId);
  const pIdx = positions.findIndex((p) => p.id === record.position_id);
  if (pIdx >= 0) {
    positions[pIdx].occupied_headcount = Math.max(0, Number(positions[pIdx].occupied_headcount || 0) + 1);
    positions[pIdx].updated_at = now;
    safeWriteJson(positionsFile(tenantId), positions);
  }

  return record;
}

export function deleteHrAssignment(tenantId: string, id: number): HrAssignmentRecord | null {
  const all = listHrAssignments(tenantId);
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;

  const current = all[idx];
  all.splice(idx, 1);
  safeWriteJson(assignmentsFile(tenantId), all);

  const now = new Date().toISOString();
  const positions = listHrPositions(tenantId);
  const pIdx = positions.findIndex((p) => p.id === current.position_id);
  if (pIdx >= 0) {
    positions[pIdx].occupied_headcount = Math.max(0, Number(positions[pIdx].occupied_headcount || 0) - 1);
    positions[pIdx].updated_at = now;
    safeWriteJson(positionsFile(tenantId), positions);
  }

  return current;
}
