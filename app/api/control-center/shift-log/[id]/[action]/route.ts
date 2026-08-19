/**
 * /api/control-center/shift-log/[id]/[action]
 * POST /api/control-center/shift-log/{id}/entry  → add entry
 * POST /api/control-center/shift-log/{id}/close  → close shift
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
const ALLOWED = new Set(['entry', 'close']);
function getTenant(req: NextRequest): string {
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const tenantId = getTenant(req);
  if (!tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, action } = params;
  if (!ALLOWED.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${B}/api/v1/ctrl/shift-logs/${id}/${action}`, {
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
