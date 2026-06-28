export const API_BASE = '/api';
import { getClientTenantId } from '@/lib/getClientTenantId';
import {
  applyHandoverBoundary,
  validateChildAssetCreatePayload,
  validatePrincipalAssetCreatePayload,
} from '@/lib/gis/assetGovernanceRules';

const BASE = '/api/v1/workspace';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const adminMode = localStorage.getItem('admin_mode');
  const userId    = localStorage.getItem('user_id') ?? localStorage.getItem('employee_id') ?? '0';
  const tenantId  = getClientTenantId();

  // Admin users bypass project-membership checks via super_admin role
  const role = adminMode === '1' ? 'super_admin'
    : (localStorage.getItem('user_role') ?? 'viewer');

  const headers: Record<string, string> = {
    'x-user-id':   userId,
    'x-user-role': role,
  };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

function assertValid(result: { ok: boolean; error?: string }) {
  if (!result.ok) {
    throw new Error(result.error || 'Asset governance validation failed.');
  }
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options.method ?? 'GET'} ${url} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get('Content-Type') ?? '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

export const workspaceApi = {
  // ── Projects ────────────────────────────────────────────────────────────
  getProjects: () =>
    apiFetch(`${BASE}/projects`),

  createProject: (data: any) =>
    apiFetch(`${BASE}/projects`, { method: 'POST', body: JSON.stringify(data) }),

  deleteProject: (id: string | number) =>
    apiFetch(`${BASE}/projects/${id}`, { method: 'DELETE' }),

  // ── Sites ────────────────────────────────────────────────────────────────
  getSites: (projectId: string | number) =>
    apiFetch(`${BASE}/projects/${projectId}/sites`),

  createSite: (projectId: string | number, data: any) =>
    apiFetch(`${BASE}/projects/${projectId}/sites`, { method: 'POST', body: JSON.stringify(data) }),

  updateSite: (siteId: string | number, data: any) =>
    apiFetch(`${BASE}/sites/${siteId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteSite: (siteId: string | number) =>
    apiFetch(`${BASE}/sites/${siteId}`, { method: 'DELETE' }),

  // ── Permissions ──────────────────────────────────────────────────────────
  getMyPermissions: (projectId: string | number) =>
    apiFetch(`${BASE}/projects/${projectId}/my-permissions`),

  // ── Assets ───────────────────────────────────────────────────────────────
  getAssets: (projectId?: string | null, siteId?: string | null, layerId?: string | null) => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', String(projectId));
    if (siteId)    params.set('site_id',    String(siteId));
    if (layerId)   params.set('layer_id',   String(layerId));
    return apiFetch(`${BASE}/assets?${params}`);
  },

  createAsset: (data: any) =>
    (() => {
      assertValid(validatePrincipalAssetCreatePayload(data));
      return apiFetch(`${BASE}/assets`, { method: 'POST', body: JSON.stringify(data) });
    })(),

  updateAsset: (id: string | number, data: any) =>
    apiFetch(`${BASE}/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteAsset: (id: string | number) =>
    apiFetch(`${BASE}/assets/${id}`, { method: 'DELETE' }),

  // ── Layers ───────────────────────────────────────────────────────────────
  getLayersTree: (projectId: string | number, siteId?: string | null) => {
    const params = siteId ? `?site_id=${siteId}` : '';
    return apiFetch(`${BASE}/projects/${projectId}/layers/tree${params}`);
  },

  createLayer: (data: any) => {
    // Use the correct endpoint based on layer type
    const projectId = data.project_id;
    if (data.parent_layer_id) {
      return apiFetch(`${BASE}/projects/${projectId}/layers/sub`, { method: 'POST', body: JSON.stringify(data) });
    }
    return apiFetch(`${BASE}/projects/${projectId}/layers/main`, { method: 'POST', body: JSON.stringify(data) });
  },

  updateLayer: (layerId: string | number, data: any) =>
    apiFetch(`${BASE}/layers/${layerId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteLayer: (layerId: string | number) =>
    apiFetch(`${BASE}/layers/${layerId}`, { method: 'DELETE' }),

  // ── Handover: Project feature → Asset record ─────────────────────────────
  handoverAsset: (
    assetId: string,
    targetLayerId: string,
    financialArchive: Record<string, any> = {},
    technicalArchive: Record<string, any> = {},
    notes?: string,
    projectReference: Record<string, any> = {},
  ) =>
    apiFetch(`${BASE}/assets/${assetId}/handover`, {
      method: 'POST',
      body: JSON.stringify(applyHandoverBoundary({
        target_layer_id: targetLayerId,
        financial_archive: financialArchive,
        technical_archive: technicalArchive,
        notes,
        project_reference: projectReference,
      })),
    }),

  // ── Asset Center ─────────────────────────────────────────────────────────
  getAssetCenter: (assetId: string) =>
    apiFetch(`${BASE}/assets/${assetId}/center`),

  addAssetDocument: (assetId: string, data: {
    doc_type: string;
    title: string;
    file_url?: string;
    file_size?: number;
    department?: string;
    notes?: string;
  }) => apiFetch(`${BASE}/assets/${assetId}/documents`, { method: 'POST', body: JSON.stringify(data) }),

  linkAssetEmployee: (assetId: string, data: {
    employee_id?: number;
    employee_name?: string;
    role?: string;
    department?: string;
  }) => apiFetch(`${BASE}/assets/${assetId}/employees`, { method: 'POST', body: JSON.stringify(data) }),

  addAssetFinancial: (assetId: string, data: {
    financial_type: string;
    amount?: number;
    currency?: string;
    description?: string;
    financial_date?: string;
    reference_number?: string;
  }) => apiFetch(`${BASE}/assets/${assetId}/financials`, { method: 'POST', body: JSON.stringify(data) }),

  deleteAssetDocument: (assetId: string, docId: string) =>
    apiFetch(`${BASE}/assets/${assetId}/documents/${docId}`, { method: 'DELETE' }),

  unlinkAssetEmployee: (assetId: string, empId: string) =>
    apiFetch(`${BASE}/assets/${assetId}/employees/${empId}`, { method: 'DELETE' }),

  deleteAssetFinancial: (assetId: string, finId: string) =>
    apiFetch(`${BASE}/assets/${assetId}/financials/${finId}`, { method: 'DELETE' }),

  // ── Asset Container (المجمع الأصلي) ──────────────────────────────────────
  getAssetChildren: (assetId: string) =>
    apiFetch(`${BASE}/assets/${assetId}/children`),

  addChildAsset: (parentId: string, data: {
    asset_name: string;
    asset_type: string;
    owning_department: string;
    status?: string;
    health_score?: number;
    installation_date?: string;
    department_owner?: string;
    geometry?: object;
    properties?: Record<string, any>;
  }) => {
    assertValid(validateChildAssetCreatePayload(data, parentId));
    return apiFetch(`${BASE}/assets/${parentId}/children`, { method: 'POST', body: JSON.stringify(data) });
  },

  markAsCompound: (assetId: string, area_m2?: number) =>
    apiFetch(`${BASE}/assets/${assetId}/set-compound`, {
      method: 'PATCH',
      body: JSON.stringify({ area_m2 }),
    }),

  // ── Temporal / Events ────────────────────────────────────────────────────
  getTemporalPatterns: () =>
    apiFetch(`${BASE}/temporal-analysis/patterns`),

  getEvents: () =>
    apiFetch(`${BASE}/events`),

  resolveEvent: (eventId: string) =>
    apiFetch(`${BASE}/events/${eventId}/resolve`, { method: 'POST' }),

  // ── Spatial Analysis ─────────────────────────────────────────────────────
  spatialBuffer: (geometry: any, distance: number, projectId?: string) =>
    apiFetch(`${BASE}/spatial/buffer`, {
      method: 'POST',
      body: JSON.stringify({ geometry, buffer_distance_m: distance, project_id: projectId }),
    }),

  spatialNearby: (lon: number, lat: number, radius: number, projectId?: string) =>
    apiFetch(`${BASE}/spatial/nearby`, {
      method: 'POST',
      body: JSON.stringify({ longitude: lon, latitude: lat, radius_m: radius, project_id: projectId }),
    }),

  spatialIntersect: (polygon: any, projectId?: string) =>
    apiFetch(`${BASE}/spatial/intersect`, {
      method: 'POST',
      body: JSON.stringify({ polygon, project_id: projectId }),
    }),

  // ── Intelligence ─────────────────────────────────────────────────────────
  getDigitalTwin: (projectId: string) =>
    apiFetch(`${BASE}/intelligence/twin/${projectId}`),

  getIntelligenceAlerts: (projectId: string) =>
    apiFetch(`${BASE}/intelligence/alerts/${projectId}`),

  gisQuery: (query: string, projectId?: string) =>
    apiFetch(`${BASE}/intelligence/gis-query`, {
      method: 'POST',
      body: JSON.stringify({ query, project_id: projectId }),
    }),

  simulate: (projectId: string, event: string, severity: string) =>
    apiFetch(`${BASE}/intelligence/simulate`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, event_type: event, severity }),
    }),

  // ── AI Orchestrator ──────────────────────────────────────────────────────
  askOrchestrator: (question: string, context: any = {}) =>
    apiFetch('/api/v1/ask', {
      method: 'POST',
      body: JSON.stringify({ question, ...context }),
    }),
};
