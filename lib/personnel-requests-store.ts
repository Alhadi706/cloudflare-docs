import fs from 'fs';
import path from 'path';
import { deductAnnualLeaveDays } from '@/lib/leave-balance-store';
import { appendMobileNotification } from '@/lib/mobile-notifications-store';

export type PersonnelRequestStatus =
  | 'pending_section_head_review'
  | 'pending_department_manager_review'
  | 'pending_hr_review'
  | 'approved'
  | 'archived'
  | 'rejected';

export type PersonnelRequestAction =
  | 'submit'
  | 'approve_section_head'
  | 'approve_department_manager'
  | 'approve_hr'
  | 'archive'
  | 'reject'
  | 'reopen';

export interface PersonnelRequestRecord {
  id: string;
  tenant_id: string;
  employee_no: string;
  employee_name: string;
  request_type: string;
  title: string;
  details: string;
  priority: 'low' | 'medium' | 'high';
  status: PersonnelRequestStatus;
  current_stage: 'manager' | 'hr' | 'done';
  created_at: string;
  updated_at: string;
  due_at: string;
  requester_id: string;
  requester_employee_no: string;
  requester_role: string;
  leave_days: number;
}

export interface PersonnelAuditRecord {
  id: string;
  tenant_id: string;
  request_id: string;
  action: PersonnelRequestAction;
  actor_id: string;
  actor_role: string;
  notes: string | null;
  from_status: PersonnelRequestStatus | null;
  to_status: PersonnelRequestStatus;
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'personnel-workflow');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function requestsFile(tenantId: string): string {
  return path.join(DATA_DIR, `requests_${tenantId}.json`);
}

