import type {
  Project360GovernanceAction,
  Project360HandoverStatus,
  Project360IntegrationSourceStatus,
  Project360IntegrationStatus,
  Project360TimelineEvent,
} from '@/lib/project360/types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normId(value: unknown): string {
  return String(value ?? '').trim();
}

function isSameId(a: unknown, b: unknown): boolean {
  const left = normId(a);
  const right = normId(b);
  if (!left || !right) return false;
  return left === right;
}

export function extractRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return asArray<any>(payload?.items)
    .concat(asArray<any>(payload?.rows))
    .concat(asArray<any>(payload?.data))
    .concat(asArray<any>(payload?.sites))
    .concat(asArray<any>(payload?.assets))
    .concat(asArray<any>(payload?.documents))
    .concat(asArray<any>(payload?.contracts))
    .concat(asArray<any>(payload?.milestones))
    .concat(asArray<any>(payload?.letters))
    .concat(asArray<any>(payload?.memos));
}

export function filterByProjectIdCanonical(rows: any[], projectId: string): any[] {
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return (
      isSameId(row.project_id, projectId)
      || isSameId(row.entity_id, projectId)
      || isSameId(row.projectId, projectId)
    );
  });
}

export function filterByTenantScope(rows: any[], tenantId: string): { allowed: any[]; dropped: number } {
  if (!tenantId) return { allowed: rows, dropped: 0 };

  const allowed: any[] = [];
  let dropped = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rowTenant = normId(row.tenant_id ?? row.tenantId ?? row.tenant);
    if (!rowTenant || rowTenant === tenantId) {
      allowed.push(row);
    } else {
      dropped += 1;
    }
  }

  return { allowed, dropped };
}

export function buildIntegrationStatus(sources: Project360IntegrationSourceStatus[]): Project360IntegrationStatus {
  const failed = sources.filter((source) => !source.ok).length;
  return {
    ok: failed === 0,
    degraded: failed > 0,
    total_sources: sources.length,
    failed_sources: failed,
    sources,
  };
}

export function buildGovernanceActions(input: {
  projectId: string;
  projectRows: any[];
  assetRows: any[];
  actionType: 'workflow' | 'approval' | 'audit';
}): Project360GovernanceAction[] {
  const actions: Project360GovernanceAction[] = [];

  for (const row of input.projectRows) {
    const id = normId(row.id);
    if (!id) continue;

    actions.push({
      id,
      action_type: input.actionType,
      title: `${input.actionType}: ${String(row.event_type || row.workflow_type || row.approval_type || 'project')}`,
      status: String(row.status || ''),
      actor: String(row.actor_email || row.decided_by || row.requested_by || row.created_by || ''),
      at: row.created_at || row.updated_at || row.requested_at || undefined,
      canonical_ref: {
        project_id: input.projectId,
        entity_type: 'project',
        entity_id: input.projectId,
      },
      payload: row,
    });
  }

  for (const row of input.assetRows) {
    const id = normId(row.id);
    const entityId = normId(row.entity_id);
    if (!id || !entityId) continue;

    actions.push({
      id,
      action_type: input.actionType,
      title: `${input.actionType}: ${String(row.event_type || row.workflow_type || row.approval_type || 'asset')}`,
      status: String(row.status || ''),
      actor: String(row.actor_email || row.decided_by || row.requested_by || row.created_by || ''),
      at: row.created_at || row.updated_at || row.requested_at || undefined,
      canonical_ref: {
        project_id: input.projectId,
        entity_type: 'asset',
        entity_id: entityId,
      },
      payload: row,
    });
  }

  return actions;
}

export function deriveHandoverStatus(input: {
  projectStatus: string;
  milestonesTotal: number;
  milestonesCompleted: number;
  resultingAssetsCount: number;
  maintenanceWorkOrdersCount: number;
  maintenanceItemsCount: number;
}): Project360HandoverStatus {
  const statusNorm = String(input.projectStatus || '').toLowerCase();
  let handoverState: Project360HandoverStatus['handover_state'] = 'not_started';

  if (statusNorm === 'completed' || statusNorm === 'handover_completed') {
    handoverState = 'completed';
  } else if (input.resultingAssetsCount > 0 || input.milestonesCompleted > 0) {
    handoverState = 'in_progress';
  }

  return {
    project_status: input.projectStatus,
    milestones_completed: input.milestonesCompleted,
    milestones_total: input.milestonesTotal,
    resulting_assets_count: input.resultingAssetsCount,
    maintenance_work_orders_count: input.maintenanceWorkOrdersCount,
    maintenance_items_count: input.maintenanceItemsCount,
    handover_state: handoverState,
  };
}

