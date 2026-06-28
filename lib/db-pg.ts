/**
 * lib/db-pg.ts — PostgreSQL connection pool (server-side only)
 * Used as the primary auth source, replacing .data/users.json for credential lookups.
 */
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (connectionString) {
    return new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return new Pool({
    host:     process.env.PG_HOST     ?? 'localhost',
    port:     Number(process.env.PG_PORT ?? 5433),
    database: process.env.PG_DB       ?? 'digital_employees',
    user:     process.env.PG_USER     ?? 'alhadi',
    password: String(process.env.PG_PASSWORD || process.env.DB_PASSWORD || 'alhadi2026'),
    max:      10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

// Reuse pool across hot-reloads in development
export const pgPool: Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (global._pgPool ??= createPool());
