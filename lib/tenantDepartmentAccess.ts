import { getTenantById } from '@/lib/tenant-store';

export type ModuleGate = 'GIS' | 'CORROSION' | 'MAINTENANCE';

const ALIAS_MAP: Record<ModuleGate, string[]> = {
  GIS: [
    'gis',
    'geospatial',
    'geography',
    'spatial',
    'map',
    'mapping',
    'engineering',
    'جغرافية',
    'الهندسية',
    'هندسية',
    'السيادةالجغرافية',
  ],
  CORROSION: [
    'corr',
    'corrosion',
    'cp',
    'cathodicprotection',
    'تآكل',
    'التآكل',
    'حمايةكاثودية',
  ],
  MAINTENANCE: [
    'maint',
    'maintenance',
    'operationsmaintenance',
    'operations',
    'ops',
    'صيانة',
    'الصيانة',
    'تشغيل',
    'العمليات',
  ],
};

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function hasAnyAlias(enabled: Set<string>, gate: ModuleGate): boolean {
  const aliases = ALIAS_MAP[gate] || [];
  for (const alias of aliases) {
    if (enabled.has(normalizeValue(alias))) {
      return true;
    }
  }
  return false;
}

/**
 * Legacy-safe behavior:
 * - Unknown tenant record: allow (to avoid breaking pre-onboarding data)
 * - Empty enabled_departments: allow (tenant not migrated to module subscriptions yet)
 */
export function isTenantAllowedForModule(tenantId: string, gate: ModuleGate): boolean {
  const tenant = getTenantById(tenantId);
  if (!tenant) return true;

  const values = Array.isArray(tenant.enabled_departments)
    ? tenant.enabled_departments.map(normalizeValue).filter(Boolean)
    : [];

  if (values.length === 0) return true;

  const enabled = new Set(values);

  // Explicit code support.
  if (gate === 'GIS' && enabled.has('gis')) return true;
  if (gate === 'CORROSION' && (enabled.has('corr') || enabled.has('corrosion'))) return true;
  if (gate === 'MAINTENANCE' && (enabled.has('maint') || enabled.has('maintenance'))) return true;

  // Corrosion is typically part of maintenance bundles.
  if (gate === 'CORROSION' && (enabled.has('maint') || enabled.has('maintenance'))) return true;

  return hasAnyAlias(enabled, gate);
}