function auditFile(tenantId: string): string {
  return path.join(DATA_DIR, `audit_${tenantId}.json`);
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

function readArray<T>(filePath: string): T[] {
  const raw = safeReadJson<unknown>(filePath, []);
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addHours(input: Date, hours: number): Date {
  return new Date(input.getTime() + hours * 60 * 60 * 1000);
}

export function listPersonnelRequests(tenantId: string): PersonnelRequestRecord[] {
  const all = readArray<PersonnelRequestRecord>(requestsFile(tenantId));
  return [...all].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listPersonnelRequestsForRequester(
  tenantId: string,
  requester: { id?: string; employee_no?: string },
): PersonnelRequestRecord[] {
  const all = listPersonnelRequests(tenantId);
  const byEmployeeNo = String(requester.employee_no || '').trim();
  const byId = String(requester.id || '').trim();
  return all.filter((row) => {
    if (byEmployeeNo && row.requester_employee_no === byEmployeeNo) return true;
    if (byId && row.requester_id === byId) return true;
    return false;
  });
}

export function listPersonnelAudit(tenantId: string, limit = 50): PersonnelAuditRecord[] {
  const all = readArray<PersonnelAuditRecord>(auditFile(tenantId));
  const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted.slice(0, Math.max(1, Math.min(500, limit)));
}

function appendAudit(tenantId: string, record: PersonnelAuditRecord) {
  const all = readArray<PersonnelAuditRecord>(auditFile(tenantId));
  all.push(record);
  safeWriteJson(auditFile(tenantId), all);
}

export function createPersonnelRequest(
  tenantId: string,
  input: {
    employee_no: string;
    employee_name: string;
    request_type: string;
    title: string;
    details: string;
    priority?: 'low' | 'medium' | 'high';
    requester_id: string;
    requester_employee_no?: string;
    requester_role: string;
    leave_days?: number;
    notes?: string;
  },
): PersonnelRequestRecord {
  const all = readArray<PersonnelRequestRecord>(requestsFile(tenantId));
  const now = nowIso();
  const status: PersonnelRequestStatus = 'pending_section_head_review';

  const record: PersonnelRequestRecord = {
    id: generateId('pr'),
    tenant_id: tenantId,
    employee_no: String(input.employee_no || '').trim(),
    employee_name: String(input.employee_name || '').trim(),
    request_type: String(input.request_type || '').trim(),
    title: String(input.title || '').trim(),
    details: String(input.details || '').trim(),
    priority: input.priority || 'medium',
    status,
    current_stage: 'manager',
    created_at: now,
    updated_at: now,
    due_at: addHours(new Date(), 48).toISOString(),
    requester_id: String(input.requester_id || 'system'),
    requester_employee_no: String(input.requester_employee_no || '').trim(),
    requester_role: String(input.requester_role || 'admin_officer'),
    leave_days: Math.max(0, Number(input.leave_days || 0)),
  };

  all.push(record);
  safeWriteJson(requestsFile(tenantId), all);

  appendAudit(tenantId, {
    id: generateId('audit'),
    tenant_id: tenantId,
    request_id: record.id,
    action: 'submit',
    actor_id: record.requester_id,
    actor_role: record.requester_role,
    notes: input.notes || null,
    from_status: null,
    to_status: status,
    created_at: now,
  });

  if (record.requester_employee_no) {
    appendMobileNotification(tenantId, {
      employee_no: record.requester_employee_no,
      title: 'تم استلام طلبك',
      body: `طلبك (${record.title}) دخل مرحلة رئيس القسم.`,
      url: '/dashboard/admin-gateway/hr/personnel/requests',
      urgency: 'normal',
      type: 'workflow',
    });
  }

  return record;
}

function isLeaveRequest(record: PersonnelRequestRecord): boolean {
  const lowerType = record.request_type.toLowerCase();
  const lowerTitle = record.title.toLowerCase();
  return (
    lowerType.includes('leave') ||
    lowerType.includes('اجاز') ||
    lowerType.includes('إجاز') ||
    lowerTitle.includes('leave') ||
    lowerTitle.includes('اجاز') ||
    lowerTitle.includes('إجاز')
  );
}

export function updatePersonnelRequest(
  tenantId: string,
  requestId: string,
  actor: { id: string; employee_no?: string; role: string },
  patch: Partial<Pick<PersonnelRequestRecord, 'title' | 'details' | 'request_type' | 'priority'>> & {
    leave_days?: number;
  },
): PersonnelRequestRecord {
  const all = readArray<PersonnelRequestRecord>(requestsFile(tenantId));
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx < 0) throw new Error('request_not_found');

  const current = all[idx];
  const editableStatuses: PersonnelRequestStatus[] = [
    'pending_section_head_review',
    'pending_department_manager_review',
  ];
  if (!editableStatuses.includes(current.status)) {
    throw new Error('request_not_editable');
  }

  const ownsById = actor.id && current.requester_id === actor.id;
  const ownsByEmpNo = actor.employee_no && current.requester_employee_no === actor.employee_no;
  const privileged = actor.role === 'admin' || actor.role === 'admin_officer' || actor.role === 'super_admin';
  if (!ownsById && !ownsByEmpNo && !privileged) {
    throw new Error('forbidden');
  }

  const next: PersonnelRequestRecord = {
    ...current,
    title: typeof patch.title === 'string' ? patch.title.trim() : current.title,
    details: typeof patch.details === 'string' ? patch.details.trim() : current.details,
    request_type: typeof patch.request_type === 'string' ? patch.request_type.trim() : current.request_type,
    priority: patch.priority || current.priority,
    leave_days: patch.leave_days !== undefined ? Math.max(0, Number(patch.leave_days || 0)) : current.leave_days,
    updated_at: nowIso(),
  };

  all[idx] = next;
  safeWriteJson(requestsFile(tenantId), all);

  appendAudit(tenantId, {
    id: generateId('audit'),
    tenant_id: tenantId,
    request_id: next.id,
    action: 'reopen',
    actor_id: actor.id || 'system',
    actor_role: actor.role || 'unknown',
    notes: 'employee_update',
    from_status: current.status,
    to_status: next.status,
    created_at: nowIso(),
  });

  return next;
}

const TRANSITIONS: Record<
  PersonnelRequestAction,
  { from: PersonnelRequestStatus[]; to: PersonnelRequestStatus; stage: 'manager' | 'hr' | 'done' }
> = {
  submit: { from: [], to: 'pending_section_head_review', stage: 'manager' },
  approve_section_head: { from: ['pending_section_head_review'], to: 'pending_department_manager_review', stage: 'manager' },
  approve_department_manager: { from: ['pending_department_manager_review'], to: 'pending_hr_review', stage: 'hr' },
  approve_hr: { from: ['pending_hr_review'], to: 'approved', stage: 'done' },
  archive: { from: ['approved'], to: 'archived', stage: 'done' },
  reject: {
    from: ['pending_section_head_review', 'pending_department_manager_review', 'pending_hr_review', 'approved'],
    to: 'rejected',
    stage: 'done',
  },
  reopen: { from: ['rejected', 'archived'], to: 'pending_section_head_review', stage: 'manager' },
};

export function transitionPersonnelRequest(
  tenantId: string,
  requestId: string,
  action: PersonnelRequestAction,
  actor: { id: string; role: string; notes?: string },
): PersonnelRequestRecord {
  const all = readArray<PersonnelRequestRecord>(requestsFile(tenantId));
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx < 0) throw new Error('request_not_found');

  const current = all[idx];
  const rule = TRANSITIONS[action];
  if (!rule) throw new Error('invalid_action');
  if (!rule.from.includes(current.status)) {
    throw new Error(`invalid_transition:${current.status}->${action}`);
  }

  const next: PersonnelRequestRecord = {
    ...current,
    status: rule.to,
    current_stage: rule.stage,
    updated_at: nowIso(),
  };

  if (action === 'approve_hr' && isLeaveRequest(next) && next.leave_days > 0) {
    deductAnnualLeaveDays(tenantId, next.employee_no, next.leave_days);
  }

  all[idx] = next;
  safeWriteJson(requestsFile(tenantId), all);

  appendAudit(tenantId, {
    id: generateId('audit'),
    tenant_id: tenantId,
    request_id: next.id,
    action,
    actor_id: actor.id || 'system',
    actor_role: actor.role || 'unknown',
    notes: actor.notes || null,
    from_status: current.status,
    to_status: next.status,
    created_at: nowIso(),
  });

  if (next.requester_employee_no) {
    const actionLabel: Record<PersonnelRequestAction, string> = {
      submit: 'تم استلام الطلب',
      approve_section_head: 'اعتمد رئيس القسم طلبك',
      approve_department_manager: 'اعتمد مدير الإدارة طلبك',
      approve_hr: 'اعتمدت شؤون الموظفين طلبك',
      archive: 'تمت أرشفة طلبك',
      reject: 'تم رفض طلبك',
      reopen: 'تمت إعادة فتح طلبك',
    };
    const body = action === 'approve_hr' && isLeaveRequest(next) && next.leave_days > 0
      ? `${actionLabel[action]} وتم خصم ${next.leave_days} يوم من رصيد الإجازة السنوية.`
      : `${actionLabel[action]} (${next.title}).`;

    appendMobileNotification(tenantId, {
      employee_no: next.requester_employee_no,
      title: 'تحديث على طلبك الإداري',
      body,
      url: '/dashboard/admin-gateway/hr/personnel/requests',
      urgency: action === 'reject' ? 'high' : 'normal',
      type: 'workflow',
    });
  }

  return next;
}

export function summarizePersonnelCompliance(tenantId: string): {
  total_requests: number;
  pending_requests: number;
  overdue_requests: number;
  archived_requests: number;
  rejected_requests: number;
  sla_compliance_pct: number;
} {
  const rows = listPersonnelRequests(tenantId);
  const now = Date.now();

  const pending = rows.filter(
    (r) =>
      r.status === 'pending_section_head_review' ||
      r.status === 'pending_department_manager_review' ||
      r.status === 'pending_hr_review',
  );
  const overdue = pending.filter((r) => new Date(r.due_at).getTime() < now);
  const archived = rows.filter((r) => r.status === 'archived').length;
  const rejected = rows.filter((r) => r.status === 'rejected').length;

  const totalClosed = archived + rejected;
  const closedWithinSla = rows.filter((r) => {
    if (r.status !== 'archived' && r.status !== 'rejected') return false;
    return new Date(r.updated_at).getTime() <= new Date(r.due_at).getTime();
  }).length;

  const sla = totalClosed > 0 ? Math.round((closedWithinSla / totalClosed) * 100) : 100;

  return {
    total_requests: rows.length,
    pending_requests: pending.length,
    overdue_requests: overdue.length,
    archived_requests: archived,
    rejected_requests: rejected,
    sla_compliance_pct: sla,
  };
}
