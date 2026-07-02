/**
 * /api/v1/corrosion/field-teams/[id]
 * DELETE → remove a field team by ID
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');

function getTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    'aaaaaaaa-0000-4000-a000-000000000001'
  );
}

function getTeamsFile(tenantId: string): string {
  return path.join(DATA_DIR, `${tenantId}.json`);
}

function readTeams(tenantId: string): any[] {
  const file = getTeamsFile(tenantId);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.teams) ? parsed.teams : [];
  } catch {
    return [];
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(req);
  const { id } = params;
  const teams = readTeams(tenantId);
  const filtered = teams.filter((t: any) => t.id !== id);

  if (filtered.length === teams.length) {
    return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    getTeamsFile(tenantId),
    JSON.stringify({ teams: filtered }, null, 2)
  );

  return new NextResponse(null, { status: 204 });
}
