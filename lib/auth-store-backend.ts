import { pgPool } from '@/lib/db-pg';
import {
  findByEmail as jsonFindByEmail,
  findByUsernameScoped as jsonFindByUsernameScoped,
  listUsers as jsonListUsers,
  createUser as jsonCreateUser,
  updateUser as jsonUpdateUser,
  type SovereignUser,
} from '@/lib/user-store';
import {
  ensureTenantForOrganization as jsonEnsureTenantForOrganization,
  type TenantRecord,
  listTenants as jsonListTenants,
  hasAnyActiveScope as jsonHasAnyActiveScope,
  hasAnyPendingScope as jsonHasAnyPendingScope,
  ensureTenantDepartmentLink as jsonEnsureTenantDepartmentLink,
} from '@/lib/tenant-store';
import { normalizeAppScope } from '@/lib/appScope';

const AUTH_BACKEND = String(process.env.AUTH_STORE_BACKEND || 'json').trim().toLowerCase();
const REQUIRED_AUTH_TABLES = [
  'auth_users',
  'auth_tenants',
  'auth_tenant_department_links',
] as const;

let pgAuthReadyState: 'unknown' | 'ready' | 'failed' = 'unknown';
let pgAuthReadyError = '';
let pgAuthReadyPromise: Promise<void> | null = null;

function usePgAuthStore(): boolean {
  return AUTH_BACKEND === 'pg';
}

