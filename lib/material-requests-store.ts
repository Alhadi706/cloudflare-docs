import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'materials-requests');

type ApprovalStatus =
  | 'pending_dept_approval'
  | 'pending_materials_approval'
  | 'pending_finance_approval'
  | 'approved_waiting_fulfillment'
  | 'procurement_in_progress'
  | 'ready_for_pickup'
  | 'issued'
  | 'rejected';

export type MaterialItemRequest = {
  inventory_item_id?: number;
  item_name: string;
  item_category: string;
  requested_qty: number;
  unit: string;
  notes?: string;
};

export type MaterialRequestEvent = {
  at: string;
  action: string;
  by: string;
  notes?: string;
};

export type MaterialRequest = {
  id: string;
  tenant_id: string;
  request_no: string;
  requester_dept: string;
  requester_name: string;
  requester_contact?: string;
  target_use_case?: string;
  items: MaterialItemRequest[];
  status: ApprovalStatus;
  fulfillment_mode?: 'from_stock' | 'procure';
  notified_ready_at?: string;
  created_at: string;
  updated_at: string;
  events: MaterialRequestEvent[];
};

export type MaterialRequestAction =
  | 'approve_dept'
  | 'approve_materials'
  | 'approve_finance'
  | 'set_fulfillment_stock'
  | 'set_fulfillment_procure'
  | 'mark_ready_for_pickup'
  | 'mark_issued'
  | 'reject';

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileForTenant(tenantId: string): string {
  return path.join(DATA_DIR, `requests_${tenantId}.json`);
}

function readTenantRequests(tenantId: string): MaterialRequest[] {
  ensureDir();
  const file = fileForTenant(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as MaterialRequest[];
  } catch {
    return [];
  }
}

function writeTenantRequests(tenantId: string, rows: MaterialRequest[]) {
  ensureDir();
  const file = fileForTenant(tenantId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRequestNo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const suffix = Date.now().toString().slice(-6);
  return `MR-${y}-${suffix}`;
}

function canApply(status: ApprovalStatus, action: MaterialRequestAction): boolean {
  if (action === 'reject') return status !== 'issued' && status !== 'rejected';

  if (status === 'pending_dept_approval' && action === 'approve_dept') return true;
  if (status === 'pending_materials_approval' && action === 'approve_materials') return true;
  if (status === 'pending_finance_approval' && action === 'approve_finance') return true;
  if (status === 'approved_waiting_fulfillment' && (action === 'set_fulfillment_stock' || action === 'set_fulfillment_procure')) return true;
  if (status === 'procurement_in_progress' && action === 'mark_ready_for_pickup') return true;
  if (status === 'ready_for_pickup' && action === 'mark_issued') return true;

  return false;
}

function nextStatus(current: ApprovalStatus, action: MaterialRequestAction): ApprovalStatus {
  if (action === 'reject') return 'rejected';
  if (current === 'pending_dept_approval' && action === 'approve_dept') return 'pending_materials_approval';
  if (current === 'pending_materials_approval' && action === 'approve_materials') return 'pending_finance_approval';
  if (current === 'pending_finance_approval' && action === 'approve_finance') return 'approved_waiting_fulfillment';
  if (current === 'approved_waiting_fulfillment' && action === 'set_fulfillment_stock') return 'ready_for_pickup';
  if (current === 'approved_waiting_fulfillment' && action === 'set_fulfillment_procure') return 'procurement_in_progress';
  if (current === 'procurement_in_progress' && action === 'mark_ready_for_pickup') return 'ready_for_pickup';
  if (current === 'ready_for_pickup' && action === 'mark_issued') return 'issued';
  return current;
}

export function createMaterialRequest(
  tenantId: string,
  input: {
    requester_dept: string;
    requester_name: string;
    requester_contact?: string;
    target_use_case?: string;
    items: MaterialItemRequest[];
  }
): MaterialRequest {
  const ts = nowIso();
  const record: MaterialRequest = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    request_no: makeRequestNo(),
    requester_dept: input.requester_dept,
    requester_name: input.requester_name,
    requester_contact: input.requester_contact,
    target_use_case: input.target_use_case,
    items: input.items,
    status: 'pending_dept_approval',
    created_at: ts,
    updated_at: ts,
    events: [
      {
        at: ts,
        action: 'created',
        by: input.requester_name || 'requester',
        notes: 'تم إنشاء طلب المواد وإرساله لمسار الموافقات.',
      },
    ],
  };

  const rows = readTenantRequests(tenantId);
  rows.push(record);
  writeTenantRequests(tenantId, rows.slice(-2000));
  return record;
}

