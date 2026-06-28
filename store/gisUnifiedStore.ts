/**
 * GIS Unified Store
 * ─────────────────
 * مخزن Zustand الموحد للنظام الجغرافي المتكامل.
 * يجمع كل السجلات المرتبطة بالمواقع من جميع الإدارات:
 * الأصول، الموظفين، أوامر العمل، أوامر الشراء، العقود، المركبات، المخزون.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserAuthHeaders } from './useUserStore';

const BASE = '/api/v1';

const hdr = () => ({
  'Content-Type': 'application/json',
  ...getUserAuthHeaders(),
});

// ─── أنواع البيانات ───────────────────────────────────────────────────────────

export type EntityCategory =
  | 'asset'
  | 'employee'
  | 'work_order'
  | 'purchase_order'
  | 'contract'
  | 'vehicle'
  | 'inventory_item'
  | 'financial';

export interface GisEntity {
  id: string | number;
  category: EntityCategory;
  title: string;
  subtitle?: string;
  status?: string;
  value?: number | string;
  project_id?: string | number;
  site_id?: number;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface SiteMarker {
  site_id: number;
  site_name: string;
  site_code: string | null;
  site_type: string;
  project_id: string | number;
  project_name: string;
  latitude: number;
  longitude: number;
  entities_count: number;
  entities_by_category: Partial<Record<EntityCategory, number>>;
}

export interface SiteDetailPanel {
  site_id: number;
  site_name: string;
  project_name: string;
  latitude: number;
  longitude: number;
  entities: GisEntity[];
  loading: boolean;
}

// ─── حالة المخزن ─────────────────────────────────────────────────────────────

interface GisUnifiedState {
  // الماركرات على الخريطة (كل المواقع)
  siteMarkers: SiteMarker[];
  markersLoading: boolean;
  markersError: string | null;
  lastRefresh: number | null;

  // لوحة التفاصيل عند اختيار موقع
  selectedPanel: SiteDetailPanel | null;

  // فلتر الإدارات المفعّلة
  activeCategories: EntityCategory[];

  // حالة اللوحة
  panelOpen: boolean;
  mapPanelOpen: boolean;        // هل لوحة الخريطة ظاهرة في الـ layout

  // الأفعال
  loadSiteMarkers: (projectIds?: (string | number)[]) => Promise<void>;
  loadSiteDetail: (siteId: number, projectId: string | number) => Promise<void>;
  closeSitePanel: () => void;
  toggleCategory: (cat: EntityCategory) => void;
  toggleMapPanel: () => void;
  setMapPanelOpen: (open: boolean) => void;
  refreshAll: () => void;
}

// ─── دوال التحميل الداخلية ───────────────────────────────────────────────────

/** تحميل مواقع المشروع مع إحداثياتها */
async function fetchProjectSites(projectId: string | number): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/workspace/projects/${projectId}/sites`, {
      headers: hdr(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.sites || []);
  } catch {
    return [];
  }
}

/** تحميل الأصول لمشروع/موقع */
async function fetchAssets(projectId: string | number, siteId?: number): Promise<GisEntity[]> {
  try {
    const q = siteId ? `&siteId=${siteId}` : '';
    const res = await fetch(`${BASE}/workspace/assets?projectId=${projectId}${q}&limit=500`, {
      headers: hdr(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.assets || data.features || (Array.isArray(data) ? data : []);
    return list.map((a: any) => ({
      id: a.id,
      category: 'asset' as EntityCategory,
      title: a.name || a.asset_name || `أصل #${a.id}`,
      subtitle: a.asset_type || a.type,
      status: a.status,
      value: a.health_score != null ? `صحة: ${a.health_score}%` : undefined,
      project_id: projectId,
      site_id: siteId,
      latitude: a.latitude ?? a.lat,
      longitude: a.longitude ?? a.lon,
      metadata: a,
    }));
  } catch {
    return [];
  }
}

