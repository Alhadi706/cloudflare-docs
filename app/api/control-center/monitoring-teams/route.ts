/**
 * /api/control-center/monitoring-teams
 * Proxy → /api/v1/ctrl/monitoring-teams
 * Passes X-Tenant-ID from Authorization Bearer JWT or falls back to default.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
function getTenantHeader(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const safe = { ...(body as Record<string, unknown>) };
  for (const key of ['tenant_id', 'tenantId', 'organization_id', 'organizationId', 'actor_id', 'actorId', 'user_id', 'userId', 'role', 'user_role']) {
    delete safe[key];
  }
  return safe;
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantHeader(req);
  if (!tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
      cache: 'no-store',
      headers: { 'X-Tenant-ID': tenantId },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantHeader(req);
  if (!tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      body: JSON.stringify(sanitizeBody(body)),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
