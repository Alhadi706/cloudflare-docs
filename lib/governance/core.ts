import { pgPool } from '@/lib/db-pg';
import { hasPermission, type Permission } from '@/lib/permissions';

export type GovernanceActor = {
  tenantId: string;
  tenantCode: string | null;
  email: string;
  role: string;
  departmentCode: string | null;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'cancelled';
export type WorkflowStatus = 'draft' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed' | 'cancelled';

let governanceSchemaReady = false;

export function mapWorkOrderStatusToWorkflowStatus(statusRaw: string | null | undefined): WorkflowStatus {
  const status = String(statusRaw || '').trim().toLowerCase();
  if (!status) return 'pending';

  if (['closed', 'closed_no_issue', 'completed'].includes(status)) return 'completed';
  if (['cancelled'].includes(status)) return 'cancelled';
  if (['rejected'].includes(status)) return 'rejected';
  if (['approved'].includes(status)) return 'approved';
  if (['in_review', 'technical_analysis'].includes(status)) return 'in_review';
  return 'pending';
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureGovernanceSchema() {
  if (governanceSchemaReady) return;

  await pgPool.query('CREATE SCHEMA IF NOT EXISTS workspace;');

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.governance_workflows (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      workflow_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      external_ref TEXT,
      status TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT,
      assigned_to TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_governance_workflows_tenant
      ON workspace.governance_workflows (tenant_id, workflow_type, status, updated_at DESC);
  `);

  await pgPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_workflows_external_ref
      ON workspace.governance_workflows (tenant_id, external_ref)
      WHERE external_ref IS NOT NULL;
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.governance_approvals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      approval_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      workflow_id TEXT,
      status TEXT NOT NULL,
      requested_by TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_by TEXT,
      decided_at TIMESTAMPTZ,
      decision_note TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT fk_governance_approvals_workflow
        FOREIGN KEY (workflow_id) REFERENCES workspace.governance_workflows(id) ON DELETE SET NULL
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_governance_approvals_tenant
      ON workspace.governance_approvals (tenant_id, approval_type, status, requested_at DESC);
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.governance_authority_delegations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      from_actor TEXT NOT NULL,
      to_actor TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_governance_delegations_tenant
      ON workspace.governance_authority_delegations (tenant_id, permission_key, status, starts_at DESC);
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.governance_accountability_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_governance_accountability_tenant
      ON workspace.governance_accountability_records (tenant_id, scope_type, scope_id, active, updated_at DESC);
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.governance_audit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      module_name TEXT NOT NULL,
      actor_email TEXT,
      actor_role TEXT,
      workflow_id TEXT,
      approval_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      request_id TEXT,
      status TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_governance_audit_tenant
      ON workspace.governance_audit_events (tenant_id, module_name, event_type, created_at DESC);
  `);

  governanceSchemaReady = true;
}

export class AuthorityResolutionService {
  static resolveActor(req: Request): GovernanceActor | null {
    const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();
    const role = (req.headers.get('x-verified-role') || '').trim();
    if (!tenantId || !role) return null;

    return {
      tenantId,
      tenantCode: (req.headers.get('x-verified-tenant-code') || '').trim() || null,
      email: (req.headers.get('x-verified-email') || '').trim(),
      role,
      departmentCode: (req.headers.get('x-verified-dept-code') || '').trim() || null,
    };
  }

  static async can(req: Request, permission: Permission): Promise<boolean> {
    const actor = this.resolveActor(req);
    if (!actor) return false;

    if (hasPermission(actor.role, permission)) return true;

    await ensureGovernanceSchema();
    const now = new Date().toISOString();
    const rs = await pgPool.query(
      `SELECT 1
         FROM workspace.governance_authority_delegations
        WHERE tenant_id = $1
          AND permission_key = $2
          AND to_actor = $3
          AND status = 'active'
          AND starts_at <= $4
          AND (ends_at IS NULL OR ends_at >= $4)
        LIMIT 1`,
      [actor.tenantId, permission, actor.email, now]
    );

    return rs.rowCount > 0;
  }
}

export class ImmutableAuditService {
  static async append(params: {
    tenantId: string;
    eventType: string;
    moduleName: string;
    actorEmail?: string | null;
    actorRole?: string | null;
    workflowId?: string | null;
    approvalId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    requestId?: string | null;
    status?: string | null;
    payload?: Record<string, unknown>;
  }) {
    await ensureGovernanceSchema();

    await pgPool.query(
      `INSERT INTO workspace.governance_audit_events
      (id, tenant_id, event_type, module_name, actor_email, actor_role, workflow_id, approval_id, entity_type, entity_id, request_id, status, payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [
        randomId('gaud'),
        params.tenantId,
        params.eventType,
        params.moduleName,
        params.actorEmail || null,
        params.actorRole || null,
        params.workflowId || null,
        params.approvalId || null,
        params.entityType || null,
        params.entityId || null,
        params.requestId || null,
        params.status || null,
        JSON.stringify(params.payload || {}),
      ]
    );
  }
}

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_review', 'approved', 'rejected', 'cancelled'],
  in_review: ['approved', 'rejected', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: ['pending', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isAllowedWorkflowTransition(fromStatus: WorkflowStatus, toStatus: WorkflowStatus): boolean {
  const allowed = WORKFLOW_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export class WorkflowEngine {
  static async create(input: {
    tenantId: string;
    workflowType: string;
    entityType: string;
    entityId: string;
    externalRef?: string | null;
    payload?: Record<string, unknown>;
    createdBy?: string | null;
    assignedTo?: string | null;
    initialStatus?: WorkflowStatus;
  }) {
    await ensureGovernanceSchema();

    const id = randomId('gwf');
    const status = input.initialStatus || 'pending';

    await pgPool.query(
      `INSERT INTO workspace.governance_workflows
      (id, tenant_id, workflow_type, entity_type, entity_id, external_ref, status, payload, created_by, assigned_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
      ON CONFLICT (tenant_id, external_ref)
      WHERE external_ref IS NOT NULL
      DO UPDATE SET
        workflow_type = EXCLUDED.workflow_type,
        entity_type = EXCLUDED.entity_type,
        entity_id = EXCLUDED.entity_id,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        assigned_to = COALESCE(EXCLUDED.assigned_to, workspace.governance_workflows.assigned_to),
        updated_at = NOW()`,
      [
        id,
        input.tenantId,
        input.workflowType,
        input.entityType,
        input.entityId,
        input.externalRef || null,
        status,
        JSON.stringify(input.payload || {}),
        input.createdBy || null,
        input.assignedTo || null,
      ]
    );

    const rs = await pgPool.query(
      `SELECT * FROM workspace.governance_workflows
        WHERE tenant_id = $1
          AND (id = $2 OR (external_ref IS NOT NULL AND external_ref = $3))
        ORDER BY updated_at DESC
        LIMIT 1`,
      [input.tenantId, id, input.externalRef || null]
    );

    return rs.rows[0];
  }

  static async transition(input: {
    tenantId: string;
    workflowId: string;
    toStatus: WorkflowStatus;
    actorEmail?: string | null;
    actorRole?: string | null;
    note?: string;
    metadata?: Record<string, unknown>;
  }) {
    await ensureGovernanceSchema();

    const currentRs = await pgPool.query(
      `SELECT * FROM workspace.governance_workflows WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [input.workflowId, input.tenantId]
    );

    if (currentRs.rowCount === 0) {
      throw new Error('workflow_not_found');
    }

    const current = currentRs.rows[0];
    const fromStatus = String(current.status) as WorkflowStatus;
    if (!isAllowedWorkflowTransition(fromStatus, input.toStatus)) {
      throw new Error(`invalid_workflow_transition:${fromStatus}->${input.toStatus}`);
    }

    const nextPayload = {
      ...(current.payload || {}),
      transition_note: input.note || null,
      transition_metadata: input.metadata || {},
      transitioned_at: new Date().toISOString(),
    };

    const updated = await pgPool.query(
      `UPDATE workspace.governance_workflows
          SET status = $1,
              payload = $2::jsonb,
              updated_at = NOW()
        WHERE id = $3
          AND tenant_id = $4
      RETURNING *`,
      [input.toStatus, JSON.stringify(nextPayload), input.workflowId, input.tenantId]
    );

    await ImmutableAuditService.append({
      tenantId: input.tenantId,
      eventType: 'workflow_transitioned',
      moduleName: 'governance.workflow',
      actorEmail: input.actorEmail || null,
      actorRole: input.actorRole || null,
      workflowId: input.workflowId,
      entityType: current.entity_type,
      entityId: current.entity_id,
      status: input.toStatus,
      payload: {
        from_status: fromStatus,
        to_status: input.toStatus,
        note: input.note || null,
        metadata: input.metadata || {},
      },
    });

    return updated.rows[0];
  }

  static async list(input: {
    tenantId: string;
    workflowType?: string;
    status?: WorkflowStatus;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    await ensureGovernanceSchema();

    const where: string[] = ['tenant_id = $1'];
    const values: unknown[] = [input.tenantId];

    const add = (cond: string, value: unknown) => {
      values.push(value);
      where.push(cond.replace('?', `$${values.length}`));
    };

    if (input.workflowType) add('workflow_type = ?', input.workflowType);
    if (input.status) add('status = ?', input.status);
    if (input.entityType) add('entity_type = ?', input.entityType);
    if (input.entityId) add('entity_id = ?', input.entityId);

    values.push(Math.max(1, Math.min(200, input.limit || 50)));

    const rs = await pgPool.query(
      `SELECT *
         FROM workspace.governance_workflows
        WHERE ${where.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT $${values.length}`,
      values
    );

    return rs.rows;
  }
}

export class ApprovalService {
  static async create(input: {
    tenantId: string;
    approvalType: string;
    entityType: string;
    entityId: string;
    requestedBy?: string | null;
    workflowId?: string | null;
    payload?: Record<string, unknown>;
  }) {
    await ensureGovernanceSchema();

    const id = randomId('gapp');
    const rs = await pgPool.query(
      `INSERT INTO workspace.governance_approvals
      (id, tenant_id, approval_type, entity_type, entity_id, workflow_id, status, requested_by, payload)
      VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8::jsonb)
      RETURNING *`,
      [
        id,
        input.tenantId,
        input.approvalType,
        input.entityType,
        input.entityId,
        input.workflowId || null,
        input.requestedBy || null,
        JSON.stringify(input.payload || {}),
      ]
    );

    await ImmutableAuditService.append({
      tenantId: input.tenantId,
      eventType: 'approval_created',
      moduleName: 'governance.approval',
      actorEmail: input.requestedBy || null,
      approvalId: id,
      workflowId: input.workflowId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'pending',
      payload: { approval_type: input.approvalType },
    });

    return rs.rows[0];
  }

  static async decide(input: {
    tenantId: string;
    approvalId: string;
    decision: Extract<ApprovalStatus, 'approved' | 'rejected' | 'delegated' | 'cancelled'>;
    decidedBy?: string | null;
    decisionNote?: string | null;
    payload?: Record<string, unknown>;
  }) {
    await ensureGovernanceSchema();

    const currentRs = await pgPool.query(
      `SELECT * FROM workspace.governance_approvals WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [input.approvalId, input.tenantId]
    );

    if (currentRs.rowCount === 0) {
      throw new Error('approval_not_found');
    }

    const current = currentRs.rows[0];
    if (String(current.status) !== 'pending') {
      throw new Error('approval_not_pending');
    }

    const nextPayload = {
      ...(current.payload || {}),
      decision_payload: input.payload || {},
      decision_at: new Date().toISOString(),
    };

    const rs = await pgPool.query(
      `UPDATE workspace.governance_approvals
          SET status = $1,
              decided_by = $2,
              decided_at = NOW(),
              decision_note = $3,
              payload = $4::jsonb
        WHERE id = $5
          AND tenant_id = $6
      RETURNING *`,
      [
        input.decision,
        input.decidedBy || null,
        input.decisionNote || null,
        JSON.stringify(nextPayload),
        input.approvalId,
        input.tenantId,
      ]
    );

    const updated = rs.rows[0];

    if (updated.workflow_id) {
      const workflowStatus: WorkflowStatus =
        input.decision === 'approved'
          ? 'approved'
          : input.decision === 'rejected'
          ? 'rejected'
          : input.decision === 'cancelled'
          ? 'cancelled'
          : 'in_review';

      try {
        await WorkflowEngine.transition({
          tenantId: input.tenantId,
          workflowId: updated.workflow_id,
          toStatus: workflowStatus,
          actorEmail: input.decidedBy || null,
          actorRole: null,
          note: input.decisionNote || undefined,
          metadata: { approval_id: input.approvalId },
        });
      } catch {
        // Compatibility-safe: approval decision should not fail because workflow transition did.
      }
    }

    await ImmutableAuditService.append({
      tenantId: input.tenantId,
      eventType: 'approval_decided',
      moduleName: 'governance.approval',
      actorEmail: input.decidedBy || null,
      approvalId: input.approvalId,
      workflowId: updated.workflow_id || null,
      entityType: updated.entity_type,
      entityId: updated.entity_id,
      status: input.decision,
      payload: { decision_note: input.decisionNote || null, decision_payload: input.payload || {} },
    });

    return updated;
  }

  static async list(input: {
    tenantId: string;
    status?: ApprovalStatus;
    approvalType?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    await ensureGovernanceSchema();

    const where: string[] = ['tenant_id = $1'];
    const values: unknown[] = [input.tenantId];

    const add = (cond: string, value: unknown) => {
      values.push(value);
      where.push(cond.replace('?', `$${values.length}`));
    };

    if (input.status) add('status = ?', input.status);
    if (input.approvalType) add('approval_type = ?', input.approvalType);
    if (input.entityType) add('entity_type = ?', input.entityType);
    if (input.entityId) add('entity_id = ?', input.entityId);

    values.push(Math.max(1, Math.min(200, input.limit || 50)));

    const rs = await pgPool.query(
      `SELECT *
         FROM workspace.governance_approvals
        WHERE ${where.join(' AND ')}
        ORDER BY requested_at DESC
        LIMIT $${values.length}`,
      values
    );

    return rs.rows;
  }

  static async findPendingByEntity(input: {
    tenantId: string;
    approvalType: string;
    entityType: string;
    entityId: string;
  }) {
    const rows = await this.list({
      tenantId: input.tenantId,
      approvalType: input.approvalType,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'pending',
      limit: 1,
    });
    return rows[0] || null;
  }
}

export class DelegationService {
  static async create(input: {
    tenantId: string;
    permissionKey: Permission;
    fromActor: string;
    toActor: string;
    reason?: string;
    startsAt?: string;
    endsAt?: string | null;
    createdBy?: string | null;
  }) {
    await ensureGovernanceSchema();

    const id = randomId('gdel');
    const rs = await pgPool.query(
      `INSERT INTO workspace.governance_authority_delegations
      (id, tenant_id, permission_key, from_actor, to_actor, reason, status, starts_at, ends_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9)
      RETURNING *`,
      [
        id,
        input.tenantId,
        input.permissionKey,
        input.fromActor,
        input.toActor,
        input.reason || null,
        input.startsAt || new Date().toISOString(),
        input.endsAt || null,
        input.createdBy || null,
      ]
    );

    await ImmutableAuditService.append({
      tenantId: input.tenantId,
      eventType: 'delegation_created',
      moduleName: 'governance.delegation',
      actorEmail: input.createdBy || null,
      status: 'active',
      payload: {
        delegation_id: id,
        permission_key: input.permissionKey,
        from_actor: input.fromActor,
        to_actor: input.toActor,
      },
    });

    return rs.rows[0];
  }

  static async list(input: { tenantId: string; status?: 'active' | 'revoked'; permissionKey?: string; limit?: number }) {
    await ensureGovernanceSchema();

    const where: string[] = ['tenant_id = $1'];
    const values: unknown[] = [input.tenantId];

    if (input.status) {
      values.push(input.status);
      where.push(`status = $${values.length}`);
    }

    if (input.permissionKey) {
      values.push(input.permissionKey);
      where.push(`permission_key = $${values.length}`);
    }

    values.push(Math.max(1, Math.min(200, input.limit || 50)));

    const rs = await pgPool.query(
      `SELECT *
         FROM workspace.governance_authority_delegations
        WHERE ${where.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT $${values.length}`,
      values
    );

    return rs.rows;
  }

  static async revoke(input: { tenantId: string; delegationId: string; revokedBy?: string | null; reason?: string }) {
    await ensureGovernanceSchema();

    const rs = await pgPool.query(
      `UPDATE workspace.governance_authority_delegations
          SET status = 'revoked',
              reason = COALESCE($1, reason),
              updated_at = NOW()
        WHERE id = $2
          AND tenant_id = $3
      RETURNING *`,
      [input.reason || null, input.delegationId, input.tenantId]
    );

    if (rs.rowCount === 0) throw new Error('delegation_not_found');

    await ImmutableAuditService.append({
      tenantId: input.tenantId,
      eventType: 'delegation_revoked',
      moduleName: 'governance.delegation',
      actorEmail: input.revokedBy || null,
      status: 'revoked',
      payload: { delegation_id: input.delegationId, reason: input.reason || null },
    });

    return rs.rows[0];
  }
}

export class AccountabilityService {
  static async upsertRecord(input: {
    tenantId: string;
    scopeType: string;
    scopeId: string;
    actorEmail: string;
    actorRole: string;
    responsibility: string;
    metadata?: Record<string, unknown>;
  }) {
    await ensureGovernanceSchema();

    const existing = await pgPool.query(
      `SELECT id FROM workspace.governance_accountability_records
        WHERE tenant_id = $1
          AND scope_type = $2
          AND scope_id = $3
          AND actor_email = $4
          AND responsibility = $5
        LIMIT 1`,
      [input.tenantId, input.scopeType, input.scopeId, input.actorEmail, input.responsibility]
    );

    if (existing.rowCount > 0) {
      const id = existing.rows[0].id;
      const rs = await pgPool.query(
        `UPDATE workspace.governance_accountability_records
            SET actor_role = $1,
                active = true,
                metadata = $2::jsonb,
                updated_at = NOW()
          WHERE id = $3
        RETURNING *`,
        [input.actorRole, JSON.stringify(input.metadata || {}), id]
      );
      return rs.rows[0];
    }

    const rs = await pgPool.query(
      `INSERT INTO workspace.governance_accountability_records
      (id, tenant_id, scope_type, scope_id, actor_email, actor_role, responsibility, active, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8::jsonb)
      RETURNING *`,
      [
        randomId('gacc'),
        input.tenantId,
        input.scopeType,
        input.scopeId,
        input.actorEmail,
        input.actorRole,
        input.responsibility,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return rs.rows[0];
  }

  static async list(input: { tenantId: string; scopeType?: string; scopeId?: string; activeOnly?: boolean; limit?: number }) {
    await ensureGovernanceSchema();

    const where: string[] = ['tenant_id = $1'];
    const values: unknown[] = [input.tenantId];

    if (input.scopeType) {
      values.push(input.scopeType);
      where.push(`scope_type = $${values.length}`);
    }

    if (input.scopeId) {
      values.push(input.scopeId);
      where.push(`scope_id = $${values.length}`);
    }

    if (input.activeOnly !== false) {
      where.push('active = true');
    }

    values.push(Math.max(1, Math.min(300, input.limit || 100)));

    const rs = await pgPool.query(
      `SELECT *
         FROM workspace.governance_accountability_records
        WHERE ${where.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT $${values.length}`,
      values
    );

    return rs.rows;
  }
}

export async function listGovernanceAudit(input: {
  tenantId: string;
  moduleName?: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}) {
  await ensureGovernanceSchema();

  const where: string[] = ['tenant_id = $1'];
  const values: unknown[] = [input.tenantId];

  const add = (column: string, value: string | undefined) => {
    if (!value) return;
    values.push(value);
    where.push(`${column} = $${values.length}`);
  };

  add('module_name', input.moduleName);
  add('event_type', input.eventType);
  add('entity_type', input.entityType);
  add('entity_id', input.entityId);

  values.push(Math.max(1, Math.min(500, input.limit || 100)));

  const rs = await pgPool.query(
    `SELECT *
       FROM workspace.governance_audit_events
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${values.length}`,
    values
  );

  return rs.rows;
}
