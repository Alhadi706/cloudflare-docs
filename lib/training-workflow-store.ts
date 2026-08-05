import fs from 'fs';
import path from 'path';
import { appendMobileNotification } from '@/lib/mobile-notifications-store';

export type TrainingNeedStatus =
  | 'draft'
  | 'submitted'
  | 'section_approved'
  | 'dept_approved'
  | 'training_approved'
  | 'rejected';

export type TrainingNominationStatus =
  | 'submitted'
  | 'section_approved'
  | 'dept_approved'
  | 'finance_approved'
  | 'hr_approved'
  | 'completed'
  | 'rejected';

export interface TrainingNeedRecord {
  id: string;
  tenant_id: string;
  department_code: string;
  section_code: string;
  target_department_codes: string[];
  title: string;
  competency_gap: string;
  objective: string;
  target_audience: string;
  expected_impact: string;
  priority: 'low' | 'medium' | 'high';
  proposed_budget: number;
  requested_by: string;
  requested_employee_no: string;
  requested_role: string;
  status: TrainingNeedStatus;
  created_at: string;
  updated_at: string;
}

export interface TrainingNominationRecord {
  id: string;
  tenant_id: string;
  need_id: string;
  employee_no: string;
  employee_name: string;
  department_code: string;
  section_code: string;
  nomination_reason: string;
  status: TrainingNominationStatus;
  created_by: string;
  created_role: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingAuditRecord {
  id: string;
  tenant_id: string;
  entity: 'need' | 'nomination';
  entity_id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'training-workflow');
const ORG_ROLES_FILE = path.join(process.cwd(), '.data', 'org-roles.json');

type OrgRoleRecord = {
  org_role?: string;
  department_code?: string;
  employee_no?: string;
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function needsFile(tenantId: string): string {
  return path.join(DATA_DIR, `needs_${tenantId}.json`);
}

function nominationsFile(tenantId: string): string {
  return path.join(DATA_DIR, `nominations_${tenantId}.json`);
}

function auditFile(tenantId: string): string {
  return path.join(DATA_DIR, `audit_${tenantId}.json`);
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

function appendAudit(tenantId: string, record: TrainingAuditRecord) {
  const all = readArray<TrainingAuditRecord>(auditFile(tenantId));
  all.push(record);
  writeJson(auditFile(tenantId), all);
}

function listTargetDeptManagerEmpNos(targetDeptCodes: string[]): string[] {
  try {
    if (!fs.existsSync(ORG_ROLES_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(ORG_ROLES_FILE, 'utf8')) as { roles?: OrgRoleRecord[] };
    const rows = Array.isArray(parsed?.roles) ? parsed.roles : [];
    const targets = new Set(targetDeptCodes.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean));
    const managerEmpNos = rows
      .filter((r) => {
        const role = String(r.org_role || '').trim().toLowerCase();
        const dept = String(r.department_code || '').trim().toUpperCase();
        return role === 'dept_manager' && targets.has(dept);
      })
      .map((r) => String(r.employee_no || '').trim())
      .filter(Boolean);
    return [...new Set(managerEmpNos)];
  } catch {
    return [];
  }
}

export function listTrainingNeeds(tenantId: string): TrainingNeedRecord[] {
  return readArray<TrainingNeedRecord>(needsFile(tenantId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listTrainingNominations(tenantId: string): TrainingNominationRecord[] {
  return readArray<TrainingNominationRecord>(nominationsFile(tenantId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listTrainingAudit(tenantId: string): TrainingAuditRecord[] {
  return readArray<TrainingAuditRecord>(auditFile(tenantId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createTrainingNeed(
  tenantId: string,
  payload: {
    department_code: string;
    section_code: string;
    target_department_codes?: string[];
    title: string;
    competency_gap: string;
    objective: string;
    target_audience: string;
    expected_impact: string;
    priority?: 'low' | 'medium' | 'high';
    proposed_budget?: number;
    requested_by: string;
    requested_employee_no?: string;
    requested_role: string;
  },
): TrainingNeedRecord {
  const all = readArray<TrainingNeedRecord>(needsFile(tenantId));
  const now = nowIso();
  const requestedRole = String(payload.requested_role || 'employee').trim().toLowerCase();
  const trainingRoles = new Set(['hr_manager', 'admin_officer', 'admin', 'founder']);
  const targetDeptCodes = Array.isArray(payload.target_department_codes)
    ? [...new Set(payload.target_department_codes.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean))]
    : [];
  const initialStatus: TrainingNeedStatus = trainingRoles.has(requestedRole) ? 'training_approved' : 'submitted';

  const next: TrainingNeedRecord = {
    id: newId('need'),
    tenant_id: tenantId,
    department_code: String(payload.department_code || '').trim().toUpperCase(),
    section_code: String(payload.section_code || '').trim().toUpperCase(),
    target_department_codes: targetDeptCodes,
    title: String(payload.title || '').trim(),
    competency_gap: String(payload.competency_gap || '').trim(),
    objective: String(payload.objective || '').trim(),
    target_audience: String(payload.target_audience || '').trim(),
    expected_impact: String(payload.expected_impact || '').trim(),
    priority: payload.priority || 'medium',
    proposed_budget: Math.max(0, Number(payload.proposed_budget || 0)),
    requested_by: String(payload.requested_by || 'system').trim(),
    requested_employee_no: String(payload.requested_employee_no || '').trim(),
    requested_role: requestedRole,
    status: initialStatus,
    created_at: now,
    updated_at: now,
  };

  all.push(next);
  writeJson(needsFile(tenantId), all);

  appendAudit(tenantId, {
    id: newId('audit'),
    tenant_id: tenantId,
    entity: 'need',
    entity_id: next.id,
    action: 'submit_need',
    actor_id: next.requested_by,
    actor_role: next.requested_role,
    from_status: null,
    to_status: next.status,
    notes: null,
    created_at: now,
  });

  if (next.requested_employee_no) {
    appendMobileNotification(tenantId, {
      employee_no: next.requested_employee_no,
      title: 'تم استلام الاحتياج التدريبي',
      body: trainingRoles.has(requestedRole)
        ? `تم تسجيل المقترح التدريبي (${next.title}) وإتاحته للإدارات المستهدفة للترشيح.`
        : `تم تسجيل الاحتياج (${next.title}) وإحالته لاعتماد رئيس القسم.`,
      url: '/dashboard/admin-gateway/hr/training',
      urgency: 'normal',
      type: 'workflow',
    });
  }

  if (trainingRoles.has(requestedRole) && next.target_department_codes.length > 0) {
    const managerEmpNos = listTargetDeptManagerEmpNos(next.target_department_codes);
    for (const managerEmpNo of managerEmpNos) {
      appendMobileNotification(tenantId, {
        employee_no: managerEmpNo,
        title: 'مقترح تدريبي جديد يحتاج ترشيح الإدارة',
        body: `تم توجيه المقترح (${next.title}) إلى إدارتك. الرجاء ترشيح الموظفين المناسبين ضمن النموذج الموحد.`,
        url: '/dashboard/admin-gateway/hr/training',
        urgency: 'high',
        type: 'workflow',
      });
    }
  }

  return next;
}

const NEED_TRANSITIONS: Record<string, { from: TrainingNeedStatus[]; to: TrainingNeedStatus }> = {
  approve_section: { from: ['submitted'], to: 'section_approved' },
  approve_dept: { from: ['section_approved'], to: 'dept_approved' },
  approve_training: { from: ['dept_approved'], to: 'training_approved' },
  reject: { from: ['submitted', 'section_approved', 'dept_approved'], to: 'rejected' },
};

export function transitionTrainingNeed(
  tenantId: string,
  id: string,
  action: string,
  actor: { id: string; role: string; notes?: string },
): TrainingNeedRecord {
  const all = readArray<TrainingNeedRecord>(needsFile(tenantId));
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('need_not_found');

  const current = all[idx];
  const rule = NEED_TRANSITIONS[action];
  if (!rule) throw new Error('invalid_action');
  if (!rule.from.includes(current.status)) throw new Error(`invalid_transition:${current.status}->${action}`);

  const next: TrainingNeedRecord = {
    ...current,
    status: rule.to,
    updated_at: nowIso(),
  };
  all[idx] = next;
  writeJson(needsFile(tenantId), all);

  appendAudit(tenantId, {
    id: newId('audit'),
    tenant_id: tenantId,
    entity: 'need',
    entity_id: next.id,
    action,
    actor_id: actor.id,
    actor_role: actor.role,
    from_status: current.status,
    to_status: next.status,
    notes: actor.notes || null,
    created_at: nowIso(),
  });

  if (next.requested_employee_no) {
    const actionLabel: Record<string, string> = {
      approve_section: 'اعتمد رئيس القسم الاحتياج',
      approve_dept: 'اعتمد مدير الإدارة الاحتياج',
      approve_training: 'اعتمدت إدارة التدريب الاحتياج',
      reject: 'تم رفض الاحتياج التدريبي',
    };
    appendMobileNotification(tenantId, {
      employee_no: next.requested_employee_no,
      title: 'تحديث على الاحتياج التدريبي',
      body: `${actionLabel[action] || 'تم تحديث حالة الاحتياج'} (${next.title}).`,
      url: '/dashboard/admin-gateway/hr/training',
      urgency: action === 'reject' ? 'high' : 'normal',
      type: 'workflow',
    });
  }

  return next;
}

export function createTrainingNomination(
  tenantId: string,
  payload: {
    need_id: string;
    employee_no: string;
    employee_name: string;
    department_code: string;
    section_code: string;
    nomination_reason: string;
    created_by: string;
    created_role: string;
  },
): TrainingNominationRecord {
  const all = readArray<TrainingNominationRecord>(nominationsFile(tenantId));
  const now = nowIso();

  const next: TrainingNominationRecord = {
    id: newId('nom'),
    tenant_id: tenantId,
    need_id: String(payload.need_id || '').trim(),
    employee_no: String(payload.employee_no || '').trim(),
    employee_name: String(payload.employee_name || '').trim(),
    department_code: String(payload.department_code || '').trim().toUpperCase(),
    section_code: String(payload.section_code || '').trim().toUpperCase(),
    nomination_reason: String(payload.nomination_reason || '').trim(),
    status: 'submitted',
    created_by: String(payload.created_by || 'system').trim(),
    created_role: String(payload.created_role || 'section_manager').trim(),
    created_at: now,
    updated_at: now,
  };

  all.push(next);
  writeJson(nominationsFile(tenantId), all);

  appendAudit(tenantId, {
    id: newId('audit'),
    tenant_id: tenantId,
    entity: 'nomination',
    entity_id: next.id,
    action: 'submit_nomination',
    actor_id: next.created_by,
    actor_role: next.created_role,
    from_status: null,
    to_status: next.status,
    notes: null,
    created_at: now,
  });

  if (next.employee_no) {
    appendMobileNotification(tenantId, {
      employee_no: next.employee_no,
      title: 'تم ترشيحك لبرنامج تدريبي',
      body: `تم ترشيحك ضمن الاحتياج ${next.need_id} وهو الآن بانتظار اعتماد رئيس القسم.`,
      url: '/dashboard/admin-gateway/hr/training',
      urgency: 'normal',
      type: 'workflow',
    });
  }

  return next;
}

const NOM_TRANSITIONS: Record<string, { from: TrainingNominationStatus[]; to: TrainingNominationStatus }> = {
  approve_section: { from: ['submitted'], to: 'section_approved' },
  approve_dept: { from: ['section_approved'], to: 'dept_approved' },
  approve_finance: { from: ['dept_approved'], to: 'finance_approved' },
  approve_hr: { from: ['finance_approved'], to: 'hr_approved' },
  mark_completed: { from: ['hr_approved'], to: 'completed' },
  reject: { from: ['submitted', 'section_approved', 'dept_approved', 'finance_approved', 'hr_approved'], to: 'rejected' },
};

export function transitionTrainingNomination(
  tenantId: string,
  id: string,
  action: string,
  actor: { id: string; role: string; notes?: string },
): TrainingNominationRecord {
  const all = readArray<TrainingNominationRecord>(nominationsFile(tenantId));
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('nomination_not_found');

  const current = all[idx];
  const rule = NOM_TRANSITIONS[action];
  if (!rule) throw new Error('invalid_action');
  if (!rule.from.includes(current.status)) throw new Error(`invalid_transition:${current.status}->${action}`);

  const next: TrainingNominationRecord = {
    ...current,
    status: rule.to,
    updated_at: nowIso(),
  };
  all[idx] = next;
  writeJson(nominationsFile(tenantId), all);

  appendAudit(tenantId, {
    id: newId('audit'),
    tenant_id: tenantId,
    entity: 'nomination',
    entity_id: next.id,
    action,
    actor_id: actor.id,
    actor_role: actor.role,
    from_status: current.status,
    to_status: next.status,
    notes: actor.notes || null,
    created_at: nowIso(),
  });

  if (next.employee_no) {
    const actionLabel: Record<string, string> = {
      approve_section: 'اعتمد رئيس القسم ترشيحك',
      approve_dept: 'اعتمد مدير الإدارة ترشيحك',
      approve_finance: 'اعتمدت الإدارة المالية ترشيحك',
      approve_hr: 'اعتمدت شؤون الموظفين ترشيحك',
      mark_completed: 'تم إغلاق ترشيحك كمكتمل',
      reject: 'تم رفض ترشيحك التدريبي',
    };
    appendMobileNotification(tenantId, {
      employee_no: next.employee_no,
      title: 'تحديث على الترشيح التدريبي',
      body: `${actionLabel[action] || 'تم تحديث حالة الترشيح'} (${next.employee_name}).`,
      url: '/dashboard/admin-gateway/hr/training',
      urgency: action === 'reject' ? 'high' : 'normal',
      type: 'workflow',
    });
  }

  return next;
}
