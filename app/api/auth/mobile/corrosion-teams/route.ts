/**
 * /api/auth/mobile/corrosion-teams
 * GET → Returns the corrosion field team(s) and assigned work orders
 *       for the logged-in mobile employee.
 *       Called by the mobile app after login to show:
 *       - Team assignment tab (فريقي)
 *       - Assigned work orders (مهامي)
 *
 * Auth: Bearer {mobile_token} in Authorization header
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');
const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

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

async function fetchWorkOrders(tenantId: string, teamName: string): Promise<any[]> {
  try {
    const url = `${BACKEND}/api/v1/workflow/work-orders?tab=outbound_internal&dept=corrosion&assigned_team=${encodeURIComponent(teamName)}&limit=50`;
    const res = await fetch(url, {
      headers: { 'X-Tenant-ID': tenantId, 'X-Staff-Api-Key': STAFF_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.work_orders ?? data?.data ?? []);
  } catch { return []; }
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
    return NextResponse.json({ teams: [], work_orders: [], has_team: false });
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
    members: team.members.map((m: any) => ({
      name: m.name,
      role: m.role,
      employeeNumber: m.employeeNumber,
      phone: m.phone,
    })),
  }));

  // Fetch work orders assigned to this employee's teams
  const workOrders: any[] = [];
  for (const team of myTeams) {
    const orders = await fetchWorkOrders(tenantId, team.name);
    for (const wo of orders) {
      workOrders.push({ ...wo, _team_name: team.name, _team_id: team.id });
    }
  }

  return NextResponse.json({
    has_team: myTeams.length > 0,
    teams: myTeams,
    work_orders: workOrders,
    // Tab hint for mobile app: show "فريقي" tab if the employee has a team
    mobile_tabs: myTeams.length > 0 ? ['home', 'my_team', 'tasks', 'profile'] : ['home', 'tasks', 'profile'],
  });
}
