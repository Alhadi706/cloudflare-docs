import { NextRequest, NextResponse } from 'next/server';
import { verifyCode } from '@/lib/code-store';
import { hashPassword } from '@/lib/user-store';
import { authFindByEmail, authUpdateUser } from '@/lib/auth-store-backend';

function resetCodeKey(email: string): string {
  return `pwdreset:${email.toLowerCase().trim()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').toLowerCase().trim();
  const code = String(body?.code || '').trim();
  const newPassword = String(body?.new_password || '');

  if (!email || !code || !newPassword) {
    return NextResponse.json({ detail: 'بيانات غير مكتملة' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ detail: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
  }

  const user = await authFindByEmail(email);
  if (!user) {
    return NextResponse.json({ detail: 'البريد الإلكتروني غير مسجل' }, { status: 404 });
  }

  if (!user.hashed_password || !user.password_salt) {
    return NextResponse.json({ detail: 'هذا الحساب لا يدعم إعادة تعيين كلمة المرور.' }, { status: 403 });
  }

  const result = verifyCode(resetCodeKey(email), code);
  if (result === 'expired') {
    return NextResponse.json({ detail: 'انتهت صلاحية الرمز. أعد إرسال رمز جديد.', code: 'expired' }, { status: 401 });
  }

  if (result === 'max_attempts') {
    return NextResponse.json({ detail: 'تم تجاوز عدد المحاولات. أعد إرسال رمز جديد.', code: 'max_attempts' }, { status: 429 });
  }

  if (result !== 'ok') {
    return NextResponse.json({ detail: 'رمز غير صحيح', code: 'invalid_code' }, { status: 401 });
  }

  const { hash, salt } = hashPassword(newPassword);
  const updated = await authUpdateUser(email, {
    hashed_password: hash,
    password_salt: salt,
    must_change_password: false,
  });

  if (!updated) {
    return NextResponse.json({ detail: 'تعذر تحديث كلمة المرور' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' });
}
