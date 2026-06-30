/**
 * /api/control-center/monitoring-teams
 * Proxy → /api/v1/ctrl/monitoring-teams
 * Passes X-Tenant-ID from Authorization Bearer JWT or falls back to default.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
const DEFAULT_TENANT = 'aaaaaaaa-0000-4000-a000-000000000001';

function getTenantHeader(req: NextRequest): string {
  // Try middleware-injected verified header first
  const verified = req.headers.get('x-verified-tenant-id')?.trim();
  if (verified) return verified;
  // Fallback: extract tenant_id from JWT payload (base64 middle part)
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.cookies.get('auth_token')?.value ?? '');
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.tenant_id) return String(payload.tenant_id);
    } catch { /* ignore */ }
  }
  return DEFAULT_TENANT;
}

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
      cache: 'no-store',
      headers: { 'X-Tenant-ID': getTenantHeader(req) },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = getTenantHeader(req);
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
