/**
 * POST /api/auth/login-credentials
 * ──────────────────────────────────────────────────────────────────────────────
 * دخول بـ username + password للمستخدمين المدعوّين (مديرو الإدارات والأقسام).
 * يختلف عن OTP flow المخصص للمؤسسين والأعضاء.
 *
 * Body: { username: string, password: string }
 * Returns: { token, role, department_code, must_change_password, full_name }
 */
import { NextRequest, NextResponse } from 'next/server';
import { makeAuthToken }             from '@/lib/auth-tokens';
import { verifyPassword } from '@/lib/user-store';
import {
  authFindByEmail,
  authFindByUsernameScoped,
  authHasAnyActiveScope,
  authHasAnyPendingScope,
  authUpdateUser,
} from '@/lib/auth-store-backend';
import { getScopesForDepartmentCode } from '@/lib/appScope';
import { getHomeRoute } from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';
import {
  buildCredentialAttemptKey,
  clearCredentialLoginFailures,
  getCredentialLockState,
  registerFailedCredentialLogin,
} from '@/lib/credential-login-attempts';

function normalizeHint(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function inferTenantCodeFromIdentity(identity: string): string | null {
  const normalized = normalizeHint(identity);
  if (!normalized.includes('@')) return null;

  const domain = normalized.split('@')[1] || '';
  if (!domain) return null;

  // manager.x@20-6.local -> 20-6
  const firstLabel = domain.split('.')[0] || '';
  const inferred = firstLabel.trim().toLowerCase();
  return inferred || null;
}

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; tenant_code?: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { username, password, tenant_code, tenant_id } = body;
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
  if (!username || !password) {
    return NextResponse.json(
      { detail: 'اسم المستخدم/الإيميل وكلمة المرور مطلوبان' },
      { status: 400 }
    );
  }

  const normalizedIdentity = username.toLowerCase().trim();
  const providedTenantCode = normalizeHint(tenant_code);
  const inferredTenantCode = inferTenantCodeFromIdentity(normalizedIdentity);
  const normalizedTenantCode = providedTenantCode || inferredTenantCode || null;
  const normalizedTenantId = tenant_id?.trim() || null;

  if (!normalizedTenantCode && !normalizedTenantId) {
    return NextResponse.json(
      { detail: 'رمز المؤسسة مطلوب. يمكنك لصق رمز المؤسسة من بطاقة الاعتماد أو استخدام بريد يحتوي على @tenant.local' },
      { status: 400 }
    );
  }

  const tenantHint = normalizedTenantCode || normalizedTenantId || 'unknown_tenant';
  const attemptKey = buildCredentialAttemptKey(tenantHint, normalizedIdentity, clientIp);
  const lockState = getCredentialLockState(attemptKey);
  if (lockState.locked) {
    return NextResponse.json(
      {
        detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة',
        retry_after_sec: lockState.retryAfterSec,
      },
      { status: 429 }
    );
  }

  // ── Find user by username OR email (tenant-scoped) ─────────────────────
  const scopedByTenant = (candidate: {
    tenant_id?: string;
    tenant_code?: string;
    department_code?: string;
    section_id?: string;
  } | undefined): boolean => {
    if (!candidate) return false;
    if (!normalizedTenantId && !normalizedTenantCode) return true;
    if (normalizedTenantId && candidate.tenant_id === normalizedTenantId) return true;
    const candidateTenantCode = normalizeHint(candidate.tenant_code);
    const candidateDeptCode = normalizeHint(candidate.department_code);
    const candidateSectionId = normalizeHint(candidate.section_id);

    if (normalizedTenantCode && candidateTenantCode === normalizedTenantCode) return true;

    // Allow copy/paste of department or section code in the tenant field.
    // This keeps login robust for credentials delivered in provisioning bundles.
    if (normalizedTenantCode && (candidateDeptCode === normalizedTenantCode || candidateSectionId === normalizedTenantCode)) {
      return true;
    }

    return false;
  };

  let user = await authFindByUsernameScoped(normalizedIdentity, {
    tenant_code: normalizedTenantCode,
    tenant_id: normalizedTenantId,
  });

  if (!user) {
    // Second pass without tenant filter, then validate tenant/dept/section hint explicitly.
    const byUsername = await authFindByUsernameScoped(normalizedIdentity);
    if (scopedByTenant(byUsername)) {
      user = byUsername;
    }
  }

  if (!user && normalizedIdentity.includes('@')) {
    const byEmail = await authFindByEmail(normalizedIdentity);
    if (scopedByTenant(byEmail)) {
      user = byEmail;
    }
  }

  if (!user || !user.hashed_password || !user.password_salt) {
    const state = registerFailedCredentialLogin(attemptKey);
    if (state.locked) {
      return NextResponse.json(
        {
          detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة',
          retry_after_sec: state.retryAfterSec,
        },
        { status: 429 }
      );
    }

    // Same error message to avoid username enumeration
    return NextResponse.json(
      { detail: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }

  // ── Check account status ─────────────────────────────────────────────────
  if (user.status === 'suspended') {
    return NextResponse.json({ detail: 'الحساب موقوف. تواصل مع المسؤول.' }, { status: 403 });
  }

  // ── Tenant department trust gate ─────────────────────────────────────────
  if (user.tenant_id && user.department_code) {
    const candidateScopes = getScopesForDepartmentCode(user.department_code);
    const active = await authHasAnyActiveScope(user.tenant_id, candidateScopes);
    if (!active) {
      const pending = await authHasAnyPendingScope(user.tenant_id, candidateScopes);
      return NextResponse.json(
        {
          detail: pending
            ? 'تفعيل الإدارة قيد المراجعة الأمنية من الإدارة الأولى.'
            : 'هذه الإدارة غير مفعلة بعد داخل المؤسسة.',
          code: pending ? 'department_join_pending' : 'department_not_linked',
        },
        { status: 403 }
      );
    }
  }

  // ── Verify password ──────────────────────────────────────────────────────
  const valid = verifyPassword(password, user.hashed_password, user.password_salt);
  if (!valid) {
    const state = registerFailedCredentialLogin(attemptKey);
    if (state.locked) {
      return NextResponse.json(
        {
          detail: 'تم تعليق محاولة الدخول مؤقتاً بعد عدة محاولات فاشلة',
          retry_after_sec: state.retryAfterSec,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { detail: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }

  clearCredentialLoginFailures(attemptKey);

  // ── Update last_login and mark as verified if still 'invited' ────────────
  const updates: Partial<typeof user> = { last_login: Date.now() };
  if (user.status === 'invited') {
    updates.status = 'verified';
    updates.verified_at = Date.now();
  }
  await authUpdateUser(user.email, updates);

  const needsBootstrap =
    !user.onboarding_complete &&
    (user.role === 'founder' || user.role === 'admin' || !!user.is_founder);

  // ── Issue auth token ─────────────────────────────────────────────────────
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
