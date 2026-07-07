import { NextRequest, NextResponse } from 'next/server';
import { getTenantByCode } from '@/lib/tenant-store';
import { buildEmployeeUsername, findByUsername, verifyPassword, upsertEmployeeCredentialUser } from '@/lib/user-store';
import { makeAuthToken } from '@/lib/auth-tokens';
import { buildMobileAttemptKey, getMobileLockState, registerFailedMobileLogin, clearMobileLoginFailures } from '@/lib/mobile-login-attempts';
import fs from 'fs';
import path from 'path';

const TEAMS_DIR      = path.join(process.cwd(), '.data', 'corrosion-field-teams');
const CTRL_TEAMS_DIR = path.join(process.cwd(), '.data', 'mobile-field');

// Role hierarchy for auto-upgrade (higher index = higher privilege)
const ROLE_LEVEL: Record<string, number> = {
  employee: 0, corrosion_field: 0, member: 0,
  supervisor: 1,
  section_manager: 2,
  dept_manager: 3,
  admin: 4, founder: 5,
};
function higherRole(a: string, b: string): string {
  return (ROLE_LEVEL[a] ?? 0) >= (ROLE_LEVEL[b] ?? 0) ? a : b;
}

/** Auto-detect management role from HR database */
async function detectHrRole(employeeNo: string): Promise<string | null> {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      user: process.env.DB_USER || 'digital',
      password: process.env.DB_PASSWORD || 'DigitalPass2026!',
      database: process.env.DB_NAME || 'digital_employees',
      max: 1, idleTimeoutMillis: 3000,
    });
    try {
      // 1. Check if they are a department manager
      const r1 = await pool.query(
        `SELECT 1 FROM hr_core.departments d
         JOIN hr_core.employees e ON e.id = d.manager_id
         WHERE e.employee_number = $1 AND d.is_active = true
         LIMIT 1`,
        [employeeNo]
      );
      if (r1.rows.length > 0) { await pool.end(); return 'dept_manager'; }

      // 2. Check if they hold a management position (position name contains مدير/رئيس)
      const r2 = await pool.query(
        `SELECT p.position_name_ar FROM hr_core.position_assignments pa
         JOIN hr_core.positions p ON p.id = pa.position_id
         JOIN hr_core.employees e ON e.id = pa.employee_id
         WHERE e.employee_number = $1 AND pa.status = 'active' LIMIT 1`,
        [employeeNo]
      );
      if (r2.rows.length > 0) {
        const posName = String(r2.rows[0].position_name_ar || '');
        if (/مدير\s*إدارة|مدير\s*عام/.test(posName)) { await pool.end(); return 'dept_manager'; }
        if (/رئيس\s*قسم|مدير\s*قسم/.test(posName))    { await pool.end(); return 'section_manager'; }
        if (/مشرف|مسؤول/.test(posName))               { await pool.end(); return 'supervisor'; }
      }
    } finally { await pool.end(); }
  } catch { /* DB unreachable — no auto-upgrade */ }
  return null;
}

function getCorrosionTeamForEmployee(tenantId: string, employeeNo: string): { teamName: string; teamId: string } | null {
  try {
    const file = path.join(TEAMS_DIR, `${tenantId}.json`);
    if (!fs.existsSync(file)) return null;
    const { teams } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(teams)) return null;
    for (const team of teams) {
      if (Array.isArray(team.members)) {
        const found = team.members.some((m: any) =>
          m.employeeNumber === employeeNo || m.employeeNumber === employeeNo.toUpperCase() || String(m.empId) === employeeNo
        );
        if (found) return { teamName: team.name, teamId: team.id };
      }
    }
    return null;
  } catch { return null; }
}

function getCtrlTeamForEmployee(tenantId: string, employeeNo: string): { teamName: string; teamId: string } | null {
  try {
    const file = path.join(CTRL_TEAMS_DIR, `monitoring_teams_${tenantId}.json`);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const teams = Array.isArray(data) ? data : (data.teams ?? []);
    for (const team of teams) {
      const inMembers     = (team.member_employee_nos     ?? []).includes(employeeNo);
      const inSupervisors = (team.supervisor_employee_nos ?? []).includes(employeeNo);
      if (inMembers || inSupervisors) return { teamName: team.team_name || team.name || 'فريق', teamId: team.id };
    }
    return null;
  } catch { return null; }
}

const MANAGER_ROLES = ['dept_manager', 'section_manager', 'admin', 'founder'];
const SUPERVISOR_ROLES = ['supervisor', 'dept_manager', 'section_manager', 'admin', 'founder'];