export function buildOperationalTimeline(input: {
  projectId: string;
  project: Record<string, any>;
  sites: any[];
  documents: any[];
  contracts: any[];
  budgets: any[];
  correspondence: any[];
  milestones: any[];
  assets: any[];
  governance: Project360GovernanceAction[];
  handover: Project360HandoverStatus;
}): Project360TimelineEvent[] {
  const events: Project360TimelineEvent[] = [];

  events.push({
    id: `project:${input.projectId}`,
    kind: 'project',
    title: 'Project Created',
    subtitle: String(input.project.name || input.project.project_name || input.projectId),
    at: String(input.project.created_at || input.project.start_date || ''),
    status: String(input.project.status || ''),
  });

  for (const site of input.sites) {
    const id = normId(site.id);
    if (!id) continue;
    events.push({
      id: `site:${id}`,
      kind: 'site',
      title: 'Project Site Registered',
      subtitle: String(site.name || site.site_name || id),
      at: String(site.created_at || ''),
      status: String(site.status || ''),
    });
  }

  for (const doc of input.documents) {
    const id = normId(doc.id);
    if (!id) continue;
    events.push({
      id: `doc:${id}`,
      kind: 'document',
      title: 'Document Added',
      subtitle: String(doc.document_name || doc.title || id),
      at: String(doc.uploaded_at || doc.created_at || ''),
      status: String(doc.status || ''),
      meta: { doc_type: doc.category || doc.doc_type || null },
    });
  }

  for (const contract of input.contracts) {
    const id = normId(contract.id);
    if (!id) continue;
    events.push({
      id: `contract:${id}`,
      kind: 'contract',
      title: 'Contract Updated',
      subtitle: String(contract.contract_number || contract.contract_title || id),
      at: String(contract.created_at || contract.start_date || ''),
      status: String(contract.status || ''),
    });
  }

  for (const budget of input.budgets) {
    const id = normId(budget.id);
    if (!id) continue;
    events.push({
      id: `budget:${id}`,
      kind: 'budget',
      title: 'Budget Snapshot',
      subtitle: String(budget.project_name || budget.budget_name_ar || id),
      at: String(budget.last_updated || budget.updated_at || budget.created_at || ''),
      status: String(budget.status || ''),
    });
  }

  for (const item of input.correspondence) {
    const id = normId(item.id);
    if (!id) continue;
    events.push({
      id: `correspondence:${id}`,
      kind: 'correspondence',
      title: 'Correspondence Recorded',
      subtitle: String(item.document_number || item.subject || id),
      at: String(item.created_at || item.archived_date || item.original_date || ''),
      status: String(item.status || ''),
    });
  }

  for (const milestone of input.milestones) {
    const id = normId(milestone.id);
    if (!id) continue;
    events.push({
      id: `milestone:${id}`,
      kind: 'milestone',
      title: 'Milestone Updated',
      subtitle: String(milestone.milestone_name || id),
      at: String(milestone.actual_completion_date || milestone.target_date || milestone.created_at || ''),
      status: String(milestone.status || ''),
    });
  }

  events.push({
    id: `handover:${input.projectId}`,
    kind: 'handover',
    title: 'Handover Status',
    subtitle: input.handover.handover_state,
    at: String(input.project.updated_at || input.project.end_date || ''),
    status: input.handover.handover_state,
    meta: {
      resulting_assets_count: input.handover.resulting_assets_count,
      milestones_completed: input.handover.milestones_completed,
      milestones_total: input.handover.milestones_total,
    },
  });

  for (const asset of input.assets) {
    const id = normId(asset.id);
    if (!id) continue;
    events.push({
      id: `asset:${id}`,
      kind: 'asset',
      title: 'Resulting Asset Linked',
      subtitle: String(asset.asset_name || asset.name || id),
      at: String(asset.created_at || ''),
      status: String(asset.status || ''),
    });
  }

  for (const action of input.governance) {
    events.push({
      id: `governance:${action.action_type}:${action.id}`,
      kind: 'governance',
      title: action.title,
      subtitle: action.actor,
      at: action.at,
      status: action.status,
      meta: action.payload,
    });
  }

  return events
    .filter((event) => !!event.id)
    .sort((a, b) => {
      const aTs = a.at ? Date.parse(a.at) : 0;
      const bTs = b.at ? Date.parse(b.at) : 0;
      return bTs - aTs;
    });
}
