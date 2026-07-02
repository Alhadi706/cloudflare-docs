import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  saveCompletionReport, getCompletionReports, getPendingCompletionReports,
  reviewCompletionReport, getCompletionReportByWO,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
  return (req.headers.get('x-verified-email') ?? '')
    .replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

const SUPERVISOR_ROLES = ['supervisor','manager','admin','dept_manager','section_manager','founder'];

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const mode = req.nextUrl.searchParams.get('mode') || 'all';
  const isSup = SUPERVISOR_ROLES.includes(auth.role);

  if (mode === 'pending' && isSup) {
    return NextResponse.json({ ok: true, reports: getPendingCompletionReports(auth.tenantId) });
  }

  const woId = req.nextUrl.searchParams.get('work_order_id');
  if (woId) {
    const r = getCompletionReportByWO(auth.tenantId, parseInt(woId));
    return NextResponse.json({ ok: true, report: r ?? null });
  }

  return NextResponse.json({ ok: true, reports: getCompletionReports(auth.tenantId) });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  // Review existing report
  if (body.action === 'review' && body.report_id) {
    if (!SUPERVISOR_ROLES.includes(auth.role)) {
      return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
    }
    const updated = reviewCompletionReport(auth.tenantId, body.report_id, body.status, empNo, body.notes);
    if (!updated) return NextResponse.json({ detail: 'التقرير غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, report: updated });
  }

  // Submit new report
  const report = saveCompletionReport(auth.tenantId, {
    tenant_id:       auth.tenantId,
    work_order_id:   parseInt(body.work_order_id) || 0,
    employee_no:     empNo,
    employee_name:   body.employee_name || empNo,
    report_text:     body.report_text || body.notes || '',
    materials_used:  body.materials_used || undefined,
    actual_cost:     body.actual_cost ?? undefined,
    photos:          body.images || undefined,
    approval_status: 'pending',
  });
  return NextResponse.json({ ok: true, report });
}
