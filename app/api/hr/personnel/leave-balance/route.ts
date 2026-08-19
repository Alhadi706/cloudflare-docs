import { NextRequest, NextResponse } from 'next/server';
import { getLeaveBalance } from '@/lib/leave-balance-store';

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function resolveEmployeeNo(req: NextRequest): string {
  return (
    req.headers.get('x-verified-employee-no') || ''
  ).trim();
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const employeeNo = resolveEmployeeNo(req);

  if (!employeeNo) {
    return NextResponse.json({ detail: 'employee_no غير متوفر في الجلسة' }, { status: 400 });
  }

  const balance = getLeaveBalance(tenantId, employeeNo);
  return NextResponse.json({ ok: true, balance, source: 'official_leave_balance_store' });
}
