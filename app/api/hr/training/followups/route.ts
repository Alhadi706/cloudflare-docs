import { NextRequest, NextResponse } from 'next/server';
import { listTrainingFollowups, submitTrainingFollowup } from '@/lib/training-impact-store';

const ALLOWED_ROLES = ['section_manager', 'dept_manager', 'hr_manager', 'admin_officer', 'admin', 'founder'];

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveActor(req: NextRequest): {
  id: string;
  role: string;
  employee_no: string;
  dept_code: string;
  section_code: string;
} {
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
    employee_no:
      (req.headers.get('x-verified-employee-no') ||
        req.headers.get('x-employee-no') ||
        req.cookies.get('employee_no')?.value ||
        '')
        .trim(),
    dept_code:
      (req.headers.get('x-verified-dept-code') ||
        req.headers.get('x-dept-code') ||
        req.cookies.get('user_dept')?.value ||
        '')
        .trim()
        .toUpperCase(),
    section_code:
      (req.headers.get('x-verified-section-code') ||
        req.headers.get('x-section-code') ||
        req.cookies.get('section_code')?.value ||
        '')
        .trim()
        .toUpperCase(),
  };
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const all = listTrainingFollowups(tenantId);

  const rows = all.filter((r) => {
    if (actor.role === 'employee') return actor.employee_no ? r.employee_no === actor.employee_no : false;
    if (actor.role === 'section_manager') return actor.section_code ? r.section_code === actor.section_code : false;
    if (actor.role === 'dept_manager') return actor.dept_code ? r.department_code === actor.dept_code : false;
    if (['hr_manager', 'admin_officer', 'admin', 'founder'].includes(actor.role)) return true;
    return false;
  });

  return NextResponse.json({ followups: rows, source: 'training_impact_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const body = await req.json().catch(() => ({}));

  if (!ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ detail: 'غير مصرح برفع متابعة المدير' }, { status: 403 });
  }

  const nominationId = String(body?.nomination_id || '').trim();
  const employeeNo = String(body?.employee_no || '').trim();
  const departmentCode = String(body?.department_code || actor.dept_code || '').trim().toUpperCase();
  const sectionCode = String(body?.section_code || actor.section_code || '').trim().toUpperCase();
  const checkpoint = Number(body?.checkpoint_days || 0);

  if (!nominationId || !employeeNo || ![30, 60, 90].includes(checkpoint)) {
    return NextResponse.json({ detail: 'nomination_id و employee_no و checkpoint_days (30/60/90) مطلوبة' }, { status: 400 });
  }

  const submitted = submitTrainingFollowup(tenantId, {
    nomination_id: nominationId,
    employee_no: employeeNo,
    department_code: departmentCode,
    section_code: sectionCode,
    checkpoint_days: checkpoint as 30 | 60 | 90,
    manager_id: actor.id,
    manager_role: actor.role,
    behavior_change_score: Number(body?.behavior_change_score ?? 1),
    application_score: Number(body?.application_score ?? 1),
    performance_signal: String(body?.performance_signal || '').trim(),
    notes: String(body?.notes || '').trim(),
  });

  return NextResponse.json({ ok: true, followup: submitted, source: 'training_impact_store' }, { status: 201 });
}
