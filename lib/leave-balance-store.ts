import fs from 'fs';
import path from 'path';

export interface LeaveBalanceRecord {
  employee_no: string;
  annual_leave_balance: number;
  sick_leave_balance: number;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');

function filePathForTenant(tenantId: string): string {
  return path.join(DATA_DIR, `leave_balances_${tenantId}.json`);
}

function safeRead(tenantId: string): LeaveBalanceRecord[] {
  try {
    const f = filePathForTenant(tenantId);
    if (!fs.existsSync(f)) return [];
    const parsed = JSON.parse(fs.readFileSync(f, 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as LeaveBalanceRecord[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(tenantId: string, rows: LeaveBalanceRecord[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePathForTenant(tenantId), JSON.stringify(rows, null, 2), 'utf8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRecord(employeeNo: string): LeaveBalanceRecord {
  return {
    employee_no: employeeNo,
    annual_leave_balance: 30,
    sick_leave_balance: 15,
    updated_at: nowIso(),
  };
}

export function getLeaveBalance(tenantId: string, employeeNo: string): LeaveBalanceRecord {
  const rows = safeRead(tenantId);
  const hit = rows.find((r) => r.employee_no === employeeNo);
  if (hit) return hit;
  return defaultRecord(employeeNo);
}

export function upsertLeaveBalance(tenantId: string, payload: LeaveBalanceRecord): LeaveBalanceRecord {
  const rows = safeRead(tenantId);
  const idx = rows.findIndex((r) => r.employee_no === payload.employee_no);
  const next = {
    ...payload,
    updated_at: nowIso(),
  };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  safeWrite(tenantId, rows);
  return next;
}

export function deductAnnualLeaveDays(tenantId: string, employeeNo: string, days: number): LeaveBalanceRecord {
  if (!employeeNo || days <= 0) return getLeaveBalance(tenantId, employeeNo);

  const current = getLeaveBalance(tenantId, employeeNo);
  if (current.annual_leave_balance < days) {
    throw new Error('leave_balance_insufficient');
  }

  return upsertLeaveBalance(tenantId, {
    ...current,
    annual_leave_balance: current.annual_leave_balance - days,
  });
}

export function deductLeaveDaysByType(
  tenantId: string,
  employeeNo: string,
  leaveType: string,
  days: number,
): LeaveBalanceRecord {
  if (!employeeNo || days <= 0) return getLeaveBalance(tenantId, employeeNo);

  const current = getLeaveBalance(tenantId, employeeNo);
  const kind = String(leaveType || '').toLowerCase();

  if (kind === 'sick') {
    if (current.sick_leave_balance < days) {
      throw new Error('leave_balance_insufficient');
    }
    return upsertLeaveBalance(tenantId, {
      ...current,
      sick_leave_balance: current.sick_leave_balance - days,
    });
  }

  // Default deduction bucket is annual leave.
  if (current.annual_leave_balance < days) {
    throw new Error('leave_balance_insufficient');
  }
  return upsertLeaveBalance(tenantId, {
    ...current,
    annual_leave_balance: current.annual_leave_balance - days,
  });
}
