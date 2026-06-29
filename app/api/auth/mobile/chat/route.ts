import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');
function chatFile(tenantId: string, room: string) {
  const safe = room.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(DATA_DIR, `chat_room_${tenantId}_${safe}.json`);
}
function readMessages(file: string): any[] {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeMessages(file: string, msgs: any[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(msgs.slice(-200), null, 2));
}

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const room  = req.nextUrl.searchParams.get('room') || 'general';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100);
  const file  = chatFile(auth.tenantId, room);
  const msgs  = readMessages(file).slice(-limit);
  return NextResponse.json({ ok: true, messages: msgs, room });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json().catch(() => ({}));
  const empNo  = resolveEmpNo(req);
  const room   = String(body.room || 'general').trim();

  const msg = {
    id:           `msg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    created_at:   new Date().toISOString(),
    room,
    sender_no:    empNo,
    sender_name:  body.sender_name || empNo,
    role:         auth.role,
    message:      String(body.message || '').trim(),
    attachments:  body.attachments || [],
  };

  const file = chatFile(auth.tenantId, room);
  const msgs = readMessages(file);
  msgs.push(msg);
  writeMessages(file, msgs);
  return NextResponse.json({ ok: true, message: msg });
}
