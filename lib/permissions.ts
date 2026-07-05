/**
 * lib/permissions.ts — Authorization Layer: Roles × Permissions
 *
 * DESIGN PRINCIPLES:
 *   1. Roles are stored in the JWT.
 *   2. Permissions are computed at runtime from the role — never stored in JWT.
 *   3. The PermissionProvider interface decouples the mapping from its source,
 *      allowing a future switch to DB-driven or config-driven permissions
 *      without changing any route code.
 *
 * EVOLUTION PATH:
 *   P2 (now):  hardcoded ROLE_PERMISSIONS map
 *   P3:        replace defaultPermissionProvider with a DB lookup
 *   P4:        add data_scope field to authorize() options
 */

// ── Permission definitions ──────────────────────────────────────────────────

export type Permission =
  // User management
  | 'user.invite'           // invite new users to the organisation
  | 'user.review'           // approve / reject mobile access requests

  // Tenant management (founder only)
  | 'tenant.approve'        // approve a new organisation's onboarding
  | 'tenant.reject'         // reject an organisation's onboarding
  | 'tenant.manage'         // change tenant status / enabled departments

  // Work orders
  | 'workorder.view'
  | 'workorder.create'
  | 'workorder.approve'     // change status / close / cancel

  // Corrosion
  | 'corrosion.view'
  | 'corrosion.write'       // create / edit corrosion data
  | 'corrosion.approve'     // sign-off on corrosion reports

  // GIS / Maps
  | 'gis.view'
  | 'gis.write'             // create / edit / delete layers and features

  // Satellite
  | 'satellite.view'
  | 'satellite.archive'     // upload / create satellite reports

  // Reports
  | 'reports.view'
  | 'reports.export'        // export / create ops / terrain reports
  | 'reports.delete'        // delete reports (irreversible)

  // Extraction catalog
  | 'extraction.view'
  | 'extraction.write';     // save / delete extraction jobs

// ── Permission Provider interface ──────────────────────────────────────────
//
// Implement this interface to swap the permission source without touching
// any route code.  The default implementation is synchronous and uses the
// hardcoded ROLE_PERMISSIONS map below.
//
// A future DB-backed provider would look up overrides from a
// `user_permission_overrides` table and merge them with the base role set.

export interface PermissionProvider {
  /**
   * Returns the set of permissions granted to the given role.
   * The special value '*' means "all permissions".
   */
  getPermissions(role: string): Set<Permission> | '*';
}

// ── Default (hardcoded) permission map ─────────────────────────────────────
//
// DESIGN: Role permissions are intentionally broad — they define what
// operations a role *class* may ever perform.  Department-domain gating
// is enforced separately via PERMISSION_DOMAIN_DEPTS (below).
//
// Example: dept_manager has 'corrosion.write' in the role list, but the
// domain map restricts 'corrosion.write' to ['CORR','MAINT'], so a Finance
// dept_manager is blocked at hasPermission() time.

type UserRole = 'founder' | 'admin' | 'dept_manager' | 'section_manager' | 'supervisor' | 'employee' | 'member' | 'corrosion_field';

const ROLE_PERMISSIONS: Record<UserRole, Permission[] | '*'> = {
  // ── Platform-level roles ─────────────────────────────────────────────────
  founder: '*',
  admin:   '*',

  // ── Organisation-level roles ─────────────────────────────────────────────
  // Dept-domain gating (via PERMISSION_DOMAIN_DEPTS) narrows these at runtime.
  dept_manager: [
    'user.invite',
    'user.review',
    'workorder.view', 'workorder.create', 'workorder.approve',
    'corrosion.view', 'corrosion.write',  'corrosion.approve',
    'gis.view',       'gis.write',
    'satellite.view', 'satellite.archive',
    'reports.view',   'reports.export',   'reports.delete',
    'extraction.view','extraction.write',
  ],

  section_manager: [
    'workorder.view', 'workorder.create', 'workorder.approve',
    'corrosion.view', 'corrosion.write',
    'gis.view',       'gis.write',
    'satellite.view',
    'reports.view',   'reports.export',
    'extraction.view',
  ],

  supervisor: [
    'workorder.view', 'workorder.create',
    'corrosion.view', 'corrosion.write',
    'gis.view',
    'satellite.view',
    'reports.view',
  ],

  employee: [
    'workorder.view',
    'corrosion.view',
    'gis.view',
    'reports.view',
  ],

  member: ['reports.view'],

  // ── Mobile field roles ──────────────────────────────────────────────
  // Employees assigned to corrosion field teams from the dashboard.
  corrosion_field: [
    'workorder.view',
    'corrosion.view',
    'reports.view',
  ],
};

// ── Default in-memory provider ──────────────────────────────────────────────

export class HardcodedPermissionProvider implements PermissionProvider {
  getPermissions(role: string): Set<Permission> | '*' {
    const entry = ROLE_PERMISSIONS[role as UserRole];
    if (!entry) return new Set<Permission>();
    if (entry === '*') return '*';
    return new Set<Permission>(entry);
  }
}

/** The active provider — replace this to switch permission sources. */
export let permissionProvider: PermissionProvider = new HardcodedPermissionProvider();

/**
 * Override the active permission provider.
 * Call this once at application startup (e.g., in a DB-backed provider).
 */
export function setPermissionProvider(provider: PermissionProvider): void {
  permissionProvider = provider;
}

/**
 * Returns true if `role` has the given `permission`.
 * Pass `deptCode` to additionally enforce department-level gating
 * (admins/founders always pass regardless of dept).
 */
export function hasPermission(
  role: string,
  permission: Permission,
  deptCode?: string | null,
): boolean {
  const grants = permissionProvider.getPermissions(role);
  if (grants === '*') return true;
  if (!grants.has(permission)) return false;

  // Dept-scoped check: if caller supplies a deptCode and the permission
  // is domain-specific, verify the dept is allowed for that domain.
  if (deptCode) {
    const domainDepts = PERMISSION_DOMAIN_DEPTS[permission];
    if (domainDepts && !domainDepts.includes(deptCode)) return false;
  }

  return true;
}

/**
 * Maps domain-specific permissions to the departments that may exercise them.
 * Omitting a permission here means it is NOT domain-restricted (any dept can use it).
 * Platform roles (founder/admin) always bypass this check.
 */
export const PERMISSION_DOMAIN_DEPTS: Partial<Record<Permission, string[]>> = {
  // Corrosion operations — only corrosion + maintenance depts
  'corrosion.write':   ['CORR', 'MAINT'],
  'corrosion.approve': ['CORR', 'MAINT'],

  // GIS write — GIS, Engineering, Corrosion, Maintenance (all field depts)
  'gis.write': ['GIS', 'ENG', 'CORR', 'MAINT', 'PROJ'],

  // Satellite archive — only remote-sensing capable depts
  'satellite.archive': ['GIS', 'ENG', 'CORR'],

  // Extraction write — data catalog specialists
  'extraction.write': ['GIS', 'ENG'],
};
