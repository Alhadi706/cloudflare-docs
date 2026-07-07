/**
 * /api/org/section-heads
 * GET  → قائمة التعيينات الحالية
 * POST → تعيين / إزالة مسؤول
 *
 * actions:
 *   assign_role  — يعيّن الموظف كمدير ويُحدث users.json (حساب الموبايل)
 *   remove_role  — يُزيل الدور
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { buildEmployeeUsername, findByUsername, upsertEmployeeCredentialUser } from '@/lib/user-store';
import fs from 'fs';
import path from 'path';

const ORG_ROLES_FILE = path.join(process.cwd(), '.data', 'org-roles.json');

type OrgRole = {
  employee_no:     string;
  full_name:       string;
  org_role:        string;    // 'dept_manager' | 'section_manager' | 'supervisor'
  department_code: string;
  section_id:      string | null;
  assigned_by:     string;
  assigned_at:     string;
};

function readRoles(): OrgRole[] {
  try {
    if (!fs.existsSync(ORG_ROLES_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORG_ROLES_FILE, 'utf8')).roles ?? [];
  } catch { return []; }
}

function writeRoles(roles: OrgRole[]) {
  fs.mkdirSync(path.dirname(ORG_ROLES_FILE), { recursive: true });
  const tmp = ORG_ROLES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ roles }, null, 2), 'utf8');
  fs.renameSync(tmp, ORG_ROLES_FILE);
}

const VALID_ORG_ROLES = ['dept_manager', 'section_manager', 'supervisor'];
const DB_CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'digital',
  password: process.env.DB_PASSWORD || 'DigitalPass2026!',
  database: process.env.DB_NAME || 'digital_employees',
};

/** Update workspace.departments.manager_id for this employee */
async function syncDeptManagerInDB(deptCode: string, employeeNo: string | null) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ ...DB_CFG, max: 1, idleTimeoutMillis: 3000 });
    try {
      if (employeeNo) {
        // Find employee's HR id
        const eRes = await pool.query(
          `SELECT id FROM hr_core.employees WHERE employee_number = $1 LIMIT 1`, [employeeNo]
        );
        const hrId = eRes.rows[0]?.id ?? null;
        if (hrId) {
          await pool.query(
            `UPDATE workspace.departments SET manager_id=$1 WHERE code=$2`, [hrId, deptCode]
          );
        }
      } else {
        await pool.query(`UPDATE workspace.departments SET manager_id=NULL WHERE code=$1`, [deptCode]);
      }
    } finally { await pool.end(); }
  } catch { /* non-blocking */ }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'user.review');
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ roles: readRoles() });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'user.invite');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').toLowerCase();

  // ── Remove role ──────────────────────────────────────────────────────────
  if (action === 'remove_role') {
    const { employee_no, department_code } = body;
    if (!employee_no) return NextResponse.json({ error: 'employee_no مطلوب' }, { status: 400 });

    const roles = readRoles();
    const removed = roles.find(r => r.employee_no === employee_no && r.department_code === department_code);
    const updated = roles.filter(r => !(r.employee_no === employee_no && r.department_code === department_code));
    writeRoles(updated);

    // Remove manager from DB
    if (department_code) void syncDeptManagerInDB(department_code, null);

    // Downgrade mobile role to employee
    const tenantCode = auth.tenantCode || 'INFRA_OPS';
    const username = buildEmployeeUsername(tenantCode, employee_no);
    const user = findByUsername(username);
    if (user) {
      upsertEmployeeCredentialUser({
        tenant_id: auth.tenantId, tenant_code: tenantCode,
        employee_no, full_name: user.full_name || removed?.full_name || '',
        department_code: body.department_code || '',
        password_hash: user.hashed_password || user.password_hash || '',
        password_salt: user.password_salt || '',
        mobile_role: 'employee',
      });
    }

    return NextResponse.json({ ok: true, action: 'removed', employee_no });
  }

  // ── Assign role ──────────────────────────────────────────────────────────
  if (action === 'assign_role') {
    const { employee_no, full_name, org_role, department_code, section_id } = body;
    if (!employee_no || !org_role || !department_code) {
      return NextResponse.json({ error: 'employee_no و org_role و department_code مطلوبة' }, { status: 400 });
    }
    if (!VALID_ORG_ROLES.includes(org_role)) {
      return NextResponse.json({ error: `org_role يجب أن يكون: ${VALID_ORG_ROLES.join(', ')}` }, { status: 400 });
    }

    const roles = readRoles();

    // Remove any previous same role in same dept
    const filtered = roles.filter(r => !(r.org_role === org_role && r.department_code === department_code && r.section_id === (section_id ?? null)));

    // If same employee already has a different role in this dept, remove it too
    const deduped = filtered.filter(r => !(r.employee_no === employee_no && r.department_code === department_code));

    const newRole: OrgRole = {
      employee_no,
      full_name:       full_name || employee_no,
      org_role,
      department_code,
      section_id:      section_id ?? null,
      assigned_by:     auth.email || auth.role,
      assigned_at:     new Date().toISOString(),
    };
    deduped.push(newRole);
    writeRoles(deduped);

    // Update DB manager_id for dept_manager assignments
    if (org_role === 'dept_manager') {
      void syncDeptManagerInDB(department_code, employee_no);
    }

    // Update mobile role in users.json
    const tenantCode = auth.tenantCode || 'INFRA_OPS';
    const username   = buildEmployeeUsername(tenantCode, employee_no);
    const user       = findByUsername(username);

    if (user) {
      // User has mobile account — upgrade their role
      upsertEmployeeCredentialUser({
        tenant_id:       auth.tenantId,
        tenant_code:     tenantCode,
        employee_no,
        full_name:       full_name || user.full_name || '',
        department_code: department_code,
        password_hash:   user.hashed_password || user.password_hash || '',
        password_salt:   user.password_salt || '',
        mobile_role:     org_role,
      });
      return NextResponse.json({
        ok: true,
        message: `✓ تم تعيين ${full_name || employee_no} كـ ${org_role} وتحديث صلاحيات الموبايل`,
        mobile_updated: true,
        role: newRole,
      });
    } else {
      // No mobile account yet — role will be picked up automatically at next login via HR lookup
      return NextResponse.json({
        ok: true,
        message: `✓ تم تعيين ${full_name || employee_no} — لا يوجد حساب موبايل بعد. عند تسجيله سيحصل على الصلاحية تلقائياً.`,
        mobile_updated: false,
        needs_mobile_account: true,
        role: newRole,
      });
    }
  }

  // ── Create section (used by org-structure page) ─────────────────────────
  // ── Create section (stored in JSON file to avoid DB FK constraints) ────
  if (action === 'create_section' || (!action && body.name_ar && body.department_id)) {
    const { name_ar, name_en, code, department_id, department_code } = body;
    if (!name_ar || !code) return NextResponse.json({ error: 'name_ar و code مطلوبان' }, { status: 400 });

    const ORG_SECTIONS_FILE = path.join(process.cwd(), '.data', 'org-sections.json');
    function readSections(): any[] {
      try {
        if (!fs.existsSync(ORG_SECTIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(ORG_SECTIONS_FILE, 'utf8')).sections ?? [];
      } catch { return []; }
    }
    function writeSections(sections: any[]) {
      fs.mkdirSync(path.dirname(ORG_SECTIONS_FILE), { recursive: true });
      const tmp = ORG_SECTIONS_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ sections }, null, 2), 'utf8');
      fs.renameSync(tmp, ORG_SECTIONS_FILE);
    }

    const sections = readSections();
    const existing = sections.find((s: any) => s.code === code.toUpperCase());
    if (existing) {
      return NextResponse.json({ ok: true, message: 'القسم موجود', id: existing.id, code, name_ar });
    }
    const newSection = {
      id: `sect-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      code: code.toUpperCase(),
      name_ar, name_en: name_en || name_ar,
      department_id: department_id || null,
      department_code: department_code || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    sections.push(newSection);
    writeSections(sections);
    return NextResponse.json({ ok: true, id: newSection.id, code: newSection.code, name_ar });
  }


  return NextResponse.json({ error: `action غير معروف: ${action}. المتاح: assign_role, remove_role, create_section` }, { status: 400 });
}
