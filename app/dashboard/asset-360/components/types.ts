export type Asset360Response = {
  ok: boolean;
  asset360: {
    asset_id: string;
    asset_summary: Record<string, any>;
    gis: {
      coordinates: { lon: number; lat: number } | null;
      geometry_type: string | null;
      geometry: any;
      map_links: {
        engineering_workspace: string;
        sovereignty_workspace: string;
      };
    };
    relationships: {
      parent_asset_id: string | null;
      parent_asset_name: string | null;
      children: Array<Record<string, any>>;
      total_children: number;
    };
    maintenance: {
      history: any[];
      open_work_orders: any[];
      completed_work: any[];
      counters: { total: number; open: number; completed: number };
    };
    documents: {
      records: any[];
      photos_and_attachments: any[];
      counters: { total: number; photos: number; attachments: number };
    };
    governance_actions: any[];
    operational_timeline: any[];
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
  components?: any;
  completion_score?: any;
  integration_status?: {
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
