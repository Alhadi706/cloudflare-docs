/**
 * /api/auth/mobile/leave-request
 * GET  — list my leave requests
 * POST — submit a new leave request
 * PATCH — cancel a pending request
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_no: string;
  employee_name: string;
  leave_type: string;
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
  days: number;
  reason: string;
  status: LeaveStatus;
  submitted_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

const LEAVE_LABELS: Record<string, string> = {
  annual:    'إجازة سنوية',
  sick:      'إجازة مرضية',
  emergency: 'إجازة طارئة',
  unpaid:    'إجازة بدون راتب',
  maternity: 'إجازة أمومة',
  paternity: 'إجازة أبوة',
  study:     'إجازة دراسية',
  bereavement: 'إجازة وفاة',
};

function leaveFile(tenantId: string) {
  return path.join(DATA_DIR, `leave_requests_${tenantId}.json`);
}

function readLeaves(tenantId: string): LeaveRequest[] {
  try {
    const f = leaveFile(tenantId);
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return []; }
}

function writeLeaves(tenantId: string, data: LeaveRequest[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = leaveFile(tenantId) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data.slice(-500), null, 2), 'utf8');
  fs.renameSync(tmp, leaveFile(tenantId));
}

function calcDays(start: string, end: string): number {
  const d1 = new Date(start), d2 = new Date(end);
  const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(diff) + 1);
}

function resolveEmpNo(req: NextRequest): string {
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
  return (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const empNo = resolveEmpNo(req);
  const allLeaves = readLeaves(auth.tenantId);
  const mine = allLeaves.filter(r => r.employee_no === empNo)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  // Calculate used days per type this year
  const year = new Date().getFullYear().toString();
  const usedDays: Record<string, number> = {};
  for (const lr of mine) {
    if (lr.status === 'approved' && lr.submitted_at.startsWith(year)) {
      usedDays[lr.leave_type] = (usedDays[lr.leave_type] ?? 0) + lr.days;
    }
  }

  return NextResponse.json({
    ok: true,
    leave_requests: mine,
    used_days: usedDays,
    leave_labels: LEAVE_LABELS,
  });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body    = await req.json().catch(() => ({}));
  const empNo   = resolveEmpNo(req);
  const empName = req.headers.get('x-verified-full-name') || body.employee_name || empNo;

  const leaveType  = String(body.leave_type || '').trim();
  const startDate  = String(body.start_date || '').trim();
  const endDate    = String(body.end_date   || '').trim();
  const reason     = String(body.reason     || '').trim();

  if (!leaveType || !startDate || !endDate) {
    return NextResponse.json({ detail: 'نوع الإجازة وتاريخ البدء والانتهاء مطلوبة' }, { status: 400 });
  }
  if (!(leaveType in LEAVE_LABELS)) {
    return NextResponse.json({ detail: `نوع الإجازة غير معروف. الأنواع المتاحة: ${Object.keys(LEAVE_LABELS).join(', ')}` }, { status: 400 });
  }
  if (new Date(startDate) > new Date(endDate)) {
    return NextResponse.json({ detail: 'تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء' }, { status: 400 });
  }

  const request: LeaveRequest = {
    id:            `leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tenant_id:     auth.tenantId,
    employee_no:   empNo,
    employee_name: empName,
    leave_type:    leaveType,
    start_date:    startDate,
    end_date:      endDate,
    days:          calcDays(startDate, endDate),
    reason,
    status:        'pending',
    submitted_at:  new Date().toISOString(),
  };

  const all = readLeaves(auth.tenantId);
  all.push(request);
  writeLeaves(auth.tenantId, all);

  return NextResponse.json({ ok: true, leave_request: request });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);
  const id    = String(body.id || '').trim();

  if (!id) return NextResponse.json({ detail: 'id مطلوب' }, { status: 400 });

  const all = readLeaves(auth.tenantId);
  const idx = all.findIndex(r => r.id === id && r.employee_no === empNo);
  if (idx < 0) return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });

  if (all[idx].status !== 'pending') {
    return NextResponse.json({ detail: 'يمكن إلغاء الطلبات المعلقة فقط' }, { status: 400 });
  }

  all[idx] = { ...all[idx], status: 'cancelled', reviewed_at: new Date().toISOString() };
  writeLeaves(auth.tenantId, all);
  return NextResponse.json({ ok: true, leave_request: all[idx] });
}
