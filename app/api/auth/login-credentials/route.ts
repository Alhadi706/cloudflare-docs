/**
 * POST /api/auth/login-credentials
 * ──────────────────────────────────────────────────────────────────────────────
 * دخول بـ username + password للمستخدمين المدعوّين (مديرو الإدارات والأقسام).
 * يختلف عن OTP flow المخصص للمؤسسين والأعضاء.
 *
 * Body: { username, password, tenant_code?, tenant_id? }
 * Returns: { token, role, department_code, section_id, home_route, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { makeAuthToken }             from '@/lib/auth-tokens';
import { verifyPassword }            from '@/lib/user-store';
import { pgPool }                    from '@/lib/db-pg';
import { getHomeRoute }              from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';

// ── Simple brute-force guard (in-memory, resets on restart) ─────────────────
const _attempts = new Map<string, { count: number; lockUntil: number }>();

function checkLock(key: string): { locked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const s = _attempts.get(key);
  if (s && s.lockUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((s.lockUntil - now) / 1000) };
  }
  return { locked: false };
}

function recordFailure(key: string): { locked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const s = _attempts.get(key) ?? { count: 0, lockUntil: 0 };
  s.count += 1;
  if (s.count >= 5) {
    s.lockUntil = now + 5 * 60 * 1000;
    s.count = 0;
    _attempts.set(key, s);
    return { locked: true, retryAfterSec: 300 };
  }
  _attempts.set(key, s);
  return { locked: false };
}

function clearFailures(key: string) { _attempts.delete(key); }

// ── DB row type ──────────────────────────────────────────────────────────────
interface AuthRow {
  id: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  full_name: string | null;
  hashed_password: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
  tenant_id: string | null;
  tenant_code: string | null;
  organization_name: string | null;
  department_code: string | null;
  section_id: string | null;
  section_code: string | null;
  is_founder: boolean | null;
  onboarding_complete: boolean | null;
}

async function findUser(
  identity: string,
  tenantCode: string | null,
  tenantId: string | null,
): Promise<AuthRow | null> {
  const SELECT = `
    SELECT id, email, username, role, status, full_name,
           hashed_password, password_salt, must_change_password,
           tenant_id, tenant_code, organization_name, department_code,
           section_id, section_code, is_founder, onboarding_complete
    FROM   auth_users
  `;

  // Tenant-scoped lookup first
  if (tenantId || tenantCode) {
    let sql = SELECT + ` WHERE (LOWER(username) = $1 OR LOWER(email) = $1)`;
    const params: (string)[] = [identity];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    } else if (tenantCode) {
      params.push(tenantCode);
      sql += ` AND LOWER(tenant_code) = $${params.length}`;
    }
    sql += ' LIMIT 1';
    try {
      const { rows } = await pgPool.query<AuthRow>(sql, params);
      if (rows.length) return rows[0];
    } catch (err) { console.error('[login-credentials] DB error (scoped):', err); }
  }

  // Fallback: any matching user
  try {
    const { rows } = await pgPool.query<AuthRow>(
      SELECT + ` WHERE (LOWER(username) = $1 OR LOWER(email) = $1) LIMIT 1`,
      [identity],
    );
    return rows[0] ?? null;
  } catch (err) {
    console.error('[login-credentials] DB error (unscoped):', err);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; tenant_code?: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { username, password, tenant_code, tenant_id } = body;
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   || req.headers.get('x-real-ip') || 'unknown';

  if (!username || !password) {
    return NextResponse.json(
      { detail: 'اسم المستخدم/الإيميل وكلمة المرور مطلوبان' },
      { status: 400 },
    );
  }

  const normalizedIdentity   = username.toLowerCase().trim();
  const normalizedTenantCode = (tenant_code ?? '').trim().toLowerCase() || null;
  const normalizedTenantId   = (tenant_id  ?? '').trim() || null;

  const lockKey = `${clientIp}:${normalizedIdentity}`;
  const lockState = checkLock(lockKey);
  if (lockState.locked) {
    return NextResponse.json(
      { detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة', retry_after_sec: lockState.retryAfterSec },
      { status: 429 },
    );
  }

  const user = await findUser(normalizedIdentity, normalizedTenantCode, normalizedTenantId);

  if (!user || !user.hashed_password || !user.password_salt) {
    const state = recordFailure(lockKey);
    if (state.locked) {
      return NextResponse.json(
        { detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة', retry_after_sec: state.retryAfterSec },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { detail: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
      { status: 401 },
    );
  }

  if (user.status === 'suspended') {
    return NextResponse.json({ detail: 'الحساب موقوف. تواصل مع المسؤول.' }, { status: 403 });
  }

  const valid = verifyPassword(password, user.hashed_password, user.password_salt);
  if (!valid) {
    const state = recordFailure(lockKey);
    if (state.locked) {
      return NextResponse.json(
        { detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة', retry_after_sec: state.retryAfterSec },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { detail: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
      { status: 401 },
    );
  }

  clearFailures(lockKey);

  // Update last_login (non-blocking)
  pgPool.query(
    user.status === 'invited'
      ? `UPDATE auth_users SET last_login=$1, status='verified', verified_at=$1 WHERE id=$2`
      : `UPDATE auth_users SET last_login=$1 WHERE id=$2`,
    [Date.now(), user.id],
  ).catch(err => console.error('[login-credentials] last_login update failed:', err));

  const needsBootstrap =
    !user.onboarding_complete &&
    (user.role === 'founder' || user.role === 'admin' || !!user.is_founder);

  const token = makeAuthToken(user.email, user.role, {
    full_name:            user.full_name,
    tenant_id:            user.tenant_id,
    tenant_code:          user.tenant_code,
    organization_name:    user.organization_name,
    department_code:      user.department_code,
    section_id:           user.section_id,
    section_code:         user.section_code,
    is_founder:           user.is_founder,
    must_change_password: user.must_change_password ?? false,
    needs_bootstrap:      needsBootstrap,
    login_method:         'credentials',
  });

  return NextResponse.json({
    token,
    role:                 user.role,
    full_name:            user.full_name,
    email:                user.email,
    tenant_id:            user.tenant_id,
    tenant_code:          user.tenant_code,
    organization_name:    user.organization_name,
    department_code:      user.department_code,
    section_code:         user.section_code ?? null,
    section_id:           user.section_id ?? null,
    is_founder:           !!user.is_founder,
    must_change_password: user.must_change_password ?? false,
    needs_bootstrap:      needsBootstrap,
    home_route:           getHomeRoute(
      (user.role ?? 'employee') as UserRole,
      (user.department_code ?? null) as DepartmentCode | null,
      null,
      user.section_id ?? null,
    ),
  });
}
