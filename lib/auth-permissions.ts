const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['approve_mobile_access', 'view_mobile_access_requests'],
  founder: ['approve_mobile_access', 'view_mobile_access_requests'],
  owner: ['approve_mobile_access', 'view_mobile_access_requests'],
  admin: ['approve_mobile_access', 'view_mobile_access_requests'],
  dept_manager: ['approve_mobile_access', 'view_mobile_access_requests'],
  section_manager: ['approve_mobile_access', 'view_mobile_access_requests'],
};

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || '').trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function getEffectivePermissions(decoded: { [k: string]: unknown }): string[] {
  const explicit = asStringList(decoded.permissions);
  if (explicit.length > 0) return Array.from(new Set(explicit));

  const role = String(decoded.role || '').trim().toLowerCase();
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return Array.from(new Set(defaults));
}

export function hasPermission(decoded: { [k: string]: unknown }, permission: string): boolean {
  const required = String(permission || '').trim().toLowerCase();
  if (!required) return false;
  const effective = getEffectivePermissions(decoded);
  return effective.includes(required);
}
