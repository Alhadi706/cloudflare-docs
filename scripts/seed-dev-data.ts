import {
  createMaterialRequest,
  listMaterialRequests,
} from '../lib/material-requests-store';
import {
  createPersonnelRequest,
  listPersonnelRequests,
} from '../lib/personnel-requests-store';

const DEV_TENANT_ID = process.env.SEED_TENANT_ID || 'aaaaaaaa-0000-4000-a000-000000000001';
const SEED_TAG = '[seed-dev-v1]';

function ensureNotProduction() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== '1') {
    throw new Error('Seeding is blocked in production. Set ALLOW_PROD_SEED=1 only if you really need it.');
  }
}

function seedMaterialRequests() {
  const existing = listMaterialRequests(DEV_TENANT_ID);
  const alreadySeeded = existing.filter((r) => (r.target_use_case || '').includes(SEED_TAG)).length;
  if (alreadySeeded >= 6) {
    return { created: 0, skipped: true };
  }

  const samples = [
    {
      requester_dept: 'finance',
      requester_name: 'مدير مالي - تجريبي',
      target_use_case: `${SEED_TAG} تجهيز تقرير الإقفال الشهري`,
      items: [
        { item_name: 'ورق A4', item_category: 'office_supplies', requested_qty: 20, unit: 'pack' },
        { item_name: 'أحبار طباعة', item_category: 'office_supplies', requested_qty: 12, unit: 'piece' },
      ],
    },
    {
      requester_dept: 'admin-affairs',
      requester_name: 'رئيس شؤون الموظفين - تجريبي',
      target_use_case: `${SEED_TAG} تجهيز ملفات موظفين جدد`,
      items: [
        { item_name: 'ملفات ورقية', item_category: 'stationery', requested_qty: 60, unit: 'piece' },
        { item_name: 'حافظات بلاستيكية', item_category: 'stationery', requested_qty: 40, unit: 'piece' },
      ],
    },
    {
      requester_dept: 'maintenance',
      requester_name: 'مهندس صيانة - تجريبي',
      target_use_case: `${SEED_TAG} صيانة دورية لمضخات المرحلة A`,
      items: [
        { item_name: 'زيوت تشغيل', item_category: 'consumables', requested_qty: 120, unit: 'litre' },
        { item_name: 'فلاتر', item_category: 'spare_parts', requested_qty: 24, unit: 'piece' },
      ],
    },
    {
      requester_dept: 'corrosion',
      requester_name: 'فني حماية كاثودية - تجريبي',
      target_use_case: `${SEED_TAG} دعم حملة قياسات الحماية`,
      items: [
        { item_name: 'أقطاب قياس', item_category: 'tools', requested_qty: 18, unit: 'piece' },
        { item_name: 'كوابل توصيل', item_category: 'consumables', requested_qty: 30, unit: 'piece' },
      ],
    },
    {
      requester_dept: 'projects',
      requester_name: 'منسق مشاريع - تجريبي',
      target_use_case: `${SEED_TAG} تجهيز موقع مشروع فرعي`,
      items: [
        { item_name: 'خوذ سلامة', item_category: 'equipment', requested_qty: 15, unit: 'piece' },
        { item_name: 'سترات عاكسة', item_category: 'equipment', requested_qty: 15, unit: 'piece' },
      ],
    },
    {
      requester_dept: 'fleet',
      requester_name: 'مشرف أسطول - تجريبي',
      target_use_case: `${SEED_TAG} تشغيل مهام النقل الأسبوعية`,
      items: [
        { item_name: 'زيت محركات', item_category: 'consumables', requested_qty: 80, unit: 'litre' },
        { item_name: 'فلاتر هواء', item_category: 'spare_parts', requested_qty: 20, unit: 'piece' },
      ],
    },
  ];

  let created = 0;
  for (const row of samples) {
    createMaterialRequest(DEV_TENANT_ID, row);
    created += 1;
  }

  return { created, skipped: false };
}

function seedPersonnelRequests() {
  const existing = listPersonnelRequests(DEV_TENANT_ID);
  const alreadySeeded = existing.filter((r) => r.title.includes(SEED_TAG)).length;
  if (alreadySeeded >= 4) {
    return { created: 0, skipped: true };
  }

  const samples = [
    {
      employee_no: 'E-2055',
      employee_name: 'أحمد تطوير',
      request_type: 'leave_annual',
      title: `${SEED_TAG} طلب إجازة سنوية`,
      details: 'طلب إجازة سنوية لمدة 5 أيام لأغراض شخصية (بيانات تجريبية).',
      priority: 'medium' as const,
      requester_id: 'seed-script',
      requester_employee_no: 'E-2055',
      requester_role: 'employee',
      leave_days: 5,
    },
    {
      employee_no: 'E-3011',
      employee_name: 'مريم جودة',
      request_type: 'certificate',
      title: `${SEED_TAG} شهادة تعريف راتب`,
      details: 'طلب إصدار شهادة تعريف راتب موجهة للبنك (بيانات تجريبية).',
      priority: 'low' as const,
      requester_id: 'seed-script',
      requester_employee_no: 'E-3011',
      requester_role: 'employee',
      leave_days: 0,
    },
    {
      employee_no: 'E-4120',
      employee_name: 'سليم متابعة',
      request_type: 'profile_update',
      title: `${SEED_TAG} تحديث بيانات ملف موظف`,
      details: 'تحديث رقم الهاتف والعنوان الوظيفي في ملف الموظف (بيانات تجريبية).',
      priority: 'low' as const,
      requester_id: 'seed-script',
      requester_employee_no: 'E-4120',
      requester_role: 'employee',
      leave_days: 0,
    },
    {
      employee_no: 'E-5002',
      employee_name: 'نورا التزام',
      request_type: 'leave_sick',
      title: `${SEED_TAG} طلب إجازة مرضية`,
      details: 'طلب إجازة مرضية لمدة يومين مع تقرير طبي (بيانات تجريبية).',
      priority: 'high' as const,
      requester_id: 'seed-script',
      requester_employee_no: 'E-5002',
      requester_role: 'employee',
      leave_days: 2,
    },
  ];

  let created = 0;
  for (const row of samples) {
    createPersonnelRequest(DEV_TENANT_ID, row);
    created += 1;
  }

  return { created, skipped: false };
}

function main() {
  ensureNotProduction();

  const material = seedMaterialRequests();
  const personnel = seedPersonnelRequests();

  console.log('[seed-dev-data] tenant:', DEV_TENANT_ID);
  console.log('[seed-dev-data] material_requests created:', material.created, 'skipped:', material.skipped);
  console.log('[seed-dev-data] personnel_requests created:', personnel.created, 'skipped:', personnel.skipped);
  console.log('[seed-dev-data] done');
}

main();
