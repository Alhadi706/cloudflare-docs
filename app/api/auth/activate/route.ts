/**
 * POST /api/auth/activate
 * Verifies a signed activation link token (from email click).
 * Activates the account and returns a session token.
 */
import { NextRequest, NextResponse }       from 'next/server';
import { findByEmail, findByToken, updateUser } from '@/lib/user-store';
import { verifyActivationToken, makeAuthToken } from '@/lib/auth-tokens';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token } = body;

  if (!token)
    return NextResponse.json({ detail: 'الرمز مطلوب', code: 'missing_token' }, { status: 400 });

  // Verify signature
  const decoded = verifyActivationToken(token);
  if (!decoded)
    return NextResponse.json({ detail: 'رابط التفعيل غير صالح أو تالف', code: 'invalid_token' }, { status: 400 });

  const user = findByEmail(decoded.email);
  if (!user)
    return NextResponse.json({ detail: 'البريد الإلكتروني غير مسجل', code: 'user_not_found' }, { status: 404 });

  // Already activated
  if (user.status === 'verified') {
    const authToken = makeAuthToken(user.email, user.role, {
      full_name: user.full_name, organization_name: user.organization_name, is_founder: user.is_founder,
    });
    return NextResponse.json({
      token: authToken, email: user.email, full_name: user.full_name, role: user.role,
      is_founder: user.is_founder, organization_name: user.organization_name,
      needs_bootstrap: user.is_founder, status: 'already_verified',
    });
  }

  // Token must match
  if (user.activation_token !== token)
    return NextResponse.json({ detail: 'رابط التفعيل غير صالح', code: 'invalid_token' }, { status: 400 });

  // Expiry check
  if (Date.now() > user.token_expires)
    return NextResponse.json({ detail: 'انتهت صلاحية رابط التفعيل. أعد إرسال رمز جديد.', code: 'expired' }, { status: 401 });

  // ── Activate ─────────────────────────────────────────────────
  updateUser(user.email, {
    status:           'verified',
    verified_at:      Date.now(),
    activation_otp:   '',
    activation_token: '',
    otp_attempts:     0,
  });

  const authToken = makeAuthToken(user.email, user.role, {
    full_name: user.full_name, organization_name: user.organization_name, is_founder: user.is_founder,
  });

  return NextResponse.json({
    token:             authToken,
    email:             user.email,
    full_name:         user.full_name,
    role:              user.role,
    is_founder:        user.is_founder,
    organization_name: user.organization_name,
    needs_bootstrap:   user.is_founder,
    status:            'verified',
  });
}
