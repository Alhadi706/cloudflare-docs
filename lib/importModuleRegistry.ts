/**
 * Import Module Registry
 * ======================
 * PHASE GLOBAL-IMPORT-SYSTEM
 *
 * المصدر الموحّد لتعريف خصائص الاستيراد لكل وحدة ERP.
 * أي وحدة جديدة تُضاف هنا فقط — ولا تحتاج إلى بناء مسار استيراد مستقل.
 *
 * requiresProject / requiresSite:
 *   true  → يُجبر المستخدم على الاختيار قبل الرفع
 *   false → البيانات على مستوى المؤسسة (لا ترتبط بمشروع/موقع)
 */

export interface ColumnDef {
  canonical: string;     // الاسم القانوني في DB
  label: string;         // التسمية للمستخدم (عربي)
  required?: boolean;
  aliases?: string[];    // أسماء بديلة في الملف
}

export interface ImportModuleConfig {
  key: string;
  label: string;           // "الموظفين"
  buttonLabel: string;     // "رفع ملف الموظفين"
  endpoint: string;        // POST /api/v1/import/<key>
  requiresProject: boolean;
  requiresSite: boolean;
  columns: ColumnDef[];
  notes?: string;          // ملاحظة توضيحية
}

// ─────────────────────────────────────────────────────────────
// تعريفات الوحدات
// ─────────────────────────────────────────────────────────────

