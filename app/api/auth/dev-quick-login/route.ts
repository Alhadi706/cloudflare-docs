/**
 * POST /api/auth/dev-quick-login
 * ─────────────────────────────────────────────────────────────────
 * دخول تطويري سريع — يُنشئ جلسة admin مؤقتة بدون كلمة مرور.
 * مخصص لبيئة التطوير والاختبار.
 */
import { NextRequest, NextResponse } from 'next/server';
import { makeAuthToken } from '@/lib/auth-tokens';

export async function POST(_req: NextRequest) {
  const token = makeAuthToken('dev@dsf.local', 'admin', {
    department_code:   null,
    section_id:        null,
    section_code:      null,
    tenant_id:         'dev-tenant',
    tenant_code:       'dev',
    organization_name: 'بيئة التطوير',
    is_founder:        false,
  });

  return NextResponse.json({
    token,
    email:             'dev@dsf.local',
    role:              'admin',
    department_code:   null,
    section_id:        null,
    section_code:      null,
    tenant_id:         'dev-tenant',
    tenant_code:       'dev',
    organization_name: 'بيئة التطوير',
    is_founder:        false,
    must_change_password: false,
    needs_bootstrap:   false,
    home_route:        '/dashboard',
  });
}
