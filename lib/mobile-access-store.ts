import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type MobileAccessStatus = 'pending' | 'approved' | 'rejected';

export interface MobileAccessRequest {
  id: string;
  status_token: string;
  tenant_id: string;
  tenant_code: string;
  organization_name: string;
  employee_no: string;
  full_name: string;
  department_code?: string;
  phone_number?: string;
  device_id?: string;
  status: MobileAccessStatus;
  secret_hash: string;
  secret_salt: string;
  requested_at: number;
  expires_at: number;
  requested_ip?: string;
  requested_user_agent?: string;
  reviewed_at?: number;
  reviewed_by?: string;
  reviewed_ip?: string;
  reviewed_user_agent?: string;
  reject_reason?: string;
  approved_username?: string;
  mobile_role?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'mobile_access_requests.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): MobileAccessRequest[] {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) as MobileAccessRequest[];
  } catch {
    return [];
  }
}

function writeAll(records: MobileAccessRequest[]): void {
  ensureDir();
  const tmp = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, FILE_PATH);
}

export function listMobileAccessRequests(input?: {
  tenantId?: string;
  status?: MobileAccessStatus;
  employeeNo?: string;
}): MobileAccessRequest[] {
  const all = readAll();
  return all.filter((r) => {
    if (input?.tenantId && r.tenant_id !== input.tenantId) return false;
    if (input?.status && r.status !== input.status) return false;
    if (input?.employeeNo && r.employee_no !== input.employeeNo) return false;
    return true;
  });
}

export function getMobileAccessRequestById(id: string): MobileAccessRequest | undefined {
  return readAll().find((r) => r.id === id);
}

export function getMobileAccessRequestByToken(token: string): MobileAccessRequest | undefined {
  return readAll().find((r) => r.status_token === token);
}

export function getLatestMobileAccessRequest(tenantId: string, employeeNo: string): MobileAccessRequest | undefined {
  const matches = readAll()
    .filter((r) => r.tenant_id === tenantId && r.employee_no === employeeNo)
    .sort((a, b) => b.requested_at - a.requested_at);
  return matches[0];
}

export function createMobileAccessRequest(input: {
  tenant_id: string;
  tenant_code: string;
  organization_name: string;
  employee_no: string;
  full_name: string;
  department_code?: string;
  phone_number?: string;
  device_id?: string;
  secret_hash: string;
  secret_salt: string;
  requested_ip?: string;
  requested_user_agent?: string;
}): MobileAccessRequest {
  const records = readAll();

  const existingPending = records.find(
    (r) => r.tenant_id === input.tenant_id && r.employee_no === input.employee_no && r.status === 'pending'
  );
  if (existingPending) return existingPending;

  const request: MobileAccessRequest = {
    id: crypto.randomUUID(),
    status_token: crypto.randomUUID(),
    tenant_id: input.tenant_id,
    tenant_code: input.tenant_code,
    organization_name: input.organization_name,
    employee_no: input.employee_no,
    full_name: input.full_name,
    department_code: input.department_code,
    phone_number: input.phone_number,
    device_id: input.device_id,
    status: 'pending',
    secret_hash: input.secret_hash,
    secret_salt: input.secret_salt,
    requested_at: Date.now(),
    expires_at: Date.now() + 72 * 60 * 60 * 1000,
    requested_ip: input.requested_ip,
    requested_user_agent: input.requested_user_agent,
  };

  records.push(request);
  writeAll(records);
  return request;
}

export function reviewMobileAccessRequest(input: {
  id: string;
  action: 'approve' | 'reject';
  reviewedBy: string;
  reason?: string;
  approvedUsername?: string;
  reviewedIp?: string;
  reviewedUserAgent?: string;
}): MobileAccessRequest {
  const records = readAll();
  const idx = records.findIndex((r) => r.id === input.id);
  if (idx < 0) throw new Error('request_not_found');
  if (records[idx].status !== 'pending') throw new Error('request_not_pending');

  records[idx] = {
    ...records[idx],
    status: input.action === 'approve' ? 'approved' : 'rejected',
    reviewed_at: Date.now(),
    reviewed_by: input.reviewedBy,
    reviewed_ip: input.reviewedIp,
    reviewed_user_agent: input.reviewedUserAgent,
    reject_reason: input.action === 'reject' ? input.reason || 'rejected' : undefined,
    approved_username: input.action === 'approve' ? input.approvedUsername : undefined,
  };

  writeAll(records);
  return records[idx];
}

export function isMobileAccessRequestExpired(record: Pick<MobileAccessRequest, 'expires_at'>): boolean {
  return Date.now() > Number(record.expires_at || 0);
}