/** تحميل أوامر العمل */
async function fetchWorkOrders(projectId?: string | number, siteId?: number): Promise<GisEntity[]> {
  try {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', String(projectId));
    if (siteId) params.set('site_id', String(siteId));
    params.set('limit', '200');
    const res = await fetch(`${BASE}/workspace/work-orders?${params}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.work_orders || data.orders || (Array.isArray(data) ? data : []);
    return list.map((w: any) => ({
      id: w.id,
      category: 'work_order' as EntityCategory,
      title: w.title || w.description || `أمر عمل #${w.id}`,
      subtitle: w.work_type || w.type,
      status: w.status,
      project_id: projectId,
      site_id: siteId ?? w.site_id,
      metadata: w,
    }));
  } catch {
    return [];
  }
}

/** تحميل أوامر الشراء */
async function fetchPurchaseOrders(projectId?: string | number, siteId?: number): Promise<GisEntity[]> {
  try {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', String(projectId));
    if (siteId) params.set('site_id', String(siteId));
    params.set('limit', '200');
    const res = await fetch(`${BASE}/procurement/orders?${params}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.orders || (Array.isArray(data) ? data : []);
    return list.map((o: any) => ({
      id: o.id,
      category: 'purchase_order' as EntityCategory,
      title: o.title || o.order_number || `أمر شراء #${o.id}`,
      subtitle: o.supplier_name,
      status: o.status,
      value: o.total_amount ? `${Number(o.total_amount).toLocaleString()} د.ل` : undefined,
      project_id: o.project_id ?? projectId,
      site_id: o.site_id ?? siteId,
      metadata: o,
    }));
  } catch {
    return [];
  }
}

/** تحميل الموظفين */
async function fetchEmployees(siteId?: number): Promise<GisEntity[]> {
  try {
    const params = new URLSearchParams({ limit: '200' });
    if (siteId) params.set('site_id', String(siteId));
    const res = await fetch(`${BASE}/hr/employees?${params}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.employees || data.results || (Array.isArray(data) ? data : []);
    return list.map((e: any) => ({
      id: e.id,
      category: 'employee' as EntityCategory,
      title: e.full_name || e.name || `موظف #${e.id}`,
      subtitle: e.position || e.job_title,
      status: e.status,
      site_id: e.site_id ?? siteId,
      project_id: e.project_id,
      metadata: e,
    }));
  } catch {
    return [];
  }
}

/** تحميل العقود */
async function fetchContracts(projectId?: string | number, siteId?: number): Promise<GisEntity[]> {
  try {
    const params = new URLSearchParams({ limit: '100' });
    if (projectId) params.set('project_id', String(projectId));
    if (siteId) params.set('site_id', String(siteId));
    const res = await fetch(`${BASE}/contracts/list?${params}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.contracts || (Array.isArray(data) ? data : []);
    return list.map((c: any) => ({
      id: c.id,
      category: 'contract' as EntityCategory,
      title: c.title || c.contract_number || `عقد #${c.id}`,
      subtitle: c.contractor_name,
      status: c.status,
      value: c.value ? `${Number(c.value).toLocaleString()} د.ل` : undefined,
      project_id: c.project_id ?? projectId,
      site_id: c.site_id ?? siteId,
      metadata: c,
    }));
  } catch {
    return [];
  }
}

// ─── المخزن ─────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: EntityCategory[] = [
  'asset', 'employee', 'work_order', 'purchase_order', 'contract', 'vehicle', 'inventory_item', 'financial',
];

