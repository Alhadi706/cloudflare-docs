/**
 * البيانات الثابتة لمستكشف النظام
 * - PHASES: مراحل التطوير
 * - DB_DOMAIN_KEYS: خريطة الأقسام والجداول
 * - SECTIONS: أقسام الإدارات بالكامل
 */

export type DbStatus = 'CONNECTED' | 'PARTIAL' | 'DISCONNECTED';
export type MapStatus = 'LINKED' | 'POSSIBLE' | 'NO';
export type PhaseNum = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Mod {
  name: string;
  path: string;
  db: DbStatus;
  map: MapStatus;
  phase: PhaseNum;
  table: string;
  desc: string;
  needs: string[];
}

export interface Sec { 
  title: string
  icon: string
  mods: Mod[] 
}

export const PHASES = [
  { id: 0, name: 'الجرد الكامل',        status: 'done'    as const, desc: 'جرد جميع الإدارات وتحديد حالتها — هذه الصفحة' },
  { id: 1, name: 'البنية التحتية',       status: 'done'    as const, desc: 'التحقق من الـ schemas وإنشاء الجداول المفقودة في PostgreSQL' },
  { id: 2, name: 'المشاريع + الخريطة',  status: 'done'    as const, desc: '✅ projects_core.projects (10 مشروع) + طبقة الخريطة الموحدة — كل مشروع يظهر كـ pin على الخريطة الفضائية' },
  { id: 3, name: 'الموارد البشرية',     status: 'done'    as const, desc: 'hr_core مرتبط: employees · grades · positions · attendance · leave_requests ✓' },
  { id: 4, name: 'الأصول والصيانة',     status: 'done'    as const, desc: '✅ operations_core: 10 أصول + 5 أوامر صيانة — الأصول والمشاريع مرئية كـ pins على الخريطة الموحدة' },
  { id: 5, name: 'المالية',             status: 'done'    as const, desc: 'finance_core مرتبط: budgets · expenses · allocations · transfers ✓' },
  { id: 6, name: 'المشتريات والمخزون',  status: 'done'    as const, desc: 'procurement_core + inventory_core + fleet_core مرتبطة بالكامل ✓' },
  { id: 7, name: 'المراسلات والسير',    status: 'done'    as const, desc: 'ربط نظام المراسلات والاعتمادات بكل الإدارات' },
  { id: 8, name: 'التحليل والتقارير',   status: 'pending' as const, desc: 'تقارير موحدة + AI تحليل + الإشعارات التلقائية' },
];

export const DB_DOMAIN_KEYS: Record<string, { dbDomain: string; dbKeys: string[] }> = {
  projects: { dbDomain: 'projects_core', dbKeys: ['projects', 'project_budgets', 'project_milestones', 'project_tasks'] },
  hr: { dbDomain: 'hr_core', dbKeys: ['employees', 'grades', 'job_titles', 'positions', 'contracts'] },
  finance: { dbDomain: 'finance_core', dbKeys: ['budgets', 'expenses', 'budget_allocations', 'invoices'] },
  operations: { dbDomain: 'operations_core', dbKeys: ['assets', 'work_orders', 'asset_types', 'maintenance_teams'] },
  procurement: { dbDomain: 'procurement_core', dbKeys: ['purchase_requests', 'purchase_orders', 'suppliers'] },
  inventory: { dbDomain: 'inventory_core', dbKeys: ['warehouses', 'inventory_items', 'stock_receipts', 'stock_issues'] },
  fleet: { dbDomain: 'fleet_core', dbKeys: ['vehicles', 'equipment', 'fuel_records'] },
  admin: { dbDomain: 'admin_core', dbKeys: ['incoming_letters', 'outgoing_letters', 'internal_memos'] },
  contracts: { dbDomain: 'contracts_core', dbKeys: ['contracts', 'contractors'] },
  workflow: { dbDomain: 'workflow_core', dbKeys: ['approval_requests', 'workflow_templates'] },
  accounting: { dbDomain: 'accounting_core', dbKeys: ['journal_entries', 'chart_of_accounts', 'cost_centers'] },
  revenue: { dbDomain: 'revenue_core', dbKeys: ['invoices', 'collections', 'customers'] },
  gis: { dbDomain: 'gis_data', dbKeys: ['projects', 'layers', 'geometries', 'sites'] },
  workspace: { dbDomain: 'workspace', dbKeys: ['departments', 'notifications'] },
  maintenance: { dbDomain: 'maintenance_core', dbKeys: ['assets_to_maintain', 'maintenance_requests'] },
};

