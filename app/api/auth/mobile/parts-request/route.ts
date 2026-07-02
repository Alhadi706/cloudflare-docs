import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  savePartsRequest, getPendingPartsRequests, reviewPartsRequest, getPartsRequestsByWO,
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
    return NextResponse.json({ ok: true, requests: getPendingPartsRequests(auth.tenantId) });
  }

  const woId = req.nextUrl.searchParams.get('work_order_id');
  if (woId) {
    return NextResponse.json({ ok: true, requests: getPartsRequestsByWO(auth.tenantId, parseInt(woId)) });
  }

  return NextResponse.json({ ok: true, requests: getPendingPartsRequests(auth.tenantId) });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  const req2 = savePartsRequest(auth.tenantId, {
    tenant_id:        auth.tenantId,
    employee_no:      empNo,
    employee_name:    body.employee_name || empNo,
    work_order_id:    parseInt(body.work_order_id) || 0,
    work_order_number: body.work_order_number || undefined,
    items:            body.items || body.parts || [],
  });
  return NextResponse.json({ ok: true, request: req2 });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const id   = String(body.id || '').trim();
  if (!id) return NextResponse.json({ detail: 'id مطلوب' }, { status: 400 });

  if (!SUPERVISOR_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
  }

  const empNo = resolveEmpNo(req);
  const updated = reviewPartsRequest(auth.tenantId, id, body.status, empNo, body.notes);
  if (!updated) return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
  return NextResponse.json({ ok: true, request: updated });
}
