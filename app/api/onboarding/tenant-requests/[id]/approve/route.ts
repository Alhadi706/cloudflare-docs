import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { verifyOwnerToken } from '@/lib/owner-auth';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

// ── هيكل الإدارات والأقسام الكامل ──────────────────────────────────────────
const DEPT_STRUCTURE = [
  {
    scope: 'corrosion',
    dept_code: 'CORR',
    name_ar: 'إدارة التآكل',
    sections: [
      { id: 'CORR-SEC-01', name_ar: 'قسم المراقبة الدورية والصيانة' },
      { id: 'CORR-SEC-02', name_ar: 'قسم الدعم الفني' },
      { id: 'CORR-SEC-03', name_ar: 'قسم المكونات الهندسية والطلاء' },
    ],
  },
  {
    scope: 'maintenance',
    dept_code: 'MAINT',
    name_ar: 'إدارة الهندسة والدعم الفني',
    sections: [
      { id: 'MAINT-SEC-01', name_ar: 'قسم تخطيط الصيانة' },
      { id: 'MAINT-SEC-02', name_ar: 'قسم مراقبة الآبار' },
      { id: 'MAINT-SEC-03', name_ar: 'قسم الدعم الفني' },
      { id: 'MAINT-SEC-04', name_ar: 'قسم مراقبة التشغيل' },
    ],
  },
  {
    scope: 'hr',
    dept_code: 'HR',
    name_ar: 'إدارة الموارد البشرية',
    sections: [
      { id: 'HR-SEC-01', name_ar: 'قسم شؤون المستخدمين' },
      { id: 'HR-SEC-02', name_ar: 'قسم التدريب والتطوير' },
      { id: 'HR-SEC-03', name_ar: 'قسم البيانات والإحصاء' },
      { id: 'HR-SEC-04', name_ar: 'قسم النظم والملاكات' },
    ],
  },
  {
    scope: 'finance',
    dept_code: 'FIN',
    name_ar: 'إدارة المالية',
    sections: [
      { id: 'FIN-SEC-01', name_ar: 'قسم الميزانيات' },
      { id: 'FIN-SEC-02', name_ar: 'قسم النفقات والتخصيصات' },
      { id: 'FIN-SEC-03', name_ar: 'قسم المحاسبة' },
      { id: 'FIN-SEC-04', name_ar: 'قسم التقارير المالية' },
    ],
  },
  {
    scope: 'materials',
    dept_code: 'ASSET',
    name_ar: 'إدارة المواد والأصول',
    sections: [
      { id: 'ASSET-SEC-01', name_ar: 'قسم سجل الأصول' },
      { id: 'ASSET-SEC-02', name_ar: 'قسم المخزون' },
      { id: 'ASSET-SEC-03', name_ar: 'قسم الأسطول والمركبات' },
      { id: 'ASSET-SEC-04', name_ar: 'قسم المشتريات' },
    ],
  },
  {
    scope: 'services',
    dept_code: 'IT',
    name_ar: 'إدارة الذكاء والخدمات',
    sections: [
      { id: 'IT-SEC-01', name_ar: 'قسم مركز الاستخبارات' },
      { id: 'IT-SEC-02', name_ar: 'قسم متابعة المشاريع' },
      { id: 'IT-SEC-03', name_ar: 'قسم التحليلات والتقارير' },
      { id: 'IT-SEC-04', name_ar: 'قسم دعم الأنظمة' },
    ],
  },
  {
    scope: 'remote-sensing',
    dept_code: 'GIS',
    name_ar: 'مركز الاستشعار عن بعد',
    sections: [
      { id: 'GIS-SEC-01', name_ar: 'قسم التحليل المكاني' },
      { id: 'GIS-SEC-02', name_ar: 'قسم الاستخبارات الفضائية' },
      { id: 'GIS-SEC-03', name_ar: 'قسم مساحة العمل الهندسية' },
      { id: 'GIS-SEC-04', name_ar: 'قسم التحقق الحقلي' },
    ],
  },
] as const;

function genPassword(len = 14): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  return Array.from(crypto.randomBytes(len))
    .map(b => chars[b % chars.length])
    .join('');
}

function hashPw(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha256').toString('hex');
}