export const SECTIONS: Sec[] = [
  {
    title: 'النظام والتحكم', icon: '⚙️',
    mods: [
      { name: 'البوابة الإدارية',  path: '/dashboard/admin-gateway',         db: 'PARTIAL',      map: 'LINKED',    phase: 0, table: 'public.tenants + hr_core.employees', desc: 'الصفحة الرئيسية — ملخص المنظومة. تجلب عدد الموظفين والمشاريع لكن المؤشرات المالية والأصول غير مربوطة.', needs: ['finance_core', 'assets_core'] },
      { name: 'المساعد الذكي',     path: '/dashboard/ai-assistant',           db: 'CONNECTED',    map: 'POSSIBLE',  phase: 8, table: 'AI Backend :7860', desc: 'دردشة LLM بالعربية — يستعلم عن بيانات النظام. يحتاج context من كل الإدارات ليجيب بدقة أكبر.', needs: ['context من كل الـ schemas'] },
      { name: 'لوحتي الشخصية',    path: '/dashboard/admin-gateway/my-dashboard', db: 'CONNECTED', map: 'NO',     phase: 3, table: 'approval/requests (5 طلبات)', desc: 'مرتبطة بـ /api/v1/approval/summary + /api/v1/approval/requests ✓', needs: [] },
      { name: 'إعدادات النظام',    path: '/dashboard/admin-gateway/system',   db: 'CONNECTED', map: 'NO',        phase: 1, table: 'api/admin-control (9 أقسام)', desc: 'مرتبطة بـ /api/admin-control/departments + settings + bots ✓', needs: [] },
      { name: 'مستكشف النظام',    path: '/dashboard/system-explorer',        db: 'CONNECTED',    map: 'NO',        phase: 0, table: 'ثابت (هذه الصفحة)', desc: 'أداة الجرد والمتابعة — تُحدَّث مع كل مرحلة ربط لتعكس الحالة الفعلية.', needs: [] },
    ],
  },
  {
    title: 'الخرائط والمعلومات الجغرافية', icon: '🗺️',
    mods: [
      { name: 'مساحة العمل الهندسية (GIS)', path: '/dashboard/gis-sovereignty/engineering-workspace',           db: 'CONNECTED',    map: 'LINKED',    phase: 2, table: 'gis_data.projects + gis_data.layers + gis_data.geometries', desc: 'الخريطة الموحدة الرئيسية — نقطة الربط المركزية لكل الإدارات. تعرض المشاريع والمواقع والطبقات.', needs: ['projects_core', 'hr_core', 'assets_core', 'finance_core'] },
      { name: 'مركز الاستخبارات الفضائية',  path: '/dashboard/gis-sovereignty/satellite-intelligence-center', db: 'PARTIAL',      map: 'LINKED',    phase: 2, table: 'gis_data + Tile APIs (Sentinel/Landsat)', desc: 'صور الأقمار Sentinel-2 وLandsat-8 وPlanetScope. يعمل عبر tile servers خارجية.', needs: ['ربط مناطق المشاريع تلقائياً'] },
      { name: 'السيادة الجغرافية (مدخل)',    path: '/dashboard/gis-sovereignty',                               db: 'PARTIAL',      map: 'LINKED',    phase: 2, table: 'gis_data', desc: 'صفحة مدخل GIS. يمكن دمجها مع engineering-workspace أو إبقاؤها كمدخل.', needs: [] },
      { name: 'مركز القيادة الرئيسي',        path: '/dashboard/command-center',                                 db: 'CONNECTED', map: 'POSSIBLE',  phase: 8, table: 'projects_core + hr_core + assets', desc: 'لوحة قيادة عليا — مرتبطة بـ CommandCenterLive + /api/v1/hr-structure/command-center/summary ✓', needs: [] },
    ],
  },
  {
    title: 'إدارة المشاريع', icon: '🏗️',
    mods: [
      { name: 'قائمة المشاريع',   path: '/dashboard/admin-gateway/projects/list',              db: 'PARTIAL',      map: 'POSSIBLE', phase: 2, table: 'gis_data.projects', desc: 'تعرض المشاريع المسجلة. تستخدم gis_data.projects حالياً. الهدف: ربط بـ projects_core.', needs: ['projects_core.projects', 'ربط تلقائي بـ gis_data'] },
      { name: 'مواقع المشاريع',   path: '/dashboard/admin-gateway/projects/sites',             db: 'PARTIAL',      map: 'LINKED',   phase: 2, table: 'gis_data.sites + gis_data.geometries', desc: 'المواقع الجغرافية للمشاريع — الجسر الرئيسي بين المشاريع والخريطة.', needs: ['مزامنة تلقائية مع projects_core'] },
      { name: 'مهام المشاريع',    path: '/dashboard/admin-gateway/projects/tasks',             db: 'CONNECTED',    map: 'NO',       phase: 2, table: 'project_control.project_tasks (5 مهام)', desc: '5 مهام — مرتبطة بـ /api/v1/hr-structure/project-tasks ✓', needs: [] },
      { name: 'ميزانية المشاريع', path: '/dashboard/admin-gateway/projects/budget',            db: 'CONNECTED', map: 'POSSIBLE', phase: 5, table: 'finance_core.budgets (5 ميزانيات)', desc: '5 ميزانيات — مرتبطة بـ /api/v1/hr-structure/project-budgets ✓', needs: [] },
      { name: 'وثائق المشاريع',   path: '/dashboard/admin-gateway/projects/documents',         db: 'CONNECTED', map: 'NO',       phase: 7, table: 'projects_core.projects (10 مشاريع)', desc: '10 وثائق مشتقة من المشاريع — مرتبطة بـ /api/v1/hr-structure/project-documents ✓', needs: [] },
      { name: 'معالم المشاريع',   path: '/dashboard/admin-gateway/projects/milestones',        db: 'CONNECTED',    map: 'NO',       phase: 2, table: 'project_control.project_milestones (5 معالم)', desc: '5 معالم — مرتبطة بـ /api/v1/hr-structure/project-milestones ✓', needs: [] },
    ],
  },
  {
    title: 'الموارد البشرية', icon: '👥',
    mods: [
      { name: 'الموظفون',          path: '/dashboard/admin-gateway/hr/employees',       db: 'CONNECTED',    map: 'POSSIBLE', phase: 3, table: 'hr_core.employees (15 موظف)', desc: '15 موظف مسجل بالكامل — مرتبطة بـ /api/v1/hr/employees ✓', needs: ['ربط بـ gis_data.projects'] },
      { name: 'الأقسام',           path: '/dashboard/admin-gateway/hr/departments',     db: 'CONNECTED',    map: 'POSSIBLE', phase: 3, table: 'workspace.departments (10 أقسام)', desc: '10 أقسام — مرتبطة بـ /api/v1/workspace/departments ✓', needs: [] },
      { name: 'الدرجات الوظيفية', path: '/dashboard/admin-gateway/hr/grades',          db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.grades (8 صفوف)', desc: '8 درجات وظيفية G1-G8 — مرتبطة بـ /api/v1/hr-structure/grades ✓', needs: [] },
      { name: 'المسميات الوظيفية',path: '/dashboard/admin-gateway/hr/job-titles',      db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.job_titles (12 مسمى)', desc: '12 مسمى وظيفي مُعتمد — مرتبطة بـ /api/v1/hr-structure/job-titles ✓', needs: [] },
      { name: 'المناصب',           path: '/dashboard/admin-gateway/hr/positions',       db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.positions (18 صفاً)', desc: '18 منصباً — مرتبطة بـ /api/v1/hr-structure/positions ✓', needs: [] },
      { name: 'الترقيات',          path: '/dashboard/admin-gateway/hr/promotions',      db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.employee_promotions (5 ترقيات)', desc: '5 ترقيات — مرتبطة بـ /api/v1/hr-structure/promotions ✓ — مع بيانات تجريبية', needs: [] },
      { name: 'التكليفات',         path: '/dashboard/admin-gateway/hr/assignments',     db: 'CONNECTED',    map: 'POSSIBLE', phase: 3, table: 'hr_core.position_assignments (5 تكليفات)', desc: '5 تكليفات — مرتبطة بـ /api/v1/hr-structure/assignments ✓ — الموظف مربوط بمشروع', needs: [] },
      { name: 'الحضور والغياب',   path: '/dashboard/admin-gateway/hr/attendance',      db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.attendance', desc: 'مرتبطة بـ /api/v1/hr/attendance ✓ — جاهزة لاستقبال البيانات', needs: [] },
      { name: 'الإجازات',          path: '/dashboard/admin-gateway/hr/leave-management',db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.leave_requests', desc: 'مرتبطة بـ /api/v1/hr/leave-requests ✓ — مع approve/reject ✓', needs: [] },
      { name: 'عقود الموظفين',    path: '/dashboard/admin-gateway/hr/contracts',       db: 'CONNECTED',    map: 'NO',       phase: 3, table: 'hr_core.contracts (5 عقود)', desc: '5 عقود — مرتبطة بـ /api/v1/hr-structure/contracts ✓', needs: [] },
      { name: 'معلومات الراتب',   path: '/dashboard/admin-gateway/hr/salary-info',     db: 'CONNECTED', map: 'NO',       phase: 5, table: 'hr_core.contracts (5 عقود)', desc: '5 رواتب من العقود — مرتبطة بـ /api/v1/hr-structure/salary-info ✓', needs: [] },
      { name: 'إعداد الرواتب',    path: '/dashboard/admin-gateway/hr/payroll-config',  db: 'CONNECTED', map: 'NO',       phase: 5, table: 'hr_core.grades (8 درجات)', desc: '8 درجات رواتب + بدلات — مرتبطة بـ /api/v1/hr-structure/payroll-config ✓', needs: [] },
    ],
  },
  {
    title: 'المالية والمحاسبة', icon: '💰',
    mods: [
      { name: 'الميزانيات',                path: '/dashboard/admin-gateway/finance/budgets',            db: 'CONNECTED',    map: 'POSSIBLE', phase: 5, table: 'finance_core.budgets (5 صفوف)', desc: '5 ميزانيات بإجمالي 23.7M — مرتبطة بـ /api/v1/finance/budgets ✓', needs: [] },
      { name: 'التخصيصات',                 path: '/dashboard/admin-gateway/finance/allocations',        db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'finance_core.budget_allocations (4 صفوف)', desc: '4 تخصيصات — مرتبطة بـ /api/v1/finance/budgets/{id}/allocations ✓', needs: [] },
      { name: 'المصروفات',                 path: '/dashboard/admin-gateway/finance/expenses',           db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'finance_core.expenses', desc: 'مرتبطة بـ /api/v1/finance/expenses ✓ — 6 فئات مصروفات موجودة', needs: [] },
      { name: 'التحويلات المالية',          path: '/dashboard/admin-gateway/finance/transfers',          db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'finance_core.budget_transfers', desc: 'مرتبطة بـ /api/v1/finance/budget-transfers ✓', needs: [] },
      { name: 'تتبع الأصول المالية',        path: '/dashboard/admin-gateway/finance/asset-tracking',    db: 'CONNECTED', map: 'NO',       phase: 5, table: 'operations_core.assets (10 أصول)', desc: '10 تقييمات — مرتبطة بـ /api/v1/hr-structure/asset-valuations ✓', needs: [] },
      { name: 'قيود اليومية',              path: '/dashboard/admin-gateway/accounting/journal-entries', db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'accounting_core.journal_entries (5 قيود)', desc: '5 قيود محاسبية مع أسطرها — مرتبطة بـ /api/v1/accounting/journal-entries ✓', needs: [] },
      { name: 'مخطط الحسابات',            path: '/dashboard/admin-gateway/accounting/chart-of-accounts',db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'accounting_core.chart_of_accounts (8 حسابات)', desc: '8 حسابات رئيسية — مرتبطة بـ /api/v1/accounting/chart-of-accounts ✓', needs: [] },
      { name: 'مراكز التكلفة',             path: '/dashboard/admin-gateway/accounting/cost-centers',   db: 'CONNECTED',    map: 'POSSIBLE', phase: 5, table: 'accounting_core.cost_centers (5 مراكز)', desc: '5 مراكز تكلفة — مرتبطة بـ /api/v1/accounting/cost-centers ✓', needs: ['gis_data'] },
      { name: 'الفواتير',                  path: '/dashboard/admin-gateway/revenue/invoices',           db: 'CONNECTED',    map: 'NO',       phase: 5, table: 'revenue_core.invoices (5 فواتير)', desc: '5 فواتير بإجمالي 8.75M — مرتبطة بـ /api/v1/revenue/invoices ✓', needs: [] },
      { name: 'التحصيلات',                path: '/dashboard/admin-gateway/revenue/collections',        db: 'CONNECTED', map: 'NO',       phase: 5, table: 'revenue_core.collections', desc: 'مرتبطة بـ /api/v1/revenue/collections ✓ — الفواتير متاحة', needs: [] },
      { name: 'العملاء',                   path: '/dashboard/admin-gateway/revenue/customers',          db: 'CONNECTED',    map: 'POSSIBLE', phase: 5, table: 'revenue_core.customers (5 عملاء)', desc: '5 عملاء مسجلون — مرتبطة بـ /api/v1/revenue/customers ✓', needs: [] },
    ],
  },
  {
    title: 'الأصول والصيانة والتآكل', icon: '🔧',
    mods: [
      { name: 'سجل الأصول',      path: '/dashboard/admin-gateway/assets/registry',           db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'operations_core.assets (10 أصول)', desc: '10 أصول بإحداثيات جغرافية — مرتبطة بـ /api/v1/operations/assets ✓', needs: ['ربط بـ gis_data للخريطة'] },
      { name: 'صحة الأصول',      path: '/dashboard/admin-gateway/assets/health',             db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'operations_core.assets (10 أصول)', desc: '10 أصول بحالاتها — مرتبطة بـ /api/v1/hr-structure/asset-health ✓', needs: [] },
      { name: 'تقييمات الأصول',  path: '/dashboard/admin-gateway/assets/valuations',         db: 'CONNECTED',    map: 'NO',       phase: 4, table: 'operations_core.assets (10 تقييمات)', desc: 'القيمة الدفترية والاستهلاك — مرتبطة بـ /api/v1/hr-structure/asset-valuations ✓', needs: [] },
      { name: 'مراجعات الأصول',  path: '/dashboard/admin-gateway/assets/reviews',            db: 'CONNECTED', map: 'NO',       phase: 4, table: 'workspace.assets (سير عمل المراجعة)', desc: 'سير عمل المراجعة متعدد المستويات — مرتبطة بـ /api/v1/review/* ✓', needs: [] },
      { name: 'تصنيفات الأصول',  path: '/dashboard/admin-gateway/assets/categories',         db: 'CONNECTED',    map: 'NO',       phase: 4, table: 'operations_core.asset_types (5 تصنيفات)', desc: '5 تصنيفات — مرتبطة بـ /api/v1/hr-structure/asset-categories ✓', needs: [] },
      { name: 'إدارة الصيانة',   path: '/dashboard/maintenance',                          db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'maintenance_core.assets_to_maintain (5 أصول)', desc: '5 أصول + إدارة طلبات الصيانة — مرتبطة بـ /api/v1/maintenance/* ✓', needs: [] },
      { name: 'أوامر الصيانة',   path: '/dashboard/admin-gateway/maintenance/work-orders',   db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'operations_core.work_orders (5 أوامر)', desc: '5 أوامر صيانة (وقائية + تصحيحية) — مرتبطة بـ /api/v1/operations/work-orders ✓', needs: [] },
      { name: 'الصيانة الوقائية',path: '/dashboard/admin-gateway/maintenance/preventive',    db: 'CONNECTED', map: 'NO',       phase: 4, table: 'operations_core.assets (جدول صيانة)', desc: 'اشتقاق جداول الصيانة من تواريخ الأصول — /api/v1/hr-structure/preventive-maintenance ✓', needs: [] },
      { name: 'قطع الغيار',      path: '/dashboard/admin-gateway/maintenance/spare-parts',   db: 'CONNECTED', map: 'NO',       phase: 6, table: 'inventory_core.inventory_items (8 أصناف)', desc: '8 أصناف مخزون — مرتبطة بـ /api/v1/hr-structure/spare-parts ✓', needs: [] },
      { name: 'فرق الصيانة',     path: '/dashboard/admin-gateway/maintenance/teams',         db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'operations_core.maintenance_teams (5 فرق)', desc: '5 فرق صيانة — مرتبطة بـ /api/v1/hr-structure/maintenance-teams ✓', needs: [] },
      { name: 'إدارة التآكل',    path: '/dashboard/admin-gateway/corrosion',                 db: 'CONNECTED', map: 'POSSIBLE', phase: 4, table: 'corrosion_data (48 قراءة)', desc: '48 قراءة تآكل — مرتبطة بـ /api/v1/corrosion/* ✓ — 2 pipelines + cp-analysis', needs: [] },
      { name: 'المركبات',         path: '/dashboard/admin-gateway/vehicles/vehicles',         db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'fleet_core.vehicles (5 مركبات)', desc: '5 مركبات — مرتبطة بـ /api/v1/fleet/vehicles ✓', needs: ['إضافة GPS للخريطة'] },
      { name: 'المعدات',          path: '/dashboard/admin-gateway/vehicles/equipment',        db: 'CONNECTED',    map: 'POSSIBLE', phase: 4, table: 'fleet_core.equipment (4 معدات)', desc: '4 معدات — مرتبطة بـ /api/v1/fleet/equipment ✓', needs: [] },
      { name: 'استهلاك الوقود',  path: '/dashboard/admin-gateway/vehicles/fuel',             db: 'CONNECTED',    map: 'NO',       phase: 4, table: 'fleet_core.fuel_records (5 صفوف)', desc: '5 سجلات وقود — مرتبطة بـ /api/v1/fleet/fuel ✓', needs: [] },
    ],
  },
  {
    title: 'المشتريات والمخزون', icon: '📦',
    mods: [
      { name: 'طلبات الشراء',    path: '/dashboard/admin-gateway/procurement/requests',    db: 'CONNECTED',    map: 'NO',       phase: 6, table: 'procurement_core.purchase_requests (4 صفوف)', desc: '4 طلبات شراء — مرتبطة بـ /api/v1/procurement/requests ✓', needs: [] },
      { name: 'أوامر الشراء',    path: '/dashboard/admin-gateway/procurement/orders',      db: 'CONNECTED',    map: 'NO',       phase: 6, table: 'procurement_core.purchase_orders (3 صفوف)', desc: '3 أوامر شراء — مرتبطة بـ /api/v1/procurement/orders ✓', needs: [] },
      { name: 'الموردون',         path: '/dashboard/admin-gateway/procurement/suppliers',   db: 'CONNECTED',    map: 'POSSIBLE', phase: 6, table: 'procurement_core.suppliers (5 صفوف)', desc: '5 موردين — مرتبطة بـ /api/v1/procurement/suppliers ✓', needs: ['إضافة إحداثيات للخريطة'] },
      { name: 'المستودعات',       path: '/dashboard/admin-gateway/inventory/warehouses',    db: 'CONNECTED',    map: 'POSSIBLE', phase: 6, table: 'inventory_core.warehouses (4 صفوف)', desc: '4 مستودعات — مرتبطة بـ /api/v1/inventory/warehouses ✓', needs: ['إضافة إحداثيات للخريطة'] },
      { name: 'الأصناف',          path: '/dashboard/admin-gateway/inventory/items',         db: 'CONNECTED',    map: 'NO',       phase: 6, table: 'inventory_core.inventory_items (8 أصناف)', desc: '8 أصناف — مرتبطة بـ /api/v1/inventory/items ✓', needs: [] },
      { name: 'حركات الاستلام',  path: '/dashboard/admin-gateway/inventory/receipts',      db: 'CONNECTED',    map: 'NO',       phase: 6, table: 'inventory_core.stock_receipts', desc: 'مرتبطة بـ /api/v1/inventory/receipts ✓ — جاهزة لاستقبال البيانات', needs: [] },
      { name: 'حركات الصرف',     path: '/dashboard/admin-gateway/inventory/issues',        db: 'CONNECTED',    map: 'NO',       phase: 6, table: 'inventory_core.stock_issues', desc: 'مرتبطة بـ /api/v1/inventory/issues ✓', needs: [] },
    ],
  },
  {
    title: 'المراسلات وسير العمل والعقود', icon: '📨',
    mods: [
      { name: 'البريد الوارد',         path: '/dashboard/admin-gateway/correspondence/incoming', db: 'CONNECTED', map: 'POSSIBLE', phase: 7, table: 'admin_core.incoming_letters (6 صفوف)', desc: '6 مراسلات واردة — /api/v1/correspondence/incoming-letters ✓', needs: [] },
      { name: 'البريد الصادر',         path: '/dashboard/admin-gateway/correspondence/outgoing', db: 'CONNECTED', map: 'POSSIBLE', phase: 7, table: 'admin_core.outgoing_letters (4 صفوف)', desc: '4 مراسلات صادرة — /api/v1/correspondence/outgoing-letters ✓', needs: [] },
      { name: 'المراسلات الداخلية',    path: '/dashboard/admin-gateway/correspondence/internal', db: 'CONNECTED', map: 'NO', phase: 7, table: 'admin_core.internal_memos (3 مذكرات)', desc: '3 مذكرات داخلية مرتبطة بالموظفين — /api/v1/correspondence/internal-memos ✓', needs: [] },
      { name: 'الأرشيف',              path: '/dashboard/admin-gateway/correspondence/archive',  db: 'CONNECTED', map: 'NO', phase: 7, table: 'admin_core.*', desc: 'أرشيف المراسلات — يعرض البيانات المكتملة من جميع جداول المراسلات.', needs: [] },
      { name: 'العقود',                path: '/dashboard/admin-gateway/contracts/list',         db: 'CONNECTED', map: 'POSSIBLE', phase: 7, table: 'contracts_core.contracts (5 صفوف)', desc: '5 عقود بإجمالي 13.8M د.ل — /api/v1/contracts ✓', needs: [] },
      { name: 'المقاولون',             path: '/dashboard/admin-gateway/contracts/contractors',  db: 'CONNECTED', map: 'POSSIBLE', phase: 7, table: 'contracts_core.contractors (5 صفوف)', desc: '5 مقاولين مسجلون — /api/v1/contracts/contractors ✓', needs: [] },
      { name: 'طلبات سير العمل',      path: '/dashboard/admin-gateway/workflow/requests',      db: 'CONNECTED', map: 'NO', phase: 7, table: 'workflow_core.approval_requests (5 صفوف)', desc: '5 طلبات — /api/v1/approval/requests ✓', needs: [] },
      { name: 'الموافقات',             path: '/dashboard/admin-gateway/workflow/approvals',    db: 'CONNECTED', map: 'NO', phase: 7, table: 'workflow_core.approval_requests', desc: '2 طلبات معلقة — /api/v1/approval/requests/pending ✓', needs: [] },
      { name: 'نماذج سير العمل',      path: '/dashboard/admin-gateway/workflow/templates',    db: 'CONNECTED', map: 'NO', phase: 7, table: 'workflow_core.workflow_templates (13 صفوف)', desc: '5 أنواع عمليات — /api/v1/approval/templates ✓', needs: [] },
    ],
  },
  {
    title: 'الذكاء والتحليل والتقارير', icon: '📊',
    mods: [
      { name: 'منصة الذكاء',          path: '/dashboard/admin-gateway/platform-intelligence',                      db: 'PARTIAL',      map: 'POSSIBLE', phase: 8, table: 'AI Backend :7860', desc: 'تحليلات AI لأداء المنظومة. مرتبط جزئياً بـ backend. الصفحات الفرعية غير مربوطة.', needs: ['ربط كل الإدارات بنظام الذكاء'] },
      { name: 'التحليلات',            path: '/dashboard/admin-gateway/platform-intelligence/analytics',            db: 'CONNECTED', map: 'NO',       phase: 8, table: 'projects_core + assets + employees', desc: 'تحليلات أداء المدينة — مرتبطة بـ /api/v1/hr-structure/analytics/* ✓', needs: [] },
      { name: 'المراقبة الفورية',     path: '/dashboard/admin-gateway/platform-intelligence/monitoring',           db: 'CONNECTED', map: 'POSSIBLE', phase: 8, table: 'operations_core.work_orders + assets', desc: 'مراقبة الأداء الفوري — مرتبطة بـ /api/v1/hr-structure/monitoring/* ✓', needs: [] },
      { name: 'التحليل التنبؤي',     path: '/dashboard/admin-gateway/platform-intelligence/predictive-analytics', db: 'CONNECTED', map: 'POSSIBLE', phase: 8, table: 'projects_core.projects (6 نشط)', desc: 'توقعات المشاريع — مرتبطة بـ /api/v1/hr-structure/forecasts/critical ✓', needs: [] },
      { name: 'إدارة المخاطر',        path: '/dashboard/admin-gateway/platform-intelligence/risk-management',      db: 'CONNECTED', map: 'POSSIBLE', phase: 8, table: 'operations_core.assets (5 أنواع)', desc: 'تحليل المخاطر — مرتبطة بـ /api/v1/hr-structure/analytics/infrastructure-usage ✓', needs: [] },
      { name: 'محاكاة السيناريوهات', path: '/dashboard/admin-gateway/platform-intelligence/scenario-simulation',  db: 'CONNECTED', map: 'NO',       phase: 8, table: 'projects_core.projects (10 مشاريع)', desc: 'سيناريوهات مشتقة من المشاريع — مرتبطة بـ /api/v1/hr-structure/scenarios ✓', needs: [] },
      { name: 'الذكاء المكاني',       path: '/dashboard/admin-gateway/platform-intelligence/spatial-intelligence', db: 'CONNECTED', map: 'LINKED',   phase: 8, table: 'operations_core.asset_types (5 أنواع)', desc: 'بيانات الأصول الجغرافية — مرتبطة بـ /api/v1/hr-structure/analytics/infrastructure-usage ✓', needs: [] },
      { name: 'الإحاطة التنفيذية',   path: '/dashboard/admin-gateway/intelligence/briefing',                     db: 'CONNECTED', map: 'NO',       phase: 8, table: 'gov-reports: executive + operations', desc: 'إحاطة يومية للقيادة — مرتبطة بـ /api/v1/gov-reports/executive ✓', needs: [] },
      { name: 'مركز القيادة الذكي',  path: '/dashboard/admin-gateway/intelligence/command',                      db: 'CONNECTED', map: 'POSSIBLE', phase: 8, table: 'gov-reports: executive + operations', desc: 'قيادة ذكية — مرتبطة بـ /api/v1/gov-reports/* ✓', needs: [] },
      { name: 'التوقعات',             path: '/dashboard/admin-gateway/intelligence/forecast',                     db: 'CONNECTED', map: 'NO',       phase: 8, table: 'gov-reports: executive + financial', desc: 'توقعات مالية وتشغيلية — مرتبطة بـ /api/v1/gov-reports/financial ✓', needs: [] },
      { name: 'الأداء',               path: '/dashboard/admin-gateway/intelligence/performance',                  db: 'CONNECTED', map: 'NO',       phase: 8, table: 'gov-reports + approval_requests', desc: 'مؤشرات الأداء — مرتبطة بـ /api/v1/gov-reports/* + /approval/summary ✓', needs: [] },
      { name: 'المخاطر',              path: '/dashboard/admin-gateway/intelligence/risk',                         db: 'CONNECTED', map: 'POSSIBLE', phase: 8, table: 'gov-reports: executive + financial', desc: 'خريطة المخاطر — مرتبطة بـ /api/v1/gov-reports/* ✓', needs: [] },
      { name: 'التقارير التنفيذية',  path: '/dashboard/admin-gateway/reports/executive',                         db: 'CONNECTED',    map: 'NO',       phase: 8, table: 'finance_core + hr_core + operations_core', desc: 'ملخص تنفيذي للقيادة — مرتبطة بـ /api/v1/gov-reports/executive ✓', needs: [] },
      { name: 'التقارير المالية',    path: '/dashboard/admin-gateway/reports/financial',                         db: 'CONNECTED',    map: 'NO',       phase: 8, table: 'finance_core.budgets + expenses + invoices', desc: 'تقارير الميزانية والصرف والإيرادات — مرتبطة بـ /api/v1/gov-reports/financial ✓', needs: [] },
      { name: 'التقارير التشغيلية', path: '/dashboard/admin-gateway/reports/operations',                        db: 'CONNECTED',    map: 'NO',       phase: 8, table: 'operations_core + fleet_core + projects', desc: 'تقارير العمليات — مرتبطة بـ /api/v1/gov-reports/operations ✓', needs: [] },
      { name: 'تقارير المشتريات',   path: '/dashboard/admin-gateway/reports/procurement',                       db: 'CONNECTED',    map: 'NO',       phase: 8, table: 'procurement_core (5 موردين، 4 طلبات، 3 أوامر)', desc: 'تقارير الشراء والموردين — مرتبطة بـ /api/v1/gov-reports/procurement ✓', needs: [] },
      { name: 'الإشعارات',           path: '/dashboard/admin-gateway/notifications',                             db: 'CONNECTED', map: 'NO',       phase: 8, table: 'workspace.notifications (فعّال)', desc: 'تنبيهات تلقائية — مرتبطة بـ /api/v1/integration/notifications ✓', needs: [] },
    ],
  },
  {
    title: 'صفحات أخرى', icon: '🔍',
    mods: [
      { name: 'صفحة القسم',           path: '/dashboard/departments/[code]',     db: 'CONNECTED', map: 'POSSIBLE', phase: 3, table: 'store/activatedDepartments', desc: 'صفحة ديناميكية لكل قسم من Zustand store — تعرض معلومات القسم وطلبات الاعتماد', needs: [] },
    ],
  },
];
