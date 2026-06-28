import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export type ServiceLayerType = 'service-point' | 'service-area' | 'network' | 'planning' | 'custom';
export type GeometryType = 'point' | 'line' | 'polygon' | 'mixed';

export interface ServiceLayerRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: ServiceLayerType;
  geometry_type: GeometryType;
  municipality_key: string | null;
  visible: boolean;
  locked: boolean;
  order: number;
  style: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MunicipalityOption {
  key: string;
  labelEn: string;
  labelAr: string;
}

export async function listMunicipalities(): Promise<MunicipalityOption[]> {
  const res = await fetch('/api/geo/municipalities', { cache: 'no-store' });
  if (!res.ok) throw new Error(`municipalities_list_failed:${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export async function listServiceLayers(): Promise<{ items: ServiceLayerRecord[]; municipalities: MunicipalityOption[] }> {
  const res = await fetchWithClientTenantRetry('/api/gis/service-layers', { cache: 'no-store' });
  if (!res.ok) throw new Error(`service_layers_list_failed:${res.status}`);
  const data = await res.json();
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    municipalities: Array.isArray(data?.municipalities) ? data.municipalities : [],
  };
}

export async function createServiceLayer(payload: {
  name: string;
  type?: ServiceLayerType;
  geometry_type?: GeometryType;
  municipality_key?: string | null;
  visible?: boolean;
}) {
  const res = await fetchWithClientTenantRetry('/api/gis/service-layers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'create_failed');
    throw new Error(txt || `service_layer_create_failed:${res.status}`);
  }
  const data = await res.json();
  return data?.item as ServiceLayerRecord;
}

export async function updateServiceLayer(id: string, payload: Partial<ServiceLayerRecord>) {
  const res = await fetchWithClientTenantRetry(`/api/gis/service-layers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'update_failed');
    throw new Error(txt || `service_layer_update_failed:${res.status}`);
  }
  const data = await res.json();
  return data?.item as ServiceLayerRecord;
}

export async function deleteServiceLayer(id: string): Promise<void> {
  const res = await fetchWithClientTenantRetry(`/api/gis/service-layers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'delete_failed');
    throw new Error(txt || `service_layer_delete_failed:${res.status}`);
  }
}

export async function reorderServiceLayers(orderedIds: string[]): Promise<void> {
  const res = await fetchWithClientTenantRetry('/api/gis/service-layers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'reorder_failed');
    throw new Error(txt || `service_layers_reorder_failed:${res.status}`);
  }
}
