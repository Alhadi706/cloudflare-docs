/**
 * GET /api/auth/me
 * Validates a session token and returns the authenticated user's profile.
 * Used by client code to check session validity on page load.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken }           from '@/lib/auth-tokens';
import { findByEmail }               from '@/lib/user-store';
import { getLayerScope, getHomeRoute } from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  if (!token) {
    return NextResponse.json({ detail: 'غير مصرح — أرسل الرمز عبر Authorization header' }, { status: 401 });
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return NextResponse.json({ detail: 'الجلسة منتهية الصلاحية أو غير صالحة', code: 'invalid_token' }, { status: 401 });
  }

  const user = findByEmail(decoded.email);
  if (!user) {
    return NextResponse.json({ detail: 'المستخدم غير موجود', code: 'user_not_found' }, { status: 404 });
  }

  if (user.status !== 'verified') {
    return NextResponse.json(
      { detail: 'الحساب غير مفعّل', code: 'not_verified', status: user.status },
      { status: 403 }
    );
  }

  const role     = user.role     as UserRole;
  const deptCode = user.department_code as DepartmentCode | undefined;

  return NextResponse.json({
    email:             user.email,
    full_name:         user.full_name,
    phone_number:      user.phone_number,
    organization_name: user.organization_name,
    organization_type: user.organization_type,
    country:           user.country,
    job_title:         user.job_title,
    role,
    department_code:   deptCode,
    section_id:        user.section_id,
    is_founder:        user.is_founder,
    status:            user.status,
    needs_bootstrap:   user.is_founder && !user.onboarding_complete,
    onboarding_complete: user.onboarding_complete ?? false,
    verified_at:       user.verified_at,
    created_at:        user.created_at,
    last_login:        user.last_login,
    // RBAC computed properties
    layer_scope:  getLayerScope(role, deptCode),
    home_route:   getHomeRoute(role, deptCode),
  });
}
