export type InstalledAppScope =
  | 'corrosion'
  | 'maintenance'
  | 'admin-affairs'
  | 'finance'
  | 'materials'
  | 'services'
  | 'remote-sensing'
  | 'all';

// Aliases that map to canonical scopes (for forward/back compat)
const SCOPE_ALIASES: Record<string, InstalledAppScope> = {
  platform: 'all',
  gis: 'remote-sensing',
};

type DeptLike = {
  department_code?: string | null;
  category?: string | null;
  name_ar?: string | null;
  custom_name_ar?: string | null;
  frontend_route?: string | null;
};

const APP_SCOPE_VALUES: InstalledAppScope[] = [
  'corrosion',
  'maintenance',
  'admin-affairs',
  'finance',
  'materials',
  'services',
  'remote-sensing',
  'all',
];

const APP_SCOPE_ALLOWED_PREFIXES: Record<Exclude<InstalledAppScope, 'all'>, string[]> = {
  corrosion: [
    '/dashboard/admin-gateway/corrosion',
    '/dashboard/corrosion',
    '/dashboard/operations-maintenance',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  maintenance: [
    '/dashboard/admin-gateway/maintenance',
    '/dashboard/maintenance',
    '/dashboard/admin-gateway/projects',
    '/dashboard/operations-maintenance',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  'admin-affairs': [
    '/dashboard/admin-control',
    '/dashboard/hr-center',
    '/dashboard/admin-gateway/hr',
    '/dashboard/admin-gateway/admin-dept',
    '/dashboard/admin-gateway/security',
    '/dashboard/admin-gateway/correspondence',
    '/dashboard/admin-gateway/contracts',
    '/dashboard/admin-gateway/workflow',
    '/dashboard/admin-gateway/org-structure',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  finance: [
    '/dashboard/finance-hub',
    '/dashboard/admin-gateway/finance',
    '/dashboard/admin-gateway/accounting',
    '/dashboard/admin-gateway/revenue',
    '/dashboard/admin-gateway/reports/financial',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  materials: [
    '/dashboard/digital-assets',
    '/dashboard/asset-intelligence',
    '/dashboard/admin-gateway/assets',
    '/dashboard/admin-gateway/inventory',
    '/dashboard/admin-gateway/procurement',
    '/dashboard/admin-gateway/materials',
    '/dashboard/admin-gateway/vehicles',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  services: [
    '/dashboard/ai-assistant',
    '/dashboard/spatial-analytics',
    '/dashboard/system-explorer',
    '/dashboard/command-center',
    '/dashboard/map-shell',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
  'remote-sensing': [
    '/dashboard/gis-sovereignty',
    '/dashboard/spatial-analytics',
    '/dashboard/asset-intelligence',
    '/dashboard/map-shell',
    '/dashboard/ai-assistant',
    '/dashboard/my-workspace',
    '/dashboard/my-portal',
  ],
};

function norm(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeAppScope(value?: string | null): InstalledAppScope {
  const raw = norm(value);
  if (!raw) return 'all';
  // Check canonical values first
  const canonical = APP_SCOPE_VALUES.find((entry) => entry === raw);
  if (canonical) return canonical as InstalledAppScope;
  // Check aliases (e.g. "platform" → "all", "gis" → "remote-sensing")
  if (raw in SCOPE_ALIASES) return SCOPE_ALIASES[raw];
  return 'all';
}

export function getDefaultRouteForScope(scopeValue?: string | null): string {
  const scope = normalizeAppScope(scopeValue);
  switch (scope) {
    case 'corrosion':
      return '/dashboard/admin-gateway/corrosion/manager';
    case 'maintenance':
      return '/dashboard/admin-gateway/maintenance';
    case 'admin-affairs':
      return '/dashboard/admin-gateway/hr';
    case 'finance':
      return '/dashboard/finance-hub';
    case 'materials':
      return '/dashboard/admin-gateway/assets';
    case 'services':
      return '/dashboard/command-center';
    case 'remote-sensing':
      return '/dashboard/gis-sovereignty/remote-sensing-center';
    default:
      return '/dashboard';
  }
}

export function canAccessPathForScope(pathname: string, scopeValue?: string | null): boolean {
  const scope = normalizeAppScope(scopeValue);
  if (scope === 'all') return true;
  if (pathname === '/dashboard') return true;
  if (pathname.startsWith('/dashboard/departments/')) return true;

  const allowPrefixes = APP_SCOPE_ALLOWED_PREFIXES[scope];
  return allowPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isDepartmentVisibleForScope(dept: DeptLike, scopeValue?: string | null): boolean {
  const scope = normalizeAppScope(scopeValue);
  if (scope === 'all') return true;

  const code = norm(dept.department_code);
  const category = norm(dept.category);
  const name = `${norm(dept.name_ar)} ${norm(dept.custom_name_ar)}`.trim();
  const route = norm(dept.frontend_route);

  const hasAny = (...values: string[]) => values.some((value) => code.includes(value) || category.includes(value) || name.includes(value) || route.includes(value));

  switch (scope) {
    case 'corrosion':
      return hasAny('corr', 'corrosion', 'تآكل', 'maintenance', 'maint', 'صيانة');
    case 'maintenance':
      return hasAny('maint', 'maintenance', 'project', 'proj', 'صيانة', 'مشاريع', 'تشغيل');
    case 'admin-affairs':
      return hasAny('admin', 'hr', 'legal', 'إدار', 'الموارد', 'بشر', 'عقود', 'مراس');
    case 'finance':
      return hasAny('fin', 'finance', 'account', 'مالي', 'محاسب', 'ميزاني');
    case 'materials':
      return hasAny('asset', 'inventory', 'warehouse', 'proc', 'مواد', 'مخزون', 'أصول', 'مشتري');
    case 'services':
      return hasAny('intel', 'service', 'analytics', 'ai', 'ذكاء', 'تحليل', 'خدمات', 'تقارير');
    case 'remote-sensing':
      return hasAny('gis', 'survey', 'remote', 'map', 'spatial', 'استشعار', 'مكاني', 'جغراف');
    default:
      return true;
  }
}

export function getScopesForDepartmentCode(departmentCode?: string | null): InstalledAppScope[] {
  const code = norm(departmentCode).replace('dept_', '');
  if (!code) return ['all'];

  if (code.includes('corr')) return ['corrosion'];
  if (code.includes('maint') || code.includes('ops') || code.includes('proj')) return ['maintenance'];
  if (code.includes('fin') || code.includes('account')) return ['finance'];
  if (code.includes('hr') || code.includes('admin') || code.includes('legal')) return ['admin-affairs'];
  if (code.includes('asset') || code.includes('proc') || code.includes('warehouse') || code.includes('inventory')) return ['materials'];
  if (code.includes('gis') || code.includes('survey') || code.includes('remote')) return ['remote-sensing'];
  if (code.includes('intel') || code.includes('service') || code.includes('ai')) return ['services'];

  return ['all'];
}
