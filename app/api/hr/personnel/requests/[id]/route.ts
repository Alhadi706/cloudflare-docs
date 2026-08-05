import { NextRequest, NextResponse } from 'next/server';
import { updatePersonnelRequest } from '@/lib/personnel-requests-store';

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveActor(req: NextRequest): { id: string; role: string; employee_no: string } {
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
        'admin_officer')
        .trim(),
    employee_no:
      (req.headers.get('x-verified-employee-no') ||
        req.headers.get('x-employee-no') ||
        req.cookies.get('employee_no')?.value ||
        '')
        .trim(),
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const body = await req.json().catch(() => ({}));

  try {
    const updated = updatePersonnelRequest(tenantId, params.id, actor, {
      title: typeof body?.title === 'string' ? body.title : undefined,
      details: typeof body?.details === 'string' ? body.details : undefined,
      request_type: typeof body?.request_type === 'string' ? body.request_type : undefined,
      priority: typeof body?.priority === 'string' ? body.priority : undefined,
      leave_days: body?.leave_days,
    });

    return NextResponse.json({ ok: true, request: updated, source: 'personnel_workflow_store' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'update_failed';
    if (message === 'request_not_found') {
      return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
    }
    if (message === 'request_not_editable') {
      return NextResponse.json({ detail: 'لا يمكن تعديل الطلب بعد هذه المرحلة' }, { status: 409 });
    }
    if (message === 'forbidden') {
      return NextResponse.json({ detail: 'غير مصرح لك تعديل هذا الطلب' }, { status: 403 });
    }
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
