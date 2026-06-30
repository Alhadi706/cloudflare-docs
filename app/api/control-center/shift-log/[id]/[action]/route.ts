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
  try {
    const cookie = req.cookies.get('auth_session')?.value;
    const bearer = req.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookie || bearer;
    if (token) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.tenant_id) return String(payload.tenant_id);
    }
  } catch { /* fall through */ }
  return req.headers.get('x-verified-tenant-id') ?? 'aaaaaaaa-0000-4000-a000-000000000001';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const { id, action } = params;
  if (!ALLOWED.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${B}/api/v1/ctrl/shift-logs/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenant(req) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
