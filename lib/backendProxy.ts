/**
 * backendProxy — shared utility for Next.js → Python backend proxying
 * ─────────────────────────────────────────────────────────────────────
 * Tenant identity is supplied only by middleware after JWT/session verification.
 * Client headers, query parameters, and cookies are never tenant authorities.
 */

import { NextRequest, NextResponse } from 'next/server';

export const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:7860';
const STAFF_API_KEY  = process.env.STAFF_API_KEY || '';

/** Extract the tenant_id established by the authentication middleware. */
export function extractTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

/** Build backend request headers with injected tenant context */
export function buildBackendHeaders(tenantId: string, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (tenantId) {
    h['X-Tenant-ID'] = tenantId;
  }
  if (STAFF_API_KEY) {
    h['X-Staff-Api-Key'] = STAFF_API_KEY;
  }
  return h;
}

/**
 * Generic proxy handler — forwards GET/POST requests to the backend.
 * Falls back to `fallback` value on error (default: null, returns 502).
 */
export async function proxyGet(
  req: NextRequest,
  backendPath: string,
  fallback?: object | null,
  timeoutMs = 15_000
): Promise<NextResponse> {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const url      = `${BACKEND}${backendPath}`;
  const qs       = req.nextUrl.searchParams.toString();
  const fullUrl  = qs ? `${url}?${qs}` : url;

  try {
    const res = await fetch(fullUrl, {
      headers: buildBackendHeaders(tenantId, {
        'X-User-Role': req.headers.get('x-verified-role') || '',
      }),
      signal:  AbortSignal.timeout(timeoutMs),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      return NextResponse.json(body);
    }

    // If the backend returns 401/403, forward the status
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(body, { status: res.status });
    }

    // Other backend errors — return fallback if provided
    if (fallback !== undefined) {
      return NextResponse.json(fallback ?? body, { status: res.ok ? 200 : res.status });
    }

    return NextResponse.json(body, { status: res.status });
  } catch (err: unknown) {
    if (fallback !== undefined) {
      return NextResponse.json(fallback);
    }
    const msg = err instanceof Error ? err.message : 'backend unavailable';
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}

export async function proxyPost(
  req: NextRequest,
  backendPath: string,
  fallback?: object | null,
  timeoutMs = 15_000
): Promise<NextResponse> {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const url      = `${BACKEND}${backendPath}`;

  let bodyText = '';
  try { bodyText = await req.text(); } catch { /* empty body */ }

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: buildBackendHeaders(tenantId, {
        'X-User-Role': req.headers.get('x-verified-role') || '',
      }),
      body:    bodyText || undefined,
      signal:  AbortSignal.timeout(timeoutMs),
    });

    const body = await res.json().catch(() => ({}));
    if (res.ok) return NextResponse.json(body);
    if (res.status === 401 || res.status === 403) return NextResponse.json(body, { status: res.status });
    if (fallback !== undefined) return NextResponse.json(fallback ?? body);
    return NextResponse.json(body, { status: res.status });
  } catch (err: unknown) {
    if (fallback !== undefined) return NextResponse.json(fallback);
    const msg = err instanceof Error ? err.message : 'backend unavailable';
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
