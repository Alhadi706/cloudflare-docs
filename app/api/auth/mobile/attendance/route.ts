import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getTodayAttendance, checkin, checkout,
  getAttendanceByEmployee,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
  return (req.headers.get('x-verified-email') ?? '')
    .replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const empNo = resolveEmpNo(req) || req.nextUrl.searchParams.get('employee_no') || '';
  const mode  = req.nextUrl.searchParams.get('mode') || 'today';

  if (mode === 'history') {
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '14');
    const records = getAttendanceByEmployee(auth.tenantId, empNo, days);
    return NextResponse.json({ ok: true, records });
  }

  const today = getTodayAttendance(auth.tenantId, empNo);
  return NextResponse.json({ ok: true, today: today ?? null });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'checkin') {
    const record = checkin(auth.tenantId, {
      tenant_id: auth.tenantId,
      employee_no: empNo,
      employee_name: body.employee_name || empNo,
      checkin_lat: body.lat ?? undefined,
      checkin_lng: body.lng ?? undefined,
      notes: body.notes || undefined,
    });
    return NextResponse.json({ ok: true, record });
  }

  if (action === 'checkout') {
    const record = checkout(auth.tenantId, empNo, body.lat, body.lng);
    if (!record) return NextResponse.json({ detail: 'لم يتم تسجيل الحضور اليوم' }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  }

  return NextResponse.json({ detail: 'action يجب أن يكون checkin أو checkout' }, { status: 400 });
}
