import { NextRequest, NextResponse } from 'next/server';
import {
  createPersonnelRequest,
  listPersonnelRequests,
  listPersonnelRequestsForRequester,
} from '@/lib/personnel-requests-store';

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveActor(req: NextRequest): { id: string; role: string; employee_no: string; full_name: string } {
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
    full_name:
      (req.headers.get('x-verified-full-name') ||
        req.cookies.get('user_name')?.value ||
        req.headers.get('x-verified-email') ||
        '')
        .trim(),
  };
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const role = String(actor.role || '').toLowerCase();
  const rows = role === 'employee'
    ? listPersonnelRequestsForRequester(tenantId, { id: actor.id, employee_no: actor.employee_no })
    : listPersonnelRequests(tenantId);
  return NextResponse.json({ requests: rows, source: 'personnel_workflow_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const actor = resolveActor(req);
  const body = await req.json().catch(() => ({}));

  const role = String(actor.role || '').toLowerCase();
  const employeeNo = String(body?.employee_no || (role === 'employee' ? actor.employee_no : '')).trim();
  const employeeName = String(body?.employee_name || actor.full_name || '').trim();
  const requestType = String(body?.request_type || '').trim();
  const title = String(body?.title || '').trim();
  const details = String(body?.details || '').trim();
  const priority = String(body?.priority || 'medium').trim() as 'low' | 'medium' | 'high';
  const leaveDays = Number(body?.leave_days || 0);
  const notes = String(body?.notes || '').trim();

  if (!employeeNo || !employeeName || !requestType || !title) {
    return NextResponse.json({ detail: 'employee_no, employee_name, request_type, title مطلوبة' }, { status: 400 });
  }

  const created = createPersonnelRequest(tenantId, {
    employee_no: employeeNo,
    employee_name: employeeName,
    request_type: requestType,
    title,
    details,
    priority,
    requester_id: actor.id,
    requester_employee_no: actor.employee_no,
    requester_role: actor.role,
    leave_days: Number.isFinite(leaveDays) ? Math.max(0, leaveDays) : 0,
    notes,
  });

  return NextResponse.json({ ok: true, request: created, source: 'personnel_workflow_store' }, { status: 201 });
}
