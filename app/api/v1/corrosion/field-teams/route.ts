/**
 * /api/v1/corrosion/field-teams
 * GET  → list field teams for the tenant
 * POST → create / upsert a field team
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');
const MOBILE_DIR = path.join(process.cwd(), '.data', 'mobile-field');
const ROLES_FILE = path.join(MOBILE_DIR, 'employee_mobile_roles.json');

function getTenantId(req: NextRequest): string {
  return (
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

function writeTeams(tenantId: string, teams: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(getTeamsFile(tenantId), JSON.stringify({ teams }, null, 2));
}

/** When a team is saved, grant each HR-linked member mobile access */
function syncMobileRoles(tenantId: string, members: any[]) {
  try {
    fs.mkdirSync(MOBILE_DIR, { recursive: true });
    let roles: Record<string, string> = {};
    if (fs.existsSync(ROLES_FILE)) {
      roles = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
    }
    for (const m of members) {
      if (m.source === 'directory' && m.employeeNumber) {
        const key = `${tenantId}:${m.employeeNumber}`;
        if (!roles[key]) {
          roles[key] = 'corrosion_field';
        }
      }
    }
    fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
  } catch {
    // non-fatal
  }
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  const teams = readTeams(tenantId);
  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { id, name, specialization, members } = body;
  if (!name || !Array.isArray(members)) {
    return NextResponse.json({ error: 'name و members مطلوبان' }, { status: 400 });
  }

  const teams = readTeams(tenantId);
  const now = new Date().toISOString();
  const teamId = id || Math.random().toString(36).slice(2, 10);
  const existingIdx = teams.findIndex((t: any) => t.id === teamId);

  const team = {
    id: teamId,
    name,
    specialization: specialization || '',
    members,
    createdAt: existingIdx >= 0 ? (teams[existingIdx].createdAt || now) : now,
    updatedAt: now,
    tenant_id: tenantId,
  };

  if (existingIdx >= 0) {
    teams[existingIdx] = team;
  } else {
    teams.push(team);
  }

  writeTeams(tenantId, teams);
  syncMobileRoles(tenantId, members);

  return NextResponse.json(team, { status: existingIdx >= 0 ? 200 : 201 });
}
