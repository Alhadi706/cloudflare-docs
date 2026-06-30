/**
 * /api/v1/workspace/workflow-orders
 * GET  → list work orders (corrosion workflow context)
 * POST → create a new work order
 *
 * This supplements /api/v1/workspace/work-orders with corrosion-specific
 * workflow status management. Data stored locally in .data/workflow-orders/
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

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);

  // Try backend first (has authoritative data)
  try {
    const url = new URL(req.url);
    const query = url.search;
    const res = await fetch(`${BACKEND}/api/v1/workspace/work-orders${query}`, {
      headers: {
        'X-Tenant-ID': tenantId,
        'X-Staff-Api-Key': STAFF_API_KEY,
        'X-Tenant-Code': 'INFRA_OPS',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch { /* fall through to local */ }

  // Fallback to local storage
  const orders = readOrders(tenantId);
  return NextResponse.json({ work_orders: orders });
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // Try backend first
  try {
    const res = await fetch(`${BACKEND}/api/v1/workspace/work-orders`, {
      method: 'POST',
      headers: {
        'X-Tenant-ID': tenantId,
        'X-Staff-Api-Key': STAFF_API_KEY,
        'X-Tenant-Code': 'INFRA_OPS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 201 });
    }
  } catch { /* fall through to local */ }

  // Local fallback
  const orders = readOrders(tenantId);
  const now = new Date().toISOString();
  const order = {
    id: body.id || Math.random().toString(36).slice(2, 12),
    ...body,
    status: body.status || 'received',
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  };
  orders.push(order);
  writeOrders(tenantId, orders);
  return NextResponse.json(order, { status: 201 });
}