async function ensurePgAuthReady(): Promise<void> {
  if (!usePgAuthStore()) return;
  if (pgAuthReadyState === 'ready') return;
  if (pgAuthReadyState === 'failed') {
    throw new Error(`auth_pg_not_ready:${pgAuthReadyError || 'unknown_error'}`);
  }

  if (!pgAuthReadyPromise) {
    pgAuthReadyPromise = (async () => {
      const res = await pgPool.query(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])`,
        [REQUIRED_AUTH_TABLES]
      );

      const found = new Set(res.rows.map((r) => String(r.table_name)));
      const missing = REQUIRED_AUTH_TABLES.filter((t) => !found.has(t));
      if (missing.length) {
        throw new Error(`missing_tables:${missing.join(',')}`);
      }
    })()
      .then(() => {
        pgAuthReadyState = 'ready';
        pgAuthReadyError = '';
      })
      .catch((error) => {
        pgAuthReadyState = 'failed';
        pgAuthReadyError = error instanceof Error ? error.message : 'unknown_error';
        throw error;
      });
  }

  await pgAuthReadyPromise;
}

export async function authBackendStatus(): Promise<{
  backend: 'json' | 'pg';
  ready: boolean;
  error?: string;
}> {
  if (!usePgAuthStore()) {
    return { backend: 'json', ready: true };
  }

  try {
    await ensurePgAuthReady();
    return { backend: 'pg', ready: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown_error';
    return { backend: 'pg', ready: false, error: msg };
  }
}

function rowToUser(row: Record<string, unknown>): SovereignUser {
  return {
    id: String(row.id || ''),
    full_name: String(row.full_name || ''),
    email: String(row.email || '').toLowerCase(),
    tenant_id: row.tenant_id ? String(row.tenant_id) : undefined,
    tenant_code: row.tenant_code ? String(row.tenant_code) : undefined,
    phone_number: String(row.phone_number || ''),
    organization_name: String(row.organization_name || ''),
    organization_type: row.organization_type ? (String(row.organization_type) as SovereignUser['organization_type']) : undefined,
    country: row.country ? String(row.country) : undefined,
    job_title: row.job_title ? String(row.job_title) : undefined,
    status: String(row.status || 'pending_verification') as SovereignUser['status'],
    role: String(row.role || 'member') as SovereignUser['role'],
    is_founder: Boolean(row.is_founder),
    onboarding_complete: typeof row.onboarding_complete === 'boolean' ? row.onboarding_complete : undefined,
    is_first_admin: typeof row.is_first_admin === 'boolean' ? row.is_first_admin : undefined,
    department_code: row.department_code ? String(row.department_code) : undefined,
    section_id: row.section_id ? String(row.section_id) : undefined,
    invited_by: row.invited_by ? String(row.invited_by) : undefined,
    username: row.username ? String(row.username) : undefined,
    hashed_password: row.hashed_password ? String(row.hashed_password) : undefined,
    password_salt: row.password_salt ? String(row.password_salt) : undefined,
    must_change_password: typeof row.must_change_password === 'boolean' ? row.must_change_password : undefined,
    section_code: row.section_code ? String(row.section_code) : undefined,
    section_password: row.section_password ? String(row.section_password) : undefined,
    activation_token: String(row.activation_token || ''),
    activation_otp: String(row.activation_otp || ''),
    otp_expires: Number(row.otp_expires || 0),
    token_expires: Number(row.token_expires || 0),
    otp_attempts: Number(row.otp_attempts || 0),
    resend_count: Number(row.resend_count || 0),
    last_resend: Number(row.last_resend || 0),
    created_at: Number(row.created_at || Date.now()),
    verified_at: row.verified_at ? Number(row.verified_at) : undefined,
    last_login: row.last_login ? Number(row.last_login) : undefined,
  };
}

function rowToTenant(row: Record<string, unknown>): TenantRecord {
  return {
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    status: String(row.status || 'active') as TenantRecord['status'],
    created_at: Number(row.created_at || Date.now()),
    approved_at: Number(row.approved_at || Date.now()),
    approved_by: String(row.approved_by || 'migration'),
    first_admin_email: String(row.first_admin_email || ''),
    enabled_departments: Array.isArray(row.enabled_departments)
      ? row.enabled_departments.map((x) => String(x))
      : [],
    telegram_bot_token: row.telegram_bot_token ? String(row.telegram_bot_token) : undefined,
  };
}

function slugifyTenantCode(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06ff]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 3) return ascii.slice(0, 40);
  return `org-${Math.random().toString(16).slice(2, 8)}`;
}

export async function authFindByEmail(email: string): Promise<SovereignUser | undefined> {
  const normalized = email.toLowerCase().trim();
  if (!usePgAuthStore()) return jsonFindByEmail(normalized);
  await ensurePgAuthReady();

  const res = await pgPool.query('SELECT * FROM auth_users WHERE email = $1 LIMIT 1', [normalized]);
  if (!res.rows.length) return undefined;
  return rowToUser(res.rows[0]);
}

export async function authListUsers(): Promise<SovereignUser[]> {
  if (!usePgAuthStore()) return jsonListUsers();
  await ensurePgAuthReady();
  const res = await pgPool.query('SELECT * FROM auth_users ORDER BY created_at ASC');
  return res.rows.map((row) => rowToUser(row));
}

export async function authListTenants(): Promise<TenantRecord[]> {
  if (!usePgAuthStore()) return jsonListTenants();
  await ensurePgAuthReady();
  const res = await pgPool.query('SELECT * FROM auth_tenants ORDER BY created_at ASC');
  return res.rows.map((row) => rowToTenant(row));
}

export async function authGetTenantByCode(code: string): Promise<TenantRecord | undefined> {
  const normalized = code.trim().toLowerCase();
  if (!usePgAuthStore()) {
    return jsonListTenants().find((t) => t.code === normalized);
  }
  await ensurePgAuthReady();

  const res = await pgPool.query('SELECT * FROM auth_tenants WHERE LOWER(code) = $1 LIMIT 1', [normalized]);
  if (!res.rows.length) return undefined;
  return rowToTenant(res.rows[0]);
}

export async function authCreateUser(
  data: Omit<SovereignUser, 'id' | 'created_at' | 'is_founder' | 'role'>
): Promise<SovereignUser> {
  if (!usePgAuthStore()) return jsonCreateUser(data);
  await ensurePgAuthReady();

  const users = await authListUsers();
  const isFounder = !users.some(
    (u) => (u.organization_name || '').toLowerCase() === (data.organization_name || '').toLowerCase() && u.status === 'verified'
  );

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const role = isFounder ? 'founder' : 'member';

  const res = await pgPool.query(
    `INSERT INTO auth_users (
      id, full_name, email, tenant_id, tenant_code, phone_number, organization_name, organization_type,
      country, job_title, status, role, is_founder, onboarding_complete, is_first_admin, department_code,
      section_id, invited_by, username, hashed_password, password_salt, must_change_password, section_code,
      section_password, activation_token, activation_otp, otp_expires, token_expires, otp_attempts,
      resend_count, last_resend, created_at, verified_at, last_login
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,$14,$15,$16,
      $17,$18,$19,$20,$21,$22,$23,
      $24,$25,$26,$27,$28,$29,
      $30,$31,$32,$33,$34
    ) RETURNING *`,
    [
      id,
      data.full_name,
      data.email.toLowerCase().trim(),
      data.tenant_id ?? null,
      data.tenant_code ?? null,
      data.phone_number ?? '',
      data.organization_name ?? '',
      data.organization_type ?? null,
      data.country ?? null,
      data.job_title ?? null,
      data.status,
      role,
      isFounder,
      data.onboarding_complete ?? null,
      data.is_first_admin ?? null,
      data.department_code ?? null,
      data.section_id ?? null,
      data.invited_by ?? null,
      data.username ?? null,
      data.hashed_password ?? null,
      data.password_salt ?? null,
      data.must_change_password ?? null,
      data.section_code ?? null,
      data.section_password ?? null,
      data.activation_token,
      data.activation_otp,
      data.otp_expires,
      data.token_expires,
      data.otp_attempts,
      data.resend_count,
      data.last_resend,
      createdAt,
      data.verified_at ?? null,
      data.last_login ?? null,
    ]
  );

  return rowToUser(res.rows[0]);
}

export async function authInviteUser(input: {
  full_name: string;
  email: string;
  role: SovereignUser['role'];
  department_code: string;
  tenant_id?: string;
  tenant_code?: string;
  section_id?: string;
  invited_by: string;
  organization_name: string;
  job_title?: string;
}): Promise<{ user: SovereignUser; username: string; temp_password: string }> {
  if (!usePgAuthStore()) {
    const { inviteUser } = await import('@/lib/user-store');
    return inviteUser(input as any);
  }
  await ensurePgAuthReady();

  const users = await authListUsers();
  const existingUsernames = users.map((u) => u.username).filter(Boolean) as string[];
  const { generateUsername, generateTempPassword, hashPassword } = await import('@/lib/user-store');
  const username = generateUsername(input.full_name, input.department_code, existingUsernames);
  const temp_password = generateTempPassword();
  const { hash, salt } = hashPassword(temp_password);

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const res = await pgPool.query(
    `INSERT INTO auth_users (
      id, full_name, email, tenant_id, tenant_code, phone_number, organization_name,
      status, role, is_founder, department_code, section_id, invited_by,
      username, hashed_password, password_salt, must_change_password,
      activation_token, activation_otp, otp_expires, token_expires, otp_attempts,
      resend_count, last_resend, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,$11,$12,$13,
      $14,$15,$16,$17,
      $18,$19,$20,$21,$22,
      $23,$24,$25
    ) RETURNING *`,
    [
      id,
      input.full_name,
      input.email.toLowerCase().trim(),
      input.tenant_id ?? null,
      input.tenant_code ?? null,
      '',
      input.organization_name,
      'invited',
      input.role,
      false,
      input.department_code,
      input.section_id ?? null,
      input.invited_by,
      username,
      hash,
      salt,
      true,
      '',
      '',
      0,
      0,
      0,
      0,
      0,
      createdAt,
    ]
  );

  const user = rowToUser(res.rows[0]);

  return { user, username, temp_password };
}

export async function authEnsureTenantForOrganization(name: string, preferredCode?: string): Promise<TenantRecord> {
  if (!usePgAuthStore()) return jsonEnsureTenantForOrganization(name, preferredCode);
  await ensurePgAuthReady();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('organization_name_required');
  }

  const existing = await pgPool.query(
    'SELECT * FROM auth_tenants WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [trimmed]
  );
  if (existing.rows.length) {
    return rowToTenant(existing.rows[0]);
  }

  const baseCode = slugifyTenantCode(preferredCode || trimmed);
  let code = baseCode;
  let i = 2;
  for (;;) {
    const codeTaken = await pgPool.query('SELECT 1 FROM auth_tenants WHERE code = $1 LIMIT 1', [code]);
    if (!codeTaken.rows.length) break;
    code = `${baseCode}-${i}`;
    i += 1;
  }

  const row = await pgPool.query(
    `INSERT INTO auth_tenants (
      id, code, name, status, created_at, approved_at, approved_by, first_admin_email, enabled_departments
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    RETURNING *`,
    [
      crypto.randomUUID(),
      code,
      trimmed,
      'active',
      Date.now(),
      Date.now(),
      'self-service',
      '',
      '[]',
    ]
  );

  return rowToTenant(row.rows[0]);
}

export async function authCreateTenant(input: {
  id?: string;
  code: string;
  name: string;
  status?: TenantRecord['status'];
  approved_by: string;
  first_admin_email: string;
  enabled_departments: string[];
}): Promise<TenantRecord> {
  if (!usePgAuthStore()) {
    const { listTenants: jsonListTenants } = await import('@/lib/tenant-store');
    const { writeFileSync, existsSync, mkdirSync, renameSync } = await import('fs');
    const { join } = await import('path');
    const dataDir = join(process.cwd(), '.data');
    const tenantsFile = join(dataDir, 'tenants.json');
    const tenants = jsonListTenants();
    const tenant: TenantRecord = {
      id: input.id || crypto.randomUUID(),
      code: input.code,
      name: input.name,
      status: input.status || 'active',
      created_at: Date.now(),
      approved_at: Date.now(),
      approved_by: input.approved_by,
      first_admin_email: input.first_admin_email,
      enabled_departments: input.enabled_departments,
    };
    tenants.push(tenant);
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const tmp = `${tenantsFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(tenants, null, 2), 'utf8');
    renameSync(tmp, tenantsFile);
    return tenant;
  }
  await ensurePgAuthReady();

  const row = await pgPool.query(
    `INSERT INTO auth_tenants (
      id, code, name, status, created_at, approved_at, approved_by, first_admin_email, enabled_departments
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      approved_by = EXCLUDED.approved_by,
      first_admin_email = EXCLUDED.first_admin_email,
      enabled_departments = EXCLUDED.enabled_departments
    RETURNING *`,
    [
      input.id || crypto.randomUUID(),
      input.code,
      input.name,
      input.status || 'active',
      Date.now(),
      Date.now(),
      input.approved_by,
      input.first_admin_email,
      JSON.stringify(input.enabled_departments ?? []),
    ]
  );

  return rowToTenant(row.rows[0]);
}

export async function authFindByUsernameScoped(
  username: string,
  tenant?: { tenant_id?: string | null; tenant_code?: string | null }
): Promise<SovereignUser | undefined> {
  const normalized = username.toLowerCase().trim();
  if (!usePgAuthStore()) return jsonFindByUsernameScoped(normalized, tenant);
  await ensurePgAuthReady();

  const tenantId = tenant?.tenant_id?.trim() || null;
  const tenantCode = tenant?.tenant_code?.trim().toLowerCase() || null;

  let query = 'SELECT * FROM auth_users WHERE username = $1';
  const params: Array<string | null> = [normalized];

  if (tenantId || tenantCode) {
    query += ' AND (';
    const cond: string[] = [];
    if (tenantId) {
      params.push(tenantId);
      cond.push(`tenant_id = $${params.length}`);
    }
    if (tenantCode) {
      params.push(tenantCode);
      cond.push(`LOWER(tenant_code) = $${params.length}`);
    }
    query += cond.join(' OR ') + ')';
  }

  query += ' LIMIT 1';
  const res = await pgPool.query(query, params);
  if (!res.rows.length) return undefined;
  return rowToUser(res.rows[0]);
}

export async function authUpdateUser(email: string, updates: Partial<SovereignUser>): Promise<SovereignUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!usePgAuthStore()) return jsonUpdateUser(normalized, updates);
  await ensurePgAuthReady();

  const fields: Array<[keyof SovereignUser, string]> = [
    ['full_name', 'full_name'],
    ['tenant_id', 'tenant_id'],
    ['tenant_code', 'tenant_code'],
    ['phone_number', 'phone_number'],
    ['organization_name', 'organization_name'],
    ['organization_type', 'organization_type'],
    ['country', 'country'],
    ['job_title', 'job_title'],
    ['status', 'status'],
    ['role', 'role'],
    ['is_founder', 'is_founder'],
    ['onboarding_complete', 'onboarding_complete'],
    ['is_first_admin', 'is_first_admin'],
    ['department_code', 'department_code'],
    ['section_id', 'section_id'],
    ['invited_by', 'invited_by'],
    ['username', 'username'],
    ['hashed_password', 'hashed_password'],
    ['password_salt', 'password_salt'],
    ['must_change_password', 'must_change_password'],
    ['section_code', 'section_code'],
    ['section_password', 'section_password'],
    ['activation_token', 'activation_token'],
    ['activation_otp', 'activation_otp'],
    ['otp_expires', 'otp_expires'],
    ['token_expires', 'token_expires'],
    ['otp_attempts', 'otp_attempts'],
    ['resend_count', 'resend_count'],
    ['last_resend', 'last_resend'],
    ['verified_at', 'verified_at'],
    ['last_login', 'last_login'],
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of fields) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      values.push((updates as Record<string, unknown>)[key as string] ?? null);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (!setClauses.length) {
    const current = await authFindByEmail(normalized);
    return current ?? null;
  }

  values.push(normalized);
  const query = `UPDATE auth_users SET ${setClauses.join(', ')} WHERE email = $${values.length} RETURNING *`;
  const res = await pgPool.query(query, values);
  if (!res.rows.length) return null;
  return rowToUser(res.rows[0]);
}

