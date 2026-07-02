/**
 * backendProxy — shared utility for Next.js → Python backend proxying
 * ─────────────────────────────────────────────────────────────────────
 * Reads the verified tenant_id from multiple sources (in priority order):
 *   1. x-verified-tenant-id  — injected by middleware from the JWT Bearer token
 *   2. x-tenant-id           — sent directly by the client (from localStorage)
 *   3. X-Tenant-ID           — alternate capitalisation from client
 *   4. tenant_id cookie      — set by LoginPanel after login
 *
 * This ensures ALL requests to the Python backend carry a valid X-Tenant-ID,
 * even when the client's localStorage doesn't have it stored.
 */

import { NextRequest, NextResponse } from 'next/server';

export const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:7860';
const STAFF_API_KEY  = process.env.STAFF_API_KEY || '';

/** Extract the best available tenant_id from the incoming Next.js request */
export function extractTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    req.cookies.get('tenant_id')?.value ||
    ''
  ).trim();
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
  const url      = `${BACKEND}${backendPath}`;
  const qs       = req.nextUrl.searchParams.toString();
  const fullUrl  = qs ? `${url}?${qs}` : url;

  try {
    const res = await fetch(fullUrl, {
      headers: buildBackendHeaders(tenantId),
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
  const url      = `${BACKEND}${backendPath}`;

  let bodyText = '';
  try { bodyText = await req.text(); } catch { /* empty body */ }

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: buildBackendHeaders(tenantId),
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
