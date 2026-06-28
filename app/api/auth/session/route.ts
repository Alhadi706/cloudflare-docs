import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function applySessionCookies(
  res: NextResponse,
  payload: { role: string; departmentCode?: string | null; tenantId?: string | null; tenantCode?: string | null; appScope?: string | null }
) {
  const secure = process.env.NODE_ENV === 'production';
  const base = {
    path: '/',
    sameSite: 'lax' as const,
    secure,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
  };

  res.cookies.set('auth_session', '1', base);
  res.cookies.set('user_role', payload.role || 'member', base);

  if (payload.departmentCode) {
    res.cookies.set('user_dept', payload.departmentCode, base);
  } else {
    res.cookies.delete('user_dept');
  }

  if (payload.tenantId) {
    res.cookies.set('tenant_id', payload.tenantId, base);
  } else {
    res.cookies.delete('tenant_id');
  }

  if (payload.tenantCode) {
    res.cookies.set('tenant_code', payload.tenantCode, base);
  } else {
    res.cookies.delete('tenant_code');
  }

  if (payload.appScope) {
    res.cookies.set('app_scope', payload.appScope, base);
  } else {
    res.cookies.delete('app_scope');
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ detail: 'missing_token' }, { status: 401 });
  }

  const claims = verifyAuthToken(token);
  if (!claims) {
    return NextResponse.json({ detail: 'invalid_token' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const appScope = typeof body?.app_scope === 'string' ? body.app_scope.trim() : '';

  const res = NextResponse.json({ ok: true });
  applySessionCookies(res, {
    role: String(claims.role || 'member'),
    departmentCode: typeof claims.department_code === 'string' ? claims.department_code : null,
    tenantId: typeof claims.tenant_id === 'string' ? claims.tenant_id : null,
    tenantCode: typeof claims.tenant_code === 'string' ? claims.tenant_code : null,
    appScope: appScope || null,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  const base = { path: '/', sameSite: 'lax' as const, secure, httpOnly: true, maxAge: 0 };

  res.cookies.set('auth_session', '', base);
  res.cookies.set('user_role', '', base);
  res.cookies.set('user_dept', '', base);
  res.cookies.set('tenant_id', '', base);
  res.cookies.set('tenant_code', '', base);
  res.cookies.set('app_scope', '', base);
  return res;
}
