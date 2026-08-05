export const MATERIAL_REQUEST_DEPTS = [
  'admin-affairs',
  'finance',
  'maintenance',
  'corrosion',
  'services',
  'materials',
] as const;

export type MaterialRequestDept = (typeof MATERIAL_REQUEST_DEPTS)[number];

const DEPT_CODE_TO_ID: Record<string, MaterialRequestDept> = {
  ADMIN: 'admin-affairs',
  ADMIN_AFFAIRS: 'admin-affairs',
  HR: 'admin-affairs',
  FIN: 'finance',
  FINANCE: 'finance',
  ACCOUNTING: 'finance',
  REVENUE: 'finance',
  MAINT: 'maintenance',
  MAINTENANCE: 'maintenance',
  FLEET: 'maintenance',
  PROJECTS: 'maintenance',
  PROJ: 'maintenance',
  CORR: 'corrosion',
  CORROSION: 'corrosion',
  SERVICES: 'services',
  SERVICE: 'services',
  ASSET: 'services',
  ASSETS: 'services',
  MATERIALS: 'materials',
  PROCUREMENT: 'materials',
  INVENTORY: 'materials',
};

function normalizeDeptCode(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/^DEPT_/, '')
    .replace(/-/g, '_');
}

export function isMaterialRequestDept(value: string): value is MaterialRequestDept {
  return MATERIAL_REQUEST_DEPTS.includes(value as MaterialRequestDept);
}

export function normalizeMaterialRequestDept(value?: string | null): MaterialRequestDept {
  const v = (value || '').trim().toLowerCase();
  if (isMaterialRequestDept(v)) return v;
  return 'admin-affairs';
}

export function resolveMaterialRequestDeptFromScope(scope?: string | null): MaterialRequestDept {
  const code = normalizeDeptCode(scope || '');
  return DEPT_CODE_TO_ID[code] || 'admin-affairs';
}
