export type Asset360Document = {
  id: string;
  title: string;
  doc_type?: string;
  file_url?: string;
  file_size?: number;
  notes?: string;
  created_at?: string;
  uploaded_by?: string;
};

export type Asset360WorkOrder = {
  id: string;
  work_order_number?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  work_type?: string;
  asset_id?: string;
  asset_name?: string;
  created_at?: string;
  completion_date?: string;
  scheduled_date?: string;
  source?: 'workflow' | 'work_orders';
  raw?: Record<string, unknown>;
};

export type Asset360TimelineEvent = {
  id: string;
  kind:
    | 'asset'
    | 'relationship'
    | 'document'
    | 'photo'
    | 'maintenance'
    | 'work_order'
    | 'governance';
  title: string;
  subtitle?: string;
  at?: string;
  status?: string;
  meta?: Record<string, unknown>;
};

export type Asset360GovernanceAction = {
  id: string;
  action_type: 'workflow' | 'approval' | 'audit';
  title: string;
  status?: string;
  actor?: string;
  at?: string;
  canonical_ref?: {
    asset_id: string;
    entity_type: 'asset' | 'work_order';
    entity_id: string;
  };
  payload?: Record<string, unknown>;
};

export type Asset360IntegrationSourceStatus = {
  source: string;
  path: string;
  ok: boolean;
  http_status: number;
  error: string | null;
};

export type Asset360IntegrationStatus = {
  ok: boolean;
  degraded: boolean;
  total_sources: number;
  failed_sources: number;
  sources: Asset360IntegrationSourceStatus[];
};

export type Asset360Payload = {
  asset_id: string;
  asset_summary: Record<string, unknown>;
  gis: {
    coordinates: { lon: number; lat: number } | null;
    geometry_type: string | null;
    geometry: unknown;
    map_links: {
      engineering_workspace: string;
      sovereignty_workspace: string;
    };
  };
  relationships: {
    parent_asset_id: string | null;
    parent_asset_name: string | null;
    children: Array<Record<string, unknown>>;
    total_children: number;
  };
  maintenance: {
    history: Asset360WorkOrder[];
    open_work_orders: Asset360WorkOrder[];
    completed_work: Asset360WorkOrder[];
    counters: {
      total: number;
      open: number;
      completed: number;
    };
  };
  documents: {
    records: Asset360Document[];
    photos_and_attachments: Asset360Document[];
    counters: {
      total: number;
      photos: number;
      attachments: number;
    };
  };
  governance_actions: Asset360GovernanceAction[];
  operational_timeline: Asset360TimelineEvent[];
  integration_status: Asset360IntegrationStatus;
};
