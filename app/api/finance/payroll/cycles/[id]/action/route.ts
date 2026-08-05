import { NextRequest, NextResponse } from 'next/server';
import { applyPayrollCycleAction } from '@/lib/payroll-cycle-store';

type PayrollAction = 'submit' | 'approve_admin' | 'approve_finance' | 'disburse_treasury' | 'reject' | 'return_admin';

const ACTIONS: PayrollAction[] = [
  'submit',
  'approve_admin',
  'approve_finance',
  'disburse_treasury',
  'reject',
  'return_admin',
];

const ACTION_ALLOWED_ROLES: Record<PayrollAction, string[]> = {
  submit: ['hr_manager', 'hr_officer', 'admin_officer', 'super_admin'],
  approve_admin: ['admin_officer', 'admin_manager', 'super_admin'],
  approve_finance: ['finance_controller', 'finance_manager', 'super_admin'],
  disburse_treasury: ['treasury_head', 'finance_manager', 'super_admin'],
  reject: ['admin_officer', 'admin_manager', 'finance_controller', 'finance_manager', 'treasury_head', 'super_admin'],
  return_admin: ['finance_controller', 'finance_manager', 'super_admin'],
};

const ROLE_ALIASES: Record<string, string> = {
  admin: 'admin_officer',
  manager: 'admin_manager',
  finance: 'finance_controller',
  treasury: 'treasury_head',
};

function normalizeRole(raw: string): string {
  const role = String(raw || '').trim().toLowerCase();
  return ROLE_ALIASES[role] || role;
}

function tenantIdFromRequest(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  );
}

function actorNameFromRequest(req: NextRequest): string {
  return (
    req.headers.get('x-verified-full-name') ||
    req.headers.get('x-verified-email') ||
    req.cookies.get('user_role')?.value ||
    'system'
  );
}

function actorRoleFromRequest(req: NextRequest, bodyRole?: string): string {
  return normalizeRole(
    req.headers.get('x-verified-role') ||
      req.headers.get('x-user-role') ||
      req.cookies.get('user_role')?.value ||
      String(bodyRole || ''),
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '').trim() as PayrollAction;
  const notes = String(body?.notes || '').trim();

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ detail: 'إجراء غير صالح' }, { status: 400 });
  }

  if ((action === 'reject' || action === 'return_admin') && !notes) {
    return NextResponse.json({ detail: 'السبب إلزامي في الرفض أو الإرجاع' }, { status: 400 });
  }

  const actorRole = actorRoleFromRequest(req, body?.as_role);
  const allowedRoles = ACTION_ALLOWED_ROLES[action] || [];

  if (!allowedRoles.includes(actorRole)) {
    return NextResponse.json(
      { detail: `الدور الحالي (${actorRole || 'unknown'}) غير مخوّل لتنفيذ ${action}` },
      { status: 403 },
    );
  }

  const tenantId = tenantIdFromRequest(req);
  const actorName = actorNameFromRequest(req);

  try {
    const updated = applyPayrollCycleAction(tenantId, params.id, {
      action,
      actor: actorName,
      role: actorRole,
      notes,
    });

    if (!updated) {
      return NextResponse.json({ detail: 'الدورة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, cycle: updated, source: 'payroll_cycle_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'invalid transition';
    if (message.startsWith('invalid_transition:')) {
      return NextResponse.json({ detail: message }, { status: 409 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
