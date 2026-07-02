import { NextRequest, NextResponse } from 'next/server';
import { getTenantByCode } from '@/lib/tenant-store';
import { buildEmployeeUsername, findByUsername, verifyPassword } from '@/lib/user-store';
import { makeAuthToken } from '@/lib/auth-tokens';
import { buildMobileAttemptKey, getMobileLockState, registerFailedMobileLogin, clearMobileLoginFailures } from '@/lib/mobile-login-attempts';
import fs from 'fs';
import path from 'path';

const TEAMS_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
const DEFAULT_TENANT_UUID = 'aaaaaaaa-0000-4000-a000-000000000001';

function getCorrosionTeamForEmployee(tenantId: string, employeeNo: string): { teamName: string; teamId: string } | null {
  try {
    const file = path.join(TEAMS_DIR, `${tenantId}.json`);
    if (!fs.existsSync(file)) return null;
    const { teams } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(teams)) return null;
    for (const team of teams) {
      if (Array.isArray(team.members)) {
        const found = team.members.some((m: { employeeNumber?: string; empId?: number | string }) =>
          m.employeeNumber === employeeNo ||
          m.employeeNumber === employeeNo.toUpperCase() ||
          String(m.empId) === employeeNo
        );
        if (found) return { teamName: team.name, teamId: team.id };
      }
    }
    return null;
  } catch { return null; }
}

async function getMonitoringTeamsForEmployee(
  tenantId: string, employeeNo: string
): Promise<{ is_monitor: boolean; teams: Array<{ id: string; station_id: string; station_name: string; zone: string; shift: string; member_role: string }> }> {
  try {
    // Use UUID tenant - fall back to default if tenantId is not a valid UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tenantUUID = UUID_RE.test(tenantId) ? tenantId : DEFAULT_TENANT_UUID;
    const res = await fetch(
      `${B}/api/v1/ctrl/monitoring-teams/by-employee?employee_no=${encodeURIComponent(employeeNo)}`,
      {
        headers: { 'X-Tenant-ID': tenantUUID },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (res.ok) {
      const d = await res.json();
      return { is_monitor: d.is_monitor ?? false, teams: d.teams ?? [] };
    }
  } catch { /* ignore */ }
  return { is_monitor: false, teams: [] };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tenantCode = String(body.tenant_code || '').trim().toUpperCase();
  const employeeNo = String(body.employee_no || '').trim().toUpperCase();
  const secret     = String(body.secret     || '').trim();

  if (!tenantCode || !employeeNo || !secret) {
    return NextResponse.json({ detail: 'tenant_code و employee_no و secret مطلوبة' }, { status: 400 });
  }

  const tenant = getTenantByCode(tenantCode);
  if (!tenant) {
    return NextResponse.json({ detail: 'كود المؤسسة غير صحيح' }, { status: 401 });
  }

  const attemptKey = buildMobileAttemptKey(tenant.id, employeeNo);
  const lock = getMobileLockState(attemptKey);
  if (lock.locked) {
    return NextResponse.json(
      { detail: `الحساب مقفل مؤقتاً. حاول بعد ${lock.retryAfterSec} ثانية.` },
      { status: 429 }
    );
  }

  const username = buildEmployeeUsername(tenantCode, employeeNo);
  const user = findByUsername(username);

  if (!user || user.tenant_id !== tenant.id) {
    registerFailedMobileLogin(attemptKey);
    return NextResponse.json({ detail: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  if (!verifyPassword(secret, user.hashed_password || user.password_hash || '', user.password_salt || '')) {
    const result = registerFailedMobileLogin(attemptKey);
    const msg = result.locked
      ? `كلمة المرور خاطئة. الحساب مقفل لمدة ${result.retryAfterSec} ثانية.`
      : 'كلمة المرور غير صحيحة';
    return NextResponse.json({ detail: msg }, { status: 401 });
  }

  clearMobileLoginFailures(attemptKey);

  const corrosionTeam = getCorrosionTeamForEmployee(tenant.id, employeeNo);
  const monitoring    = await getMonitoringTeamsForEmployee(tenant.id, employeeNo);

  const token = makeAuthToken(user.email, user.role, {
    tenant_id:   tenant.id,
    tenant_code: tenant.code,
    employee_no: employeeNo,
    dept_code:   user.department_code || '',
    full_name:   user.full_name || '',
  });

  // Build mobile tabs based on team assignments
  const tabs: string[] = ['home'];
  if (monitoring.is_monitor) tabs.push('monitoring');
  if (corrosionTeam)         tabs.push('my_team');
  tabs.push('tasks', 'profile');

  return NextResponse.json({
    ok: true,
    token,
    role:              user.role,
    full_name:         user.full_name || '',
    organization_name: tenant.name,
    department_code:   user.department_code || '',
    tenant_code:       tenant.code,
    // Corrosion field team info
    has_corrosion_team:  corrosionTeam !== null,
    corrosion_team_name: corrosionTeam?.teamName ?? null,
    corrosion_team_id:   corrosionTeam?.teamId ?? null,
    // Monitoring team info (فرق الرصد الميداني)
    has_monitoring_team:    monitoring.is_monitor,
    monitoring_teams:       monitoring.teams,
    monitoring_team_count:  monitoring.teams.length,
    // Primary monitoring team (first active team)
    monitoring_team_id:     monitoring.teams[0]?.id ?? null,
    monitoring_station_id:  monitoring.teams[0]?.station_id ?? null,
    monitoring_station:     monitoring.teams[0]?.station_name ?? null,
    monitoring_shift:       monitoring.teams[0]?.shift ?? null,
    monitoring_role:        monitoring.teams[0]?.member_role ?? null,
    // Mobile tab configuration
    mobile_tabs: tabs,
  });
}
