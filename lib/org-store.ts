/**
 * org-store.ts
 * Persistent JSON store for organisational structure:
 *   - Departments (إدارات) with dept_manager
 *   - Sections     (أقسام)  with section_manager
 *   - Employee org-role assignments (dept_manager / section_manager / supervisor)
 *
 * File layout (inside .data/):
 *   org_departments_{tenantId}.json
 *   org_sections_{tenantId}.json
 *   org_role_assignments_{tenantId}.json
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── File helpers ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), '.data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, def: T): T {
  ensureDir();
  const full = path.join(DATA_DIR, file);
  try { return JSON.parse(fs.readFileSync(full, 'utf8')) as T; }
  catch { return def; }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  tenant_id: string;
  name_ar: string;
  name_en: string;
  code: string;              // e.g. "CTRL", "HR", "MAINT"
  dept_manager_employee_no: string | null;
  dept_manager_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** ID of the matching department row in the hr_core backend (System A).
   *  Set after a successful sync to the Python backend.
   *  null  = not yet synced or backend unavailable.
   *  string = stringified integer or UUID returned by the backend. */
  dept_backend_id?: string | null;
}

export interface Section {
  id: string;
  tenant_id: string;
  department_id: string;    // FK → Department.id
  department_code: string;
  name_ar: string;
  name_en: string;
  code: string;
  section_manager_employee_no: string | null;
  section_manager_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgRoleAssignment {
  id: string;
  tenant_id: string;
  employee_no: string;
  full_name: string;
  /** 'dept_manager' | 'section_manager' | 'supervisor' */
  org_role: string;
  /** department code this assignment covers */
  department_code: string;
  /** section id (for section_manager/supervisor) */
  section_id: string | null;
  is_active: boolean;
  assigned_by: string;    // employee_no of assigner
  assigned_at: string;
  updated_at: string;
}

// ── File name helpers ────────────────────────────────────────────────────────

const deptFile   = (t: string) => `org_departments_${t}.json`;
const sectFile   = (t: string) => `org_sections_${t}.json`;
const rolesFile  = (t: string) => `org_role_assignments_${t}.json`;

// ── Departments ──────────────────────────────────────────────────────────────

export function getDepartments(tenantId: string): Department[] {
  return readJson<Department[]>(deptFile(tenantId), []);
}

export function saveDepartment(tenantId: string, input: Omit<Department, 'id' | 'created_at' | 'updated_at'>): Department {
  const all = getDepartments(tenantId);
  const now = new Date().toISOString();
  const record: Department = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
  all.push(record);
  writeJson(deptFile(tenantId), all);
  return record;
}

export function updateDepartment(tenantId: string, id: string, updates: Partial<Department>): Department | null {
  const all = getDepartments(tenantId);
  const idx = all.findIndex(d => d.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, id, updated_at: new Date().toISOString() };
  writeJson(deptFile(tenantId), all);
  return all[idx];
}

// ── Sections ─────────────────────────────────────────────────────────────────

export function getSections(tenantId: string): Section[] {
  return readJson<Section[]>(sectFile(tenantId), []);
}

export function saveSection(tenantId: string, input: Omit<Section, 'id' | 'created_at' | 'updated_at'>): Section {
  const all = getSections(tenantId);
  const now = new Date().toISOString();
  const record: Section = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
  all.push(record);
  writeJson(sectFile(tenantId), all);
  return record;
}

export function updateSection(tenantId: string, id: string, updates: Partial<Section>): Section | null {
  const all = getSections(tenantId);
  const idx = all.findIndex(s => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, id, updated_at: new Date().toISOString() };
  writeJson(sectFile(tenantId), all);
  return all[idx];
}

// ── Role Assignments ─────────────────────────────────────────────────────────

export function getRoleAssignments(tenantId: string): OrgRoleAssignment[] {
  return readJson<OrgRoleAssignment[]>(rolesFile(tenantId), []);
}

/** Assign (or update) an org role for an employee. Only one active assignment per employee per dept. */
export function assignOrgRole(
  tenantId: string,
  input: Omit<OrgRoleAssignment, 'id' | 'assigned_at' | 'updated_at'>
): OrgRoleAssignment {
  const all = getRoleAssignments(tenantId);
  const now = new Date().toISOString();
  // Deactivate any previous assignment for this employee in same dept
  for (const a of all) {
    if (a.employee_no === input.employee_no && a.department_code === input.department_code && a.is_active) {
      a.is_active = false;
      a.updated_at = now;
    }
  }
  const record: OrgRoleAssignment = { ...input, id: crypto.randomUUID(), assigned_at: now, updated_at: now };
  all.push(record);
  writeJson(rolesFile(tenantId), all);
  return record;
}

export function removeOrgRole(tenantId: string, employeeNo: string, departmentCode: string): void {
  const all = getRoleAssignments(tenantId);
  const now = new Date().toISOString();
  for (const a of all) {
    if (a.employee_no === employeeNo && a.department_code === departmentCode && a.is_active) {
      a.is_active = false;
      a.updated_at = now;
    }
  }
  writeJson(rolesFile(tenantId), all);
}

/** Get all active role assignments for a given employee */
export function getEmployeeOrgRoles(tenantId: string, employeeNo: string): OrgRoleAssignment[] {
  return getRoleAssignments(tenantId).filter(a => a.employee_no === employeeNo && a.is_active);
}
