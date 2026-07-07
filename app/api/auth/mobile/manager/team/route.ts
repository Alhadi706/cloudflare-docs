/**
 * /api/auth/mobile/manager/team
 * GET  → قائمة أعضاء الفريق مع حالة الحضور والمهام
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { getTodayAttendance, getAttendanceRecords } from '@/lib/mobile-field-store';

const SUPERVISOR_ROLES = ['supervisor', 'dept_manager', 'section_manager', 'admin', 'founder'];

function resolveEmpNo(req: NextRequest): string {
  const h = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (h) return h;
  return (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  if (!SUPERVISOR_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
  }

  const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
  const deptCode = auth.departmentCode || req.nextUrl.searchParams.get('dept') || '';
  const today    = new Date().toISOString().slice(0, 10);

  // Fetch employees in this department
  let employees: any[] = [];
  try {
    const res = await fetch(
      `${B}/api/v1/workspace/employees?department=${encodeURIComponent(deptCode)}&limit=200`,
      { headers: { 'X-Tenant-ID': auth.tenantId }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      employees = Array.isArray(d) ? d : (d.employees ?? d.data ?? []);
    }
  } catch { /* ignore */ }

  // Attach today's attendance to each employee
  const allAtt = getAttendanceRecords(auth.tenantId);
  const todayAtt = allAtt.filter(r => r.date === today);

  const team = employees.map(emp => {
    const empNo = String(emp.employee_number || emp.employee_no || emp.id || '');
    const att   = todayAtt.find(r => r.employee_no === empNo || r.employee_no === empNo.toUpperCase());
    return {
      id:            emp.id,
      employee_no:   empNo,
      name:          emp.name || emp.name_ar || emp.full_name || '',
      role:          emp.role || '',
      department:    emp.department || deptCode,
      attendance:    att ? {
        checkin:  att.checkin_time,
        checkout: att.checkout_time ?? null,
        present:  true,
      } : { present: false, checkin: null, checkout: null },
    };
  });

  const presentCount = team.filter(e => e.attendance.present).length;
  const absentCount  = team.length - presentCount;

  return NextResponse.json({
    ok: true,
    date: today,
    department_code: deptCode,
    summary: { total: team.length, present: presentCount, absent: absentCount },
    team,
  });
}
