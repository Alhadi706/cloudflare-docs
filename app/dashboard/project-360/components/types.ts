export type Project360Response = {
  ok: boolean;
  project360: {
    project_id: string;
    project_summary: Record<string, any>;
    project_sites: Array<Record<string, any>>;
    gis_context: Record<string, any>;
    documents: {
      records: Array<Record<string, any>>;
      counters: {
        total: number;
        by_type: Record<string, number>;
      };
    };
    contracts: {
      records: Array<Record<string, any>>;
      counters: {
        total: number;
        active: number;
        completed: number;
        cancelled: number;
      };
    };
    budget_summary: {
      records: Array<Record<string, any>>;
      totals: {
        total_budget: number;
        spent_amount: number;
        remaining_amount: number;
        utilization_pct: number;
      };
    };
    correspondence: {
      records: Array<Record<string, any>>;
      counters: {
        total: number;
        incoming: number;
        outgoing: number;
        internal: number;
      };
    };
    milestones: {
      records: Array<Record<string, any>>;
      counters: {
        total: number;
        completed: number;
        upcoming: number;
        missed: number;
      };
    };
    handover_status: {
      project_status: string;
      milestones_completed: number;
      milestones_total: number;
      resulting_assets_count: number;
      maintenance_work_orders_count: number;
      maintenance_items_count: number;
      handover_state: 'not_started' | 'in_progress' | 'completed';
    };
    resulting_assets: Array<Record<string, any>>;
    governance_activity: Array<{
      id: string;
      action_type: 'workflow' | 'approval' | 'audit';
      title: string;
      status?: string;
      actor?: string;
      at?: string;
      canonical_ref: {
        project_id: string;
        entity_type: 'project' | 'asset';
        entity_id: string;
      };
      payload?: Record<string, unknown>;
    }>;
    operational_timeline: Array<{
      id: string;
      kind:
        | 'project'
        | 'site'
        | 'gis'
        | 'document'
        | 'contract'
        | 'budget'
        | 'correspondence'
        | 'milestone'
        | 'handover'
        | 'asset'
        | 'governance';
      title: string;
      subtitle?: string;
      at?: string;
      status?: string;
      meta?: Record<string, unknown>;
    }>;
    integration_status: {
      ok: boolean;
      degraded: boolean;
      total_sources: number;
      failed_sources: number;
      sources: Array<{
        source: string;
        path: string;
        ok: boolean;
        http_status: number;
        error: string | null;
      }>;
    };
  };
  integration_status: {
    ok: boolean;
    degraded: boolean;
    total_sources: number;
    failed_sources: number;
    sources: Array<{
      source: string;
      path: string;
      ok: boolean;
      http_status: number;
      error: string | null;
    }>;
  };
};
