/**
 * /api/v1/corrosion/engineering/calculations
 * GET  → list saved engineering calculations
 * POST → save a new calculation result
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-engineering');

// Tenant identity must come from middleware's verified JWT — never a client-supplied header.
function getTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function getFile(tenantId: string) {
  return path.join(DATA_DIR, `${tenantId}.json`);
}

function readCalcs(tenantId: string): any[] {
  try {
    const f = getFile(tenantId);
    if (!fs.existsSync(f)) return [];
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d.calculations) ? d.calculations : [];
  } catch { return []; }
}

function writeCalcs(tenantId: string, calcs: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(getFile(tenantId), JSON.stringify({ calculations: calcs }, null, 2));
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '120');
  const calcs = readCalcs(tenantId).slice(-limit).reverse();
  return NextResponse.json({ calculations: calcs });
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const calcs = readCalcs(tenantId);
  const now = new Date().toISOString();
  const calc = {
    id: body.id || Math.random().toString(36).slice(2, 10),
    ...body,
    created_at: now,
    tenant_id: tenantId,
  };

  // Keep max 500 records
  calcs.push(calc);
  if (calcs.length > 500) calcs.splice(0, calcs.length - 500);
  writeCalcs(tenantId, calcs);
  return NextResponse.json(calc, { status: 201 });
}
