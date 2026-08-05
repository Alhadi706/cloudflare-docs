import { NextRequest, NextResponse } from 'next/server';
import { transitionTrainingNomination } from '@/lib/training-workflow-store';

const ACTION_ROLES: Record<string, string[]> = {
  approve_section: ['section_manager', 'admin', 'founder', 'admin_officer'],
  approve_dept: ['dept_manager', 'admin', 'founder', 'admin_officer'],
  approve_finance: ['finance_manager', 'finance_controller', 'admin', 'founder'],
  approve_hr: ['hr_manager', 'admin_officer', 'admin', 'founder'],
  mark_completed: ['hr_manager', 'admin_officer', 'admin', 'founder'],
  reject: [
    'section_manager',
    'dept_manager',
    'finance_manager',
    'finance_controller',
    'hr_manager',
    'admin_officer',
    'admin',
    'founder',
  ],
};

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
    role:
      (req.headers.get('x-verified-role') ||
        req.headers.get('x-user-role') ||
        req.cookies.get('user_role')?.value ||
        'employee')
        .trim()
        .toLowerCase(),
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

  const allowedRoles = ACTION_ROLES[action] || [];
  if (!allowedRoles.includes(actor.role)) {
    return NextResponse.json({ detail: `الدور الحالي (${actor.role}) غير مخوّل لتنفيذ ${action}` }, { status: 403 });
  }

  try {
    const updated = transitionTrainingNomination(tenantId, params.id, action, {
      id: actor.id,
      role: actor.role,
      notes,
    });
    return NextResponse.json({ ok: true, nomination: updated, source: 'training_workflow_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'workflow_error';
    if (message === 'nomination_not_found') {
      return NextResponse.json({ detail: 'الترشيح غير موجود' }, { status: 404 });
    }
    if (message.startsWith('invalid_transition:')) {
      return NextResponse.json({ detail: message }, { status: 409 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
