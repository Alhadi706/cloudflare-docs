export type MailboxOption = {
  key: string;
  label: string;
  group: 'departments' | 'sections';
};

export const MAILBOX_OPTIONS: MailboxOption[] = [
  // Department managers
  { key: 'admin_manager', label: 'مدير البوابة الإدارية', group: 'departments' },
  { key: 'hr_manager', label: 'مدير إدارة الموارد البشرية', group: 'departments' },
  { key: 'finance_manager', label: 'مدير الإدارة المالية', group: 'departments' },
  { key: 'maint_manager', label: 'مدير إدارة الهندسة والدعم الفني', group: 'departments' },
  { key: 'control_manager', label: 'مدير مركز التحكم', group: 'departments' },
  { key: 'corrosion_manager', label: 'مدير إدارة التآكل', group: 'departments' },
  { key: 'engineering_manager', label: 'مدير الإدارة الهندسية', group: 'departments' },
  { key: 'procurement_manager', label: 'مدير المشتريات والمخازن', group: 'departments' },
  { key: 'fleet_manager', label: 'مدير إدارة النقل والأسطول', group: 'departments' },
  { key: 'communications_manager', label: 'مدير إدارة الاتصالات', group: 'departments' },
  { key: 'intelligence_manager', label: 'مدير الاستخبارات والذكاء الاصطناعي', group: 'departments' },
  { key: 'contracts_manager', label: 'مدير إدارة العقود', group: 'departments' },
  { key: 'projects_manager', label: 'مدير إدارة المشاريع', group: 'departments' },
  { key: 'assets_manager', label: 'مدير إدارة الأصول الرقمية', group: 'departments' },
  { key: 'ops_manager', label: 'مدير إدارة العمليات', group: 'departments' },
  { key: 'gis_manager', label: 'مدير إدارة GIS', group: 'departments' },
  { key: 'legal_manager', label: 'مدير الشؤون القانونية', group: 'departments' },
  { key: 'it_manager', label: 'مدير إدارة تقنية المعلومات', group: 'departments' },

  // Section heads
  { key: 'hr_personnel_head', label: 'رئيس قسم شؤون المستخدمين', group: 'sections' },
  { key: 'hr_training_head', label: 'رئيس قسم التدريب والتطوير', group: 'sections' },
  { key: 'hr_data_head', label: 'رئيس قسم البيانات والإحصاء', group: 'sections' },
  { key: 'hr_staffing_head', label: 'رئيس قسم النظم والملاكات', group: 'sections' },
  { key: 'hr_medical_head', label: 'رئيس قسم الشؤون الطبية والاجتماعية', group: 'sections' },
  { key: 'maint_operations_head', label: 'رئيس قسم العمليات الميدانية', group: 'sections' },
  { key: 'maint_technical_head', label: 'رئيس قسم الدعم الفني والتحليل', group: 'sections' },
  { key: 'maint_planning_head', label: 'رئيس قسم التخطيط والموارد', group: 'sections' },
  { key: 'corrosion_monitoring_head', label: 'رئيس قسم المراقبة الدورية', group: 'sections' },
  { key: 'corrosion_support_head', label: 'رئيس قسم الدعم الفني (التآكل)', group: 'sections' },
  { key: 'corrosion_coating_head', label: 'رئيس قسم المكونات والطلاء', group: 'sections' },
];

export const MAILBOX_ALIASES: Record<string, string> = {
  hr: 'hr_manager',
  engineering: 'engineering_manager',
  control: 'control_manager',
  corrosion: 'corrosion_manager',
  finance: 'finance_manager',
  maintenance: 'maint_manager',
};

const MAILBOX_KEYS = new Set(MAILBOX_OPTIONS.map((m) => m.key));

export function normalizeMailboxKey(value: unknown): string {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return MAILBOX_ALIASES[key] || key;
}

export function isValidMailboxKey(value: unknown): boolean {
  const key = normalizeMailboxKey(value);
  return MAILBOX_KEYS.has(key);
}

export function getMailboxLabel(value: unknown): string {
  const key = normalizeMailboxKey(value);
  const found = MAILBOX_OPTIONS.find((m) => m.key === key);
  return found?.label || key || 'غير محدد';
}

export const DEPARTMENT_BROADCAST_KEYS = MAILBOX_OPTIONS
  .filter((m) => m.group === 'departments')
  .map((m) => m.key);
