import { NextRequest, NextResponse } from 'next/server';
import { createTrainingNeed, listTrainingNeeds } from '@/lib/training-workflow-store';
import fs from 'fs';
import path from 'path';

const ORG_ROLES_FILE = path.join(process.cwd(), '.data', 'org-roles.json');

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function resolveActor(req: NextRequest): { id: string; role: string; employee_no: string } {
  return {
    id:
      (req.headers.get('x-verified-email') || '')
        .trim(),
    role:
      (req.headers.get('x-verified-role') || '')
        .trim(),
    employee_no:
      (req.headers.get('x-verified-employee-no') || '')
        .trim(),
  };
}

const PROPOSER_ROLES = new Set(['hr_manager', 'admin_officer', 'admin', 'founder']);

function findDepartmentsWithoutManager(targetDepartmentCodes: string[]): string[] {
  try {
    if (!fs.existsSync(ORG_ROLES_FILE)) return targetDepartmentCodes;
    const parsed = JSON.parse(fs.readFileSync(ORG_ROLES_FILE, 'utf8')) as { roles?: Array<{ org_role?: string; department_code?: string }> };
    const roles = Array.isArray(parsed?.roles) ? parsed.roles : [];
    const managedDepartments = new Set(
      roles
        .filter((r) => String(r.org_role || '').trim().toLowerCase() === 'dept_manager')
        .map((r) => String(r.department_code || '').trim().toUpperCase())
        .filter(Boolean),
    );
    return targetDepartmentCodes.filter((code) => !managedDepartments.has(code));
  } catch {
    return targetDepartmentCodes;
  }
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const rows = listTrainingNeeds(tenantId);
  return NextResponse.json({ needs: rows, source: 'training_workflow_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const actor = resolveActor(req);

  if (!PROPOSER_ROLES.has(actor.role.toLowerCase())) {
    return NextResponse.json({ detail: 'إنشاء المقترح التدريبي متاح لإدارة التدريب فقط' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const title = String(body?.title || '').trim();
  const departmentCode = String(body?.department_code || '').trim();
  const sectionCode = String(body?.section_code || '').trim();
  const competencyGap = String(body?.competency_gap || '').trim();
  const objective = String(body?.objective || '').trim();
  const targetAudience = String(body?.target_audience || '').trim();
  const expectedImpact = String(body?.expected_impact || '').trim();
  const targetDepartmentCodes = Array.isArray(body?.target_department_codes)
    ? body.target_department_codes.map((x: unknown) => String(x || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const priority = String(body?.priority || 'medium').trim() as 'low' | 'medium' | 'high';
  const proposedBudget = Number(body?.proposed_budget || 0);

  if (!title || !departmentCode || !sectionCode || !competencyGap || !objective || targetDepartmentCodes.length === 0) {
    return NextResponse.json({ detail: 'title, department_code, section_code, competency_gap, objective, target_department_codes مطلوبة' }, { status: 400 });
  }

  const missingDeptManagers = findDepartmentsWithoutManager(targetDepartmentCodes);
  if (missingDeptManagers.length > 0) {
    return NextResponse.json(
      {
        detail: `لا يمكن إنشاء المقترح: الإدارات التالية بدون مدير إدارة معيّن (${missingDeptManagers.join(', ')})`,
        code: 'missing_department_managers',
        missing_departments: missingDeptManagers,
      },
      { status: 409 },
    );
  }

  const created = createTrainingNeed(tenantId, {
    department_code: departmentCode,
    section_code: sectionCode,
    target_department_codes: targetDepartmentCodes,
    title,
    competency_gap: competencyGap,
    objective,
    target_audience: targetAudience,
    expected_impact: expectedImpact,
    priority,
    proposed_budget: Number.isFinite(proposedBudget) ? Math.max(0, proposedBudget) : 0,
    requested_by: actor.id,
    requested_employee_no: actor.employee_no,
    requested_role: actor.role,
  });

  return NextResponse.json({ ok: true, need: created, source: 'training_workflow_store' }, { status: 201 });
}
