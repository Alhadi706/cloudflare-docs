/**
 * RBAC — Role-Based Access Control Registry
 * ══════════════════════════════════════════
 * Single source of truth for:
 *   - Role hierarchy levels
 *   - Route access rules (which roles can visit which paths)
 *   - Map layer scope (which layers visible per role+dept)
 *   - Post-login home route (where to redirect after authentication)
 *   - Sidebar nav visibility per role
 *
 * All role-checking helpers are pure functions — safe to import in
 * both server (middleware, API routes) and client (Sidebar, page components).
 */

import type { UserRole, DepartmentCode } from './user-store';
import { getDefaultRouteForScope, normalizeAppScope } from './appScope';

// ── Role hierarchy (higher number = broader access) ──────────────────────────
export const ROLE_LEVEL: Record<UserRole, number> = {
  founder:         100,
  admin:           90,
  dept_manager:    60,
  section_manager: 40,
  supervisor:      30,
  employee:        20,
  member:          10,
};

/** Returns true if `role` has at least the same level as `minRole` */
export function atLeast(role: UserRole, minRole: UserRole): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[minRole] ?? 0);
}

// ── Route access rules ───────────────────────────────────────────────────────
/**
 * Each entry: { prefix, minRole, deptCodes? }
 *   prefix    — pathname prefix that this rule applies to
 *   minRole   — minimum role required (using ROLE_LEVEL comparison)
 *   deptCodes — if set, dept_manager/section_manager/supervisor/employee must
 *               also belong to one of these departments
 *
 * Rules are checked in order — first match wins.
 */
export interface RouteRule {
  prefix:     string;
  minRole:    UserRole;
  deptCodes?: DepartmentCode[];  // restrict to these departments (for non-admin roles)
}

