/**
 * Pending Users Store
 * يُخزّن طلبات انضمام مديري الإدارات التي تنتظر موافقة مالك المؤسسة.
 * الملف: .data/pending-users.json
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR     = path.join(process.cwd(), '.data');
const PENDING_FILE = path.join(DATA_DIR, 'pending-users.json');

export type PendingUserStatus = 'pending' | 'approved' | 'rejected';

export interface PendingUserRecord {
  id:           string;   // UUID
  poll_token:   string;   // secret token — used by app to poll status
  tenant_id:    string;
  tenant_code:  string;   // e.g. XK-48219
  full_name:    string;
  email:        string;
  dept:         string;   // corrosion | maintenance | ...
  status:       PendingUserStatus;
  requested_at: number;   // timestamp ms
  reviewed_at?: number;
  reviewed_by?: string;
  reject_reason?: string;
  // credentials set after approval
  temp_password?: string;
}

// ── File helpers ──────────────────────────────────────────────────────────────

function readPending(): PendingUserRecord[] {
  try {
    if (!fs.existsSync(PENDING_FILE)) return [];
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')) as PendingUserRecord[];
  } catch {
    return [];
  }
}

function writePending(records: PendingUserRecord[]): void {
  const tmp = `${PENDING_FILE}.tmp`;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, PENDING_FILE);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listPendingUsers(tenantId?: string): PendingUserRecord[] {
  const all = readPending();
  return tenantId ? all.filter(r => r.tenant_id === tenantId) : all;
}

export function getPendingByPollToken(token: string): PendingUserRecord | undefined {
  return readPending().find(r => r.poll_token === token);
}

export function getPendingById(id: string): PendingUserRecord | undefined {
  return readPending().find(r => r.id === id);
}

/** Create a new pending-user record; returns {id, poll_token} */
export function createPendingUser(input: {
  tenant_id:   string;
  tenant_code: string;
  full_name:   string;
  email:       string;
  dept:        string;
}): PendingUserRecord {
  const records = readPending();

  // Reject duplicate pending for same email + tenant
  const existing = records.find(
    r => r.email === input.email.toLowerCase().trim() &&
         r.tenant_id === input.tenant_id &&
         r.status === 'pending'
  );
  if (existing) return existing; // return the existing one quietly

  const record: PendingUserRecord = {
    id:           crypto.randomUUID(),
    poll_token:   crypto.randomUUID(),
    tenant_id:    input.tenant_id,
    tenant_code:  input.tenant_code,
    full_name:    input.full_name.trim(),
    email:        input.email.toLowerCase().trim(),
    dept:         input.dept,
    status:       'pending',
    requested_at: Date.now(),
  };

  records.push(record);
  writePending(records);
  return record;
}

/** Approve a pending user — stores temp_password */
export function approvePendingUser(id: string, reviewedBy: string, tempPassword: string): PendingUserRecord {
  const records = readPending();
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('record_not_found');
  if (records[idx].status !== 'pending') throw new Error('not_pending');

  records[idx] = {
    ...records[idx],
    status:       'approved',
    reviewed_at:  Date.now(),
    reviewed_by:  reviewedBy,
    temp_password: tempPassword,
  };
  writePending(records);
  return records[idx];
}

/** Reject a pending user */
export function rejectPendingUser(id: string, reviewedBy: string, reason?: string): PendingUserRecord {
  const records = readPending();
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('record_not_found');
  if (records[idx].status !== 'pending') throw new Error('not_pending');

  records[idx] = {
    ...records[idx],
    status:        'rejected',
    reviewed_at:   Date.now(),
    reviewed_by:   reviewedBy,
    reject_reason: reason,
  };
  writePending(records);
  return records[idx];
}
