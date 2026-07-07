/**
 * /api/auth/mobile/leave-approval
 * GET  → طلبات إجازة الفريق المعلقة
 * POST → موافقة / رفض طلب إجازة
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');
const REVIEWER_ROLES = ['dept_manager', 'section_manager', 'admin', 'founder'];

function leaveFile(tenantId: string) { return path.join(DATA_DIR, `leave_requests_${tenantId}.json`); }
function readLeaves(tenantId: string): any[] {
  try {
    const f = leaveFile(tenantId);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  } catch { return []; }
}
function writeLeaves(tenantId: string, data: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = leaveFile(tenantId) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, leaveFile(tenantId));
}

function resolveEmpNo(req: NextRequest): string {
  const h = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (h) return h;
  return (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

const LEAVE_LABELS: Record<string, string> = {
  annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة',
  unpaid: 'بدون راتب', bereavement: 'وفاة', study: 'دراسية',
};

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  if (!REVIEWER_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح — للمدراء ورؤساء الأقسام فقط' }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const leaves = readLeaves(auth.tenantId)
    .filter((r: any) => status === 'all' || r.status === status)
    .sort((a: any, b: any) => b.submitted_at.localeCompare(a.submitted_at))
    .slice(0, 50)
    .map((r: any) => ({ ...r, leave_label: LEAVE_LABELS[r.leave_type] ?? r.leave_type }));

  return NextResponse.json({ ok: true, leaves, total: leaves.length });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  if (!REVIEWER_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
  }

  const body   = await req.json().catch(() => ({}));
  const id     = String(body.id || '').trim();
  const action = String(body.action || '').toLowerCase() as 'approve' | 'reject';
  const reason = String(body.reason || '').trim();
  const empNo  = resolveEmpNo(req);

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ detail: 'id و action (approve|reject) مطلوبان' }, { status: 400 });
  }

  const all = readLeaves(auth.tenantId);
  const idx = all.findIndex((r: any) => r.id === id);
  if (idx < 0) return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
  if (all[idx].status !== 'pending') {
    return NextResponse.json({ detail: 'هذا الطلب ليس في حالة انتظار' }, { status: 400 });
  }

  all[idx] = {
    ...all[idx],
    status:           action === 'approve' ? 'approved' : 'rejected',
    reviewed_by:      empNo,
    reviewed_at:      new Date().toISOString(),
    rejection_reason: action === 'reject' ? reason : undefined,
  };
  writeLeaves(auth.tenantId, all);
  return NextResponse.json({ ok: true, leave: all[idx] });
}
