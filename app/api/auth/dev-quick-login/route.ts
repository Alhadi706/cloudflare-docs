/**
 * POST /api/auth/dev-quick-login
 * ─────────────────────────────────────────────────────────────────
 * دخول تطويري سريع — يُنشئ جلسة admin مؤقتة بدون كلمة مرور.
 * مخصص لبيئة التطوير والاختبار.
 * يتبع التينيت INFRA_OPS (بيئة التطوير) بحيث البيانات معزولة تماماً عن التينانتس الأخرى.
 */
import { NextRequest, NextResponse } from 'next/server';
import { makeAuthToken } from '@/lib/auth-tokens';

const DEV_TENANT_ID   = 'aaaaaaaa-0000-4000-a000-000000000001';
const DEV_TENANT_CODE = 'INFRA_OPS';
const DEV_ORG_NAME    = 'بيئة التطوير — INFRA_OPS';

export async function POST(_req: NextRequest) {
  // Phase 0 security fix: this endpoint previously issued a fully-signed
  // admin/founder token to ANY unauthenticated caller (it sits under the
  // globally-public /api/auth/ prefix in middleware.ts, so it was NOT
  // covered by the /api/dev/* dev-portal gate). Require the same explicit
  // dev-portal flag used to gate /dev and /api/dev/* before issuing anything.
  if (process.env.DEV_PORTAL_ENABLED !== '1') {
    return NextResponse.json(
      { detail: 'dev_quick_login_disabled', code: 'forbidden' },
      { status: 403 }
    );
  }

  const token = makeAuthToken('dev@dsf.local', 'admin', {
    department_code:   null,
    section_id:        null,
    section_code:      null,
    tenant_id:         DEV_TENANT_ID,
    tenant_code:       DEV_TENANT_CODE,
    organization_name: DEV_ORG_NAME,
    is_founder:        true,
  });

  return NextResponse.json({
    token,
    email:             'dev@dsf.local',
    role:              'admin',
    department_code:   null,
    section_id:        null,
    section_code:      null,
    tenant_id:         DEV_TENANT_ID,
    tenant_code:       DEV_TENANT_CODE,
    organization_name: DEV_ORG_NAME,
    is_founder:        true,
    must_change_password: false,
    needs_bootstrap:   false,
    home_route:        '/dashboard/gm-office',
  });
}
