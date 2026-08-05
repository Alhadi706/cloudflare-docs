import { NextRequest, NextResponse } from 'next/server';
import { createTrainingNomination, listTrainingNominations, listTrainingNeeds } from '@/lib/training-workflow-store';

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveActor(req: NextRequest): { id: string; role: string; dept_code: string } {
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
        'section_manager')
        .trim(),
    dept_code:
      (req.headers.get('x-verified-dept-code') ||
        req.headers.get('x-dept-code') ||
        req.cookies.get('user_dept')?.value ||
        '')
        .trim()
        .toUpperCase(),
  };
}

const NOMINATOR_ROLES = new Set(['dept_manager', 'admin', 'founder', 'admin_officer']);

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const rows = listTrainingNominations(tenantId);
  return NextResponse.json({ nominations: rows, source: 'training_workflow_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);

  if (!NOMINATOR_ROLES.has(actor.role.toLowerCase())) {
    return NextResponse.json({ detail: 'الترشيح متاح لمدير الإدارة أو المفوضين فقط' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const needId = String(body?.need_id || '').trim();
  const employeeNo = String(body?.employee_no || '').trim();
  const employeeName = String(body?.employee_name || '').trim();
  const departmentCode = String(body?.department_code || '').trim();
  const sectionCode = String(body?.section_code || '').trim();
  const nominationReason = String(body?.nomination_reason || '').trim();

  if (!needId || !employeeNo || !employeeName || !departmentCode || !sectionCode || !nominationReason) {
    return NextResponse.json({ detail: 'need_id, employee_no, employee_name, department_code, section_code, nomination_reason مطلوبة' }, { status: 400 });
  }

  const need = listTrainingNeeds(tenantId).find((n) => n.id === needId);
  if (!need) {
    return NextResponse.json({ detail: 'الاحتياج غير موجود' }, { status: 404 });
  }

  if (need.status !== 'training_approved') {
    return NextResponse.json({ detail: 'لا يمكن الترشيح قبل اعتماد إدارة التدريب للمقترح' }, { status: 409 });
  }

  const targets = Array.isArray(need.target_department_codes) ? need.target_department_codes : [];
  if (targets.length > 0 && !targets.includes(departmentCode.toUpperCase())) {
    return NextResponse.json({ detail: 'الإدارة المختارة ليست ضمن الإدارات المستهدفة لهذا المقترح' }, { status: 409 });
  }

  if (actor.role.toLowerCase() === 'dept_manager' && actor.dept_code && actor.dept_code !== departmentCode.toUpperCase()) {
    return NextResponse.json({ detail: 'مدير الإدارة يمكنه الترشيح لإدارته فقط' }, { status: 403 });
  }

  const created = createTrainingNomination(tenantId, {
    need_id: needId,
    employee_no: employeeNo,
    employee_name: employeeName,
    department_code: departmentCode,
    section_code: sectionCode,
    nomination_reason: nominationReason,
    created_by: actor.id,
    created_role: actor.role,
  });

  return NextResponse.json({ ok: true, nomination: created, source: 'training_workflow_store' }, { status: 201 });
}