export const ROUTE_RULES: RouteRule[] = [
  // ── Full admin routes — founder + admin only ─────────────────────────────
  { prefix: '/dashboard/admin-gateway/system',     minRole: 'admin' },
  { prefix: '/dashboard/admin-gateway/ai-engine',  minRole: 'admin' },
  { prefix: '/dashboard/admin-gateway/audit',      minRole: 'admin' },

  // ── Corrosion app routes (department-scoped) ─────────────────────────────
  // Keep these before generic /dashboard/admin-gateway rule.
  {
    prefix: '/dashboard/admin-gateway/corrosion/manager',
    minRole: 'dept_manager',
    deptCodes: ['CORR'],
  },
  {
    prefix: '/dashboard/admin-gateway/corrosion/monitoring',
    minRole: 'employee',
    deptCodes: ['CORR'],
  },
  {
    prefix: '/dashboard/admin-gateway/corrosion/support',
    minRole: 'employee',
    deptCodes: ['CORR'],
  },
  {
    prefix: '/dashboard/admin-gateway/corrosion/coating',
    minRole: 'employee',
    deptCodes: ['CORR'],
  },
  {
    prefix: '/dashboard/admin-gateway/corrosion',
    minRole: 'employee',
    deptCodes: ['CORR'],
  },

  // ── Admin gateway (all pages) — admin level minimum ──────────────────────
  { prefix: '/dashboard/admin-gateway',            minRole: 'admin' },

  // ── GIS Sovereignty — GIS department + admin level ───────────────────────
  {
    prefix: '/dashboard/gis-sovereignty',
    minRole: 'dept_manager',
    deptCodes: ['GIS'],
  },

  // ── Operations & Maintenance — Maintenance department + admin level ───────
  {
    prefix: '/dashboard/operations-maintenance',
    minRole: 'dept_manager',
    deptCodes: ['MAINT'],
  },

  // ── Control Center — إدارة التحكم (ضغوط + إنتاج + توزيع) ────────────────
  {
    prefix: '/dashboard/control-center/admin',
    minRole: 'dept_manager',
    deptCodes: ['CTRL'],
  },
  {
    prefix: '/dashboard/control-center',
    minRole: 'supervisor',
    deptCodes: ['CTRL'],
  },

  // ── Documentation & Information ─────────────────────────────────────────
  {
    prefix: '/dashboard/documentation-hub',
    minRole: 'dept_manager',
    deptCodes: ['DOC', 'ADMIN', 'HR'],
  },

  // ── Projects Control — PROJ department + admin ────────────────────────────
  {
    prefix: '/dashboard/projects-control',
    minRole: 'dept_manager',
    deptCodes: ['PROJ'],
  },

  // ── Command center — supervisors and above ───────────────────────────────
  { prefix: '/dashboard/command-center',           minRole: 'supervisor' },
    // ── Operations & Maintenance Demo — public/all authenticated ──────────────
    { prefix: '/dashboard/operations-maintenance/demo',  minRole: 'employee' },
  
  // ── AI assistant — all authenticated ────────────────────────────────────
  { prefix: '/dashboard/ai-assistant',             minRole: 'employee' },

  // ── Department workspace — dept_manager and below ───────────────────────
  { prefix: '/dashboard/dept-workspace',           minRole: 'employee' },

  // ── My workspace / My portal — all authenticated ─────────────────────────
  { prefix: '/dashboard/my-workspace',             minRole: 'employee' },
  { prefix: '/dashboard/my-portal',                minRole: 'employee' },

  // ── Spatial analytics ── supervisors+ ───────────────────────────────────
  { prefix: '/dashboard/spatial-analytics',        minRole: 'supervisor' },

  // ── Asset intelligence — all authenticated ───────────────────────────────
  { prefix: '/dashboard/asset-intelligence',       minRole: 'employee' },

  // ── New department hubs ──────────────────────────────────────────────────
  { prefix: '/dashboard/engineering',  minRole: 'employee',  deptCodes: ['ENG'] },
  { prefix: '/dashboard/procurement',  minRole: 'employee',  deptCodes: ['PROC'] },
  { prefix: '/dashboard/fleet',        minRole: 'employee',  deptCodes: ['FLEET'] },
  { prefix: '/dashboard/communications', minRole: 'employee' },
  { prefix: '/dashboard/contracts',    minRole: 'dept_manager' },
  { prefix: '/dashboard/corrosion',    minRole: 'employee',  deptCodes: ['CORR'] },
  { prefix: '/dashboard/intelligence', minRole: 'supervisor' },
];

/**
 * Check if a role+dept combination can access a given pathname.
 * Founders and admins bypass all department restrictions.
 */
export function canAccessRoute(
  role:    UserRole,
  deptCode: DepartmentCode | undefined | null,
  pathname: string
): boolean {
  const rule = ROUTE_RULES.find(r => pathname.startsWith(r.prefix));
  if (!rule) return true; // no rule = open

  // Check minimum level
  if (!atLeast(role, rule.minRole)) return false;

  // If rule has department restriction and user is below admin level
  if (rule.deptCodes && !atLeast(role, 'admin')) {
    return rule.deptCodes.includes(deptCode as DepartmentCode);
  }

  return true;
}

// ── Post-login home route ────────────────────────────────────────────────────
/**
 * Where to redirect the user immediately after a successful login.
 */
/** Maps department codes to their primary dashboard route */
export const DEPT_DASHBOARD: Record<string, string> = {
  ADMIN:    '/dashboard/admin-control',
  HR:       '/dashboard/hr-center',
  FIN:      '/dashboard/finance-hub',
  MAINT:    '/dashboard/maintenance',
  GIS:      '/dashboard/gis-sovereignty',
  PROJ:     '/dashboard/projects-control',
  OPS:      '/dashboard/operations-maintenance',
  ASSET:    '/dashboard/digital-assets',
  CORR:     '/dashboard/corrosion',
  CTRL:     '/dashboard/control-center',
  FLEET:    '/dashboard/fleet',
  INTEL:    '/dashboard/intelligence',
  PROC:     '/dashboard/procurement',
  CONT:     '/dashboard/contracts',
  COMM:     '/dashboard/communications',
  DOC:      '/dashboard/documentation-hub',
  ENG:      '/dashboard/map-shell?pack=engineering',
  LEGAL:    '/dashboard/admin-control',
  IT:       '/dashboard/system-explorer',
};

