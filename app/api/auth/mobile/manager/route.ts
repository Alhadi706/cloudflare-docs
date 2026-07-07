/**
 * /api/auth/mobile/manager
 * GET → لوحة القيادة: إحصائيات سريعة للمدير أو رئيس القسم
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getTodayAttendance, getAttendanceRecords,
  getPendingCompletionReports, getPendingPartsRequests,
  getOpenFaultReports,
} from '@/lib/mobile-field-store';
import fs from 'fs';
import path from 'path';

const MANAGER_ROLES = ['dept_manager', 'section_manager', 'admin', 'founder'];

function resolveEmpNo(req: NextRequest): string {
  const h = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (h) return h;
  return (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

function readLeaves(tenantId: string): any[] {
  try {
    const f = path.join(process.cwd(), '.data', 'mobile-field', `leave_requests_${tenantId}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  if (!MANAGER_ROLES.includes(auth.role) && auth.role !== 'supervisor') {
    return NextResponse.json({ detail: 'هذه اللوحة للمدراء ورؤساء الأقسام فقط' }, { status: 403 });
  }

  const empNo = resolveEmpNo(req);
  const today = new Date().toISOString().slice(0, 10);
  const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

  // Attendance today
  const allAttendance = getAttendanceRecords(auth.tenantId);
  const todayAttCount = allAttendance.filter(r => r.date === today).length;
  const checkedOutCount = allAttendance.filter(r => r.date === today && r.checkout_time).length;

  // Pending work items
  const pendingApprovals = getPendingCompletionReports(auth.tenantId);
  const pendingParts     = getPendingPartsRequests(auth.tenantId);
  const openFaults       = getOpenFaultReports(auth.tenantId);

  // Pending leave requests for department
  const allLeaves = readLeaves(auth.tenantId);
  const pendingLeaves = allLeaves.filter((r: any) => r.status === 'pending');

  // Work orders summary from backend (best effort)
  let woStats = { open: 0, in_progress: 0, completed_today: 0, overdue: 0 };
  try {
    const woRes = await fetch(`${B}/api/v1/workflow/work-orders?limit=200&dept=${auth.departmentCode || ''}`, {
      headers: { 'X-Tenant-ID': auth.tenantId, 'X-Staff-Api-Key': process.env.STAFF_API_KEY || '' },
      signal: AbortSignal.timeout(5000),
    });
    if (woRes.ok) {
      const d = await woRes.json();
      const orders = Array.isArray(d) ? d : (d.data ?? d.orders ?? []);
      woStats.open          = orders.filter((w: any) => w.status === 'open').length;
      woStats.in_progress   = orders.filter((w: any) => w.status === 'in_progress').length;
      woStats.completed_today = orders.filter((w: any) => w.status === 'completed' && w.completion_date?.startsWith(today)).length;
      woStats.overdue       = orders.filter((w: any) => ['open','in_progress'].includes(w.status) && w.scheduled_date && w.scheduled_date < today).length;
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({
    ok: true,
    role: auth.role,
    employee_no: empNo,
    department_code: auth.departmentCode,
    kpis: {
      // Attendance
      present_today:    todayAttCount,
      checked_out:      checkedOutCount,
      // Work orders
      wo_open:          woStats.open,
      wo_in_progress:   woStats.in_progress,
      wo_completed_today: woStats.completed_today,
      wo_overdue:       woStats.overdue,
      // Approvals
      pending_approvals: pendingApprovals.length,
      pending_parts:     pendingParts.length,
      open_faults:       openFaults.length,
      // Leave
      pending_leaves:    pendingLeaves.length,
    },
    recent_faults: openFaults.slice(0, 3).map(f => ({
      id: f.id, title: f.title, severity: f.severity, reported_at: f.reported_at,
    })),
    pending_leaves: pendingLeaves.slice(0, 5).map((l: any) => ({
      id: l.id, employee_no: l.employee_no, employee_name: l.employee_name,
      leave_type: l.leave_type, start_date: l.start_date, end_date: l.end_date, days: l.days,
    })),
  });
}
