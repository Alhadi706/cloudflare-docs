/**
 * /api/control-center/alarms/[id]/[action]
 * POST acknowledge → /api/v1/ctrl/alarms/{id}/acknowledge
 * POST resolve     → /api/v1/ctrl/alarms/{id}/resolve
 * POST create-work-order → /api/v1/ctrl/alarms/{id}/create-work-order
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

const ALLOWED_ACTIONS = ['acknowledge', 'resolve', 'create-work-order'];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const { id, action } = params;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${B}/api/v1/ctrl/alarms/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