export async function POST(req: NextRequest) {
  const body       = await req.json().catch(() => ({}));
  const tenantCode = String(body.tenant_code || '').trim().toUpperCase();
  const employeeNo = String(body.employee_no || '').trim().toUpperCase();
  const secret     = String(body.secret      || '').trim();

  if (!tenantCode || !employeeNo || !secret) {
    return NextResponse.json({ detail: 'tenant_code و employee_no و secret مطلوبة' }, { status: 400 });
  }

  const tenant = getTenantByCode(tenantCode);
  if (!tenant) return NextResponse.json({ detail: 'كود المؤسسة غير صحيح' }, { status: 401 });

  const attemptKey = buildMobileAttemptKey(tenant.id, employeeNo);
  const lock = getMobileLockState(attemptKey);
  if (lock.locked) return NextResponse.json({ detail: `الحساب مقفل مؤقتاً. حاول بعد ${lock.retryAfterSec} ثانية.` }, { status: 429 });

  const username = buildEmployeeUsername(tenantCode, employeeNo);
  const user = findByUsername(username);
  if (!user || user.tenant_id !== tenant.id) {
    registerFailedMobileLogin(attemptKey);
    return NextResponse.json({ detail: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  if (!verifyPassword(secret, user.hashed_password || user.password_hash || '', user.password_salt || '')) {
    const result = registerFailedMobileLogin(attemptKey);
    return NextResponse.json({ detail: result.locked ? `كلمة المرور خاطئة. الحساب مقفل لمدة ${result.retryAfterSec} ثانية.` : 'كلمة المرور غير صحيحة' }, { status: 401 });
  }

  clearMobileLoginFailures(attemptKey);

  // Auto-detect role from HR (if higher than stored role)
  const storedRole = user.role || 'employee';
  const hrRole     = await detectHrRole(employeeNo);
  const role       = hrRole ? higherRole(storedRole, hrRole) : storedRole;

  // If HR upgraded the role, persist the upgrade so it's used on next login
  if (hrRole && hrRole !== storedRole && ROLE_LEVEL[hrRole] > ROLE_LEVEL[storedRole]) {
    try {
      upsertEmployeeCredentialUser({
        tenant_id: tenant.id, tenant_code: tenant.code,
        employee_no: employeeNo, full_name: user.full_name || '',
        department_code: user.department_code || '',
        password_hash: user.hashed_password || user.password_hash || '',
        password_salt: user.password_salt || '',
        mobile_role: hrRole,
      });
    } catch { /* non-blocking */ }
  }

  const corrosionTeam = getCorrosionTeamForEmployee(tenant.id, employeeNo);
  const ctrlTeam      = getCtrlTeamForEmployee(tenant.id, employeeNo);

  // Build dept_tabs
  const deptTabs: Array<{ dept: string; label: string; api: string; tab_key: string }> = [];

  // Manager tabs (always shown for managers regardless of team assignment)
  if (MANAGER_ROLES.includes(role)) {
    deptTabs.push({
      dept: 'management', label: 'لوحة القيادة',
      api: '/api/auth/mobile/manager', tab_key: 'dept_board',
    });
    deptTabs.push({
      dept: 'management', label: 'إدارة الفريق',
      api: '/api/auth/mobile/manager/team', tab_key: 'team_mgmt',
    });
  } else if (SUPERVISOR_ROLES.includes(role)) {
    deptTabs.push({
      dept: 'management', label: 'فريقي',
      api: '/api/auth/mobile/manager/team', tab_key: 'team_mgmt',
    });
  }

  // Department-specific tabs (ctrl / corrosion)
  if (ctrlTeam) {
    deptTabs.push({
      dept: 'control_center', label: `راصد — ${ctrlTeam.teamName}`,
      api: '/api/auth/mobile/monitoring', tab_key: 'ctrl_monitoring',
    });
  }
  if (corrosionTeam) {
    deptTabs.push({
      dept: 'corrosion', label: `فريقي — ${corrosionTeam.teamName}`,
      api: '/api/auth/mobile/corrosion-teams', tab_key: 'corrosion_team',
    });
  }

  const token = makeAuthToken(user.email, role, {
    tenant_id:   tenant.id,
    tenant_code: tenant.code,
    employee_no: employeeNo,
    dept_code:   user.department_code || '',
    full_name:   user.full_name || '',
  });

  return NextResponse.json({
    ok: true, token, role,
    full_name:         user.full_name || '',
    organization_name: tenant.name,
    department_code:   user.department_code || '',
    tenant_code:       tenant.code,
    tenant_id:         tenant.id,
    employee_no:       employeeNo,
    is_manager:        MANAGER_ROLES.includes(role),
    is_supervisor:     SUPERVISOR_ROLES.includes(role),
    hr_role_detected:  hrRole,
    dept_tabs:         deptTabs,
    has_corrosion_team:  corrosionTeam !== null,
    corrosion_team_name: corrosionTeam?.teamName ?? null,
    corrosion_team_id:   corrosionTeam?.teamId  ?? null,
    mobile_tabs: deptTabs.length > 0
      ? ['home', ...deptTabs.map(d => d.tab_key), 'tasks', 'profile']
      : ['home', 'tasks', 'profile'],
  });
}

