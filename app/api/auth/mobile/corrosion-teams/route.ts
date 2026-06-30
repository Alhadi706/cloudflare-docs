/**
 * /api/auth/mobile/corrosion-teams
 * GET → Returns the corrosion field team(s) the logged-in mobile employee belongs to.
 *       Called by the mobile app after login to show team assignment + work areas.
 *
 * Auth: Bearer {mobile_token} in Authorization header
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');

function readTeams(tenantId: string): any[] {
  const file = path.join(DATA_DIR, `${tenantId}.json`);
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.teams) ? parsed.teams : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ detail: 'Authorization مطلوب' }, { status: 401 });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ detail: 'Token غير صالح أو منتهي' }, { status: 401 });
  }

  const tenantId = String(payload.tenant_id || '');
  const employeeNo = String(payload.employee_no || '');

  if (!tenantId || !employeeNo) {
    return NextResponse.json({ teams: [] });
  }

  const allTeams = readTeams(tenantId);

  // Filter teams where this employee is a member
  const myTeams = allTeams.filter((team: any) =>
    Array.isArray(team.members) &&
    team.members.some(
      (m: any) =>
        m.employeeNumber === employeeNo ||
        m.employeeNumber === employeeNo.toUpperCase() ||
        String(m.empId) === employeeNo
    )
  ).map((team: any) => ({
    id: team.id,
    name: team.name,
    specialization: team.specialization,
    updatedAt: team.updatedAt,
    members: team.members,
  }));

  return NextResponse.json({ teams: myTeams });
}
