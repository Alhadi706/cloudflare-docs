/**
 * POST /api/auth/invite
 * ──────────────────────────────────────────────────────────────────────────────
 * يتيح للمؤسس (founder) أو الأدمن (admin) دعوة مديري الإدارات والأقسام.
 * يُنشئ حساباً بـ username + كلمة مرور مؤقتة.
 *
 * الصلاحيات:
 *   founder → يستطيع دعوة: dept_manager, admin
 *   dept_manager → يستطيع دعوة: section_manager, supervisor, employee
 *   section_manager → يستطيع دعوة: supervisor, employee
 *
 * الناتج: { username, temp_password, email, role, department_code }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken }           from '@/lib/auth-tokens';
import {
  findByEmail, inviteUser, listUsers,
  type UserRole, type DepartmentCode,
} from '@/lib/user-store';

// ── Role permission matrix ─────────────────────────────────────────────────

const ALLOWED_INVITE: Record<string, UserRole[]> = {
  founder:         ['admin', 'dept_manager', 'section_manager', 'supervisor', 'employee'],
  admin:           ['dept_manager', 'section_manager', 'supervisor', 'employee'],
  dept_manager:    ['section_manager', 'supervisor', 'employee'],
  section_manager: ['supervisor', 'employee'],
};

export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
  if (!token) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return NextResponse.json({ detail: 'الجلسة منتهية' }, { status: 401 });
  }

  const inviterRole = decoded.role as string;
  if (!ALLOWED_INVITE[inviterRole]) {
    return NextResponse.json({ detail: 'لا تملك صلاحية دعوة مستخدمين' }, { status: 403 });
  }

  // ── Body validation ─────────────────────────────────────────────────────
  let body: {
    full_name:       string;
    email:           string;
    role:            UserRole;
    department_code: DepartmentCode;
    section_id?:     string;
    job_title?:      string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { full_name, email, role, department_code, section_id, job_title } = body;

  if (!full_name || !email || !role || !department_code) {
    return NextResponse.json(
      { detail: 'حقول مطلوبة: full_name, email, role, department_code' },
      { status: 400 }
    );
  }

  // ── Check inviter can invite this role ──────────────────────────────────
  const allowed = ALLOWED_INVITE[inviterRole] ?? [];
  if (!allowed.includes(role)) {
    return NextResponse.json(
      { detail: `دورك (${inviterRole}) لا يستطيع دعوة (${role})` },
      { status: 403 }
    );
  }

  // ── Check email not already registered ──────────────────────────────────
  if (findByEmail(email)) {
    return NextResponse.json({ detail: 'البريد الإلكتروني مسجّل مسبقاً' }, { status: 409 });
  }

  // ── Get org name from inviter's user record ─────────────────────────────
  const inviterUser = findByEmail(decoded.email as string);
  const orgName     = inviterUser?.organization_name ?? (decoded.organization_name as string) ?? 'المنظمة';

  // ── Create invited user ─────────────────────────────────────────────────
  const result = inviteUser({
    full_name,
    email,
    role,
    department_code,
    section_id,
    invited_by:       decoded.email as string,
    organization_name: orgName,
    job_title,
  });

  return NextResponse.json({
    success:         true,
    username:        result.username,
    temp_password:   result.temp_password,
    email:           result.user.email,
    role:            result.user.role,
    department_code: result.user.department_code,
    message:         `تم إنشاء حساب لـ ${full_name}. أرسل له اسم المستخدم وكلمة المرور المؤقتة.`,
  });
}

// ── GET /api/auth/invite — list invited users ───────────────────────────────

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  const decoded = verifyAuthToken(token);
  if (!decoded) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const allowedRoles = ['founder', 'admin', 'dept_manager', 'section_manager'];
  if (!allowedRoles.includes(decoded.role as string)) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
  }

  const all = listUsers();

  // Filter based on inviter role
  const filtered = decoded.role === 'founder' || decoded.role === 'admin'
    ? all
    : all.filter(u => u.invited_by === (decoded.email as string) || u.department_code === (decoded.department_code as string));

  return NextResponse.json({
    users: filtered.map(u => ({
      id:              u.id,
      full_name:       u.full_name,
      email:           u.email,
      role:            u.role,
      status:          u.status,
      department_code: u.department_code,
      section_id:      u.section_id,
      invited_by:      u.invited_by,
      username:        u.username,
      job_title:       u.job_title,
      is_founder:      u.is_founder,
      last_login:      u.last_login,
      created_at:      u.created_at,
    })),
  });
}
