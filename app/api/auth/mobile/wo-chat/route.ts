import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getChatMessages, postChatMessage, markMessagesRead, countUnreadMessages,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const woId  = req.nextUrl.searchParams.get('work_order_id') || '';
  if (!woId) return NextResponse.json({ detail: 'work_order_id مطلوب' }, { status: 400 });

  const empNo   = resolveEmpNo(req);
  const woNum   = parseInt(woId);
  const msgs    = getChatMessages(auth.tenantId, woNum);
  const unread  = countUnreadMessages(auth.tenantId, woNum, empNo);
  return NextResponse.json({ ok: true, messages: msgs, unread_count: unread, work_order_id: woNum });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);
  const woId  = String(body.work_order_id || '').trim();
  if (!woId) return NextResponse.json({ detail: 'work_order_id مطلوب' }, { status: 400 });

  const woNum = parseInt(woId);
  const msg = postChatMessage(
    auth.tenantId,
    woNum,
    { employee_no: empNo, name: body.sender_name || empNo, role: auth.role as any },
    String(body.message || '').trim(),
  );
  return NextResponse.json({ ok: true, message: msg });
}

export async function PATCH(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);
  const woId  = String(body.work_order_id || '').trim();
  if (!woId) return NextResponse.json({ detail: 'work_order_id مطلوب' }, { status: 400 });

  markMessagesRead(auth.tenantId, parseInt(woId), empNo);
  return NextResponse.json({ ok: true });
}
