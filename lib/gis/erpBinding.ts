/**
 * ERP-to-GIS Binding Rules — قواعد الربط الإلزامي ERP-GIS
 * ════════════════════════════════════════════════════════
 * يحدد ما هو مطلوب مكانياً من كل كيان ERP.
 *
 * القواعد الإلزامية:
 *   - project   → يجب أن يحتوي على هندسة (نقطة أو مضلع)
 *   - asset     → يجب أن يحتوي على إحداثيات أو مضلع
 *   - work_order → يجب أن يكون مرتبطاً بأصل (asset_id)
 *   - employee   → يجب أن يكون له موقع أو وضع "غير مُعيَّن" صريح
 */

import type { MapProject, MapAsset, MapWorkOrder, MapEmployee, BindingViolation } from '@/store/gisEngine';

// ══════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ══════════════════════════════════════════════════════════════

export function validateProject(p: MapProject): BindingViolation | null {
  const hasPoint = p.latitude != null && p.longitude != null;
  const hasGeom  = p.geometry != null;
  if (!hasPoint && !hasGeom) {
    return {
      entity_type: 'project',
      entity_id: p.id,
      entity_name: p.name,
      violation: 'missing_geometry',
      severity: 'error',
    };
  }
  return null;
}

export function validateAsset(a: MapAsset): BindingViolation | null {
  const hasCoords = a.latitude != null && a.longitude != null;
  if (!hasCoords) {
    return {
      entity_type: 'asset',
      entity_id: a.id,
      entity_name: a.name,
      violation: 'missing_coordinates',
      severity: 'error',
    };
  }
  return null;
}

export function validateWorkOrder(wo: MapWorkOrder): BindingViolation | null {
  if (!wo.has_asset_link || wo.asset_id == null) {
    return {
      entity_type: 'work_order',
      entity_id: wo.id,
      entity_name: wo.title,
      violation: 'missing_asset_link',
      severity: 'warning',
    };
  }
  return null;
}

export function validateEmployee(emp: MapEmployee): BindingViolation | null {
  if (emp.location_status === 'located') return null;
  if (emp.location_status === 'unassigned') return null; // صريح بلا تعيين
  // location_status === 'unknown' → انتهاك
  return {
    entity_type: 'employee',
    entity_id: emp.id,
    entity_name: emp.name,
    violation: 'missing_location',
    severity: 'warning',
  };
}

// ══════════════════════════════════════════════════════════════
// AGGREGATE VALIDATION
// ══════════════════════════════════════════════════════════════

export interface BindingReport {
  violations: BindingViolation[];
  errors: number;
  warnings: number;
  compliant: number;
  total: number;
  compliance_pct: number;
}

export function runBindingValidation(
  projects: MapProject[],
  assets: MapAsset[],
  workOrders: MapWorkOrder[],
  employees: MapEmployee[],
): BindingReport {
  const violations: BindingViolation[] = [];

  for (const p of projects) {
    const v = validateProject(p);
    if (v) violations.push(v);
  }
  for (const a of assets) {
    const v = validateAsset(a);
    if (v) violations.push(v);
  }
  for (const wo of workOrders) {
    const v = validateWorkOrder(wo);
    if (v) violations.push(v);
  }
  for (const emp of employees) {
    const v = validateEmployee(emp);
    if (v) violations.push(v);
  }

  const total      = projects.length + assets.length + workOrders.length + employees.length;
  const errors     = violations.filter(v => v.severity === 'error').length;
  const warnings   = violations.filter(v => v.severity === 'warning').length;
  const compliant  = total - violations.length;

  return {
    violations,
    errors,
    warnings,
    compliant,
    total,
    compliance_pct: total > 0 ? Math.round((compliant / total) * 100) : 100,
  };
}

// ══════════════════════════════════════════════════════════════
// HELPERS FOR UI
// ══════════════════════════════════════════════════════════════

export function violationLabel(v: BindingViolation): string {
  const labels: Record<BindingViolation['violation'], string> = {
    missing_geometry:    'لا توجد هندسة مكانية',
    missing_coordinates: 'لا توجد إحداثيات',
    missing_asset_link:  'غير مرتبط بأصل',
    missing_location:    'الموقع غير معروف',
  };
  return labels[v.violation] ?? v.violation;
}

export function entityTypeLabel(type: BindingViolation['entity_type']): string {
  const labels: Record<BindingViolation['entity_type'], string> = {
    project:    'مشروع',
    asset:      'أصل',
    work_order: 'أمر عمل',
    employee:   'موظف',
  };
  return labels[type] ?? type;
}
