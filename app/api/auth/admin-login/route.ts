import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pgPool } from '@/lib/db-pg';
import { makeAuthToken } from '@/lib/auth-tokens';

function hashPw(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };

  if (!password?.trim()) {
    return NextResponse.json({ detail: 'كلمة المرور مطلوبة' }, { status: 400 });
  }

  // 1. محاولة الدخول عبر قاعدة البيانات (دور founder أو admin)
  if (email?.trim()) {
    try {
      const { rows } = await pgPool.query<{
        id: string; email: string; role: string;
        hashed_password: string; password_salt: string; tenant_id: string; tenant_code: string | null;
      }>(
        `SELECT id, email, role, tenant_id, tenant_code, hashed_password, password_salt
         FROM auth_users
         WHERE email = $1 AND role IN ('founder', 'admin')
         LIMIT 1`,
        [email.trim().toLowerCase()]
      );

      if (rows.length > 0) {
        const user = rows[0];
        if (user.hashed_password && user.password_salt) {
          const hashed = hashPw(password, user.password_salt);
          const valid = crypto.timingSafeEqual(
            Buffer.from(hashed, 'hex'),
            Buffer.from(user.hashed_password, 'hex')
          );
          if (valid) {
            const token = makeAuthToken(user.email, user.role, {
              tenant_id: user.tenant_id,
              tenant_code: user.tenant_code,
              login_method: 'admin-credentials',
            });
            return NextResponse.json({ token, role: user.role, tenant_id: user.tenant_id, tenant_code: user.tenant_code });
          }
          // لا توقف هنا — اسمح للوضع الاحتياطي بالمحاولة
        }
      }
    } catch (err) {
      console.error('[admin-login] DB error:', err);
    }
  }

  
  return NextResponse.json({ detail: 'كلمة مرور غير صحيحة' }, { status: 401 });

  return NextResponse.json({ detail: 'كلمة مرور غير صحيحة' }, { status: 401 });
}
