/**
 * POST /api/auth/refresh-session
 * ──────────────────────────────────────────────────────────────────────────────
 * Refresh the current user's session with updated role, department_code, etc.
 * 
 * Use case: When a user is newly assigned to a department or role,
 * call this endpoint to update their session without requiring logout/login.
 * 
 * Returns: Updated session data with new role, department_code, home_route, etc.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAuthToken } from '@/lib/auth-tokens';
import { findByUsername, findByEmail } from '@/lib/user-store';
import { getHomeRoute } from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';

export async function POST(req: NextRequest) {
  // Get token from Authorization header
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  if (!token) {
    return NextResponse.json(
      { detail: 'غير مصرح — أرسل الرمز عبر Authorization header' },
      { status: 401 }
    );
  }

  // Verify token
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return NextResponse.json(
      { detail: 'الجلسة منتهية الصلاحية أو غير صالحة' },
      { status: 401 }
    );
  }

  // Find user
  const user = findByEmail(decoded.email) ?? findByUsername(decoded.email);
  if (!user) {
    return NextResponse.json(
      { detail: 'المستخدم غير موجود' },
      { status: 404 }
    );
  }

  // Check for updated org role assignment
  let effectiveDeptCode = user.department_code as string | undefined;
  let effectiveRole = user.role as UserRole;

  // Look in org-roles.json for the latest assignment
  try {
    const orgRolesFile = path.join(process.cwd(), '.data', 'org-roles.json');
    if (fs.existsSync(orgRolesFile)) {
      const orgRoles: Array<{
        employee_no: string;
        org_role: string;
        department_code: string;
      }> = JSON.parse(fs.readFileSync(orgRolesFile, 'utf8')).roles ?? [];

      // Try to match by username, email, or employee number
      const uname = (user.username || decoded.email || '').toLowerCase();
      const derivedEmpNo = uname.startsWith('emp.')
        ? uname.split('.').slice(2).join('.')
        : uname;

      // Also try to extract from email (e.g., hadi.maint@dsf.local -> hadi.maint)
      const emailPrefix = uname.includes('@') ? uname.split('@')[0] : uname;

      const orgMatch = orgRoles.find(r =>
        r.employee_no === uname ||
        r.employee_no === derivedEmpNo ||
        r.employee_no === emailPrefix
      );

      if (orgMatch) {
        effectiveDeptCode = orgMatch.department_code;
        if (
          orgMatch.org_role === 'dept_manager' ||
          orgMatch.org_role === 'section_manager' ||
          orgMatch.org_role === 'supervisor'
        ) {
          effectiveRole = orgMatch.org_role as UserRole;
        }
      }
    }
  } catch {
    // Non-blocking: continue with current values
  }

  // Compute home route based on new role and department
  const homeRoute = getHomeRoute(
    effectiveRole,
    effectiveDeptCode as DepartmentCode | undefined
  );

  return NextResponse.json({
    ok: true,
    email: user.email,
    full_name: user.full_name,
    role: effectiveRole,
    department_code: effectiveDeptCode,
    home_route: homeRoute,
    tenant_id: user.tenant_id,
    tenant_code: user.tenant_code,
    message: effectiveRole !== user.role || effectiveDeptCode !== user.department_code
      ? `✓ تم تحديث الجلسة بنجاح. أنت الآن: ${effectiveRole}`
      : 'الجلسة محدثة (لم تتغير البيانات)',
  });
}
