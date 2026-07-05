import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { findByUsername, buildEmployeeUsername } from '@/lib/user-store';
import { getTenantByCode } from '@/lib/tenant-store';
import fs from 'fs';
import path from 'path';

const TEAMS_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');

function getCorrosionTeam(tenantId: string, employeeNo: string) {
  try {
    const file = path.join(TEAMS_DIR, `${tenantId}.json`);
    if (!fs.existsSync(file)) return null;
    const { teams } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(teams)) return null;
    for (const team of teams) {
      if (Array.isArray(team.members) && team.members.some((m: any) =>
        (m.employeeNumber || '').toUpperCase() === employeeNo.toUpperCase() ||
        String(m.empId) === employeeNo
      )) {
        return { team_id: team.id, team_name: team.name, specialization: team.specialization };
      }
    }
    return null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const tenantCode = (req.headers.get('x-verified-tenant-code') ?? '').trim();
  // Use the employee_no from JWT (set by middleware as x-verified-employee-no)
  const employeeNo = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase()
    || (req.headers.get('x-verified-email') ?? '').replace(/@.*$/, '').split('_').slice(1).join('_').toUpperCase();

  const email    = req.headers.get('x-verified-email') ?? '';
  const username = buildEmployeeUsername(tenantCode, employeeNo);
  const user     = findByUsername(username) ?? findByUsername(email.replace(/@.*$/, ''));

  const tenant = getTenantByCode(tenantCode);

  const corrosionTeam = getCorrosionTeam(auth.tenantId, employeeNo);

  return NextResponse.json({
    ok: true,
    employee_no:       employeeNo || user?.username?.split('.').pop() || '',
    full_name:         user?.full_name || req.headers.get('x-verified-full-name') || '',
    email:             user?.email || email,
    role:              auth.role,
    department_code:   auth.departmentCode || user?.department_code || '',
    tenant_code:       auth.tenantCode || tenantCode,
    organization_name: tenant?.name || '',
    // Corrosion field team info — mobile app shows team tab if present
    has_corrosion_team: corrosionTeam !== null,
    corrosion_team_name: corrosionTeam?.team_name ?? null,
    corrosion_team_id:   corrosionTeam?.team_id ?? null,
    mobile_tabs: corrosionTeam
      ? ['home', 'my_team', 'tasks', 'profile']
      : ['home', 'tasks', 'profile'],
  });
}
