import { NextRequest, NextResponse } from 'next/server';

const DB_CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'digital',
  password: process.env.DB_PASSWORD || 'DigitalPass2026!',
  database: process.env.DB_NAME || 'digital_employees',
};

export async function GET(_req: NextRequest) {
  let departments: Array<{ id: string; code: string; name_ar: string }> = [];
  let employees: Array<{ employee_no: string; name_ar: string }> = [];

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ ...DB_CFG, max: 1, idleTimeoutMillis: 3000 });
    try {
      const deptRes = await pool.query(`
        SELECT id::text, code, COALESCE(name_ar, code) AS name_ar
        FROM workspace.departments
        WHERE (parent_id IS NULL OR parent_id = 0)
        ORDER BY name_ar
      `);
      departments = deptRes.rows.map((r: any) => ({
        id: String(r.id || ''),
        code: String(r.code || '').trim().toUpperCase(),
        name_ar: String(r.name_ar || '').trim(),
      }));

      const empRes = await pool.query(`
        SELECT e.employee_number AS employee_no,
               TRIM(COALESCE(e.first_name_ar, '') || ' ' || COALESCE(e.last_name_ar, '')) AS name_ar
        FROM hr_core.employees e
        WHERE e.employee_number IS NOT NULL AND e.employee_number <> ''
        ORDER BY e.employee_number
        LIMIT 1000
      `);
      employees = empRes.rows.map((r: any) => ({
        employee_no: String(r.employee_no || '').trim(),
        name_ar: String(r.name_ar || '').trim() || String(r.employee_no || '').trim(),
      }));
    } finally {
      await pool.end();
    }
  } catch {
    // Keep graceful fallback to empty lists when DB is unavailable.
  }

  return NextResponse.json({
    departments,
    employees,
    source: 'training_catalog_db',
  });
}
