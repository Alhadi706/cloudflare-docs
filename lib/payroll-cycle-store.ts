import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type PayrollCycleStatus =
  | 'draft'
  | 'pending_admin_approval'
  | 'pending_finance_approval'
  | 'pending_treasury_disbursement'
  | 'disbursed'
  | 'rejected';

export type PayrollCycleAction =
  | 'submit'
  | 'approve_admin'
  | 'approve_finance'
  | 'disburse_treasury'
  | 'reject'
  | 'return_admin';

export type PayrollCycleEvent = {
  at: string;
  action: PayrollCycleAction | 'created';
  by: string;
  role: string;
  notes?: string;
};

export type PayrollCycleRecord = {
  id: string;
  tenant_id: string;
  cycle_no: string;
  period_label: string;
  period_month?: number | null;
  period_year?: number | null;
  employee_count: number;
  total_base: number;
  total_allowances: number;
  total_deductions: number;
  total_net: number;
  status: PayrollCycleStatus;
  source_department: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  events: PayrollCycleEvent[];
};

const DATA_DIR = path.join(process.cwd(), '.data', 'payroll-cycles');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileForTenant(tenantId: string): string {
  return path.join(DATA_DIR, `cycles_${tenantId}.json`);
}

function readCycles(tenantId: string): PayrollCycleRecord[] {
  ensureDir();
  const filePath = fileForTenant(tenantId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as PayrollCycleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeCycles(tenantId: string, cycles: PayrollCycleRecord[]) {
  ensureDir();
  const filePath = fileForTenant(tenantId);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cycles, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeCycleNo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const suffix = Date.now().toString().slice(-5);
  return `PR-${y}${m}-${suffix}`;
}

function canApply(status: PayrollCycleStatus, action: PayrollCycleAction): boolean {
  if (status === 'disbursed' || status === 'rejected') return false;
  if (action === 'submit') return status === 'draft';
  if (action === 'approve_admin') return status === 'pending_admin_approval';
  if (action === 'approve_finance') return status === 'pending_finance_approval';
  if (action === 'disburse_treasury') return status === 'pending_treasury_disbursement';
  if (action === 'reject') return status !== 'disbursed';
  if (action === 'return_admin') return status === 'pending_finance_approval';
  return false;
}

function nextStatus(current: PayrollCycleStatus, action: PayrollCycleAction): PayrollCycleStatus {
  if (action === 'submit' && current === 'draft') return 'pending_admin_approval';
  if (action === 'approve_admin' && current === 'pending_admin_approval') return 'pending_finance_approval';
  if (action === 'approve_finance' && current === 'pending_finance_approval') return 'pending_treasury_disbursement';
  if (action === 'disburse_treasury' && current === 'pending_treasury_disbursement') return 'disbursed';
  if (action === 'return_admin' && current === 'pending_finance_approval') return 'pending_admin_approval';
  if (action === 'reject') return 'rejected';
  return current;
}

export function listPayrollCycles(tenantId: string): PayrollCycleRecord[] {
  return readCycles(tenantId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getPayrollCycleById(tenantId: string, id: string): PayrollCycleRecord | null {
  return readCycles(tenantId).find((r) => r.id === id) || null;
}

export function createPayrollCycle(
  tenantId: string,
  payload: {
    period_label: string;
    period_month?: number | null;
    period_year?: number | null;
    employee_count: number;
    total_base?: number;
    total_allowances?: number;
    total_deductions?: number;
    total_net: number;
    source_department?: string;
    created_by: string;
    created_role: string;
  },
): PayrollCycleRecord {
  const rows = readCycles(tenantId);
  const ts = nowIso();

  const record: PayrollCycleRecord = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    cycle_no: makeCycleNo(),
    period_label: String(payload.period_label || '').trim(),
    period_month: payload.period_month ?? null,
    period_year: payload.period_year ?? null,
    employee_count: Math.max(0, Number(payload.employee_count || 0)),
    total_base: Math.max(0, Number(payload.total_base || 0)),
    total_allowances: Math.max(0, Number(payload.total_allowances || 0)),
    total_deductions: Math.max(0, Number(payload.total_deductions || 0)),
    total_net: Math.max(0, Number(payload.total_net || 0)),
    status: 'draft',
    source_department: String(payload.source_department || 'HR').trim().toUpperCase(),
    created_by: String(payload.created_by || 'system').trim(),
    created_at: ts,
    updated_at: ts,
    events: [
      {
        at: ts,
        action: 'created',
        by: String(payload.created_by || 'system').trim(),
        role: String(payload.created_role || 'hr_manager').trim(),
        notes: 'تم إنشاء دورة المرتبات بصيغة مسودة.',
      },
    ],
  };

  rows.push(record);
  writeCycles(tenantId, rows.slice(-2000));
  return record;
}

export function applyPayrollCycleAction(
  tenantId: string,
  id: string,
  payload: {
    action: PayrollCycleAction;
    actor: string;
    role: string;
    notes?: string;
  },
): PayrollCycleRecord | null {
  const rows = readCycles(tenantId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const current = rows[idx];
  if (!canApply(current.status, payload.action)) {
    throw new Error(`invalid_transition:${current.status}:${payload.action}`);
  }

  const ts = nowIso();
  const updated: PayrollCycleRecord = {
    ...current,
    status: nextStatus(current.status, payload.action),
    updated_at: ts,
    events: [
      ...current.events,
      {
        at: ts,
        action: payload.action,
        by: payload.actor,
        role: payload.role,
        notes: payload.notes,
      },
    ],
  };

  rows[idx] = updated;
  writeCycles(tenantId, rows);
  return updated;
}
