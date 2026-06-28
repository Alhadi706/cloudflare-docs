import { promises as fs } from 'fs';
import path from 'path';

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

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'gis-service-layers.json');

export async function loadServiceLayers(): Promise<ServiceLayerRecord[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ServiceLayerRecord[];
  } catch {
    return [];
  }
}

export async function saveServiceLayers(rows: ServiceLayerRecord[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export function generateLayerId() {
  return `lyr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextLayerOrder(rows: ServiceLayerRecord[], tenantId: string): number {
  const tenantRows = rows.filter((item) => item.tenant_id === tenantId);
  if (tenantRows.length === 0) return 1;
  return Math.max(...tenantRows.map((item) => item.order || 0)) + 1;
}

export function normalizeTenantOrders(rows: ServiceLayerRecord[], tenantId: string): ServiceLayerRecord[] {
  const tenantRows = rows
    .filter((item) => item.tenant_id === tenantId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const mapped = new Map<string, number>();
  tenantRows.forEach((item, index) => mapped.set(item.id, index + 1));

  return rows.map((item) => {
    if (item.tenant_id !== tenantId) return item;
    const nextOrder = mapped.get(item.id) || item.order;
    return nextOrder === item.order ? item : { ...item, order: nextOrder };
  });
}

export function defaultLayerStyle(type: ServiceLayerType): Record<string, unknown> {
  if (type === 'service-point') {
    return { color: '#22c55e', size: 8, icon: 'circle' };
  }
  if (type === 'service-area') {
    return { stroke: '#0ea5e9', fill: 'rgba(14,165,233,0.2)', width: 2 };
  }
  if (type === 'network') {
    return { color: '#f59e0b', width: 3, dash: [6, 4] };
  }
  if (type === 'planning') {
    return { stroke: '#a855f7', fill: 'rgba(168,85,247,0.16)', width: 2 };
  }
  return { color: '#94a3b8', width: 2 };
}
