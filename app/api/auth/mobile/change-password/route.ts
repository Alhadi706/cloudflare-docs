import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';
import { findByUsername, buildEmployeeUsername, verifyPassword, hashPassword, upsertEmployeeCredentialUser } from '@/lib/user-store';
import { getTenantByCode } from '@/lib/tenant-store';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ detail: 'Authorization مطلوب' }, { status: 401 });

  const payload = verifyAuthToken(token);
  if (!payload) return NextResponse.json({ detail: 'رمز الدخول غير صالح' }, { status: 401 });

  const tenantId   = String(payload.tenant_id   || '');
  const tenantCode = String(payload.tenant_code || '');
  const employeeNo = String(payload.employee_no || '');

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.current_password || '').trim();
  const newPassword      = String(body.new_password     || '').trim();
  const confirmPassword  = String(body.confirm_password || '').trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ detail: 'جميع حقول كلمة المرور مطلوبة' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ detail: 'كلمة المرور الجديدة وتأكيدها غير متطابقتان' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ detail: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  const username = buildEmployeeUsername(tenantCode, employeeNo);
  const user = findByUsername(username);
  if (!user || user.tenant_id !== tenantId) {
    return NextResponse.json({ detail: 'الحساب غير موجود' }, { status: 404 });
  }

  if (!verifyPassword(currentPassword, user.hashed_password || user.password_hash || '', user.password_salt || '')) {
    return NextResponse.json({ detail: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });
  }

  const { hash, salt } = hashPassword(newPassword);
  upsertEmployeeCredentialUser({
    tenant_id:     tenantId,
    tenant_code:   tenantCode,
    employee_no:   employeeNo,
    full_name:     user.full_name || '',
    department_code: user.department_code || '',
    password_hash: hash,
    password_salt: salt,
    mobile_role:   user.role,
  });

  return NextResponse.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
