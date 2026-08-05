import { NextRequest, NextResponse } from 'next/server';
import { getLeaveBalance } from '@/lib/leave-balance-store';

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

function resolveEmployeeNo(req: NextRequest): string {
  return (
    req.headers.get('x-verified-employee-no') ||
    req.headers.get('x-employee-no') ||
    req.cookies.get('employee_no')?.value ||
    ''
  ).trim();
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const employeeNo = resolveEmployeeNo(req);

  if (!employeeNo) {
    return NextResponse.json({ detail: 'employee_no غير متوفر في الجلسة' }, { status: 400 });
  }

  const balance = getLeaveBalance(tenantId, employeeNo);
  return NextResponse.json({ ok: true, balance, source: 'official_leave_balance_store' });
}
