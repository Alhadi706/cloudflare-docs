/**
 * Push Subscription Store
 * Persists Web Push subscriptions per tenant + employee to JSON files.
 * Each subscription = { endpoint, keys: { p256dh, auth } }
 */
import path from 'path';
import fs   from 'fs';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');

function subFile(tenantId: string) {
  return path.join(DATA_DIR, `push_subs_${tenantId}.json`);
}

function readSubs(tenantId: string): PushSubRecord[] {
  try {
    const raw = fs.readFileSync(subFile(tenantId), 'utf8');
    return JSON.parse(raw) as PushSubRecord[];
  } catch {
    return [];
  }
}

function writeSubs(tenantId: string, subs: PushSubRecord[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(subFile(tenantId), JSON.stringify(subs.slice(-2000), null, 0));
}

export interface PushSubRecord {
  employee_no: string;
  role: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  saved_at: string;
}

/** Save or update a push subscription for an employee */
export function savePushSub(
  tenantId: string,
  employeeNo: string,
  role: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): void {
  const all = readSubs(tenantId);
  const idx = all.findIndex(s => s.employee_no === employeeNo && s.endpoint === sub.endpoint);
  const record: PushSubRecord = {
    employee_no: employeeNo,
    role,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth:   sub.keys.auth,
    saved_at: new Date().toISOString(),
  };
  if (idx >= 0) { all[idx] = record; } else { all.push(record); }
  writeSubs(tenantId, all);
}

/** Remove a subscription (unsubscribe / expired endpoint) */
export function removePushSub(tenantId: string, endpoint: string): void {
  const all = readSubs(tenantId).filter(s => s.endpoint !== endpoint);
  writeSubs(tenantId, all);
}

/** Get all subscriptions for a specific employee */
export function getPushSubsByEmployee(tenantId: string, employeeNo: string): PushSubRecord[] {
  return readSubs(tenantId).filter(s => s.employee_no === employeeNo);
}

/** Get all subscriptions for one or more roles (e.g. managers) */
export function getPushSubsByRoles(tenantId: string, roles: string[]): PushSubRecord[] {
  return readSubs(tenantId).filter(s => roles.includes(s.role));
}

/** Get ALL subscriptions for a tenant */
export function getAllPushSubs(tenantId: string): PushSubRecord[] {
  return readSubs(tenantId);
}
