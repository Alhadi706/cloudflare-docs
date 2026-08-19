/**
 * /api/v1/corrosion/monthly-phases/[id]
 * PUT/PATCH → update phase
 * DELETE    → remove phase
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-monthly-phases');

// Tenant identity must come from middleware's verified JWT — never a client-supplied header.
function getTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function getFile(tenantId: string) {
  return path.join(DATA_DIR, `${tenantId}.json`);
}

function readPhases(tenantId: string): any[] {
  try {
    const f = getFile(tenantId);
    if (!fs.existsSync(f)) return [];
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d.phases) ? d.phases : [];
  } catch { return []; }
}

function writePhases(tenantId: string, phases: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(getFile(tenantId), JSON.stringify({ phases }, null, 2));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const { id } = params;
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const phases = readPhases(tenantId);
  const idx = phases.findIndex((p: any) => p.id === id);
  if (idx < 0) return NextResponse.json({ error: 'المرحلة غير موجودة' }, { status: 404 });

  phases[idx] = { ...phases[idx], ...body, updatedAt: new Date().toISOString() };
  writePhases(tenantId, phases);
  return NextResponse.json(phases[idx]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const { id } = params;
  const phases = readPhases(tenantId);
  const filtered = phases.filter((p: any) => p.id !== id);
  if (filtered.length === phases.length) {
    return NextResponse.json({ error: 'المرحلة غير موجودة' }, { status: 404 });
  }
  writePhases(tenantId, filtered);
  return new NextResponse(null, { status: 204 });
}
