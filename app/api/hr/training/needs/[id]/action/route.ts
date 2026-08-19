import { NextRequest, NextResponse } from 'next/server';
import { transitionTrainingNeed } from '@/lib/training-workflow-store';

const ACTION_ROLES: Record<string, string[]> = {
  approve_section: ['section_manager', 'admin', 'founder', 'admin_officer'],
  approve_dept: ['dept_manager', 'admin', 'founder', 'admin_officer'],
  approve_training: ['hr_manager', 'admin_officer', 'admin', 'founder'],
  reject: ['section_manager', 'dept_manager', 'hr_manager', 'admin_officer', 'admin', 'founder'],
};

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function resolveActor(req: NextRequest): { id: string; role: string } {
  return {
    id:
      (req.headers.get('x-verified-email') || '')
        .trim(),
    role:
      (req.headers.get('x-verified-role') || '')
        .trim()
        .toLowerCase(),
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
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
    const updated = transitionTrainingNeed(tenantId, params.id, action, {
      id: actor.id,
      role: actor.role,
      notes,
    });
    return NextResponse.json({ ok: true, need: updated, source: 'training_workflow_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'workflow_error';
    if (message === 'need_not_found') {
      return NextResponse.json({ detail: 'الاحتياج غير موجود' }, { status: 404 });
    }
    if (message.startsWith('invalid_transition:')) {
      return NextResponse.json({ detail: message }, { status: 409 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
