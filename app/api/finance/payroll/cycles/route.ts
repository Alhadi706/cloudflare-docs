import { NextRequest, NextResponse } from 'next/server';
import { createPayrollCycle, listPayrollCycles } from '@/lib/payroll-cycle-store';

function tenantIdFromRequest(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  );
}

function actorFromRequest(req: NextRequest): { name: string; role: string } {
  const name =
    req.headers.get('x-verified-full-name') ||
    req.headers.get('x-verified-email') ||
    req.cookies.get('user_role')?.value ||
    'system';

  const role =
    req.headers.get('x-verified-role') ||
    req.headers.get('x-user-role') ||
    req.cookies.get('user_role')?.value ||
    'hr_manager';

  return { name: String(name).trim(), role: String(role).trim().toLowerCase() };
}

export async function GET(req: NextRequest) {
  const tenantId = tenantIdFromRequest(req);
  const statusFilter = String(req.nextUrl.searchParams.get('status') || '').trim();

  const rows = listPayrollCycles(tenantId);
  const filtered = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;
  return NextResponse.json({ cycles: filtered, source: 'payroll_cycle_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = tenantIdFromRequest(req);
  const actor = actorFromRequest(req);
  const body = await req.json().catch(() => ({}));

  const periodLabel = String(body?.period_label || '').trim();
  const employeeCount = Number(body?.employee_count || 0);
  const totalNet = Number(body?.total_net || 0);

  if (!periodLabel) {
    return NextResponse.json({ error: 'period_label مطلوب' }, { status: 400 });
  }
  if (!Number.isFinite(employeeCount) || employeeCount <= 0) {
    return NextResponse.json({ error: 'employee_count يجب أن يكون أكبر من صفر' }, { status: 400 });
  }
  if (!Number.isFinite(totalNet) || totalNet < 0) {
    return NextResponse.json({ error: 'total_net غير صالح' }, { status: 400 });
  }

  const record = createPayrollCycle(tenantId, {
    period_label: periodLabel,
    period_month: Number.isFinite(Number(body?.period_month)) ? Number(body.period_month) : null,
    period_year: Number.isFinite(Number(body?.period_year)) ? Number(body.period_year) : null,
    employee_count: employeeCount,
    total_base: Number(body?.total_base || 0),
    total_allowances: Number(body?.total_allowances || 0),
    total_deductions: Number(body?.total_deductions || 0),
    total_net: totalNet,
    source_department: String(body?.source_department || 'HR'),
    created_by: actor.name,
    created_role: actor.role,
  });

  return NextResponse.json({ ok: true, cycle: record, source: 'payroll_cycle_store' }, { status: 201 });
}
