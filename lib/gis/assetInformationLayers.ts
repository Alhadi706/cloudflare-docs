export type AssetInfoLayerKey =
  | 'engineering'
  | 'administrative'
  | 'finance'
  | 'technical'
  | 'maintenance'
  | 'buildings'
  | 'materials'
  | 'viewer';

export type AssetTabKey = 'geo' | 'admin' | 'technical' | 'financial' | 'components' | 'children';

function norm(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase();
}

export function resolveAssetInfoLayer(userRole?: string | null, userDepartment?: string | null): AssetInfoLayerKey {
  const role = norm(userRole);
  const dept = norm(userDepartment);
  const bag = `${role} ${dept}`;

  if (bag.includes('super_admin') || bag.includes('tenant_admin') || bag.includes('director')) return 'engineering';
  if (bag.includes('engineering') || bag.includes('engineer') || bag.includes('gis') || bag.includes('هندس')) return 'engineering';
  if (bag.includes('finance') || bag.includes('account') || bag.includes('مالي') || bag.includes('محاسب')) return 'finance';
  if (bag.includes('maintenance') || bag.includes('operate') || bag.includes('صيان')) return 'maintenance';
  if (bag.includes('technical') || bag.includes('فن')) return 'technical';
  if (bag.includes('material') || bag.includes('procurement') || bag.includes('مواد') || bag.includes('مشتريات')) return 'materials';
  if (bag.includes('building') || bag.includes('facility') || bag.includes('مبان') || bag.includes('مرافق')) return 'buildings';
  if (bag.includes('admin') || bag.includes('hr') || bag.includes('correspond') || bag.includes('إدار')) return 'administrative';

  return 'viewer';
}

export function getInfoLayerLabel(layer: AssetInfoLayerKey): string {
  const labels: Record<AssetInfoLayerKey, string> = {
    engineering: 'الطبقة الهندسية',
    administrative: 'الطبقة الإدارية',
    finance: 'الطبقة المالية',
    technical: 'الطبقة الفنية',
    maintenance: 'طبقة الصيانة',
    buildings: 'طبقة المباني',
    materials: 'طبقة المواد والمشتريات',
    viewer: 'طبقة القراءة',
  };
  return labels[layer];
}

export function getWritableTabs(layer: AssetInfoLayerKey, isAdminMode = false): AssetTabKey[] {
  if (isAdminMode || layer === 'engineering') return ['geo', 'admin', 'technical', 'financial', 'components', 'children'];

  const map: Record<AssetInfoLayerKey, AssetTabKey[]> = {
    engineering: ['geo', 'admin', 'technical', 'financial', 'components', 'children'],
    administrative: ['admin'],
    finance: ['financial'],
    technical: ['technical'],
    maintenance: ['technical', 'components'],
    buildings: ['components'],
    materials: ['components', 'financial'],
    viewer: [],
  };

  return map[layer];
}

export function getAllowedDocumentTypes(layer: AssetInfoLayerKey, isAdminMode = false): string[] {
  if (isAdminMode || layer === 'engineering') {
    return ['admin', 'technical', 'financial', 'contract', 'manual', 'drawing', 'photo', 'other'];
  }

  const map: Record<AssetInfoLayerKey, string[]> = {
    engineering: ['admin', 'technical', 'financial', 'contract', 'manual', 'drawing', 'photo', 'other'],
    administrative: ['admin', 'contract', 'other', 'photo'],
    finance: ['financial', 'contract', 'other'],
    technical: ['technical', 'manual', 'drawing', 'other'],
    maintenance: ['technical', 'manual', 'other', 'photo'],
    buildings: ['technical', 'drawing', 'other'],
    materials: ['financial', 'contract', 'other'],
    viewer: [],
  };

  return map[layer];
}
