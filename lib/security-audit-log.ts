import fs from 'fs';
import path from 'path';
import { ImmutableAuditService } from '@/lib/governance/core';

export interface SecurityAuditEvent {
  event: string;
  tenant_id?: string;
  tenant_code?: string;
  actor_email?: string;
  actor_role?: string;
  employee_no?: string;
  request_id?: string;
  action?: string;
  status?: string;
  ip?: string;
  user_agent?: string;
  meta?: Record<string, unknown>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'security_audit.log');

export function appendSecurityAudit(event: SecurityAuditEvent): void {
  if (event.tenant_id) {
    void ImmutableAuditService.append({
      tenantId: event.tenant_id,
      eventType: event.event,
      moduleName: 'security.audit',
      actorEmail: event.actor_email || null,
      actorRole: event.actor_role || null,
      entityType: event.employee_no ? 'employee' : null,
      entityId: event.employee_no || null,
      requestId: event.request_id || null,
      status: event.status || null,
      payload: {
        tenant_code: event.tenant_code || null,
        action: event.action || null,
        ip: event.ip || null,
        user_agent: event.user_agent || null,
        meta: event.meta || {},
      },
    }).catch(() => {
      // Non-fatal logging sink.
    });
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      ts: new Date().toISOString(),
      ...event,
    };
    fs.appendFileSync(FILE_PATH, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {
    // Non-fatal logging sink.
  }
}
