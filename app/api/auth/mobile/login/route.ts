import { NextRequest, NextResponse } from 'next/server';
import { getTenantByCode } from '@/lib/tenant-store';
import { buildEmployeeUsername, findByUsername, verifyPassword } from '@/lib/user-store';
import { makeAuthToken } from '@/lib/auth-tokens';
import { buildMobileAttemptKey, getMobileLockState, registerFailedMobileLogin, clearMobileLoginFailures } from '@/lib/mobile-login-attempts';
import fs from 'fs';
import path from 'path';

const TEAMS_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');

function getCorrosionTeamForEmployee(tenantId: string, employeeNo: string): { teamName: string; teamId: string } | null {
  try {
    const file = path.join(TEAMS_DIR, `${tenantId}.json`);
    if (!fs.existsSync(file)) return null;
    const { teams } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(teams)) return null;
    for (const team of teams) {
      if (Array.isArray(team.members)) {
        const found = team.members.some((m: any) =>
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

  const token = makeAuthToken(user.email, user.role, {
    tenant_id:   tenant.id,
    tenant_code: tenant.code,
    employee_no: employeeNo,
    dept_code:   user.department_code || '',
    full_name:   user.full_name || '',
  });

  return NextResponse.json({
    ok: true,
    token,
    role:              user.role,
    full_name:         user.full_name || '',
    organization_name: tenant.name,
    department_code:   user.department_code || '',
    tenant_code:       tenant.code,
    // Corrosion field team info (if employee is assigned)
    has_corrosion_team: corrosionTeam !== null,
    corrosion_team_name: corrosionTeam?.teamName ?? null,
    corrosion_team_id:   corrosionTeam?.teamId ?? null,
    // Mobile tab hints based on team assignment
    mobile_tabs: corrosionTeam
      ? ['home', 'my_team', 'tasks', 'profile']
      : ['home', 'tasks', 'profile'],
  });
}