export function getHomeRoute(
  role: UserRole,
  deptCode?: DepartmentCode | null,
  appScope?: string | null,
): string {
  // If a specific app scope is set, always route there first (for admin/founder too)
  const scope = normalizeAppScope(appScope);
  if (scope !== 'all') {
    return getDefaultRouteForScope(scope);
  }

  if (role === 'founder' || role === 'admin') {
    return '/dashboard/gm-office';
  }

  // Corrosion users have a dedicated gateway regardless of role level.
  if (deptCode === 'CORR') {
    if (role === 'dept_manager') return '/dashboard/admin-gateway/corrosion/manager';
    return '/dashboard/admin-gateway/corrosion';
  }

  // Department managers and section managers go to their specific dashboard
  if ((role === 'dept_manager' || role === 'section_manager' || role === 'supervisor') && deptCode) {
    const route = DEPT_DASHBOARD[deptCode as string];
    if (route) return route;
  }
  return '/dashboard';
}

// ── Map layer scope ──────────────────────────────────────────────────────────
/**
 * Each layer pack identifier that a role+dept can see on the unified map.
 * '*' means all layers (admin/founder).
 *
 * Layer pack identifiers (aligned with UnifiedMapEngine layer system):
 *   base          — Libya base map (OpenStreetMap / Esri satellite)
 *   projects      — GIS project polygons / points
 *   maintenance   — corridor maintenance, defect markers
 *   finance       — payment zones, budget overlays
 *   hr            — personnel locations, org chart pins
 *   assets        — fixed asset locations
 *   corrosion     — CP layers, corrosion risk heat maps
 *   procurement   — vendor locations, delivery routes
 */
export type LayerPackId =
  | 'base'
  | 'projects'
  | 'maintenance'
  | 'finance'
  | 'hr'
  | 'assets'
  | 'corrosion'
  | 'procurement'
  | '*';

export interface LayerScope {
  layerPacks: LayerPackId[];
  canToggleLayers: boolean;   // can user show/hide individual layers?
  canEditFeatures: boolean;   // can user create/edit map features?
}

const ALL_LAYERS: LayerPackId[] = [
  'base', 'projects', 'maintenance', 'finance', 'hr', 'assets', 'corrosion', 'procurement',
];

export function getLayerScope(role: UserRole, deptCode?: DepartmentCode | null): LayerScope {
  if (atLeast(role, 'admin')) {
    return { layerPacks: ALL_LAYERS, canToggleLayers: true, canEditFeatures: true };
  }

  const base: LayerPackId[] = ['base'];

  switch (deptCode) {
    case 'GIS':
      return {
        layerPacks: [...base, 'projects', 'assets', 'corrosion'],
        canToggleLayers: role === 'dept_manager' || role === 'section_manager',
        canEditFeatures: role === 'dept_manager',
      };
    case 'MAINT':
      return {
        layerPacks: [...base, 'maintenance', 'corrosion', 'assets'],
        canToggleLayers: true,
        canEditFeatures: role === 'dept_manager',
      };
    case 'FIN':
      return {
        layerPacks: [...base, 'finance', 'projects'],
        canToggleLayers: role === 'dept_manager',
        canEditFeatures: false,
      };
    case 'HR':
      return {
        layerPacks: [...base, 'hr'],
        canToggleLayers: role === 'dept_manager',
        canEditFeatures: false,
      };
    case 'PROC':
      return {
        layerPacks: [...base, 'procurement', 'assets'],
        canToggleLayers: role === 'dept_manager',
        canEditFeatures: false,
      };
    case 'ASSET':
      return {
        layerPacks: [...base, 'assets', 'projects'],
        canToggleLayers: true,
        canEditFeatures: role === 'dept_manager',
      };
    case 'PROJ':
      return {
        layerPacks: [...base, 'projects', 'assets'],
        canToggleLayers: role === 'dept_manager' || role === 'section_manager',
        canEditFeatures: role === 'dept_manager',
      };
    case 'ENG':
      return {
        layerPacks: [...base, 'assets'],
        canToggleLayers: role === 'dept_manager',
        canEditFeatures: false,
      };
    case 'CORR':
      return {
        layerPacks: [...base, 'corrosion', 'assets'],
        canToggleLayers: true,
        canEditFeatures: role === 'dept_manager',
      };
    default:
      return { layerPacks: base, canToggleLayers: false, canEditFeatures: false };
  }
}

