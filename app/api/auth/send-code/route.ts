/**
 * POST /api/auth/send-code  (LOGIN flow)
 * Sends a one-time login code to a verified registered user.
 * Returns 403 for pending accounts, 404 for unregistered emails.
 */
import { NextRequest, NextResponse } from 'next/server';
import { storeCode }                  from '@/lib/code-store';
import { findByEmail }                from '@/lib/user-store';
import { generateOTP }                from '@/lib/auth-tokens';
import { sendEmail, buildLoginEmail } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ detail: 'بريد إلكتروني غير صالح' }, { status: 400 });

  const normalEmail = email.toLowerCase().trim();

  // ── Check account state ───────────────────────────────────────
  const user = findByEmail(normalEmail);

  if (!user)
    return NextResponse.json(
      { detail: 'البريد الإلكتروني غير مسجل. يرجى إنشاء حساب جديد أولاً.', code: 'not_registered' },
      { status: 404 }
    );

  if (user.status === 'pending_verification')
    return NextResponse.json(
      { detail: 'حسابك في انتظار التفعيل. تحقق من بريدك الإلكتروني.', code: 'pending_verification', status: 'pending_verification' },
      { status: 403 }
    );

  if (user.status === 'suspended')
    return NextResponse.json(
      { detail: 'هذا الحساب موقوف. تواصل مع الإدارة.', code: 'suspended' },
      { status: 403 }
    );

  // ── Generate and store OTP ────────────────────────────────────
  const code = generateOTP();
  storeCode(normalEmail, code, user.full_name);

  const { subject, html, text } = buildLoginEmail({ otp: code, email: normalEmail });
  const result = await sendEmail({ to: normalEmail, subject, html, text });

  return NextResponse.json({
    success:    true,
    message:    'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
    email_sent: result.sent,
    ...(result.warning ? { smtp_warning: result.warning } : {}),
    ...(!result.sent   ? { dev_code: code }                : {}),
  });
}
