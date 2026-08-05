import { NextRequest, NextResponse } from 'next/server';
import { transitionPersonnelRequest } from '@/lib/personnel-requests-store';

const ALLOWED_BY_ROLE: Record<string, string[]> = {
  approve_section_head: ['section_manager', 'dept_manager', 'admin_manager', 'admin_officer', 'super_admin'],
  approve_department_manager: ['dept_manager', 'admin_manager', 'admin_officer', 'super_admin'],
  approve_hr: ['admin_officer', 'admin_manager', 'super_admin', 'hr_manager'],
  archive: ['admin_officer', 'admin_manager', 'super_admin'],
  reject: ['section_manager', 'dept_manager', 'admin_manager', 'admin_officer', 'super_admin'],
  reopen: ['admin_manager', 'admin_officer', 'super_admin'],
};

function normalizeRole(raw: string): string {
  const role = (raw || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    admin: 'admin_officer',
    manager: 'dept_manager',
    section_head: 'section_manager',
  };
  return aliases[role] || role;
}

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveActor(req: NextRequest): { id: string; role: string } {
  return {
    id:
      (req.headers.get('x-verified-email') ||
        req.headers.get('x-user-id') ||
        req.cookies.get('user_email')?.value ||
        'system')
        .trim(),
    role: normalizeRole(
      req.headers.get('x-verified-role') ||
        req.headers.get('x-user-role') ||
        req.cookies.get('user_role')?.value ||
        'admin_officer',
    ),
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '').trim();
  const notes = String(body?.notes || '').trim();

  if (!action) {
    return NextResponse.json({ detail: 'action مطلوب' }, { status: 400 });
  }

  const allowedRoles = ALLOWED_BY_ROLE[action] || [];
  if (!allowedRoles.includes(actor.role)) {
    return NextResponse.json({ detail: `الدور الحالي (${actor.role}) غير مخوّل لتنفيذ ${action}` }, { status: 403 });
  }

  try {
    const updated = transitionPersonnelRequest(tenantId, params.id, action as any, {
      id: actor.id,
      role: actor.role,
      notes,
    });
    return NextResponse.json({ ok: true, request: updated, source: 'personnel_workflow_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'workflow_error';
    if (message === 'request_not_found') {
      return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
    }
    if (message.startsWith('invalid_transition:')) {
      return NextResponse.json({ detail: message }, { status: 409 });
    }
    if (message === 'leave_balance_insufficient') {
      return NextResponse.json({ detail: 'رصيد الإجازة السنوية غير كافٍ لإتمام هذا الطلب' }, { status: 409 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
