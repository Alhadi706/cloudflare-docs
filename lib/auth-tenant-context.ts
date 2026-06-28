import { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';

export type AuthTenantContext = {
  email: string;
  role: string;
  tenantId: string;
  tenantCode: string | null;
  decoded: { [k: string]: unknown };
};

export type AuthTenantContextResult =
  | { ok: true; context: AuthTenantContext }
  | { ok: false; status: 401 | 403; error: string };

function extractAuthToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookieToken = req.cookies.get('auth_token')?.value || '';
  return cookieToken.trim();
}

export function resolveAuthTenantContext(req: NextRequest): AuthTenantContextResult {
  // Primary: read from middleware-injected verified headers (set after JWT verification)
  // These cannot be spoofed — middleware strips client-supplied x-verified-* headers.
  const verifiedTenantId   = req.headers.get('x-verified-tenant-id')?.trim()   ?? '';
  const verifiedTenantCode = req.headers.get('x-verified-tenant-code')?.trim() ?? '';
  const verifiedEmail      = req.headers.get('x-verified-email')?.trim()       ?? '';
  const verifiedRole       = req.headers.get('x-verified-role')?.trim()        ?? '';

  if (verifiedTenantId) {
    return {
      ok: true,
      context: {
        email:      verifiedEmail,
        role:       verifiedRole,
        tenantId:   verifiedTenantId,
        tenantCode: verifiedTenantCode || null,
        decoded:    { email: verifiedEmail, role: verifiedRole, tenant_id: verifiedTenantId, tenant_code: verifiedTenantCode },
      },
    };
  }

  // Fallback: direct JWT verification (for cases where middleware is bypassed,
  // e.g., direct handler tests or non-middleware contexts).
  const token = extractAuthToken(req);
  if (!token) return { ok: false, status: 401, error: 'unauthorized' };

  const decoded = verifyAuthToken(token);
  if (!decoded) return { ok: false, status: 401, error: 'unauthorized' };

  const tenantId = String(decoded.tenant_id || '').trim();
  if (!tenantId) return { ok: false, status: 403, error: 'tenant_context_required' };

  const tenantCode = String(decoded.tenant_code || '').trim() || null;
  const email = String(decoded.email || '').trim();
  const role = String(decoded.role || '').trim();

  return {
    ok: true,
    context: {
      email,
      role,
      tenantId,
      tenantCode,
      decoded,
    },
  };
}
