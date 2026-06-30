/**
 * activatedDepartments.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Zustand store that holds the list of departments this tenant has activated.
 * Fetched once at app bootstrap via OperationalContextSync.
 *
 * Source: GET /api/v1/catalog/tenant/{tenant_id}/activated-departments
 *
 * Design:
 *  - Single data-fetch store (no polling — departments change rarely)
 *  - Re-load is triggered manually or on tenant_id change
 *  - Sidebar + Command Center read from here
 *  - Does NOT replace admin-gateway/page.tsx static dept hub (different use)
 */
import { create } from 'zustand';
import { isDepartmentVisibleForScope, normalizeAppScope } from '@/lib/appScope';

const STAFF_KEY = process.env.NEXT_PUBLIC_STAFF_API_KEY ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivatedDept {
  activation_id: number;
  catalog_id: number;
  department_code: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  ui_icon: string;
  ui_color: string;
  frontend_route: string | null;
  is_mandatory: boolean | null;
  status: 'pending_manager' | 'active' | 'suspended';
  manager_user_id: string | null;
  custom_name_ar: string | null;
  activated_by: string;
  display_order: number;
}

interface ActivatedDepartmentsState {
  departments: ActivatedDept[];
  entity_type: string | null;
  registry_entity_id: string | null;
  loading: boolean;
  loaded_tenant_id: string | null;
  error: string | null;

  /** Load or refresh departments for the given tenant_id */
  load(tenant_id: string): Promise<void>;
  /** Clear all cached data (on logout) */
  clear(): void;
  /** Resolve the best URL for a department — prefers catalog frontend_route, falls back to generic shell */
  resolveRoute(dept: ActivatedDept): string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useActivatedDepartments = create<ActivatedDepartmentsState>((set, get) => ({
  departments: [],
  entity_type: null,
  registry_entity_id: null,
  loading: false,
  loaded_tenant_id: null,
  error: null,

  

  load: async (tenant_id: string) => {
    // Skip if already loaded for this tenant
    if (get().loaded_tenant_id === tenant_id && get().departments.length > 0) return;

    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `/api/v1/catalog/tenant/${encodeURIComponent(tenant_id)}/activated-departments`,
        {
          headers: {
            'X-Staff-Api-Key': STAFF_KEY,
            'X-Tenant-ID': tenant_id,
            'Content-Type': 'application/json',
          },
          // cache: no-store so every bootstrap gets fresh data
          cache: 'no-store',
        }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const appScope = normalizeAppScope(
        typeof window !== 'undefined'
          ? (localStorage.getItem('launch_app') || document.cookie
              .split(';')
              .map((p) => p.trim())
              .find((p) => p.startsWith('app_scope='))
              ?.split('=')[1] || process.env.NEXT_PUBLIC_APP_SCOPE || '')
          : ''
      );
      const scopedDepartments = (data.departments ?? []).filter((dept: ActivatedDept) =>
        isDepartmentVisibleForScope(dept, appScope)
      );
      set({
        departments: scopedDepartments,
        entity_type: data.entity_type ?? null,
        registry_entity_id: data.registry_entity_id ?? null,
        loaded_tenant_id: tenant_id,
        loading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg, loaded_tenant_id: null });
    }
  },

  clear: () =>
    set({
      departments: [],
      entity_type: null,
      registry_entity_id: null,
      loading: false,
      loaded_tenant_id: null,
      error: null,
    }),

  resolveRoute: (dept: ActivatedDept): string => {
    if (dept.frontend_route) return dept.frontend_route;
    // Generic shell — always safe to render
    return `/dashboard/departments/${dept.department_code.toLowerCase().replace('dept_', '')}`;
  },
}));

// ── Selector helpers ──────────────────────────────────────────────────────────

/** Departments that should appear in sidebar — active or pending_manager, not suspended */
export function sidebarDepts(departments: ActivatedDept[]): ActivatedDept[] {
  return departments.filter((d) => d.status !== 'suspended');
}

/** Departments that have a named manager assigned */
export function managedDepts(departments: ActivatedDept[]): ActivatedDept[] {
  return departments.filter((d) => d.manager_user_id !== null);
}

/** Count by status */
export function deptStatusSummary(departments: ActivatedDept[]): {
  active: number;
  pending_manager: number;
  suspended: number;
  total: number;
} {
  return {
    active:          departments.filter((d) => d.status === 'active').length,
    pending_manager: departments.filter((d) => d.status === 'pending_manager').length,
    suspended:       departments.filter((d) => d.status === 'suspended').length,
    total:           departments.length,
  };
}