async function insertUser(params: {
  tenantId: string; tenantCode: string;
  fullName: string; email: string; username: string;
  role: string; deptCode: string; sectionId?: string;
  tempPassword: string;
}): Promise<void> {
  const salt = crypto.randomBytes(32).toString('hex');
  const hashed = hashPw(params.tempPassword, salt);
  await pgPool.query(
    `INSERT INTO auth_users
      (id, full_name, email, tenant_id, tenant_code, role, status,
       username, hashed_password, password_salt, department_code,
       section_id, must_change_password, is_first_admin, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'verified',$7,$8,$9,$10,$11,true,false,$12)
     ON CONFLICT (email) DO NOTHING`,
    [
      randomUUID(), params.fullName, params.email,
      params.tenantId, params.tenantCode,
      params.role, params.username, hashed, salt,
      params.deptCode, params.sectionId ?? null, Date.now(),
    ]
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const requestId = params.id;

  try {
    // 1. جلب الطلب
    const { rows } = await pgPool.query(
      `SELECT * FROM auth_tenant_requests WHERE id = $1 LIMIT 1`,
      [requestId]
    );
    if (!rows.length) return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
    const request = rows[0];
    if (request.status !== 'pending') {
      return NextResponse.json({ detail: 'الطلب تمت معالجته مسبقاً' }, { status: 400 });
    }

    // 2. إنشاء كود المؤسسة
    const tenantId   = randomUUID();
    const shortCode  = Date.now().toString(36).toUpperCase().slice(-6);
    const tenantCode = `ORG-${shortCode}`;
    const activCode  = crypto.randomBytes(8).toString('hex').toUpperCase();
    const tcLower    = tenantCode.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 3. إنشاء المؤسسة
    await pgPool.query(
      `INSERT INTO auth_tenants
        (id, code, name, status, created_at, approved_at, approved_by, first_admin_email, enabled_departments)
       VALUES ($1,$2,$3,'active',$4,$4,$5,$6,$7)`,
      [tenantId, tenantCode, request.organization_name,
       Date.now(), claims.email, request.contact_email, JSON.stringify([])]
    );

    // 4. إنشاء المسؤول الأول (admin)
    const adminPw = genPassword();
    await insertUser({
      tenantId, tenantCode,
      fullName: request.contact_full_name,
      email: request.contact_email,
      username: `admin.${tcLower}`,
      role: 'admin',
      deptCode: 'HR',
      tempPassword: adminPw,
    });

    // 5. إنشاء مدراء الإدارات وأقسامهم
    const bundles = [];

    for (const dept of DEPT_STRUCTURE) {
      const deptPw = genPassword();
      const deptUsername = `mgr.${dept.dept_code.toLowerCase()}.${tcLower}`;
      const deptEmail = `mgr.${dept.scope}.${tcLower}@tenant.local`;

      await insertUser({
        tenantId, tenantCode,
        fullName: `مدير ${dept.name_ar}`,
        email: deptEmail,
        username: deptUsername,
        role: 'dept_manager',
        deptCode: dept.dept_code,
        tempPassword: deptPw,
      });

      const sections = [];
      for (const sec of dept.sections) {
        const secPw = genPassword();
        const secShort = sec.id.replace('-SEC-', '').replace('-', '').toLowerCase();
        const secUsername = `sec.${secShort}.${tcLower}`;
        const secEmail = `${secShort}.${tcLower}@tenant.local`;

        await insertUser({
          tenantId, tenantCode,
          fullName: `رئيس ${sec.name_ar}`,
          email: secEmail,
          username: secUsername,
          role: 'section_manager',
          deptCode: dept.dept_code,
          sectionId: sec.id,
          tempPassword: secPw,
        });

        sections.push({
          full_name: `رئيس ${sec.name_ar}`,
          role: 'section_manager' as const,
          department_code: dept.dept_code,
          section_id: sec.id,
          section_name: sec.name_ar,
          email: secEmail,
          username: secUsername,
          temp_password: secPw,
        });
      }

      bundles.push({
        scope: dept.scope,
        department_code: dept.dept_code,
        department_name: dept.name_ar,
        app_download_key: dept.scope,
        manager: {
          full_name: `مدير ${dept.name_ar}`,
          role: 'dept_manager' as const,
          department_code: dept.dept_code,
          email: deptEmail,
          username: deptUsername,
          temp_password: deptPw,
        },
        sections,
      });
    }

    // 6. تحديث الطلب
    await pgPool.query(
      `UPDATE auth_tenant_requests
       SET status='approved', reviewed_at=$1, reviewed_by=$2, tenant_id=$3, activation_code=$4
       WHERE id=$5`,
      [Date.now(), claims.email, tenantId, activCode, requestId]
    );

    return NextResponse.json({
      tenant: { code: tenantCode, name: request.organization_name, activation_code: activCode },
      first_admin: {
        email: request.contact_email,
        username: `admin.${tcLower}`,
        temp_password: adminPw,
      },
      provisioning_package: {
        generated_at: Date.now(),
        generated_by: claims.email,
        tenant_code: tenantCode,
        organization_name: request.organization_name,
        bundles,
      },
    });
  } catch (err) {
    console.error('[approve]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}
