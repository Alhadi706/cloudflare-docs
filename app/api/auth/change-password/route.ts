/**
 * POST /api/auth/change-password
 * للمستخدمين المدعوّين لتغيير كلمة المرور المؤقتة في أول دخول.
 * Body: { current_password: string, new_password: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken }           from '@/lib/auth-tokens';
import { findByEmail, verifyPassword, hashPassword, updateUser } from '@/lib/user-store';

export async function POST(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
  const decoded = verifyAuthToken(token);
  if (!decoded) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  let body: { current_password?: string; new_password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ detail: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { current_password, new_password } = body;
  if (!current_password || !new_password) {
    return NextResponse.json({ detail: 'كلمة المرور الحالية والجديدة مطلوبتان' }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ detail: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
  }

  const user = findByEmail(decoded.email as string);
  if (!user?.hashed_password || !user.password_salt) {
    return NextResponse.json({ detail: 'هذا الحساب لا يستخدم كلمة مرور' }, { status: 400 });
  }

  if (!verifyPassword(current_password, user.hashed_password, user.password_salt)) {
    return NextResponse.json({ detail: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 });
  }

  const { hash, salt } = hashPassword(new_password);
  updateUser(user.email, {
    hashed_password:      hash,
    password_salt:        salt,
    must_change_password: false,
  });

  return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
