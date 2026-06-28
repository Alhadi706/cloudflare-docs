/**
 * ERP Context Store
 * ─────────────────
 * مخزن Zustand مستقل لسياق ERP (المشروع + الموقع).
 * مستقل عن useProjectStore الخاص بـGIS حتى لا يتداخلان.
 * المصدر: workspace.projects + workspace.project_sites
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ErpProject {
  id: string | number;
  name?: string;
  project_name?: string;
  project_code?: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ErpSite {
  id: number;
  project_id: number;
  name: string;
  code: string | null;
  site_type: string;
  status: string;
}

interface ErpContextState {
  // البيانات
  projects: ErpProject[];
  sites: ErpSite[];
  // السياق المحدد
  activeProjectId: string | number | null;
  activeSiteId: number | null;
  // حالة التحميل
  projectsLoading: boolean;
  sitesLoading: boolean;
  // الإجراءات
  loadProjects: () => Promise<void>;
  loadSites: (projectId: string | number) => Promise<void>;
  setActiveProject: (projectId: string | number | null) => void;
  setActiveSite: (siteId: number | null) => void;
  clearContext: () => void;
  // حساب: المشروع/الموقع النشط كاملاً
  getActiveProject: () => ErpProject | null;
  getActiveSite: () => ErpSite | null;
}

export const useErpContextStore = create<ErpContextState>()(
  persist(
    (set, get) => ({
      projects: [],
      sites: [],
      activeProjectId: null,
      activeSiteId: null,
      projectsLoading: false,
      sitesLoading: false,

      loadProjects: async () => {
        set({ projectsLoading: true });
        try {
          const tenantId =
            typeof window !== 'undefined'
              ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
              : '';
          const headers: Record<string, string> = {};
          if (tenantId) headers['X-Tenant-ID'] = tenantId;
          const res = await fetch('/api/v1/projects', { headers });
          if (!res.ok) throw new Error('projects fetch failed');
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (raw.items ?? raw.projects ?? []);
          set({ projects: list });
        } catch (e) {
          console.error('[erpContextStore] loadProjects error:', e);
        } finally {
          set({ projectsLoading: false });
        }
      },

      loadSites: async (projectId) => {
        set({ sitesLoading: true, sites: [], activeSiteId: null });
        try {
          const tenantId =
            typeof window !== 'undefined'
              ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
              : '';
          const headers: Record<string, string> = {};
          if (tenantId) headers['X-Tenant-ID'] = tenantId;
          const res = await fetch(`/api/v1/projects/${projectId}/sites`, {
            headers,
          });
          if (!res.ok) throw new Error('sites fetch failed');
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (raw.items ?? raw.sites ?? []);
          set({ sites: list });
        } catch (e) {
          console.error('[erpContextStore] loadSites error:', e);
        } finally {
          set({ sitesLoading: false });
        }
      },

      setActiveProject: (projectId) => {
        set({ activeProjectId: projectId, activeSiteId: null, sites: [] });
        if (projectId) get().loadSites(projectId);
      },

      setActiveSite: (siteId) => set({ activeSiteId: siteId }),

      clearContext: () => set({ activeProjectId: null, activeSiteId: null, sites: [] }),

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        if (!activeProjectId) return null;
        return projects.find(p => String(p.id) === String(activeProjectId)) ?? null;
      },

      getActiveSite: () => {
        const { sites, activeSiteId } = get();
        if (!activeSiteId) return null;
        return sites.find(s => s.id === activeSiteId) ?? null;
      },
    }),
    {
      name: 'erp-context',
      // احفظ المعرّفات فقط، ليس البيانات الكاملة
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        activeSiteId: state.activeSiteId,
      }),
    }
  )
);