export async function authHasAnyActiveScope(tenantId: string, scopes: string[]): Promise<boolean> {
  if (!usePgAuthStore()) return jsonHasAnyActiveScope(tenantId, scopes);
  await ensurePgAuthReady();
  const normalized = scopes.map((s) => s.trim()).filter(Boolean);
  if (!normalized.length) return false;

  const res = await pgPool.query(
    `SELECT 1
       FROM auth_tenant_department_links
      WHERE tenant_id = $1
        AND trust_state = 'active'
        AND app_scope = ANY($2::text[])
      LIMIT 1`,
    [tenantId, normalized]
  );
  return res.rows.length > 0;
}

export async function authHasAnyPendingScope(tenantId: string, scopes: string[]): Promise<boolean> {
  if (!usePgAuthStore()) return jsonHasAnyPendingScope(tenantId, scopes);
  await ensurePgAuthReady();
  const normalized = scopes.map((s) => s.trim()).filter(Boolean);
  if (!normalized.length) return false;

  const res = await pgPool.query(
    `SELECT 1
       FROM auth_tenant_department_links
      WHERE tenant_id = $1
        AND trust_state = 'pending'
        AND app_scope = ANY($2::text[])
      LIMIT 1`,
    [tenantId, normalized]
  );
  return res.rows.length > 0;
}

