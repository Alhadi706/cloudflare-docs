import fs from 'fs';
import path from 'path';

interface MobileLoginAttempt {
  key: string;
  failed_count: number;
  first_failed_at: number;
  last_failed_at: number;
  locked_until?: number;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'mobile_login_attempts.json');

const MAX_FAILED = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): MobileLoginAttempt[] {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) as MobileLoginAttempt[];
  } catch {
    return [];
  }
}

function writeAll(rows: MobileLoginAttempt[]): void {
  ensureDir();
  const tmp = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE_PATH);
}

export function buildMobileAttemptKey(tenantId: string, employeeNo: string): string {
  return `${tenantId}:${employeeNo}`;
}

export function getMobileLockState(key: string): { locked: boolean; retryAfterSec: number } {
  const rows = readAll();
  const row = rows.find((r) => r.key === key);
  if (!row?.locked_until) return { locked: false, retryAfterSec: 0 };

  const left = row.locked_until - Date.now();
  if (left <= 0) return { locked: false, retryAfterSec: 0 };
  return { locked: true, retryAfterSec: Math.ceil(left / 1000) };
}

export function registerFailedMobileLogin(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rows = readAll();
  const idx = rows.findIndex((r) => r.key === key);

  if (idx < 0) {
    rows.push({
      key,
      failed_count: 1,
      first_failed_at: now,
      last_failed_at: now,
    });
    writeAll(rows);
    return { locked: false, retryAfterSec: 0 };
  }

  const row = rows[idx];
  const withinWindow = now - row.first_failed_at <= WINDOW_MS;
  const failedCount = withinWindow ? row.failed_count + 1 : 1;
  const firstFailedAt = withinWindow ? row.first_failed_at : now;
  const lockedUntil = failedCount >= MAX_FAILED ? now + LOCK_MS : undefined;

  rows[idx] = {
    key,
    failed_count: failedCount,
    first_failed_at: firstFailedAt,
    last_failed_at: now,
    locked_until: lockedUntil,
  };
  writeAll(rows);

  if (!lockedUntil) return { locked: false, retryAfterSec: 0 };
  return { locked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
}

export function clearMobileLoginFailures(key: string): void {
  const rows = readAll();
  const filtered = rows.filter((r) => r.key !== key);
  if (filtered.length === rows.length) return;
  writeAll(filtered);
}
