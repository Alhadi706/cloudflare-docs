import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { savePushSub, removePushSub } from '@/lib/push-store';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';

export async function GET() {
  return NextResponse.json({ vapid_public_key: VAPID_PUBLIC });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const sub  = body.subscription ?? body.sub ?? {};

  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ detail: 'subscription مطلوبة' }, { status: 400 });
  }

  const employeeNo = (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();

  savePushSub(auth.tenantId, employeeNo || auth.email, auth.role, sub);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || '').trim();
  if (endpoint) removePushSub(auth.tenantId, endpoint);
  return NextResponse.json({ ok: true });
}
