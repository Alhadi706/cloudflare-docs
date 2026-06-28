/**
 * Server-side tenant context resolver.
 *
 * SECURITY MODEL:
 * tenant_id is ONLY read from X-Verified-Tenant-ID — a header that is
 * exclusively set by middleware.ts after verifying the JWT signature.
 * Any client-supplied X-Tenant-ID, X-Tenant-Code, or tenant_id cookies
 * are completely ignored here. The middleware strips X-Verified-Tenant-ID
 * from all incoming client requests before injecting its own value, making
 * it impossible to spoof.
 */

/** UUID validation pattern */
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResolvedTenantContext {
  tenantId: string;
  tenantCode: string | null;
  email: string | null;
  role: string | null;
}

/**
 * Resolve the tenant context for a server-side request.
 * Returns null if the middleware did not inject a verified tenant
 * (which means the request was either unauthenticated or the JWT
 * did not contain a tenant_id — both cases should already have been
 * rejected by the middleware).
 */
export function resolveRequiredTenantContext(request: Request): ResolvedTenantContext | null {
  // Read ONLY from the server-injected verified headers
  const tenantId   = (request.headers.get('x-verified-tenant-id')   ?? '').trim();
  const tenantCode = (request.headers.get('x-verified-tenant-code') ?? '').trim() || null;
  const email      = (request.headers.get('x-verified-email')       ?? '').trim() || null;
  const role       = (request.headers.get('x-verified-role')        ?? '').trim() || null;

  if (!UUID_LIKE.test(tenantId)) {
    // Header missing or malformed — middleware should have blocked this request
    return null;
  }

  return { tenantId, tenantCode, email, role };
}