export function listMaterialRequests(tenantId: string): MaterialRequest[] {
  return readTenantRequests(tenantId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMaterialRequestById(tenantId: string, id: string): MaterialRequest | null {
  return readTenantRequests(tenantId).find((r) => r.id === id) || null;
}

export function applyMaterialRequestAction(
  tenantId: string,
  id: string,
  payload: {
    action: MaterialRequestAction;
    actor: string;
    notes?: string;
  }
): MaterialRequest | null {
  const rows = readTenantRequests(tenantId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const current = rows[idx];
  const action = payload.action;

  if (!canApply(current.status, action)) {
    throw new Error(`invalid_transition:${current.status}:${action}`);
  }

  const ts = nowIso();
  const updated: MaterialRequest = {
    ...current,
    status: nextStatus(current.status, action),
    updated_at: ts,
    events: [
      ...current.events,
      {
        at: ts,
        action,
        by: payload.actor || 'system',
        notes: payload.notes,
      },
    ],
  };

  if (action === 'set_fulfillment_stock') {
    updated.fulfillment_mode = 'from_stock';
    updated.notified_ready_at = ts;
  }

  if (action === 'set_fulfillment_procure') {
    updated.fulfillment_mode = 'procure';
  }

  if (action === 'mark_ready_for_pickup') {
    updated.notified_ready_at = ts;
  }

  rows[idx] = updated;
  writeTenantRequests(tenantId, rows);
  return updated;
}

export function appendMaterialRequestEvent(
  tenantId: string,
  id: string,
  payload: { action: string; by: string; notes?: string }
): MaterialRequest | null {
  const rows = readTenantRequests(tenantId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const current = rows[idx];
  const ts = nowIso();
  const updated: MaterialRequest = {
    ...current,
    updated_at: ts,
    events: [
      ...current.events,
      {
        at: ts,
        action: payload.action,
        by: payload.by || 'system',
        notes: payload.notes,
      },
    ],
  };

  rows[idx] = updated;
  writeTenantRequests(tenantId, rows);
  return updated;
}

export function getDepartmentTemplates(): Record<string, Array<{ item_name: string; item_category: string; unit: string }>> {
  return {
    'admin-affairs': [
      { item_name: 'قرطاسية مكتبية', item_category: 'stationery', unit: 'box' },
      { item_name: 'أحبار طابعات', item_category: 'office_supplies', unit: 'piece' },
    ],
    finance: [
      { item_name: 'قرطاسية تدقيق', item_category: 'stationery', unit: 'box' },
      { item_name: 'أوراق أرشفة', item_category: 'office_supplies', unit: 'pack' },
    ],
    maintenance: [
      { item_name: 'قطع غيار مضخات', item_category: 'spare_parts', unit: 'piece' },
      { item_name: 'زيوت تشغيل', item_category: 'consumables', unit: 'litre' },
    ],
    corrosion: [
      { item_name: 'مواد حماية كاثودية', item_category: 'chemicals', unit: 'set' },
      { item_name: 'أقطاب قياس', item_category: 'tools', unit: 'piece' },
    ],
    services: [
      { item_name: 'مستهلكات ميدانية', item_category: 'consumables', unit: 'box' },
      { item_name: 'معدات مسح', item_category: 'equipment', unit: 'piece' },
    ],
    materials: [
      { item_name: 'مواد تشغيل المخازن', item_category: 'consumables', unit: 'box' },
      { item_name: 'ملصقات وتتبع', item_category: 'office_supplies', unit: 'roll' },
    ],
  };
}
