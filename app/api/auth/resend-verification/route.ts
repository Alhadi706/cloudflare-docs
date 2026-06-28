/**
 * POST /api/auth/resend-verification
 * Resends activation OTP + email link for pending accounts.
 * Enforces cooldown and max-resend limits.
 */
import { NextRequest, NextResponse }                      from 'next/server';
import { findByEmail, updateUser }                        from '@/lib/user-store';
import { generateOTP, generateActivationToken }           from '@/lib/auth-tokens';
import { sendEmail, buildVerificationEmail }              from '@/lib/email-service';

const OTP_TTL         = 30 * 60 * 1000;
const TOKEN_TTL       = 24 * 60 * 60 * 1000;
const COOLDOWN_MS     = 2 * 60 * 1000; // 2 minutes between resends
const MAX_DAILY_RESEND = 10;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = body;

  if (!email)
    return NextResponse.json({ detail: 'البريد الإلكتروني مطلوب' }, { status: 400 });

  const user = findByEmail(email);
  if (!user)
    return NextResponse.json({ detail: 'البريد الإلكتروني غير مسجل' }, { status: 404 });
  if (user.status === 'verified')
    return NextResponse.json({ detail: 'الحساب مفعّل مسبقاً. يمكنك تسجيل الدخول.' }, { status: 400 });

  const now = Date.now();

  // Cooldown check
  if (user.last_resend && (now - user.last_resend) < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - user.last_resend)) / 1000);
    return NextResponse.json(
      { detail: `انتظر ${remaining} ثانية قبل إعادة الإرسال`, cooldown: remaining },
      { status: 429 }
    );
  }

  // Max resends
  if ((user.resend_count || 0) >= MAX_DAILY_RESEND)
    return NextResponse.json(
      { detail: 'تجاوزت الحد الأقصى لإعادة الإرسال اليومي. حاول غداً.' },
      { status: 429 }
    );

  const otp   = generateOTP();
  const token = generateActivationToken(user.email, user.id);

  updateUser(user.email, {
    activation_otp:   otp,
    activation_token: token,
    otp_expires:      now + OTP_TTL,
    token_expires:    now + TOKEN_TTL,
    otp_attempts:     0,
    resend_count:     (user.resend_count || 0) + 1,
    last_resend:      now,
  });

  const baseUrl        = process.env.NEXT_PUBLIC_BASE_URL || 'https://dev.d-me.ly';
  const activationLink = `${baseUrl}/activate?token=${token}`;

  const { subject, html, text } = buildVerificationEmail({
    full_name: user.full_name,
    otp,
    activationLink,
  });

  const result = await sendEmail({ to: user.email, subject, html, text });

  return NextResponse.json({
    success:    true,
    email_sent: result.sent,
    ...(result.warning ? { smtp_warning: result.warning } : {}),
    ...(!result.sent   ? { dev_otp: otp }                  : {}),
  });
}
