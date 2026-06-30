/**
 * /api/v1/corrosion/monthly-phases
 * GET  → list monthly phases for the tenant
 * POST → create a new monthly phase
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-monthly-phases');

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

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  return NextResponse.json({ phases: readPhases(tenantId) });
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { id, planId, planTitle, month, year, fromStation, toStation, teamName, notes } = body;
  if (!planId || !fromStation || !toStation) {
    return NextResponse.json({ error: 'planId و fromStation و toStation مطلوبة' }, { status: 400 });
  }

  const phases = readPhases(tenantId);
  const now = new Date().toISOString();
  const phaseId = id || Math.random().toString(36).slice(2, 10);
  const existingIdx = phases.findIndex((p: any) => p.id === phaseId);

  const phase = {
    id: phaseId,
    planId,
    planTitle: planTitle || '',
    month: month || '',
    year: year || new Date().getFullYear(),
    fromStation,
    toStation,
    teamName: teamName || null,
    notes: notes || null,
    status: 'planned',
    createdAt: existingIdx >= 0 ? (phases[existingIdx].createdAt || now) : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) { phases[existingIdx] = phase; } else { phases.push(phase); }
  writePhases(tenantId, phases);
  return NextResponse.json(phase, { status: existingIdx >= 0 ? 200 : 201 });
}
