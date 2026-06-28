/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit OTP from the registration flow.
 * Activates the account and returns a session token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { findByEmail, updateUser }   from '@/lib/user-store';
import { makeAuthToken }             from '@/lib/auth-tokens';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, otp } = body;

  if (!email || !otp)
    return NextResponse.json({ detail: 'بيانات ناقصة' }, { status: 400 });

  const user = findByEmail(email);
  if (!user)
    return NextResponse.json({ detail: 'البريد الإلكتروني غير مسجل' }, { status: 404 });

  // Already verified — return existing session
  if (user.status === 'verified') {
    const token = makeAuthToken(user.email, user.role, {
      full_name:         user.full_name,
      organization_name: user.organization_name,
      is_founder:        user.is_founder,
    });
    return NextResponse.json({
      token,
      email:             user.email,
      full_name:         user.full_name,
      role:              user.role,
      is_founder:        user.is_founder,
      organization_name: user.organization_name,
      needs_bootstrap:   user.is_founder,
      status:            'already_verified',
    });
  }

  // Rate limit: max 5 wrong attempts
  if (user.otp_attempts >= 5) {
    return NextResponse.json(
      { detail: 'تجاوزت عدد المحاولات المسموحة. أعد إرسال رمز جديد.', code: 'max_attempts' },
      { status: 429 }
    );
  }

  // Check expiry
  if (Date.now() > user.otp_expires) {
    return NextResponse.json(
      { detail: 'انتهت صلاحية الرمز. أعد إرسال رمز جديد.', code: 'expired' },
      { status: 401 }
    );
  }

  // Wrong OTP
  if (user.activation_otp !== String(otp).trim()) {
    updateUser(user.email, { otp_attempts: user.otp_attempts + 1 });
    const left = 5 - user.otp_attempts - 1;
    return NextResponse.json(
      { detail: `رمز غير صحيح. المحاولات المتبقية: ${left}`, attempts_left: left },
      { status: 401 }
    );
  }

  // ── Activate ──────────────────────────────────────────────────
  updateUser(user.email, {
    status:           'verified',
    verified_at:      Date.now(),
    activation_otp:   '',
    activation_token: '',
    otp_attempts:     0,
  });

  const token = makeAuthToken(user.email, user.role, {
    full_name:         user.full_name,
    organization_name: user.organization_name,
    is_founder:        user.is_founder,
  });

  return NextResponse.json({
    token,
    email:             user.email,
    full_name:         user.full_name,
    role:              user.role,
    is_founder:        user.is_founder,
    organization_name: user.organization_name,
    needs_bootstrap:   user.is_founder,
  });
}