export const useGisUnifiedStore = create<GisUnifiedState>()(
  persist(
    (set, get) => ({
      siteMarkers: [],
      markersLoading: false,
      markersError: null,
      lastRefresh: null,
      selectedPanel: null,
      activeCategories: ALL_CATEGORIES,
      panelOpen: false,
      mapPanelOpen: false,

      loadSiteMarkers: async (projectIds) => {
        set({ markersLoading: true, markersError: null });
        try {
          const q = projectIds && projectIds.length > 0
            ? `?project_ids=${projectIds.join(',')}`
            : '';
          const res = await fetch(`${BASE}/gis/unified/sites${q}`, { headers: hdr() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const markers: SiteMarker[] = (data.sites || []).map((s: any) => ({
            site_id: s.site_id,
            site_name: s.site_name,
            site_code: s.site_code || null,
            site_type: s.site_type || 'field',
            project_id: s.project_id,
            project_name: s.project_name,
            latitude: s.latitude,
            longitude: s.longitude,
            entities_count: s.entities_count || 0,
            entities_by_category: s.entities_by_category || {},
          }));
          set({ siteMarkers: markers, lastRefresh: Date.now() });
        } catch (e: any) {
          set({ markersError: e?.message || 'خطأ في تحميل البيانات' });
        } finally {
          set({ markersLoading: false });
        }
      },

      loadSiteDetail: async (siteId, projectId) => {
        const existing = get().siteMarkers.find(m => m.site_id === siteId);
        set({
          selectedPanel: {
            site_id: siteId,
            site_name: existing?.site_name || `موقع #${siteId}`,
            project_name: existing?.project_name || '',
            latitude: existing?.latitude || 0,
            longitude: existing?.longitude || 0,
            entities: [],
            loading: true,
          },
          panelOpen: true,
        });

        try {
          const res = await fetch(`${BASE}/gis/unified/site/${siteId}/entities`, { headers: hdr() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const entities: GisEntity[] = (data.entities || []).map((e: any) => ({
            id: e.id,
            category: e.category as EntityCategory,
            title: e.title,
            subtitle: e.subtitle,
            status: e.status,
            value: e.value,
            project_id: e.project_id,
            site_id: e.site_id,
            created_at: e.created_at,
            metadata: e,
          }));

          const countByCategory: Partial<Record<EntityCategory, number>> = {};
          for (const e of entities) {
            countByCategory[e.category] = (countByCategory[e.category] || 0) + 1;
          }

          set(state => ({
            siteMarkers: state.siteMarkers.map(m =>
              m.site_id === siteId
                ? { ...m, entities_count: entities.length, entities_by_category: countByCategory }
                : m
            ),
            selectedPanel: {
              ...(state.selectedPanel as SiteDetailPanel),
              entities,
              loading: false,
            },
          }));
        } catch {
          set(state => ({
            selectedPanel: state.selectedPanel
              ? { ...state.selectedPanel, loading: false }
              : null,
          }));
        }
      },

      closeSitePanel: () => set({ panelOpen: false, selectedPanel: null }),

      toggleCategory: (cat) =>
        set(state => ({
          activeCategories: state.activeCategories.includes(cat)
            ? state.activeCategories.filter(c => c !== cat)
            : [...state.activeCategories, cat],
        })),

      toggleMapPanel: () => set(state => ({ mapPanelOpen: !state.mapPanelOpen })),
      setMapPanelOpen: (open) => set({ mapPanelOpen: open }),

      refreshAll: () => get().loadSiteMarkers(),
    }),
    {
      name: 'gis-unified-store',
      partialize: (s) => ({
        activeCategories: s.activeCategories,
        mapPanelOpen: s.mapPanelOpen,
      }),
    }
  )
);

// ─── ثوابت مساعدة ────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<EntityCategory, { label: string; color: string; icon: string }> = {
  asset:          { label: 'الأصول',         color: '#3b82f6', icon: '🏗️' },
  employee:       { label: 'الموظفون',        color: '#10b981', icon: '👷' },
  work_order:     { label: 'أوامر العمل',    color: '#f59e0b', icon: '🔧' },
  purchase_order: { label: 'أوامر الشراء',   color: '#8b5cf6', icon: '🛒' },
  contract:       { label: 'العقود',          color: '#ec4899', icon: '📋' },
  vehicle:        { label: 'المركبات',        color: '#06b6d4', icon: '🚛' },
  inventory_item: { label: 'المخزون',         color: '#84cc16', icon: '📦' },
  financial:      { label: 'المالية',         color: '#f97316', icon: '💰' },
};

export const SITE_TYPE_COLORS: Record<string, string> = {
  administrative: '#6366f1',
  operational:    '#f59e0b',
  field:          '#22c55e',
  storage:        '#06b6d4',
  maintenance:    '#ef4444',
};
