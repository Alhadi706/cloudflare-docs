import { NextRequest, NextResponse } from 'next/server';
import { createTrainingSurvey, listTrainingSurveys } from '@/lib/training-impact-store';

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
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
      (req.headers.get('x-verified-email') || '')
        .trim(),
    role:
      (req.headers.get('x-verified-role') || '')
        .trim()
        .toLowerCase(),
    employee_no:
      (req.headers.get('x-verified-employee-no') || '')
        .trim(),
    dept_code:
      (req.headers.get('x-verified-dept-code') || '')
        .trim()
        .toUpperCase(),
    section_code:
      (req.headers.get('x-verified-section-code') || '')
        .trim()
        .toUpperCase(),
  };
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const actor = resolveActor(req);
  const all = listTrainingSurveys(tenantId);

  const rows = all.filter((r) => {
    if (actor.role === 'employee') return actor.employee_no ? r.employee_no === actor.employee_no : false;
    if (actor.role === 'section_manager') return actor.section_code ? r.section_code === actor.section_code : false;
    if (actor.role === 'dept_manager') return actor.dept_code ? r.department_code === actor.dept_code : false;
    if (['hr_manager', 'admin_officer', 'admin', 'founder'].includes(actor.role)) return true;
    return false;
  });

  return NextResponse.json({ surveys: rows, source: 'training_impact_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const actor = resolveActor(req);
  const body = await req.json().catch(() => ({}));

  const nominationId = String(body?.nomination_id || '').trim();
  const employeeNo = String(body?.employee_no || actor.employee_no || '').trim();
  const departmentCode = String(body?.department_code || actor.dept_code || '').trim().toUpperCase();
  const sectionCode = String(body?.section_code || actor.section_code || '').trim().toUpperCase();

  if (!nominationId || !employeeNo) {
    return NextResponse.json({ detail: 'nomination_id و employee_no مطلوبة' }, { status: 400 });
  }

  if (actor.role === 'employee' && actor.employee_no && employeeNo !== actor.employee_no) {
    return NextResponse.json({ detail: 'غير مسموح برفع استبيان لموظف آخر' }, { status: 403 });
  }

  const created = createTrainingSurvey(tenantId, {
    nomination_id: nominationId,
    employee_no: employeeNo,
    department_code: departmentCode,
    section_code: sectionCode,
    score_relevance: Number(body?.score_relevance ?? 1),
    score_trainer: Number(body?.score_trainer ?? 1),
    score_content: Number(body?.score_content ?? 1),
    score_overall: Number(body?.score_overall ?? 1),
    comments: String(body?.comments || '').trim(),
    submitted_by: actor.id,
    submitted_role: actor.role,
  });

  return NextResponse.json({ ok: true, survey: created, source: 'training_impact_store' }, { status: 201 });
}
