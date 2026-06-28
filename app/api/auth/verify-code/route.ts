/**
 * POST /api/auth/verify-code  (LOGIN flow)
 * Verifies a login OTP for an already-verified user account.
 */
import { NextRequest, NextResponse }   from 'next/server';
import { verifyCode, getStoredName }   from '@/lib/code-store';
import { makeAuthToken }               from '@/lib/auth-tokens';
import { findByEmail }                 from '@/lib/user-store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, code } = body;

  if (!email || !code)
    return NextResponse.json({ detail: 'بيانات غير مكتملة' }, { status: 400 });

  const storedName = getStoredName(email);
  const result     = verifyCode(email, code);

  if (result === 'ok') {
    // Look up full user record for complete info
    const user  = findByEmail(email);
    const role  = user?.role  || 'member';
    const fname = user?.full_name || storedName || null;
    const token = makeAuthToken(email, role, {
      full_name:         fname,
      organization_name: user?.organization_name,
      is_founder:        user?.is_founder ?? false,
    });
    return NextResponse.json({
      token,
      email,
      full_name:         fname,
      role,
      is_founder:        user?.is_founder ?? false,
      organization_name: user?.organization_name,
      needs_bootstrap:   user?.is_founder && !user?.verified_at,
    });
  }

  if (result === 'expired')
    return NextResponse.json({ detail: 'انتهت صلاحية الرمز، أعد إرسال رمز جديد', code: 'expired' }, { status: 401 });
  if (result === 'max_attempts')
    return NextResponse.json({ detail: 'تجاوزت عدد المحاولات المسموحة، أعد إرسال رمز جديد', code: 'max_attempts' }, { status: 429 });

  return NextResponse.json({ detail: 'رمز غير صحيح' }, { status: 401 });
}
