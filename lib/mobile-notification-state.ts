import fs from 'fs';
import path from 'path';

type EmployeeNotificationState = {
  read_ids: string[];
  updated_at: number;
};

type TenantState = Record<string, EmployeeNotificationState>;
type NotificationsState = Record<string, TenantState>;

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'mobile_notification_state.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readState(): NotificationsState {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as NotificationsState;
  } catch {
    return {};
  }
}

function writeState(state: NotificationsState) {
  ensureDir();
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

function trimReadIds(ids: string[]): string[] {
  // Keep recent IDs bounded to avoid unbounded growth.
  const normalized = Array.from(new Set(ids.map((x) => String(x || '').trim()).filter(Boolean)));
  return normalized.slice(-1000);
}

export function resolveEmployeeNotificationKey(employeeNo: string, email: string): string {
  const no = String(employeeNo || '').trim();
  if (no) return `employee:${no}`;
  const em = String(email || '').trim().toLowerCase();
  if (em) return `email:${em}`;
  return 'employee:unknown';
}

export function getReadNotificationIds(tenantId: string, employeeKey: string): Set<string> {
  const state = readState();
  const ids = state?.[tenantId]?.[employeeKey]?.read_ids || [];
  return new Set(ids);
}

export function markNotificationsRead(tenantId: string, employeeKey: string, ids: string[]): number {
  const state = readState();
  const tenant = state[tenantId] || {};
  const current = tenant[employeeKey] || { read_ids: [], updated_at: Date.now() };
  const merged = trimReadIds([...(current.read_ids || []), ...ids]);

  tenant[employeeKey] = {
    read_ids: merged,
    updated_at: Date.now(),
  };
  state[tenantId] = tenant;
  writeState(state);
  return merged.length;
}
