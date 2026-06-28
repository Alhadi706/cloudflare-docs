/**
 * Operational Context Store
 * ─────────────────────────
 * Single source of truth for cross-system state.
 * All frontend modules write here; Command Center and AI bridge read from here.
 *
 * Design principles:
 *   - Additive: does NOT replace erpContextStore, mapStore, or projectStore
 *   - Acts as a bridge bus between them
 *   - Any module can set context; any module can react to it
 *   - Persisted only for user_role (survives page refresh)
 *
 * Context dimensions:
 *   selected_project  — active project chosen by user (via GIS click or ERP selector)
 *   selected_location — a lat/lon point set by GIS click or AI geographic mention
 *   active_report     — a citizen report or workflow that is "in focus"
 *   active_workflow   — workflow instance being viewed/acted on
 *   user_role         — current user's operational role
 *   pending_navigation — AI wants to navigate user somewhere; cleared after use
 *   last_ai_intent    — what the AI classified the last query as
 *   live_alerts       — system-wide alerts pushed by polling
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'super_admin' | 'project_admin' | 'site_manager' | 'operator' | 'viewer' | 'citizen';

export interface SelectedLocation {
  lat: number;
  lon: number;
  name?: string;
  source?: 'gis_click' | 'ai_mention' | 'project_site' | 'manual';
}

export interface LiveAlert {
  id: string;
  type: 'warning' | 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
  source?: 'workflow' | 'report' | 'system';
  action_url?: string;
}

export interface PendingNavigation {
  route: string;
  label: string;
  labelAr: string;
  context?: Record<string, unknown>;
}

interface OperationalContextState {
  // ── Project Context ─────────────────────────────────────────────────────
  selected_project_id: string | number | null;
  selected_project_name: string | null;

  // ── Location Context ────────────────────────────────────────────────────
  selected_location: SelectedLocation | null;

  // ── Report / Workflow Context ────────────────────────────────────────────
  active_report_id: string | null;
  active_workflow_id: number | null;

  // ── User Context ─────────────────────────────────────────────────────────
  user_role: UserRole;
  user_name: string | null;
  // ── Tenant / Institution Identity ─────────────────────────────────────────────
  /** Canonical tenant UUID for API calls (NEXT_PUBLIC_TENANT_ID) */
  tenant_id: string | null;
  /** registry_id from institution_registry — null if not linked */
  registry_entity_id: string | null;
  /** entity_type resolved from institution_registry (e.g. municipality_ly, public_company) */
  entity_type: string | null;
  // ── AI Bridge ────────────────────────────────────────────────────────────
  last_ai_intent: string | null;
  last_ai_answer: string | null;
  last_ai_question: string | null;
  /** Route the AI wants to open; cleared once consumed by the navigation handler */
  pending_navigation: PendingNavigation | null;

  // ── Live System State ─────────────────────────────────────────────────────
  live_alerts: LiveAlert[];
  pending_workflow_count: number;   // from /api/v1/workflows/steps/pending
  pending_report_count: number;     // from /api/v1/conversation/analytics

  // ── Actions ──────────────────────────────────────────────────────────────
  setSelectedProject(id: string | number | null, name?: string | null): void;
  setSelectedLocation(loc: SelectedLocation | null): void;
  setActiveReport(id: string | null): void;
  setActiveWorkflow(id: number | null): void;
  setUserRole(role: UserRole, name?: string | null): void;
  setTenantIdentity(tenant_id: string, registry_entity_id?: string | null, entity_type?: string | null): void;
  recordAIInteraction(intent: string, question: string, answer: string): void;
  setPendingNavigation(nav: PendingNavigation | null): void;
  clearPendingNavigation(): void;
  setLiveAlerts(alerts: LiveAlert[]): void;
  addAlert(alert: Omit<LiveAlert, 'id' | 'timestamp'>): void;
  setPendingCounts(workflow: number, report: number): void;
  reset(): void;
}

const INITIAL: Pick<
  OperationalContextState,
  | 'selected_project_id' | 'selected_project_name'
  | 'selected_location'
  | 'active_report_id' | 'active_workflow_id'
  | 'user_role' | 'user_name'
  | 'tenant_id' | 'registry_entity_id' | 'entity_type'
  | 'last_ai_intent' | 'last_ai_answer' | 'last_ai_question'
  | 'pending_navigation'
  | 'live_alerts' | 'pending_workflow_count' | 'pending_report_count'
> = {
  selected_project_id: null,
  selected_project_name: null,
  selected_location: null,
  active_report_id: null,
  active_workflow_id: null,
  user_role: 'super_admin',
  user_name: null,
  tenant_id: null,
  registry_entity_id: null,
  entity_type: null,
  last_ai_intent: null,
  last_ai_answer: null,
  last_ai_question: null,
  pending_navigation: null,
  live_alerts: [],
  pending_workflow_count: 0,
  pending_report_count: 0,
};

export const useOperationalContext = create<OperationalContextState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setSelectedProject: (id, name = null) => {
        set({ selected_project_id: id, selected_project_name: name });
      },

      setSelectedLocation: (loc) => {
        set({ selected_location: loc });
      },

      setActiveReport: (id) => set({ active_report_id: id }),

      setActiveWorkflow: (id) => set({ active_workflow_id: id }),

      setUserRole: (role, name = null) => set({ user_role: role, user_name: name }),

      setTenantIdentity: (tenant_id, registry_entity_id = null, entity_type = null) =>
        set({ tenant_id, registry_entity_id, entity_type }),

      recordAIInteraction: (intent, question, answer) =>
        set({ last_ai_intent: intent, last_ai_question: question, last_ai_answer: answer }),

      setPendingNavigation: (nav) => set({ pending_navigation: nav }),

      clearPendingNavigation: () => set({ pending_navigation: null }),

      setLiveAlerts: (alerts) => set({ live_alerts: alerts }),

      addAlert: (alert) => {
        set((s) => {
          const nowMs = Date.now();
          const duplicate = s.live_alerts.find((a) => (
            a.type === alert.type
            && a.message === alert.message
            && a.source === alert.source
            && (nowMs - new Date(a.timestamp).getTime()) < 120_000
          ));

          if (duplicate) {
            return s;
          }

          const id = `${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
          const timestamp = new Date(nowMs).toISOString();
          return {
            live_alerts: [{ ...alert, id, timestamp }, ...s.live_alerts].slice(0, 20),
          };
        });
      },

      setPendingCounts: (workflow, report) =>
        set({ pending_workflow_count: workflow, pending_report_count: report }),

      reset: () => set(INITIAL),
    }),
    {
      name: 'operational-context',
      storage: createJSONStorage(() => sessionStorage), // session only — cleared on tab close
      partialize: (s) => ({
        // Only persist user identity and project context across page navigation
        user_role: s.user_role,
        user_name: s.user_name,
        tenant_id: s.tenant_id,
        registry_entity_id: s.registry_entity_id,
        entity_type: s.entity_type,
        selected_project_id: s.selected_project_id,
        selected_project_name: s.selected_project_name,
      }),
    }
  )
);
