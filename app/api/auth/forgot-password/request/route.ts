import { NextRequest, NextResponse } from 'next/server';
import { generateOTP } from '@/lib/auth-tokens';
import { storeCode } from '@/lib/code-store';
import { authFindByEmail } from '@/lib/auth-store-backend';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email-service';

function resetCodeKey(email: string): string {
  // Prefix key to isolate password-reset OTP from login OTP.
  return `pwdreset:${email.toLowerCase().trim()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ detail: 'بريد إلكتروني غير صالح' }, { status: 400 });
  }

  const user = await authFindByEmail(email);
  if (!user) {
    return NextResponse.json({ detail: 'البريد الإلكتروني غير مسجل' }, { status: 404 });
  }

  if (user.status === 'suspended') {
    return NextResponse.json({ detail: 'هذا الحساب موقوف. تواصل مع الإدارة.' }, { status: 403 });
  }

  if (!user.hashed_password || !user.password_salt) {
    return NextResponse.json({ detail: 'هذا الحساب لا يدعم إعادة تعيين كلمة المرور.' }, { status: 403 });
  }

  const otp = generateOTP();
  const key = resetCodeKey(email);
  storeCode(key, otp, user.full_name || email);

  const payload = buildPasswordResetEmail({
    name: user.full_name || 'المستخدم',
    otp,
  });

  const mail = await sendEmail({
    to: email,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  return NextResponse.json({
    success: true,
    message: 'تم إرسال رمز إعادة التعيين إلى بريدك الإلكتروني',
    email_sent: mail.sent,
    ...(mail.warning ? { smtp_warning: mail.warning } : {}),
    ...(!mail.sent ? { dev_code: otp } : {}),
  });
}
