// app/api/gis/routing-sessions/[id]/route.ts
// Single session: GET (full), PATCH (update), DELETE

import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs/promises';
import path from 'path';
import type { DesignSession } from '../route';

const DATA_FILE = path.join(process.cwd(), '.data', 'gis', 'design-sessions.json');

async function readSessions(): Promise<DesignSession[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as DesignSession[];
  } catch { return []; }
}
async function writeSessions(sessions: DesignSession[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

// GET /api/gis/routing-sessions/:id — full session including result
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessions = await readSessions();
  const session  = sessions.find(s => s.id === params.id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ session });
}

// PATCH /api/gis/routing-sessions/:id — update name / notes / status / result / add snapshot
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Partial<DesignSession> & { add_snapshot?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const sessions = await readSessions();
  const idx      = sessions.findIndex(s => s.id === params.id);
  if (idx < 0)   return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session  = sessions[idx];

  // Validate status transitions — cannot go back to draft from approved
  if (body.status === 'draft' && session.status === 'approved') {
    return NextResponse.json({ error: 'لا يمكن إعادة جلسة معتمدة إلى مسودة' }, { status: 400 });
  }

  // Optional: save a snapshot of the current result before updating
  if (body.add_snapshot && session.result) {
    session.snapshots = session.snapshots ?? [];
    session.snapshots.push({ saved_at: new Date().toISOString(), result: session.result });
    // Keep max 10 snapshots
    if (session.snapshots.length > 10) session.snapshots.shift();
  }

  // Apply allowed updates
  const allowed: (keyof DesignSession)[] = [
    'name', 'project_label', 'status', 'result',
    'designer_notes', 'tags', 'priority', 'obstacles',
  ];
  for (const key of allowed) {
    if (key in body) (session as any)[key] = (body as any)[key];
  }
  session.modified_at = new Date().toISOString();

  sessions[idx] = session;
  await writeSessions(sessions);

  const { snapshots: _s, ...sessionOut } = session;
  return NextResponse.json({ session: sessionOut });
}

// DELETE /api/gis/routing-sessions/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessions  = await readSessions();
  const idx       = sessions.findIndex(s => s.id === params.id);
  if (idx < 0)    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (sessions[idx].status === 'approved') {
    return NextResponse.json({ error: 'لا يمكن حذف جلسة معتمدة — أرشفها بدلاً من ذلك' }, { status: 400 });
  }

  sessions.splice(idx, 1);
  await writeSessions(sessions);
  return NextResponse.json({ ok: true });
}
