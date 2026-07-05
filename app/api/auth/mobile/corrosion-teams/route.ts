/**
 * /api/auth/mobile/corrosion-teams
 * GET → Dedicated endpoint for مكافحة التآكل (Corrosion Management) field teams.
 *
 * ISOLATION: This endpoint ONLY returns corrosion field teams.
 * Control center teams use /api/auth/mobile/monitoring — no overlap.
 *
 * Auth: Bearer token via middleware (x-verified-* headers)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize }                  from '@/lib/authorize';
import { STATION_PRESETS }            from '@/lib/mobile-field-store';
import fs   from 'fs';
import path from 'path';

const DATA_DIR      = path.join(process.cwd(), '.data', 'corrosion-field-teams');
const BACKEND       = process.env.BACKEND_URL ?? 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

function resolveEmpNo(req: NextRequest): string {
  const h = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (h) return h;
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

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
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const empNo    = resolveEmpNo(req);
  const allTeams = readTeams(auth.tenantId);
  const preset   = STATION_PRESETS['corrosion_field'];

  const myTeams = allTeams
    .filter((team: any) =>
      Array.isArray(team.members) &&
      team.members.some((m: any) =>
        (m.employeeNumber || '').toUpperCase() === empNo ||
        String(m.empId) === empNo
      )
    )
    .map((team: any) => {
      const myMember = team.members.find((m: any) =>
        (m.employeeNumber || '').toUpperCase() === empNo || String(m.empId) === empNo
      );
      return {
        id:             team.id,
        team_name:      team.name,
        name:           team.name,
        specialization: team.specialization,
        station_type:   'corrosion_field',
        dept:           'corrosion',
        member_role:    myMember?.role || 'فني',
        members: team.members.map((m: any) => ({
          name: m.name, role: m.role,
          employeeNumber: m.employeeNumber, phone: m.phone,
        })),
        field_groups: preset?.field_groups ?? [],
        updatedAt: team.updatedAt,
        source: 'corrosion_field',
      };
    });

  const workOrders: any[] = [];
  for (const team of myTeams) {
    const orders = await fetchWorkOrders(auth.tenantId, team.team_name);
    for (const wo of orders) {
      workOrders.push({ ...wo, _team_name: team.team_name, _team_id: team.id });
    }
  }

  return NextResponse.json({
    ok:          true,
    has_team:    myTeams.length > 0,
    dept:        'corrosion',
    teams:       myTeams,
    team:        myTeams[0] ?? null,
    work_orders: workOrders,
  });
}