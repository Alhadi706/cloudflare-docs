import { pgPool } from '@/lib/db-pg';

export type FieldTeamMember = {
  empId: number;
  name: string;
  email: string;
  role: string;
};

export type FieldTeamRecord = {
  id: string;
  tenantId: string;
  name: string;
  specialization: string;
  members: FieldTeamMember[];
  createdAt: string;
  updatedAt: string;
};

export type MonthlyPhaseStatus = 'planned' | 'in_progress' | 'data_uploaded' | 'completed';

export type MonthlyPhaseRecord = {
  id: string;
  tenantId: string;
  planId: number;
  planTitle: string;
  month: string;
  year: number;
  fromStation: string;
  toStation: string;
  teamName: string | null;
  notes: string | null;
  status: MonthlyPhaseStatus;
  createdAt: string;
  updatedAt: string;
};

let corrosionWorkflowTablesReady = false;

export async function ensureCorrosionWorkflowTables() {
  if (corrosionWorkflowTablesReady) return;

  await pgPool.query(`
    CREATE SCHEMA IF NOT EXISTS workspace;
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.corrosion_field_teams (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      members_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_corrosion_field_teams_tenant
      ON workspace.corrosion_field_teams (tenant_id, updated_at DESC);
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.corrosion_monthly_phases (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      plan_id BIGINT NOT NULL,
      plan_title TEXT NOT NULL,
      month_name TEXT NOT NULL,
      year_num INT NOT NULL,
      from_station TEXT NOT NULL,
      to_station TEXT NOT NULL,
      team_name TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_corrosion_monthly_phases_tenant
      ON workspace.corrosion_monthly_phases (tenant_id, year_num DESC, month_name, created_at DESC);
  `);

  corrosionWorkflowTablesReady = true;
}

/**
 * Resolve tenant_id from server-authoritative header only.
 * This header is set exclusively by middleware.ts after JWT verification.
 * Never read X-Tenant-ID directly — it is client-supplied and untrusted.
 */
export function resolveTenantId(headers: Headers): string {
  return (headers.get('x-verified-tenant-id') ?? '').trim();
}

export function mapFieldTeamRow(row: any): FieldTeamRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    specialization: row.specialization,
    members: Array.isArray(row.members_json) ? row.members_json : [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapMonthlyPhaseRow(row: any): MonthlyPhaseRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: Number(row.plan_id),
    planTitle: row.plan_title,
    month: row.month_name,
    year: Number(row.year_num),
    fromStation: row.from_station,
    toStation: row.to_station,
    teamName: row.team_name ?? null,
    notes: row.notes ?? null,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
