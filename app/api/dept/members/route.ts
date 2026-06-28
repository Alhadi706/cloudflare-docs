/**
 * GET  /api/dept/members        — list members in the caller's department
 * POST /api/dept/members        — invite a member inside the caller's department
 * GET  /api/dept/members?id=X   — get a specific member (must be same dept)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken }           from '@/lib/auth-tokens';
import {
  findByDepartment, findById, inviteUser,
  listUsers, type SovereignUser,
} from '@/lib/user-store';
import { canInviteRole, atLeast }    from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';

function getCallerFromRequest(req: NextRequest): ReturnType<typeof verifyAuthToken> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyAuthToken(token);
}

// ── Sanitise user record before returning to client ─────────────────────────
function sanitise(u: SovereignUser) {
  const { hashed_password, password_salt, activation_token, activation_otp, ...safe } = u;
  return safe;
}

// ── GET /api/dept/members ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = getCallerFromRequest(req);
  if (!caller) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const role     = caller.role as UserRole;
  const deptCode = caller.department_code as DepartmentCode | undefined;

  // Admin/founder see all users; others see only their dept
  let members: SovereignUser[];
  if (atLeast(role, 'admin')) {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const u = findById(id);
      if (!u) return NextResponse.json({ detail: 'المستخدم غير موجود' }, { status: 404 });
      return NextResponse.json({ user: sanitise(u) });
    }
    members = listUsers();
  } else {
    if (!deptCode) return NextResponse.json({ detail: 'لا توجد إدارة مرتبطة بحسابك' }, { status: 403 });
    members = findByDepartment(deptCode);
  }

  return NextResponse.json({
    members: members.map(sanitise),
    total:   members.length,
    dept:    deptCode ?? 'all',
  });
}

// ── POST /api/dept/members ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = getCallerFromRequest(req);
  if (!caller) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const callerRole = caller.role    as UserRole;
  const callerDept = caller.department_code as DepartmentCode | undefined;

  // Only dept_manager and above can invite
  if (!atLeast(callerRole, 'dept_manager')) {
    return NextResponse.json({ detail: 'ليس لديك صلاحية دعوة أعضاء' }, { status: 403 });
  }

  let body: {
    full_name?: string;
    email?: string;
    role?: string;
    section_id?: string;
    job_title?: string;
    department_code?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ detail: 'بيانات غير صالحة' }, { status: 400 }); }

  const { full_name, email, role: targetRole, section_id, job_title, department_code } = body;

  if (!full_name || !email || !targetRole) {
    return NextResponse.json(
      { detail: 'الاسم والبريد والدور مطلوبة' },
      { status: 400 }
    );
  }

  // Validate the target role is invite-able by caller
  if (!canInviteRole(callerRole, targetRole as UserRole)) {
    return NextResponse.json(
      { detail: `لا يمكنك دعوة مستخدم بدور ${targetRole}` },
      { status: 403 }
    );
  }

  // Department: admin can specify any dept; dept_manager uses their own dept
  const finalDept = atLeast(callerRole, 'admin')
    ? (department_code ?? callerDept)
    : callerDept;

  if (!finalDept) {
    return NextResponse.json({ detail: 'يجب تحديد الإدارة' }, { status: 400 });
  }

  // Get the caller's organisation name from user store
  const { findByEmail } = await import('@/lib/user-store');
  const callerUser = findByEmail(caller.email);
  const orgName    = callerUser?.organization_name ?? 'Unknown';

  const result = inviteUser({
    full_name,
    email: email.toLowerCase().trim(),
    role:            targetRole as UserRole,
    department_code: finalDept as DepartmentCode,
    section_id:      section_id,
    invited_by:      caller.email,
    organization_name: orgName,
    job_title,
  });

  return NextResponse.json({
    username:      result.username,
    temp_password: result.temp_password,
    email:         result.user.email,
    full_name:     result.user.full_name,
    role:          result.user.role,
    department_code: result.user.department_code,
  }, { status: 201 });
}
