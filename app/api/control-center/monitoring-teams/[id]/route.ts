/**
 * /api/control-center/monitoring-teams/[id]
 * PATCH → /api/v1/ctrl/monitoring-teams/{id}/status
 * DELETE → /api/v1/ctrl/monitoring-teams/{id}
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
const DEFAULT_TENANT = 'aaaaaaaa-0000-4000-a000-000000000001';

function getTenantHeader(req: NextRequest): string {
  const verified = req.headers.get('x-verified-tenant-id')?.trim();
  if (verified) return verified;
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams/${params.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantHeader(req) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams/${params.id}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-ID': getTenantHeader(req) },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
