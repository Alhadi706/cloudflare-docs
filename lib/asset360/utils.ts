import type {
  Asset360Document,
  Asset360GovernanceAction,
  Asset360TimelineEvent,
  Asset360WorkOrder,
} from '@/lib/asset360/types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeStatus(status: unknown): string {
  return String(status || '').trim().toLowerCase();
}

function isCompletedStatus(status: string): boolean {
  return ['completed', 'closed', 'closed_no_issue'].includes(status);
}

export function extractWorkOrders(payload: any, source: 'workflow' | 'work_orders'): Asset360WorkOrder[] {
  const rows = asArray<any>(payload)
    .concat(asArray<any>(payload?.work_orders))
    .concat(asArray<any>(payload?.rows))
    .concat(asArray<any>(payload?.items))
    .concat(asArray<any>(payload?.data));

  const out: Asset360WorkOrder[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const idRaw = row.id ?? row.work_order_id ?? row.wo_id ?? row.work_order_number ?? row.wo_number;
    const id = String(idRaw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      work_order_number: row.work_order_number || row.wo_number || undefined,
      title: row.title || row.title_ar || undefined,
      description: row.description || row.notes || undefined,
      status: row.status || undefined,
      priority: row.priority || undefined,
      work_type: row.work_type || row.wo_type || undefined,
      asset_id: row.asset_id != null ? String(row.asset_id) : undefined,
      asset_name: row.asset_name || undefined,
      created_at: row.created_at || undefined,
      completion_date: row.completion_date || undefined,
      scheduled_date: row.scheduled_date || undefined,
      source,
      raw: row,
    });
  }

  return out;
}

export function filterWorkOrdersByAsset(workOrders: Asset360WorkOrder[], _asset: Record<string, unknown>, assetId: string): Asset360WorkOrder[] {
  const idNorm = String(assetId).trim();
  if (!idNorm) return [];

  return workOrders.filter((wo) => {
    const woAssetId = String(wo.asset_id || '').trim();
    if (woAssetId && woAssetId === idNorm) return true;

    const rawAssetId = String((wo.raw as any)?.asset_id || '').trim();
    return !!rawAssetId && rawAssetId === idNorm;
  });
}

export function splitWorkOrders(workOrders: Asset360WorkOrder[]): {
  open_work_orders: Asset360WorkOrder[];
  completed_work: Asset360WorkOrder[];
} {
  const open_work_orders: Asset360WorkOrder[] = [];
  const completed_work: Asset360WorkOrder[] = [];

  for (const wo of workOrders) {
    const status = normalizeStatus(wo.status);
    if (isCompletedStatus(status)) {
      completed_work.push(wo);
    } else {
      open_work_orders.push(wo);
    }
  }

  return { open_work_orders, completed_work };
}

export function splitDocuments(docs: Asset360Document[]): {
  photos_and_attachments: Asset360Document[];
  regular_documents: Asset360Document[];
} {
  const photoTypes = new Set(['photo', 'image']);
  const attachmentTypes = new Set(['attachment', 'file_attachment', 'supporting_attachment']);

  const photos_and_attachments: Asset360Document[] = [];
  const regular_documents: Asset360Document[] = [];

  for (const doc of docs) {
    const type = String(doc.doc_type || '').trim().toLowerCase();
    const isPhoto = photoTypes.has(type);
    const isAttachment = attachmentTypes.has(type);

    if (isPhoto || isAttachment) {
      photos_and_attachments.push(doc);
    }

    if (!isPhoto && !isAttachment) {
      regular_documents.push(doc);
    }
  }

  return { photos_and_attachments, regular_documents };
}

export function buildOperationalTimeline(input: {
  assetId: string;
  asset: Record<string, unknown>;
  children: Array<Record<string, unknown>>;
  documents: Asset360Document[];
  workOrders: Asset360WorkOrder[];
  governanceActions: Asset360GovernanceAction[];
}): Asset360TimelineEvent[] {
  const timeline: Asset360TimelineEvent[] = [];

  timeline.push({
    id: `asset:${input.assetId}`,
    kind: 'asset',
    title: 'Asset Registered',
    subtitle: String(input.asset.asset_name || input.asset.name || input.assetId),
    at: String(input.asset.created_at || ''),
    status: String(input.asset.status || ''),
  });

  for (const child of input.children) {
    const childId = String(child.id || '').trim();
    if (!childId) continue;

    timeline.push({
      id: `rel:${childId}`,
      kind: 'relationship',
      title: 'Child Asset Linked',
      subtitle: String(child.asset_name || child.name || child.id || 'Child asset'),
      at: String(child.created_at || ''),
      status: String(child.status || ''),
    });
  }

  for (const doc of input.documents) {
    const type = String(doc.doc_type || '').toLowerCase();
    timeline.push({
      id: `doc:${doc.id}`,
      kind: type === 'photo' ? 'photo' : 'document',
      title: type === 'photo' ? 'Photo/Attachment Added' : 'Document Added',
      subtitle: doc.title,
      at: doc.created_at,
      meta: { doc_type: doc.doc_type || null },
    });
  }

  for (const wo of input.workOrders) {
    timeline.push({
      id: `wo:${wo.id}`,
      kind: 'work_order',
      title: 'Work Order Activity',
      subtitle: wo.work_order_number || wo.title || wo.id,
      at: wo.completion_date || wo.created_at,
      status: wo.status,
      meta: { source: wo.source || null, priority: wo.priority || null },
    });
  }

  for (const action of input.governanceActions) {
    timeline.push({
      id: `gov:${action.action_type}:${action.id}`,
      kind: 'governance',
      title: action.title,
      subtitle: action.actor,
      at: action.at,
      status: action.status,
      meta: action.payload,
    });
  }

  return timeline
    .filter((item) => !!item.id)
    .sort((a, b) => {
      const aTs = a.at ? Date.parse(a.at) : 0;
      const bTs = b.at ? Date.parse(b.at) : 0;
      return bTs - aTs;
    });
}
