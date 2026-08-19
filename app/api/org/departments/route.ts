/**
 * /api/org/departments
 * GET  → قائمة الإدارات والأقسام مع مدرائها المعينين
 * POST → إنشاء إدارة جديدة
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

const DB_CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'digital',
  password: process.env.DB_PASSWORD || 'DigitalPass2026!',
  database: process.env.DB_NAME || 'digital_employees',
};

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'user.review');
  if (auth instanceof NextResponse) return auth;
  const tenantId = auth.tenantId.trim();
  if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const orgRoles = readOrgRoles();

  // Read local sections from org-sections.json
  const ORG_SECTIONS_FILE = path.join(process.cwd(), '.data', 'org-sections.json');
  let localSections: any[] = [];
  try {
    if (fs.existsSync(ORG_SECTIONS_FILE)) {
      localSections = JSON.parse(fs.readFileSync(ORG_SECTIONS_FILE, 'utf8')).sections ?? [];
    }
  } catch { /* ignore */ }

  let departments: any[] = [];
  let sections:    any[] = [];

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ ...DB_CFG, max: 1, idleTimeoutMillis: 3000 });
    try {
      // Departments
      const deptRes = await pool.query(`
        SELECT id::text, code, name_ar, COALESCE(name_ar, code) AS name_en, status
        FROM workspace.departments
        WHERE tenant_id = $1 AND (parent_id IS NULL OR parent_id = 0)
        ORDER BY name_ar
      `, [tenantId]);
      departments = deptRes.rows.map((d: any) => {
        const mgr = orgRoles.find((r: any) => r.org_role === 'dept_manager' && r.department_code === d.code);
        return {
          id: String(d.id), code: d.code || '', name_ar: d.name_ar || '',
          name_en: d.name_en || d.name_ar || '',
          dept_manager_employee_no: mgr?.employee_no ?? null,
          dept_manager_name:        mgr?.full_name   ?? null,
          is_active: d.status === 'active',
        };
      });

      // Sections from admin_core.sections (primary source)
      const sectRes = await pool.query(`
        SELECT s.id::text AS id, s.section_code AS code,
          COALESCE(s.section_name_ar, s.section_name) AS name_ar,
          s.section_name AS name_en,
          s.department_id::text AS department_id, s.is_active
        FROM admin_core.sections s
        WHERE s.tenant_id = $1 AND s.is_active = true
        ORDER BY s.section_name_ar NULLS LAST
      `, [tenantId]);
      // Also legacy: workspace.departments with parent_id
      const subRes = await pool.query(`
        SELECT id::text, code, name_ar, parent_id::text AS department_id, status
        FROM workspace.departments WHERE tenant_id = $1 AND parent_id IS NOT NULL AND parent_id::text != '0'
        ORDER BY name_ar
      `, [tenantId]);

      const adminSections = sectRes.rows.map((s: any) => {
        const mgr = orgRoles.find((r: any) => r.org_role === 'section_manager' && r.section_id === s.id);
        return {
          id: s.id, code: s.code || '', name_ar: s.name_ar || '', name_en: s.name_en || s.name_ar || '',
          department_id: s.department_id, department_code: null,
          section_manager_employee_no: mgr?.employee_no ?? null, section_manager_name: mgr?.full_name ?? null,
          is_active: s.is_active ?? true, source: 'admin_core',
        };
      });
      const workspaceSections = subRes.rows.map((s: any) => {
        const mgr = orgRoles.find((r: any) => r.org_role === 'section_manager' && r.section_id === s.id);
        return {
          id: s.id, code: s.code || '', name_ar: s.name_ar || '', name_en: s.name_ar || '',
          department_id: s.department_id, department_code: null,
          section_manager_employee_no: mgr?.employee_no ?? null, section_manager_name: mgr?.full_name ?? null,
          is_active: s.status === 'active', source: 'workspace',
        };
      });
      // Add local JSON sections (created via org-structure page)
      const jsonSections = localSections.map((s: any) => {
        const mgr = orgRoles.find((r: any) => r.org_role === 'section_manager' && r.section_id === s.id);
        return {
          id: s.id, code: s.code || '', name_ar: s.name_ar || '', name_en: s.name_en || s.name_ar || '',
          department_id: s.department_id, department_code: s.department_code || null,
          section_manager_employee_no: mgr?.employee_no ?? null, section_manager_name: mgr?.full_name ?? null,
          is_active: s.is_active ?? true, source: 'local',
        };
      });
      // Merge: prefer DB sources, add local ones not in DB
      const dbIds = new Set([...adminSections, ...workspaceSections].map((s: any) => s.code));
      const uniqueJson = jsonSections.filter((s: any) => !dbIds.has(s.code));
      sections = [...adminSections, ...workspaceSections, ...uniqueJson];

    } finally { await pool.end(); }
  } catch (err) {
    return NextResponse.json({ departments: [], sections: [], error: 'DB unavailable' });
  }
  return NextResponse.json({ departments, sections });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'user.invite');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { name_ar, name_en, code } = body;
  if (!name_ar || !code) return NextResponse.json({ error: 'name_ar و code مطلوبان' }, { status: 400 });

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ ...DB_CFG, max: 1, idleTimeoutMillis: 3000 });
    try {
      const res = await pool.query(
        `INSERT INTO workspace.departments (name_ar, code, status, tenant_id)
         VALUES ($1, $2, 'active', $3) RETURNING id, code, name_ar`,
        [name_ar, code.toUpperCase(), auth.tenantId]
      );
      return NextResponse.json({ success: true, department: res.rows[0] });
    } finally { await pool.end(); }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