// ── Sidebar nav visibility ───────────────────────────────────────────────────
export interface NavItemDef {
  id:        string;
  href:      string;
  icon:      string;   // lucide icon name
  label:     string;   // Arabic label
  minRole:   UserRole;
  deptCodes?: DepartmentCode[];
}

export const NAV_ITEMS: NavItemDef[] = [
  // All authenticated users
  { id: 'home',        href: '/',                                          icon: 'home',        label: 'الرئيسية',          minRole: 'employee' },
  { id: 'ai',         href: '/dashboard/ai-assistant',                    icon: 'bot',         label: 'المساعد الذكي',     minRole: 'employee' },
  { id: 'my-space',   href: '/dashboard/my-workspace',                   icon: 'user',        label: 'مساحتي',            minRole: 'employee' },

  // Department workspace — dept_manager down
  { id: 'dept',       href: '/dashboard/dept-workspace',                  icon: 'building2',   label: 'إدارتي',             minRole: 'dept_manager' },

  // GIS — GIS dept or admin+
  { id: 'gis',        href: '/dashboard/gis-sovereignty/engineering-workspace', icon: 'globe2', label: 'السيادة الجغرافية', minRole: 'dept_manager', deptCodes: ['GIS'] },

  // Command center — supervisors+
  { id: 'cmd',        href: '/dashboard/command-center',                  icon: 'activity',    label: 'مركز القيادة',      minRole: 'supervisor' },

  // Spatial analytics — supervisors+
  { id: 'spatial',    href: '/dashboard/spatial-analytics',               icon: 'layers',      label: 'التحليل المكاني',   minRole: 'supervisor' },

  // Asset intelligence — employees+
  { id: 'assets',     href: '/dashboard/asset-intelligence',              icon: 'briefcase',   label: 'الأصول',            minRole: 'employee' },

  // Admin gateway — admin only
  { id: 'admin',      href: '/dashboard/admin-gateway',                   icon: 'building2',   label: 'بوابة الإدارة',    minRole: 'admin' },
];

/** Filter nav items visible to a given role+dept */
export function getVisibleNav(role: UserRole, deptCode?: DepartmentCode | null): NavItemDef[] {
  return NAV_ITEMS.filter(item => {
    if (!atLeast(role, item.minRole)) return false;
    if (item.deptCodes && !atLeast(role, 'admin')) {
      return item.deptCodes.includes(deptCode as DepartmentCode);
    }
    return true;
  });
}

// ── Dept management permissions ──────────────────────────────────────────────
/**
 * Which roles a manager can invite (roles they can create below them)
 */
export const INVITE_PERMISSIONS: Record<UserRole, UserRole[]> = {
  founder:         ['admin', 'dept_manager', 'section_manager', 'supervisor', 'employee'],
  admin:           ['dept_manager', 'section_manager', 'supervisor', 'employee'],
  dept_manager:    ['section_manager', 'supervisor', 'employee'],
  section_manager: ['supervisor', 'employee'],
  supervisor:      ['employee'],
  employee:        [],
  member:          [],
};

export function canInviteRole(inviterRole: UserRole, targetRole: UserRole): boolean {
  return INVITE_PERMISSIONS[inviterRole]?.includes(targetRole) ?? false;
}
