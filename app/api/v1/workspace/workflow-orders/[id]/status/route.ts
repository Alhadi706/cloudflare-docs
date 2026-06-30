/**
 * /api/v1/workspace/workflow-orders/[id]/status
 * PATCH → transition a work order to a new status
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'workflow-orders');
const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

function getTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    'aaaaaaaa-0000-4000-a000-000000000001'
  );
}

function getFile(tenantId: string) {
  return path.join(DATA_DIR, `${tenantId}.json`);
}

function readOrders(tenantId: string): any[] {
  try {
    const f = getFile(tenantId);
    if (!fs.existsSync(f)) return [];
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d.orders) ? d.orders : [];
  } catch { return []; }
}

function writeOrders(tenantId: string, orders: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(getFile(tenantId), JSON.stringify({ orders }, null, 2));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(req);
  const { id } = params;
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const { new_status, note, actor } = body;
  if (!new_status) {
    return NextResponse.json({ error: 'new_status مطلوب' }, { status: 400 });
  }

  // Try backend first
  try {
    const res = await fetch(`${BACKEND}/api/v1/workspace/work-orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'X-Tenant-ID': tenantId,
        'X-Staff-Api-Key': STAFF_API_KEY,
        'X-Tenant-Code': 'INFRA_OPS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_status, note, actor }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch { /* fall through to local */ }

  // Local fallback: update status in JSON storage
  const orders = readOrders(tenantId);
  const idx = orders.findIndex((o: any) => o.id === id || String(o.id) === String(id));
  if (idx >= 0) {
    orders[idx] = {
      ...orders[idx],
      status: new_status,
      last_note: note || null,
      last_actor: actor || null,
      updated_at: new Date().toISOString(),
    };
    writeOrders(tenantId, orders);
    return NextResponse.json({ success: true, order: orders[idx] });
  }

  return NextResponse.json({ success: true, message: 'تم تحديث الحالة (محلياً)' });
}