export const IMPORT_MODULES: Record<string, ImportModuleConfig> = {

  // ─── HR ──────────────────────────────────────────────────
  employees: {
    key: 'employees',
    label: 'الموظفين',
    buttonLabel: 'رفع ملف الموظفين',
    endpoint: '/api/v1/import/employees',
    requiresProject: true,
    requiresSite: true,
    columns: [
      { canonical: 'name',         label: 'الاسم',             required: true,  aliases: ['employee_name','full_name','الاسم الكامل'] },
      { canonical: 'role',         label: 'المسمى الوظيفي',                     aliases: ['job_title','position','المسمى'] },
      { canonical: 'department',   label: 'القسم',                              aliases: ['dept','القسم'] },
      { canonical: 'salary',       label: 'الراتب',                             aliases: ['الراتب الأساسي'] },
      { canonical: 'hire_date',    label: 'تاريخ التعيين',                      aliases: ['start_date','تاريخ البداية'] },
      { canonical: 'phone',        label: 'الهاتف',                             aliases: ['mobile','جوال'] },
      { canonical: 'email',        label: 'البريد الإلكتروني',                  aliases: ['mail'] },
    ],
  },

  departments: {
    key: 'departments',
    label: 'الأقسام',
    buttonLabel: 'رفع ملف الأقسام',
    endpoint: '/api/v1/import/departments',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'name',         label: 'اسم القسم',  required: true, aliases: ['department_name','القسم'] },
      { canonical: 'code',         label: 'الرمز',                      aliases: ['dept_code','الرمز'] },
      { canonical: 'manager_name', label: 'المدير',                     aliases: ['manager','المسؤول'] },
      { canonical: 'description',  label: 'الوصف',                      aliases: ['notes'] },
    ],
    notes: 'بيانات مركزية — لا تحتاج إلى مشروع أو موقع',
  },

  positions: {
    key: 'positions',
    label: 'المسميات الوظيفية',
    buttonLabel: 'رفع ملف المسميات',
    endpoint: '/api/v1/import/positions',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'title',        label: 'المسمى',     required: true, aliases: ['position_title','الوظيفة'] },
      { canonical: 'department',   label: 'القسم',                      aliases: ['dept'] },
      { canonical: 'grade',        label: 'الدرجة الوظيفية',            aliases: ['grade_name','rank'] },
      { canonical: 'description',  label: 'الوصف' },
    ],
    notes: 'بيانات مركزية — لا تحتاج إلى مشروع أو موقع',
  },

  contracts: {
    key: 'contracts',
    label: 'العقود',
    buttonLabel: 'رفع ملف العقود',
    endpoint: '/api/v1/import/contracts',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'employee_name', label: 'الموظف',           required: true, aliases: ['name','employee'] },
      { canonical: 'contract_type', label: 'نوع العقد',                         aliases: ['type','النوع'] },
      { canonical: 'start_date',    label: 'تاريخ البداية',                      aliases: ['hire_date'] },
      { canonical: 'end_date',      label: 'تاريخ الانتهاء',                     aliases: ['expiry_date'] },
      { canonical: 'salary',        label: 'الراتب',                             aliases: ['amount'] },
    ],
  },

  grades: {
    key: 'grades',
    label: 'الدرجات الوظيفية',
    buttonLabel: 'رفع ملف الدرجات',
    endpoint: '/api/v1/import/grades',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'name',          label: 'اسم الدرجة',  required: true, aliases: ['grade_name','الدرجة'] },
      { canonical: 'level',         label: 'المستوى',                     aliases: ['grade_level','rank'] },
      { canonical: 'min_salary',    label: 'الراتب الأدنى',               aliases: ['salary_min'] },
      { canonical: 'max_salary',    label: 'الراتب الأعلى',               aliases: ['salary_max'] },
    ],
    notes: 'بيانات مركزية — لا تحتاج إلى مشروع أو موقع',
  },

  // ─── Assets ──────────────────────────────────────────────
  assets: {
    key: 'assets',
    label: 'الأصول',
    buttonLabel: 'رفع ملف الأصول',
    endpoint: '/api/v1/import/assets',
    requiresProject: true,
    requiresSite: true,
    columns: [
      { canonical: 'asset_name',    label: 'اسم الأصل',    required: true, aliases: ['name','الأصل'] },
      { canonical: 'asset_type',    label: 'النوع',                        aliases: ['type','النوع'] },
      { canonical: 'status',        label: 'الحالة',                       aliases: ['state'] },
      { canonical: 'health_score',  label: 'درجة الصحة',                   aliases: ['health'] },
      { canonical: 'latitude',      label: 'خط العرض',                     aliases: ['lat'] },
      { canonical: 'longitude',     label: 'خط الطول',                     aliases: ['lon','lng'] },
      { canonical: 'department_owner', label: 'القسم المسؤول',             aliases: ['department'] },
      { canonical: 'installation_date', label: 'تاريخ التركيب',            aliases: ['install_date'] },
    ],
  },

  // ─── Maintenance ─────────────────────────────────────────
  work_orders: {
    key: 'work_orders',
    label: 'أوامر العمل',
    buttonLabel: 'رفع ملف أوامر العمل',
    endpoint: '/api/v1/import/work_orders',
    requiresProject: true,
    requiresSite: true,
    columns: [
      { canonical: 'title',         label: 'العنوان',       required: true, aliases: ['name','الأمر'] },
      { canonical: 'description',   label: 'الوصف',                        aliases: ['notes','التفاصيل'] },
      { canonical: 'priority',      label: 'الأولوية',                     aliases: ['level'] },
      { canonical: 'status',        label: 'الحالة',                       aliases: ['state'] },
      { canonical: 'assigned_to',   label: 'المكلّف',                      aliases: ['assignee','الفني'] },
      { canonical: 'due_date',      label: 'تاريخ الاستحقاق',              aliases: ['deadline'] },
    ],
  },

  spare_parts: {
    key: 'spare_parts',
    label: 'قطع الغيار',
    buttonLabel: 'رفع ملف قطع الغيار',
    endpoint: '/api/v1/import/spare_parts',
    requiresProject: true,
    requiresSite: true,
    columns: [
      { canonical: 'name',          label: 'اسم القطعة',    required: true, aliases: ['part_name','القطعة'] },
      { canonical: 'part_number',   label: 'رقم القطعة',                   aliases: ['sku','code'] },
      { canonical: 'quantity',      label: 'الكمية',                       aliases: ['qty','الرصيد'] },
      { canonical: 'unit_price',    label: 'سعر الوحدة',                   aliases: ['price','السعر'] },
      { canonical: 'supplier',      label: 'المورّد',                      aliases: ['vendor'] },
      { canonical: 'location',      label: 'مكان التخزين',                 aliases: ['storage'] },
    ],
  },

  // ─── Finance ─────────────────────────────────────────────
  expenses: {
    key: 'expenses',
    label: 'المصروفات',
    buttonLabel: 'رفع ملف المصروفات',
    endpoint: '/api/v1/import/expenses',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'description',   label: 'الوصف',         required: true, aliases: ['expense_name','البند'] },
      { canonical: 'amount',        label: 'المبلغ',         required: true, aliases: ['cost','القيمة'] },
      { canonical: 'category',      label: 'الفئة',                        aliases: ['type','التصنيف'] },
      { canonical: 'date',          label: 'التاريخ',                      aliases: ['expense_date'] },
      { canonical: 'approved_by',   label: 'اعتمده',                       aliases: ['approver'] },
    ],
  },

  budgets: {
    key: 'budgets',
    label: 'الميزانيات',
    buttonLabel: 'رفع ملف الميزانيات',
    endpoint: '/api/v1/import/budgets',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'name',          label: 'اسم الميزانية', required: true, aliases: ['budget_name','الميزانية'] },
      { canonical: 'total_amount',  label: 'المبلغ الإجمالي', required: true, aliases: ['amount','القيمة'] },
      { canonical: 'category',      label: 'الفئة',                        aliases: ['type'] },
      { canonical: 'fiscal_year',   label: 'السنة المالية',                aliases: ['year','fiscal'] },
      { canonical: 'status',        label: 'الحالة',                       aliases: ['state'] },
    ],
  },

  // ─── Correspondence ──────────────────────────────────────
  incoming: {
    key: 'incoming',
    label: 'الوارد',
    buttonLabel: 'رفع ملف المراسلات الواردة',
    endpoint: '/api/v1/import/incoming',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'subject',       label: 'الموضوع',       required: true, aliases: ['title','العنوان'] },
      { canonical: 'sender',        label: 'المُرسِل',                     aliases: ['from','من'] },
      { canonical: 'reference_no',  label: 'رقم المرجع',                   aliases: ['ref','ref_no'] },
      { canonical: 'date',          label: 'التاريخ',                      aliases: ['received_date','تاريخ الاستلام'] },
      { canonical: 'status',        label: 'الحالة',                       aliases: ['state'] },
    ],
    notes: 'مراسلات مركزية — لا تحتاج إلى موقع',
  },

  outgoing: {
    key: 'outgoing',
    label: 'الصادر',
    buttonLabel: 'رفع ملف المراسلات الصادرة',
    endpoint: '/api/v1/import/outgoing',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'subject',       label: 'الموضوع',       required: true, aliases: ['title','العنوان'] },
      { canonical: 'recipient',     label: 'المُستلِم',                    aliases: ['to','إلى'] },
      { canonical: 'reference_no',  label: 'رقم المرجع',                   aliases: ['ref'] },
      { canonical: 'date',          label: 'التاريخ',                      aliases: ['sent_date','تاريخ الإرسال'] },
      { canonical: 'status',        label: 'الحالة',                       aliases: ['state'] },
    ],
    notes: 'مراسلات مركزية — لا تحتاج إلى موقع',
  },

  // ─── Projects ────────────────────────────────────────────
  tasks: {
    key: 'tasks',
    label: 'المهام',
    buttonLabel: 'رفع ملف المهام',
    endpoint: '/api/v1/import/tasks',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'title',         label: 'عنوان المهمة', required: true, aliases: ['name','task_name','المهمة'] },
      { canonical: 'description',   label: 'الوصف',                       aliases: ['notes'] },
      { canonical: 'status',        label: 'الحالة',                      aliases: ['state'] },
      { canonical: 'priority',      label: 'الأولوية',                    aliases: ['level'] },
      { canonical: 'assigned_to',   label: 'المكلّف',                     aliases: ['assignee'] },
      { canonical: 'due_date',      label: 'تاريخ الاستحقاق',             aliases: ['deadline','end_date'] },
    ],
  },

  // ─── Procurement ─────────────────────────────────────────
  suppliers: {
    key: 'suppliers',
    label: 'الموردون',
    buttonLabel: 'رفع ملف الموردين',
    endpoint: '/api/v1/import/suppliers',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'supplier_name',   label: 'اسم المورّد',          required: true,  aliases: ['name','المورد','الاسم'] },
      { canonical: 'supplier_code',   label: 'رمز المورّد',                           aliases: ['code','رمز'] },
      { canonical: 'supplier_type',   label: 'نوع المورّد',                           aliases: ['type','النوع'] },
      { canonical: 'phone',           label: 'الهاتف',                                aliases: ['mobile','جوال'] },
      { canonical: 'email',           label: 'البريد الإلكتروني',                     aliases: ['mail'] },
      { canonical: 'city',            label: 'المدينة',                               aliases: ['location'] },
      { canonical: 'address',         label: 'العنوان',                               aliases: ['addr'] },
      { canonical: 'contact_person',  label: 'المسؤول',                               aliases: ['contact'] },
      { canonical: 'tax_number',      label: 'الرقم الضريبي',                         aliases: ['tax','ضريبي'] },
      { canonical: 'status',          label: 'الحالة',                                aliases: ['state'] },
    ],
    notes: 'سجلات مركزية — لا تحتاج إلى مشروع أو موقع',
  },

  purchase_requests: {
    key: 'purchase_requests',
    label: 'طلبات الشراء',
    buttonLabel: 'رفع ملف طلبات الشراء',
    endpoint: '/api/v1/import/purchase_requests',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'title',           label: 'عنوان الطلب',           required: true,  aliases: ['subject','الطلب','الموضوع'] },
      { canonical: 'request_type',    label: 'نوع الطلب',                              aliases: ['type','النوع'] },
      { canonical: 'priority',        label: 'الأولوية',                              aliases: ['level'] },
      { canonical: 'requested_by',    label: 'مقدّم الطلب',                           aliases: ['requester','من'] },
      { canonical: 'status',          label: 'الحالة',                                aliases: ['state'] },
      { canonical: 'estimated_cost',  label: 'التكلفة التقديرية',                     aliases: ['cost','budget'] },
      { canonical: 'required_date',   label: 'تاريخ الحاجة',                          aliases: ['needed_by','deadline'] },
      { canonical: 'description',     label: 'الوصف',                                 aliases: ['notes'] },
    ],
  },

  purchase_orders: {
    key: 'purchase_orders',
    label: 'أوامر الشراء',
    buttonLabel: 'رفع ملف أوامر الشراء',
    endpoint: '/api/v1/import/purchase_orders',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'title',                   label: 'عنوان الأمر',          required: true,  aliases: ['subject','الأمر'] },
      { canonical: 'supplier_name',           label: 'المورّد',                               aliases: ['vendor','مورد'] },
      { canonical: 'total_amount',            label: 'المبلغ الكلي',                          aliases: ['amount','المبلغ'] },
      { canonical: 'currency',                label: 'العملة',                                aliases: ['curr'] },
      { canonical: 'status',                  label: 'الحالة',                                aliases: ['state'] },
      { canonical: 'issued_date',             label: 'تاريخ الإصدار',                         aliases: ['date','issue_date'] },
      { canonical: 'expected_delivery_date',  label: 'تاريخ التسليم المتوقع',                  aliases: ['delivery_date'] },
      { canonical: 'description',             label: 'الوصف',                                 aliases: ['notes'] },
    ],
  },

  // ─── Inventory ────────────────────────────────────────────────
  warehouses: {
    key: 'warehouses',
    label: 'المستودعات',
    buttonLabel: 'رفع ملف المستودعات',
    endpoint: '/api/v1/import/warehouses',
    requiresProject: true,
    requiresSite: false,
    columns: [
      { canonical: 'warehouse_name', label: 'اسم المستودع',  required: true,  aliases: ['name','المستودع','اسم المخزن'] },
      { canonical: 'warehouse_code', label: 'رمز المستودع',                   aliases: ['code','الرمز'] },
      { canonical: 'warehouse_type', label: 'نوع المستودع',                   aliases: ['type','النوع'] },
      { canonical: 'location_name',  label: 'الموقع',                              aliases: ['location','الموقع'] },
      { canonical: 'status',         label: 'الحالة',                              aliases: ['state'] },
      { canonical: 'notes',          label: 'ملاحظات',                            aliases: ['تعليق','comments'] },
    ],
    notes: 'مرتبط بمشروع — اختر المشروع قبل الرفع',
  },

  inventory_items: {
    key: 'inventory_items',
    label: 'أصناف المخزون',
    buttonLabel: 'رفع ملف الأصناف',
    endpoint: '/api/v1/import/inventory_items',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'item_name',         label: 'اسم الصنف',      required: true,  aliases: ['name','الصنف','المادة'] },
      { canonical: 'item_code',         label: 'كود الصنف',                       aliases: ['code','رمز الصنف'] },
      { canonical: 'item_category',     label: 'الفئة',                         aliases: ['category','تصنيف','فئة الصنف'] },
      { canonical: 'unit',              label: 'وحدة القياس',                aliases: ['uom','unit_of_measure','الوحدة'] },
      { canonical: 'min_stock_level',   label: 'الحد الأدنى',                aliases: ['min_stock','min','أدنى'] },
      { canonical: 'max_stock_level',   label: 'الحد الأعلى',                aliases: ['max_stock','max','أعلى'] },
      { canonical: 'default_cost',      label: 'تكلفة الوحدة',              aliases: ['cost','unit_cost','التكلفة'] },
      { canonical: 'status',            label: 'الحالة',                         aliases: ['state'] },
    ],
    notes: 'كتالوج مركزي — لا يحتاج إلى مشروع أو موقع',
  },

  // ─── Accounting ───────────────────────────────────────────
  chart_of_accounts: {
    key: 'chart_of_accounts',
    label: 'دليل الحسابات',
    buttonLabel: 'رفع ملف دليل الحسابات',
    endpoint: '/api/v1/import/chart_of_accounts',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'account_name', label: 'اسم الحساب',      required: true, aliases: ['name','الحساب','اسم'] },
      { canonical: 'account_code', label: 'رمز الحساب',                      aliases: ['code','رمز','كود'] },
      { canonical: 'account_type', label: 'نوع الحساب',      required: true, aliases: ['type','نوع'] },
      { canonical: 'parent_code',  label: 'رمز الحساب الأب',                 aliases: ['parent','الأب','parent_account'] },
      { canonical: 'is_active',    label: 'نشط',                             aliases: ['active','status'] },
      { canonical: 'notes',        label: 'ملاحظات',                         aliases: ['تعليق','comments'] },
    ],
    notes: 'أنواع الحساب: asset / liability / equity / revenue / expense',
  },

  cost_centers: {
    key: 'cost_centers',
    label: 'مراكز التكلفة',
    buttonLabel: 'رفع ملف مراكز التكلفة',
    endpoint: '/api/v1/import/cost_centers',
    requiresProject: false,
    requiresSite: false,
    columns: [
      { canonical: 'cost_center_name', label: 'اسم المركز',     required: true, aliases: ['name','المركز','الاسم'] },
      { canonical: 'cost_center_code', label: 'رمز المركز',                     aliases: ['code','رمز'] },
      { canonical: 'description',      label: 'الوصف',                          aliases: ['notes','وصف'] },
      { canonical: 'is_active',        label: 'نشط',                            aliases: ['active','status'] },
    ],
    notes: 'مراكز التكلفة المركزية — يمكن ربطها بمشاريع يدوياً بعد الاستيراد',
  },
};

