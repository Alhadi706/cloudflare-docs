export type Project360IntegrationSourceStatus = {
  source: string;
  path: string;
  ok: boolean;
  http_status: number;
  error: string | null;
};

export type Project360IntegrationStatus = {
  ok: boolean;
  degraded: boolean;
  total_sources: number;
  failed_sources: number;
  sources: Project360IntegrationSourceStatus[];
};

export type Project360TimelineEvent = {
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
};

export type Project360GovernanceAction = {
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
};

export type Project360HandoverStatus = {
  project_status: string;
  milestones_completed: number;
  milestones_total: number;
  resulting_assets_count: number;
  maintenance_work_orders_count: number;
  maintenance_items_count: number;
  handover_state: 'not_started' | 'in_progress' | 'completed';
};

export type Project360Payload = {
  project_id: string;
  project_summary: Record<string, unknown>;
  project_sites: Array<Record<string, unknown>>;
  gis_context: Record<string, unknown>;
  documents: {
    records: Array<Record<string, unknown>>;
    counters: {
      total: number;
      by_type: Record<string, number>;
    };
  };
  contracts: {
    records: Array<Record<string, unknown>>;
    counters: {
      total: number;
      active: number;
      completed: number;
      cancelled: number;
    };
  };
  budget_summary: {
    records: Array<Record<string, unknown>>;
    totals: {
      total_budget: number;
      spent_amount: number;
      remaining_amount: number;
      utilization_pct: number;
    };
  };
  correspondence: {
    records: Array<Record<string, unknown>>;
    counters: {
      total: number;
      incoming: number;
      outgoing: number;
      internal: number;
    };
  };
  milestones: {
    records: Array<Record<string, unknown>>;
    counters: {
      total: number;
      completed: number;
      upcoming: number;
      missed: number;
    };
  };
  handover_status: Project360HandoverStatus;
  resulting_assets: Array<Record<string, unknown>>;
  governance_activity: Project360GovernanceAction[];
  operational_timeline: Project360TimelineEvent[];
  integration_status: Project360IntegrationStatus;
};
