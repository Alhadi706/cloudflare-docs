import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { findByUsername, buildEmployeeUsername } from '@/lib/user-store';
import { getTenantByCode } from '@/lib/tenant-store';

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const tenantCode = (req.headers.get('x-verified-tenant-code') ?? '').trim();
  // Use the employee_no from JWT (set by middleware as x-verified-employee-no)
  const employeeNo = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase()
    || (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();

  const email    = req.headers.get('x-verified-email') ?? '';
  const username = buildEmployeeUsername(tenantCode, employeeNo);
  const user     = findByUsername(username) ?? findByUsername(email.replace(/@.*$/, ''));

  const tenant = getTenantByCode(tenantCode);

  return NextResponse.json({
    ok: true,
    employee_no:       employeeNo || user?.username?.split('.').pop() || '',
    full_name:         user?.full_name || req.headers.get('x-verified-full-name') || '',
    email:             user?.email || email,
    role:              auth.role,
    department_code:   auth.departmentCode || user?.department_code || '',
    tenant_code:       auth.tenantCode || tenantCode,
    organization_name: tenant?.name || '',
  });
}
