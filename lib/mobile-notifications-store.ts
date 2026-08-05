import fs from 'fs';
import path from 'path';

export interface MobileNotificationRecord {
  id: string;
  created_at: string;
  read: boolean;
  employee_no: string | null;
  broadcast: boolean;
  title: string;
  body: string;
  url: string;
  urgency: 'normal' | 'high' | 'urgent';
  type: 'info' | 'workflow' | 'alert';
}

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');

function notificationsFile(tenantId: string): string {
  return path.join(DATA_DIR, `notifications_${tenantId}.json`);
}

function readNotifications(tenantId: string): MobileNotificationRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(notificationsFile(tenantId), 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as MobileNotificationRecord[]) : [];
  } catch {
    return [];
  }
}

function writeNotifications(tenantId: string, rows: MobileNotificationRecord[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(notificationsFile(tenantId), JSON.stringify(rows.slice(-1000), null, 2), 'utf8');
}

export function appendMobileNotification(
  tenantId: string,
  payload: {
    employee_no?: string | null;
    broadcast?: boolean;
    title: string;
    body: string;
    url?: string;
    urgency?: 'normal' | 'high' | 'urgent';
    type?: 'info' | 'workflow' | 'alert';
  },
): MobileNotificationRecord {
  const rows = readNotifications(tenantId);
  const next: MobileNotificationRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    read: false,
    employee_no: payload.employee_no || null,
    broadcast: payload.broadcast === true,
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard/admin-gateway/hr/personnel/requests',
    urgency: payload.urgency || 'normal',
    type: payload.type || 'workflow',
  };
  rows.push(next);
  writeNotifications(tenantId, rows);
  return next;
}
