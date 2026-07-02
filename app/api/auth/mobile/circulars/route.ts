import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getCircularsForEmployee, createCircular, markCircularRead, unreadCount,
} from '@/lib/circulars-store';

function resolveEmpNo(req: NextRequest): string {
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
  return (req.headers.get('x-verified-email') ?? '')
    .replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

const SUPERVISOR_ROLES = ['supervisor','manager','admin','dept_manager','section_manager','founder','owner'];

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const empNo = resolveEmpNo(req);
  const circulars = getCircularsForEmployee(auth.tenantId, empNo, auth.role, auth.departmentCode);
  const unread    = unreadCount(auth.tenantId, empNo, auth.role, auth.departmentCode);
  return NextResponse.json({ ok: true, circulars, unread_count: unread });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.create');
  if (auth instanceof NextResponse) return auth;

  if (!SUPERVISOR_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح — المشرفون فقط' }, { status: 403 });
  }

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  const circular = createCircular(auth.tenantId, {
    type:               body.type || 'announcement',
    subject:            String(body.subject || '').trim(),
    body:               String(body.body    || '').trim(),
    sender_no:          empNo,
    sender_name:        body.sender_name || empNo,
    target_roles:       body.target_roles || [],
    target_departments: body.target_departments || [],
  });
  return NextResponse.json({ ok: true, circular });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json().catch(() => ({}));
  const empNo  = resolveEmpNo(req);
  const circId = String(body.circular_id || '').trim();
  if (!circId) return NextResponse.json({ detail: 'circular_id مطلوب' }, { status: 400 });

  markCircularRead(auth.tenantId, circId, empNo);
  return NextResponse.json({ ok: true });
}
