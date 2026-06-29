import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { findByUsername, buildEmployeeUsername } from '@/lib/user-store';
import { getTenantByCode } from '@/lib/tenant-store';

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const tenantCode = (req.headers.get('x-verified-tenant-code') ?? '').trim();
  const employeeNo = (req.headers.get('x-verified-email') ?? '')
    .split('@')[0]
    .toUpperCase()
    .replace(/^[A-Z0-9]+_/, ''); // strip tenant prefix if present

  // Resolve employee_no from email pattern "code_empno@mobile.local"
  const email = req.headers.get('x-verified-email') ?? '';
  const username = email.replace('@mobile.local', '');
  const user = findByUsername(username);

  const tenant = getTenantByCode(tenantCode);

  return NextResponse.json({
    ok: true,
    employee_no:       user?.username?.split('_').slice(1).join('_') || employeeNo,
    full_name:         user?.full_name || '',
    email:             user?.email || email,
    role:              auth.role,
    department_code:   auth.departmentCode || user?.department_code || '',
    tenant_code:       auth.tenantCode || tenantCode,
    organization_name: tenant?.name || '',
  });
}
