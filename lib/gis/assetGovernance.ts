import type { WorkspaceUser } from '@/store/useUserStore';

export type AssetDepartment =
  | 'engineering'
  | 'administrative'
  | 'finance'
  | 'technical'
  | 'maintenance'
  | 'unknown';

export interface AssetCapabilities {
  canDrawSpatial: boolean;
  canCreateMainAsset: boolean;
  canCreateChildAsset: boolean;
  canUploadSpatialFiles: boolean;
  canUploadAdministrativeDocs: boolean;
  canUploadFinancialDocs: boolean;
  canUploadTechnicalDocs: boolean;
  canUploadMaintenanceDocs: boolean;
}

function norm(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase();
}

export function resolveAssetDepartment(user: WorkspaceUser | null, storedDepartment?: string | null): AssetDepartment {
  const dept = norm(storedDepartment);
  const role = norm(user?.role);
  const roles = (user?.roles ?? []).map(norm);
  const all = [dept, role, ...roles].join(' ');

  if (all.includes('engine') || all.includes('هندس') || all.includes('gis')) return 'engineering';
  if (all.includes('finance') || all.includes('مالي') || all.includes('محاسب')) return 'finance';
  if (all.includes('maint') || all.includes('صيان')) return 'maintenance';
  if (all.includes('tech') || all.includes('فن')) return 'technical';
  if (all.includes('admin') || all.includes('إدار') || all.includes('correspond')) return 'administrative';
  return 'unknown';
}

export function getAssetCapabilities(user: WorkspaceUser | null, storedDepartment?: string | null): AssetCapabilities {
  const role = norm(user?.role || user?.roles?.[0]);
  const isSuper = role === 'super_admin' || role === 'admin' || (user?.roles ?? []).map(norm).includes('super_admin') || (user?.roles ?? []).map(norm).includes('admin');

  if (isSuper) {
    return {
      canDrawSpatial: true,
      canCreateMainAsset: true,
      canCreateChildAsset: true,
      canUploadSpatialFiles: true,
      canUploadAdministrativeDocs: true,
      canUploadFinancialDocs: true,
      canUploadTechnicalDocs: true,
      canUploadMaintenanceDocs: true,
    };
  }

  const dept = resolveAssetDepartment(user, storedDepartment);

  return {
    // الرسم وإنشاء الأصول الجغرافية — اختصاص الإدارة الهندسية فقط
    canDrawSpatial: dept === 'engineering',
    canCreateMainAsset: dept === 'engineering',
    canCreateChildAsset: dept === 'engineering',

    // رفع الملفات متاح لجميع الإدارات (كل إدارة ترفع بياناتها على الأصل)
    canUploadSpatialFiles: true,

    // الإدارات الأخرى تكمل المركز المعلوماتي من تخصصها
    canUploadAdministrativeDocs: true,
    canUploadFinancialDocs: true,
    canUploadTechnicalDocs: true,
    canUploadMaintenanceDocs: true,
  };
}
