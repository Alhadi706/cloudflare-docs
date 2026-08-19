import { NextRequest, NextResponse } from 'next/server';
import {
  applyMaterialRequestAction,
  getMaterialRequestById,
} from '@/lib/material-requests-store';

type WorkflowAction =
  | 'approve_dept'
  | 'approve_materials'
  | 'approve_finance'
  | 'set_fulfillment_stock'
  | 'set_fulfillment_procure'
  | 'mark_ready_for_pickup'
  | 'mark_issued'
  | 'reject'
  | 'return';

type RequestStatus =
  | 'pending_dept_approval'
  | 'pending_materials_approval'
  | 'pending_finance_approval'
  | 'approved_waiting_fulfillment'
  | 'procurement_in_progress'
  | 'ready_for_pickup'
  | 'issued'
  | 'rejected';

const ACTIONS: WorkflowAction[] = [
  'approve_dept',
  'approve_materials',
  'approve_finance',
  'set_fulfillment_stock',
  'set_fulfillment_procure',
  'mark_ready_for_pickup',
  'mark_issued',
  'reject',
  'return',
];

const ACTION_ALLOWED_STATUS: Record<WorkflowAction, RequestStatus[]> = {
  approve_dept: ['pending_dept_approval'],
  approve_materials: ['pending_materials_approval'],
  approve_finance: ['pending_finance_approval'],
  set_fulfillment_stock: ['approved_waiting_fulfillment'],
  set_fulfillment_procure: ['approved_waiting_fulfillment'],
  mark_ready_for_pickup: ['procurement_in_progress'],
  mark_issued: ['ready_for_pickup'],
  reject: [
    'pending_dept_approval',
    'pending_materials_approval',
    'pending_finance_approval',
    'approved_waiting_fulfillment',
    'procurement_in_progress',
    'ready_for_pickup',
  ],
  return: ['pending_dept_approval', 'pending_materials_approval', 'pending_finance_approval'],
};

const ACTION_ALLOWED_ROLES: Record<WorkflowAction, string[]> = {
  approve_dept: ['dept_manager', 'admin_manager', 'admin_officer', 'super_admin'],
  approve_materials: ['materials_manager', 'materials_director', 'super_admin'],
  approve_finance: ['finance_controller', 'finance_manager', 'super_admin'],
  set_fulfillment_stock: ['materials_manager', 'store_keeper', 'super_admin'],
  set_fulfillment_procure: ['materials_manager', 'procurement_officer', 'super_admin'],
  mark_ready_for_pickup: ['procurement_officer', 'store_keeper', 'super_admin'],
  mark_issued: ['store_keeper', 'materials_manager', 'super_admin'],
  reject: [
    'dept_manager',
    'admin_manager',
    'admin_officer',
    'materials_manager',
    'materials_director',
    'finance_controller',
    'finance_manager',
    'procurement_officer',
    'store_keeper',
    'super_admin',
  ],
  return: [
    'dept_manager',
    'admin_manager',
    'admin_officer',
    'materials_manager',
    'materials_director',
    'finance_controller',
    'finance_manager',
    'super_admin',
  ],
};

function normalizeRole(raw: string): string {
  const role = (raw || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    admin: 'admin_officer',
    manager: 'dept_manager',
    materials_officer: 'materials_manager',
    finance: 'finance_controller',
    procurement: 'procurement_officer',
    warehouse: 'store_keeper',
  };
  return aliases[role] || role;
}

function resolveActorRole(req: NextRequest): string {
  return normalizeRole(
    req.headers.get('x-verified-role') || ''
  );
}

function resolveActorName(req: NextRequest): string {
  const fullNameAr = (req.headers.get('x-verified-full-name') || '').trim();
  const email = (req.headers.get('x-verified-email') || '').trim();
  return fullNameAr || email || 'system';
}

function resolveCurrentStatus(payload: any): RequestStatus | '' {
  const directStatus = payload?.status;
  if (typeof directStatus === 'string') return directStatus as RequestStatus;

  const nestedStatus = payload?.request?.status;
  if (typeof nestedStatus === 'string') return nestedStatus as RequestStatus;

  return '';
}

async function fetchRequestStatus(req: NextRequest, id: string): Promise<RequestStatus | ''> {
  // Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
  const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();

  const local = getMaterialRequestById(tenantId, id);
  return (local?.status || '') as RequestStatus | '';
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  // Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
  const tenantIdGuard = (req.headers.get('x-verified-tenant-id') || '').trim();
  if (!tenantIdGuard) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  const action = String(body?.action || '') as WorkflowAction;
  const notes = String(body?.notes || '').trim();

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ detail: 'إجراء غير صالح' }, { status: 400 });
  }

  if ((action === 'reject' || action === 'return') && !notes) {
    return NextResponse.json({ detail: 'سبب الرفض/الإرجاع إلزامي' }, { status: 400 });
  }

  const actorRole = resolveActorRole(req);
  const allowedRoles = ACTION_ALLOWED_ROLES[action] || [];

  if (!allowedRoles.includes(actorRole)) {
    return NextResponse.json(
      { detail: `الدور الحالي (${actorRole || 'unknown'}) غير مخوّل لتنفيذ ${action}` },
      { status: 403 }
    );
  }

  const currentStatus = await fetchRequestStatus(req, id);
  if (!currentStatus) {
    return NextResponse.json({ detail: 'تعذر التحقق من حالة الطلب الحالية' }, { status: 502 });
  }

  const allowedStatuses = ACTION_ALLOWED_STATUS[action] || [];
  if (!allowedStatuses.includes(currentStatus)) {
    return NextResponse.json(
      {
        detail: `انتقال حالة غير مسموح: ${currentStatus} -> ${action}`,
        current_status: currentStatus,
      },
      { status: 409 }
    );
  }

  const tenantId =
    req.headers.get('x-verified-tenant-id') ||
    '';
  const actorName = resolveActorName(req);

  const forwardPayload = {
    action,
    // Never trust actor identity coming from client payload.
    actor: `${actorName}:${actorRole}`,
    notes,
  };

  try {
    const local = applyMaterialRequestAction(tenantId, id, {
      action,
      actor: `${actorName}:${actorRole}`,
      notes,
    });
    if (!local) {
      return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, request: local, source: 'gateway_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'invalid transition';
    if (message.startsWith('invalid_transition:')) {
      return NextResponse.json({ detail: message }, { status: 409 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
