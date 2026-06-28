/**
 * POST /api/auth/register
 * Credential-based registration with operational profile fields.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  findByEmail,
  updateUser,
  hashPassword,
  generateUsername,
  listUsers,
} from '@/lib/user-store';
import { makeAuthToken } from '@/lib/auth-tokens';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    full_name,
    email,
    personal_email,
    phone_number,
    job_number,
    department_code,
    organization_name,
    password,
  } = body as {
    full_name?: string;
    email?: string;
    personal_email?: string;
    phone_number?: string;
    job_number?: string;
    department_code?: string;
    organization_name?: string | null;
    password?: string;
  };

  if (!full_name?.trim()) {
    return NextResponse.json({ detail: 'الاسم الكامل مطلوب' }, { status: 400 });
  }
  if (!email?.trim() || !isValidEmail(email.trim())) {
    return NextResponse.json({ detail: 'البريد الإلكتروني غير صالح' }, { status: 400 });
  }
  if (!personal_email?.trim() || !isValidEmail(personal_email.trim())) {
    return NextResponse.json({ detail: 'الإيميل الشخصي غير صالح' }, { status: 400 });
  }
  if (!phone_number?.trim()) {
    return NextResponse.json({ detail: 'رقم الهاتف مطلوب' }, { status: 400 });
  }
  if (!job_number?.trim()) {
    return NextResponse.json({ detail: 'الرقم الوظيفي مطلوب' }, { status: 400 });
  }
  if (!department_code?.trim()) {
    return NextResponse.json({ detail: 'الإدارة مطلوبة' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ detail: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
  }

  const normalEmail = email.toLowerCase().trim();
  const existing = findByEmail(normalEmail);

  if (existing?.status === 'verified') {
    return NextResponse.json(
      { detail: 'هذا البريد الإلكتروني مسجل ومفعل مسبقًا. الرجاء تسجيل الدخول.' },
      { status: 409 }
    );
  }

  const users = listUsers();
  const existingUsernames = users.map((u) => u.username).filter(Boolean) as string[];
  const username = existing?.username || generateUsername(full_name.trim(), department_code.trim(), existingUsernames);
  const { hash, salt } = hashPassword(password);

  const profilePayload = {
    full_name: full_name.trim(),
    email: normalEmail,
    personal_email: personal_email.trim().toLowerCase(),
    phone_number: phone_number.trim(),
    job_number: job_number.trim(),
    department_code: department_code.trim(),
    organization_name: (organization_name ?? '').trim() || 'غير محدد',
    username,
    hashed_password: hash,
    password_salt: salt,
    must_change_password: false,
    status: 'verified' as const,
    verified_at: Date.now(),
    last_login: Date.now(),
  };

  const user = existing
    ? updateUser(normalEmail, profilePayload)
    : createUser({
        ...profilePayload,
        activation_token: '',
        activation_otp: '',
        otp_expires: 0,
        token_expires: 0,
        otp_attempts: 0,
        resend_count: 0,
        last_resend: 0,
      });

  if (!user) {
    return NextResponse.json({ detail: 'فشل إنشاء الحساب' }, { status: 500 });
  }

  const token = makeAuthToken(user.email, user.role, {
    full_name: user.full_name,
    department_code: user.department_code,
    section_id: user.section_id,
    tenant_id: user.tenant_id,
    is_founder: user.is_founder,
    must_change_password: user.must_change_password ?? false,
    needs_bootstrap: false,
    login_method: 'credentials',
  });

  return NextResponse.json({
    token,
    role: user.role,
    email: user.email,
    full_name: user.full_name,
    tenant_id: user.tenant_id,
    department_code: user.department_code,
    must_change_password: user.must_change_password ?? false,
  });
}
