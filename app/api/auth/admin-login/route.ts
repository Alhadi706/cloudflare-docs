import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pgPool } from '@/lib/db-pg';

const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'SovereignAdmin2026!';

function hashPw(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
}

function makeToken(email: string, role: string): string {
  const payload = Buffer.from(JSON.stringify({ email, role, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'sovereign-dev-secret')
    .update(payload).digest('base64url');
  return `${payload}.${sig}`;
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
        hashed_password: string; password_salt: string;
      }>(
        `SELECT id, email, role, hashed_password, password_salt
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
            const token = makeToken(user.email, 'super_admin');
            return NextResponse.json({ token, role: 'super_admin' });
          }
          // لا توقف هنا — اسمح للوضع الاحتياطي بالمحاولة
        }
      }
    } catch (err) {
      console.error('[admin-login] DB error:', err);
    }
  }

  // 2. الوضع الاحتياطي — كلمة مرور النظام
  if (password === ADMIN_PASSWORD) {
    const token = makeToken(email || 'admin@system', 'super_admin');
    return NextResponse.json({ token, role: 'super_admin' });
  }

  return NextResponse.json({ detail: 'كلمة مرور غير صحيحة' }, { status: 401 });
}
