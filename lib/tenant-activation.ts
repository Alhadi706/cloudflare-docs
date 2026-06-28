import crypto from 'crypto';
import { TenantRecord } from '@/lib/tenant-store';

const CODE_SALT = process.env.TENANT_ACTIVATION_SALT || 'dsf-activation-v1';

function compact(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateTenantActivationCode(tenant: TenantRecord): string {
  const payload = `${tenant.id}|${tenant.code}|${CODE_SALT}`;
  const digest = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
  return `${compact(tenant.code)}-${digest.slice(0, 6)}`;
}

export function normalizeActivationCode(value: string): string {
  return compact(value).replace(/[^A-Z0-9-]/g, '');
}