// ─────────────────────────────────────────────────────────────
// CLASSIFICATION TABLE (للتوثيق والـ audit)
// ─────────────────────────────────────────────────────────────

export type ImportClassification = 'REQUIRED' | 'OPTIONAL' | 'NOT_SUITABLE';

export const ERP_AUDIT_TABLE: {
  route: string;
  label: string;
  moduleKey?: string;
  classification: ImportClassification;
  reason: string;
}[] = [
  // HR
  { route: '/dashboard/admin-gateway/hr/employees',        label: 'الموظفون',              moduleKey: 'employees',    classification: 'REQUIRED',     reason: 'سجلات هيكلية + project/site binding' },
  { route: '/dashboard/admin-gateway/hr/departments',      label: 'الأقسام',               moduleKey: 'departments',  classification: 'REQUIRED',     reason: 'سجلات مركزية قابلة لرفع جماعي' },
  { route: '/dashboard/admin-gateway/hr/positions',        label: 'المسميات الوظيفية',     moduleKey: 'positions',    classification: 'REQUIRED',     reason: 'سجلات مركزية قابلة لرفع جماعي' },
  { route: '/dashboard/admin-gateway/hr/contracts',        label: 'العقود',                moduleKey: 'contracts',    classification: 'REQUIRED',     reason: 'سجلات هيكلية مرتبطة بموظفين' },
  { route: '/dashboard/admin-gateway/hr/grades',           label: 'الدرجات الوظيفية',      moduleKey: 'grades',       classification: 'REQUIRED',     reason: 'جداول مرجعية قابلة لرفع جماعي' },
  { route: '/dashboard/admin-gateway/hr/attendance',       label: 'الحضور والغياب',        moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'يكتمل عادةً من نظام تسجيل ذكي — يمكن استيراده لاحقاً' },
  { route: '/dashboard/admin-gateway/hr/leave-management', label: 'إدارة الإجازات',        moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'سجلات دورية — استيراد تاريخي ممكن' },
  { route: '/dashboard/admin-gateway/hr/salary-info',      label: 'معلومات الرواتب',       moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'بيانات حساسة — ممكن مستقبلاً بضوابط إضافية' },
  { route: '/dashboard/admin-gateway/hr/payroll-config',   label: 'إعداد الرواتب',         moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'إعدادات نظام — ليست سجلات بيانات' },
  // Assets
  { route: '/dashboard/admin-gateway/assets/registry',     label: 'سجل الأصول',            moduleKey: 'assets',       classification: 'REQUIRED',     reason: 'أصول مكانية + GIS geometry + project/site' },
  { route: '/dashboard/admin-gateway/assets/categories',   label: 'فئات الأصول',           moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'جداول ضبط — عدد صفوف صغير' },
  { route: '/dashboard/admin-gateway/assets/health',       label: 'صحة الأصول',            moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'تحليلات محسوبة —لا تُستورَد' },
  { route: '/dashboard/admin-gateway/assets/valuations',   label: 'تقييمات الأصول',        moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'ممكن مستقبلاً مع module مخصص' },
  // Maintenance
  { route: '/dashboard/admin-gateway/maintenance/work-orders',  label: 'أوامر العمل',     moduleKey: 'work_orders',  classification: 'REQUIRED',     reason: 'بيانات تشغيلية + project/site' },
  { route: '/dashboard/admin-gateway/maintenance/spare-parts',  label: 'قطع الغيار',      moduleKey: 'spare_parts',  classification: 'REQUIRED',     reason: 'جرد ومخزون + project/site' },
  { route: '/dashboard/admin-gateway/maintenance/preventive',   label: 'الصيانة الوقائية', moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'خطط دورية — ممكن مستقبلاً' },
  { route: '/dashboard/admin-gateway/maintenance/teams',        label: 'فرق الصيانة',      moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'سجلات صغيرة — يدوي أفضل' },
  // Finance
  { route: '/dashboard/admin-gateway/finance/expenses',    label: 'المصروفات',             moduleKey: 'expenses',     classification: 'REQUIRED',     reason: 'بيانات مالية + project binding' },
  { route: '/dashboard/admin-gateway/finance/budgets',     label: 'الميزانيات',            moduleKey: 'budgets',      classification: 'REQUIRED',     reason: 'خطط مالية + project binding' },
  { route: '/dashboard/admin-gateway/finance/allocations', label: 'التخصيصات',             moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'يعتمد على الميزانيات — مستقبلاً' },
  { route: '/dashboard/admin-gateway/finance/transfers',   label: 'التحويلات',             moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'معاملات مالية — يتطلب ضوابط دقيقة' },
  { route: '/dashboard/admin-gateway/finance/reports',     label: 'التقارير المالية',       moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'تقارير محسوبة — لا تُستورَد' },
  { route: '/dashboard/admin-gateway/finance/asset-tracking', label: 'تتبع مالي للأصول', moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'مشتق من الأصول — لا تُستورَد مستقلة' },
  // Correspondence
  { route: '/dashboard/admin-gateway/correspondence/incoming', label: 'الوارد',           moduleKey: 'incoming',     classification: 'REQUIRED',     reason: 'أرشفة جماعية للمراسلات الواردة' },
  { route: '/dashboard/admin-gateway/correspondence/outgoing', label: 'الصادر',           moduleKey: 'outgoing',     classification: 'REQUIRED',     reason: 'أرشفة جماعية للمراسلات الصادرة' },
  { route: '/dashboard/admin-gateway/correspondence/archive',  label: 'الأرشيف',          moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'ممكن مستقبلاً مع module مخصص' },
  { route: '/dashboard/admin-gateway/correspondence/internal', label: 'مذكرات داخلية',    moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'ممكن مستقبلاً' },
  // Projects
  { route: '/dashboard/admin-gateway/projects/tasks',      label: 'المهام',               moduleKey: 'tasks',             classification: 'REQUIRED',     reason: 'مهام مرتبطة بمشروع' },
  { route: '/dashboard/admin-gateway/projects/list',       label: 'المشاريع',             moduleKey: undefined,           classification: 'OPTIONAL',     reason: 'يوجد نموذج إنشاء — استيراد جماعي ممكن مستقبلاً' },
  // Procurement
  { route: '/dashboard/admin-gateway/procurement/suppliers',         label: 'الموردون',          moduleKey: 'suppliers',         classification: 'REQUIRED',     reason: 'سجلات مركزية قابلة لرفع جماعي' },
  { route: '/dashboard/admin-gateway/procurement/requests',          label: 'طلبات الشراء',      moduleKey: 'purchase_requests', classification: 'REQUIRED',     reason: 'بيانات مشتريات + project binding' },
  { route: '/dashboard/admin-gateway/procurement/orders',            label: 'أوامر الشراء',      moduleKey: 'purchase_orders',   classification: 'REQUIRED',     reason: 'أوامر مالية + project binding' },
  // Inventory
  { route: '/dashboard/admin-gateway/inventory/warehouses', label: 'المستودعات',     moduleKey: 'warehouses',       classification: 'REQUIRED', reason: 'مستودعات مرتبطة بمشاريع' },
  { route: '/dashboard/admin-gateway/inventory/items',      label: 'الأصناف',        moduleKey: 'inventory_items',  classification: 'REQUIRED', reason: 'كتالوج مركزي قابل لرفع جماعي' },
  { route: '/dashboard/admin-gateway/inventory/receipts',   label: 'سندات الاستلام', moduleKey: undefined,          classification: 'OPTIONAL', reason: 'حركات تشغيلية — يدوي أفضل' },
  { route: '/dashboard/admin-gateway/inventory/issues',     label: 'سندات الصرف',    moduleKey: undefined,          classification: 'OPTIONAL', reason: 'حركات تشغيلية — يدوي أفضل' },
  // Accounting
  { route: '/dashboard/admin-gateway/accounting/chart-of-accounts', label: 'دليل الحسابات',  moduleKey: 'chart_of_accounts', classification: 'REQUIRED', reason: 'أساس النظام المحاسبي — استيراد جماعي ضروري' },
  { route: '/dashboard/admin-gateway/accounting/cost-centers',      label: 'مراكز التكلفة', moduleKey: 'cost_centers',      classification: 'REQUIRED', reason: 'هيكل تكلفة مرتبط بمشاريع' },
  { route: '/dashboard/admin-gateway/accounting/journal-entries',   label: 'القيود اليومية', moduleKey: undefined,           classification: 'OPTIONAL', reason: 'قيود تشغيلية — يدوي أفضل للتحقق' },
  { route: '/dashboard/admin-gateway/projects/milestones', label: 'الإنجازات',            moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'ممكن مستقبلاً' },
  { route: '/dashboard/admin-gateway/projects/budget',     label: 'ميزانية المشاريع',      moduleKey: undefined,      classification: 'OPTIONAL',     reason: 'ممكن مستقبلاً' },
  { route: '/dashboard/admin-gateway/projects/documents',  label: 'وثائق المشاريع',       moduleKey: undefined,      classification: 'NOT_SUITABLE', reason: 'وثائق ثنائية — لا تُستورَد كـ CSV' },
  // Platform Intelligence
  { route: '/dashboard/admin-gateway/platform-intelligence/analytics',           label: 'التحليلات',          moduleKey: undefined, classification: 'NOT_SUITABLE', reason: 'تحليلات محسوبة' },
  { route: '/dashboard/admin-gateway/platform-intelligence/monitoring',          label: 'المراقبة',           moduleKey: undefined, classification: 'NOT_SUITABLE', reason: 'بيانات آنية من مستشعرات' },
  { route: '/dashboard/admin-gateway/platform-intelligence/predictive-analytics',label: 'التحليل التنبؤي',    moduleKey: undefined, classification: 'NOT_SUITABLE', reason: 'نتائج AI — لا تُستورَد' },
  { route: '/dashboard/admin-gateway/platform-intelligence/risk-management',     label: 'إدارة المخاطر',      moduleKey: undefined, classification: 'NOT_SUITABLE', reason: 'مؤشرات محسوبة' },
  { route: '/dashboard/admin-gateway/system',                                    label: 'إعدادات النظام',     moduleKey: undefined, classification: 'NOT_SUITABLE', reason: 'إعدادات — لا تُستورَد' },
];

// Helper: الحصول على config وحدة
export function getModuleConfig(key: string): ImportModuleConfig | undefined {
  return IMPORT_MODULES[key];
}

// Helper: جميع الوحدات REQUIRED
export function getRequiredModules(): ImportModuleConfig[] {
  return ERP_AUDIT_TABLE
    .filter(e => e.classification === 'REQUIRED' && e.moduleKey)
    .map(e => IMPORT_MODULES[e.moduleKey!])
    .filter(Boolean) as ImportModuleConfig[];
}
