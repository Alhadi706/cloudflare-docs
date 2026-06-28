// app/api/gis/routing-sessions/route.ts
// Design Sessions API — list all, create new, duplicate
// Storage: .data/gis/design-sessions.json (isolated from spatial assets)

import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_FILE = path.join(process.cwd(), '.data', 'gis', 'design-sessions.json');

export interface DesignSession {
  id:              string;
  name:            string;
  project_label?:  string;
  infra_type:      string;
  status:          'draft' | 'in_review' | 'approved' | 'archived';
  created_by:      string;
  created_at:      string;
  modified_at:     string;
  start:           [number, number];
  end:             [number, number];
  priority:        string;
  obstacles:       Record<string, boolean>;
  result:          Record<string, unknown>;   // full API response — path + engineering
  designer_notes?: string;
  tags?:           string[];
  snapshots?:      { saved_at: string; result: Record<string, unknown> }[];
}

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

// GET /api/gis/routing-sessions?status=draft&infra_type=road
export async function GET(req: NextRequest) {
  const sessions = await readSessions();
  const { searchParams } = new URL(req.url);
  const statusFilter    = searchParams.get('status');
  const infraFilter     = searchParams.get('infra_type');
  const createdByFilter = searchParams.get('created_by');

  let filtered = sessions;
  if (statusFilter)    filtered = filtered.filter(s => s.status    === statusFilter);
  if (infraFilter)     filtered = filtered.filter(s => s.infra_type === infraFilter);
  if (createdByFilter) filtered = filtered.filter(s => s.created_by === createdByFilter);

  // Return list without bulky result/snapshots for performance
  const list = filtered.map(({ result: _r, snapshots: _s, ...rest }) => ({
    ...rest,
    has_result: true,
    path_summary: {
      total_distance_km: (_r as any)?.stats?.total_distance_km,
      difficulty:        (_r as any)?.stats?.difficulty,
      elev_range_m:      (_r as any)?.engineering?.elev_range_m,
    },
  })).sort((a, b) => b.modified_at.localeCompare(a.modified_at));

  return NextResponse.json({ sessions: list, total: list.length });
}

// POST /api/gis/routing-sessions  — create new session
export async function POST(req: NextRequest) {
  let body: Partial<DesignSession>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.start || !body.end || !body.result) {
    return NextResponse.json({ error: 'start, end, result are required' }, { status: 400 });
  }

  const sessions = await readSessions();
  const now = new Date().toISOString();
  const session: DesignSession = {
    id:            `ds_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    name:          body.name          ?? `جلسة ${new Date().toLocaleDateString('ar-LY')}`,
    project_label: body.project_label ?? '',
    infra_type:    body.infra_type    ?? 'general',
    status:        'draft',
    created_by:    body.created_by    ?? 'designer',
    created_at:    now,
    modified_at:   now,
    start:         body.start,
    end:           body.end,
    priority:      body.priority      ?? 'balanced',
    obstacles:     body.obstacles     ?? {},
    result:        body.result,
    designer_notes: body.designer_notes ?? '',
    tags:          body.tags           ?? [],
    snapshots:     [],
  };

  sessions.push(session);
  await writeSessions(sessions);

  // Return without snapshots
  const { snapshots: _s, ...sessionOut } = session;
  return NextResponse.json({ session: sessionOut }, { status: 201 });
}
