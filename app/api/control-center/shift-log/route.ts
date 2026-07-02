/**
 * /api/control-center/shift-log
 * Proxy → /api/v1/ctrl/shift-logs
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const hdr = req.headers.get('x-verified-tenant-id');
  if (hdr && UUID_RE.test(hdr.trim())) return hdr.trim();
  return 'aaaaaaaa-0000-4000-a000-000000000001';
}

export async function GET(req: NextRequest) {
  try {
    const days = new URL(req.url).searchParams.get('days') || '7';
    const res = await fetch(`${B}/api/v1/ctrl/shift-logs?days=${days}`, {
      headers: { 'X-Tenant-ID': getTenant(req) },
      cache: 'no-store',
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
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${B}/api/v1/ctrl/shift-logs`, {
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
