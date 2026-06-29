import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');
function notifsFile(tenantId: string) { return path.join(DATA_DIR, `notifications_${tenantId}.json`); }
function readNotifs(tenantId: string): any[] {
  try { return JSON.parse(fs.readFileSync(notifsFile(tenantId), 'utf8')); } catch { return []; }
}
function writeNotifs(tenantId: string, data: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(notifsFile(tenantId), JSON.stringify(data.slice(-500), null, 2));
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const employeeNo = req.nextUrl.searchParams.get('employee_no') ||
    (req.headers.get('x-verified-email') ?? '').replace('@mobile.local','').split('_').slice(1).join('_').toUpperCase();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100);
  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true';

  let notifs = readNotifs(auth.tenantId);
  if (employeeNo) notifs = notifs.filter(n => !n.employee_no || n.employee_no === employeeNo || n.broadcast);
  if (unreadOnly) notifs = notifs.filter(n => !n.read);
  const slice = notifs.slice(-limit).reverse();
  return NextResponse.json({ ok: true, notifications: slice, unread_count: notifs.filter(n => !n.read).length });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.create');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const notif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    created_at: new Date().toISOString(), read: false,
    employee_no: body.employee_no || null, broadcast: body.broadcast ?? false,
    title: body.title || '', body: body.body || '', url: body.url || '',
    urgency: body.urgency || 'normal', type: body.type || 'info',
  };
  const notifs = readNotifs(auth.tenantId);
  notifs.push(notif);
  writeNotifs(auth.tenantId, notifs);
  return NextResponse.json({ ok: true, id: notif.id });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids || (body.id ? [body.id] : []);
  const all = body.all === true;

  const notifs = readNotifs(auth.tenantId);
  let updated = 0;
  notifs.forEach(n => {
    if (all || ids.includes(n.id)) { n.read = true; updated++; }
  });
  writeNotifs(auth.tenantId, notifs);
  return NextResponse.json({ ok: true, updated });
}
