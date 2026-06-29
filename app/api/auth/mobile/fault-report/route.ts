import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  saveFaultReport, getFaultReportsByEmployee, getOpenFaultReports, updateFaultStatus,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const mode  = req.nextUrl.searchParams.get('mode') || 'mine';
  const empNo = resolveEmpNo(req);

  const isSupervisor = ['supervisor','manager','admin','dept_manager','section_manager','founder'].includes(auth.role);

  if (mode === 'open' && isSupervisor) {
    return NextResponse.json({ ok: true, reports: getOpenFaultReports(auth.tenantId) });
  }
  return NextResponse.json({ ok: true, reports: getFaultReportsByEmployee(auth.tenantId, empNo) });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  const report = saveFaultReport(auth.tenantId, {
    tenant_id:             auth.tenantId,
    employee_no:           empNo,
    employee_name:         body.employee_name || empNo,
    title:                 String(body.title       || '').trim(),
    description:           String(body.description || '').trim(),
    severity:              body.severity || 'medium',
    location_name:         body.location || undefined,
    linked_work_order_id:  body.work_order_id ? parseInt(body.work_order_id) : undefined,
    photos:                body.images || undefined,
    lat:                   body.lat ?? undefined,
    lng:                   body.lng ?? undefined,
  });
  return NextResponse.json({ ok: true, report });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const id   = String(body.id || '').trim();
  if (!id) return NextResponse.json({ detail: 'id مطلوب' }, { status: 400 });

  const updated = updateFaultStatus(auth.tenantId, id, body.status, body.notes);
  if (!updated) return NextResponse.json({ detail: 'البلاغ غير موجود' }, { status: 404 });
  return NextResponse.json({ ok: true, report: updated });
}