export async function authEnsureTenantDepartmentLink(input: {
  tenantId: string;
  appScope: string;
  state: 'active' | 'pending' | 'blocked';
  actor: string;
  reason?: string;
}): Promise<void> {
  const tenantId = String(input.tenantId || '').trim();
  const scope = normalizeAppScope(input.appScope);
  if (!tenantId || !scope) return;

  if (!usePgAuthStore()) {
    jsonEnsureTenantDepartmentLink(tenantId, scope, input.state, input.actor, input.reason);
    return;
  }

  await ensurePgAuthReady();

  const now = Date.now();
  const updateRes = await pgPool.query(
    `UPDATE auth_tenant_department_links
        SET trust_state = $3,
            joined_at = CASE WHEN $3 = 'active' THEN COALESCE(joined_at, $4) ELSE joined_at END,
            approved_by = CASE WHEN $3 = 'active' THEN $5 ELSE approved_by END,
            approved_at = CASE WHEN $3 = 'active' THEN $4 ELSE approved_at END,
            blocked_reason = CASE WHEN $3 = 'blocked' THEN $6 ELSE NULL END,
            updated_at = $4
      WHERE tenant_id = $1
        AND app_scope = $2`,
    [tenantId, scope, input.state, now, input.actor, input.reason || null]
  );

  if ((updateRes.rowCount ?? 0) > 0) {
    return;
  }

  await pgPool.query(
    `INSERT INTO auth_tenant_department_links (
      id,
      tenant_id,
      app_scope,
      trust_state,
      joined_at,
      approved_by,
      approved_at,
      blocked_reason,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )`,
    [
      crypto.randomUUID(),
      tenantId,
      scope,
      input.state,
      input.state === 'active' ? now : null,
      input.state === 'active' ? input.actor : null,
      input.state === 'active' ? now : null,
      input.state === 'blocked' ? (input.reason || null) : null,
      now,
      now,
    ]
  );
}
