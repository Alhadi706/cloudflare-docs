/**
 * /api/org/employees
 * GET → قائمة الموظفين لاستخدامها في dropdown تعيين المدراء
 * يجمع بين hr_core.employees و users.json (حسابات الموبايل)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const ORG_ROLES_FILE = path.join(process.cwd(), '.data', 'org-roles.json');

function readOrgRoles(): any[] {
  try {
    if (!fs.existsSync(ORG_ROLES_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORG_ROLES_FILE, 'utf8')).roles ?? [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'user.review');
  if (auth instanceof NextResponse) return auth;

  const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    user: process.env.DB_USER || 'digital',
    password: process.env.DB_PASSWORD || 'DigitalPass2026!',
    database: process.env.DB_NAME || 'digital_employees',
  };

  let dbEmployees: any[] = [];
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ ...DB_CONFIG, max: 1, idleTimeoutMillis: 3000 });
    try {
      const res = await pool.query(`
        SELECT e.id, e.employee_number AS employee_no,
               (e.first_name_ar || ' ' || COALESCE(e.last_name_ar,'')) AS name_ar,
               NULL::text AS email, NULL::text AS phone, NULL::text AS position_title
        FROM hr_core.employees e
        WHERE e.employee_number IS NOT NULL AND e.employee_number != ''
        ORDER BY e.employee_number
        LIMIT 500
      `);
      dbEmployees = res.rows;
    } finally { await pool.end(); }
  } catch { /* fallback to mobile users */ }

  // Also include mobile users (users.json)
  let mobileUsers: any[] = [];
  try {
    const usersFile = path.join(process.cwd(), '.data', 'users.json');
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      mobileUsers = users
        .filter((u: any) => u.tenant_id === auth.tenantId)
        .map((u: any) => ({
          employee_no: u.username?.split('.').slice(2).join('.') || u.username,
          name_ar:     u.full_name || u.username,
          email:       u.email || null,
          phone:       null,
          position_title: null,
          has_mobile:  true,
        }));
    }
  } catch { /* ignore */ }

  // Merge: DB employees are primary, add mobile-only users
  const dbEmpNos = new Set(dbEmployees.map((e: any) => String(e.employee_no)));
  const uniqueMobile = mobileUsers.filter((u: any) => !dbEmpNos.has(String(u.employee_no)));
  const allEmployees = [...dbEmployees, ...uniqueMobile];

  // Attach current org roles
  const orgRoles = readOrgRoles();
  const employees = allEmployees.map((emp: any) => {
    const roles = orgRoles.filter((r: any) => r.employee_no === emp.employee_no);
    return {
      employee_no:    String(emp.employee_no || '').trim(),
      name_ar:        String(emp.name_ar || '').trim(),
      email:          emp.email,
      phone:          emp.phone,
      position:       emp.position_title,
      has_mobile:     mobileUsers.some((u: any) => u.employee_no === emp.employee_no),
      org_roles:      roles.map((r: any) => ({
        org_role:         r.org_role,
        department_code:  r.department_code,
        section_id:       r.section_id ?? null,
      })),
    };
  });

  return NextResponse.json({ employees, total: employees.length });
}
