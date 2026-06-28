import { authInviteUser } from '@/lib/auth-store-backend';
import type { DepartmentCode, UserRole } from '@/lib/user-store';

export interface ProvisionedCredential {
  full_name: string;
  role: UserRole;
  department_code: DepartmentCode;
  section_id?: string;
  section_name?: string;
  email: string;
  username: string;
  temp_password: string;
}

export interface ProvisionedDepartmentBundle {
  scope: string;
  department_code: DepartmentCode;
  department_name: string;
  app_download_key: string;
  manager: ProvisionedCredential;
  sections: ProvisionedCredential[];
}

export interface TenantProvisioningPackage {
  generated_at: number;
  generated_by: string;
  tenant_code: string;
  organization_name: string;
  bundles: ProvisionedDepartmentBundle[];
}

interface DepartmentTemplate {
  scope: string;
  department_code: DepartmentCode;
  department_name: string;
  app_download_key: string;
  sections: string[];
}

const DEPARTMENT_TEMPLATES: DepartmentTemplate[] = [
  {
    scope: 'corrosion',
    department_code: 'CORR',
    department_name: 'إدارة التآكل',
    app_download_key: 'dsf-corrosion-windows-x64.zip',
    sections: [
      'قسم المراقبة الدورية والصيانة',
      'قسم الدعم الفني',
      'قسم المكونات الهندسية والطلاء',
    ],
  },
  {
    scope: 'maintenance',
    department_code: 'MAINT',
    department_name: 'إدارة الصيانة',
    app_download_key: 'dsf-maintenance-windows-x64.zip',
    sections: [
      'قسم تخطيط الصيانة',
      'قسم مراقبة الآبار',
      'قسم الدعم الفني',
      'قسم مراقبة التشغيل',
    ],
  },
  {
    scope: 'admin-affairs',
    department_code: 'HR',
    department_name: 'الشؤون الإدارية',
    app_download_key: 'dsf-admin-affairs-windows-x64.zip',
    sections: [
      'قسم شؤون المستخدمين',
      'قسم التدريب',
      'قسم البيانات والإحصاء',
      'قسم النظم والملاكات',
    ],
  },
  {
    scope: 'finance',
    department_code: 'FIN',
    department_name: 'الإدارة المالية',
    app_download_key: 'dsf-finance-windows-x64.zip',
    sections: [
      'قسم الميزانيات',
      'قسم النفقات والتخصيصات',
      'قسم المحاسبة',
      'قسم التقارير المالية',
    ],
  },
  {
    scope: 'materials',
    department_code: 'ASSET',
    department_name: 'إدارة المواد',
    app_download_key: 'dsf-materials-windows-x64.zip',
    sections: [
      'قسم سجل الأصول',
      'قسم المخزون',
      'قسم الأسطول والمركبات',
      'قسم المشتريات',
    ],
  },
  {
    scope: 'services',
    department_code: 'IT',
    department_name: 'الذكاء والخدمات',
    app_download_key: 'dsf-services-windows-x64.zip',
    sections: [
      'مركز الاستخبارات',
      'قسم متابعة المشاريع',
      'قسم التحليلات والتقارير',
      'قسم دعم الأنظمة',
    ],
  },
  {
    scope: 'remote-sensing',
    department_code: 'GIS',
    department_name: 'مركز الاستشعار عن بعد',
    app_download_key: 'dsf-remote-sensing-windows-x64.zip',
    sections: [
      'قسم التحليل المكاني',
      'قسم الاستخبارات الفضائية',
      'قسم مساحة العمل الهندسية',
      'قسم التحقق الحقلي',
    ],
  },
];

function normalizeEmailPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function buildProvisionEmail(tenantCode: string, scope: string, roleKey: string, index?: number): string {
  const tenant = normalizeEmailPart(tenantCode) || 'tenant';
  const dept = normalizeEmailPart(scope) || 'dept';
  const suffix = index ? `-${index}` : '';
  return `${roleKey}.${dept}${suffix}@${tenant}.local`;
}

export async function provisionTenantCentralAccounts(input: {
  tenant_id: string;
  tenant_code: string;
  organization_name: string;
  invited_by: string;
}): Promise<TenantProvisioningPackage> {
  const bundles: ProvisionedDepartmentBundle[] = [];

  for (const template of DEPARTMENT_TEMPLATES) {
    const managerName = `مدير ${template.department_name}`;
    const managerEmail = buildProvisionEmail(input.tenant_code, template.scope, 'manager');
    const managerInvite = await authInviteUser({
      full_name: managerName,
      email: managerEmail,
      role: 'dept_manager',
      department_code: template.department_code,
      tenant_id: input.tenant_id,
      tenant_code: input.tenant_code,
      invited_by: input.invited_by,
      organization_name: input.organization_name,
      job_title: managerName,
    });

    const manager: ProvisionedCredential = {
      full_name: managerInvite.user.full_name,
      role: managerInvite.user.role,
      department_code: template.department_code,
      email: managerInvite.user.email,
      username: managerInvite.username,
      temp_password: managerInvite.temp_password,
    };

    const sections: ProvisionedCredential[] = [];
    for (let i = 0; i < template.sections.length; i += 1) {
      const sectionName = template.sections[i];
      const sectionId = `${template.department_code}-SEC-${String(i + 1).padStart(2, '0')}`;
      const sectionEmail = buildProvisionEmail(input.tenant_code, template.scope, 'section', i + 1);
      const sectionInvite = await authInviteUser({
        full_name: `رئيس ${sectionName}`,
        email: sectionEmail,
        role: 'section_manager',
        department_code: template.department_code,
        section_id: sectionId,
        tenant_id: input.tenant_id,
        tenant_code: input.tenant_code,
        invited_by: input.invited_by,
        organization_name: input.organization_name,
        job_title: `رئيس ${sectionName}`,
      });

      sections.push({
        full_name: sectionInvite.user.full_name,
        role: sectionInvite.user.role,
        department_code: template.department_code,
        section_id: sectionId,
        section_name: sectionName,
        email: sectionInvite.user.email,
        username: sectionInvite.username,
        temp_password: sectionInvite.temp_password,
      });
    }

    bundles.push({
      scope: template.scope,
      department_code: template.department_code,
      department_name: template.department_name,
      app_download_key: template.app_download_key,
      manager,
      sections,
    });
  }

  return {
    generated_at: Date.now(),
    generated_by: input.invited_by,
    tenant_code: input.tenant_code,
    organization_name: input.organization_name,
    bundles,
  };
}