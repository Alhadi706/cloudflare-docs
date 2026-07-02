import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getMonitoringTeam, saveMonitoringTeam,
  saveMonitoringReading, getPendingMonitoringReadings,
  STATION_PRESETS,
} from '@/lib/mobile-field-store';
import fs from 'fs';
import path from 'path';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
const CORROSION_TEAMS_DIR = path.join(process.cwd(), '.data', 'corrosion-field-teams');

function resolveEmpNo(req: NextRequest): string {
  // Prefer injected verified header
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

/** Load corrosion field teams from local JSON and filter to those matching empNo */
function getMyCorrosionTeams(tenantId: string, empNo: string) {
  try {
    const file = path.join(CORROSION_TEAMS_DIR, `${tenantId}.json`);
    if (!fs.existsSync(file)) return [];
    const { teams } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(teams)) return [];
    const preset = STATION_PRESETS['corrosion_field'];
    return teams
      .filter((t: any) =>
        Array.isArray(t.members) &&
        t.members.some((m: any) =>
          (m.employeeNumber || '').toUpperCase() === empNo ||
          String(m.empId) === empNo
        )
      )
      .map((t: any) => ({
        id:           t.id,
        team_name:    t.name,
        station_type: 'corrosion_field',
        location_label: t.specialization || 'مكافحة التآكل',
        station_id:   t.id,
        shift:        'يومي',
        member_role:  t.members.find((m: any) => (m.employeeNumber || '').toUpperCase() === empNo)?.role || 'فني',
        member_employee_nos: t.members.map((m: any) => m.employeeNumber || '').filter(Boolean),
        supervisor_employee_nos: t.members
          .filter((m: any) => m.role === 'قائد الفريق')
          .map((m: any) => m.employeeNumber || ''),
        field_groups: preset?.field_groups ?? [],
        is_active:    true,
        source:       'corrosion_field',
        updated_at:   t.updatedAt,
      }));
  } catch { return []; }
}

const SUPERVISOR_ROLES = ['supervisor','manager','admin','dept_manager','section_manager','founder'];

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const mode  = req.nextUrl.searchParams.get('mode') || 'all_teams_summary';
  const empNo = resolveEmpNo(req);
  const isSup = SUPERVISOR_ROLES.includes(auth.role);

  // pending readings — from backend DB (approved workflow)
  if (mode === 'pending' && isSup) {
    try {
      const res = await fetch(`${B}/api/v1/ctrl/readings/pending?level=supervisor`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const d = await res.json();
        return NextResponse.json({ ok: true, readings: d.readings || [] });
      }
    } catch { /* fall through to in-memory */ }
    const pending = getPendingMonitoringReadings(auth.tenantId);
    return NextResponse.json({ ok: true, readings: pending });
  }

  // Fetch teams from DB backend (ctrl.monitoring_teams), fall back to in-memory
  try {
    const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
      cache: 'no-store',
      headers: { 'X-Tenant-ID': auth.tenantId || 'aaaaaaaa-0000-4000-a000-000000000001' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const d = await res.json();
      const dbTeams = (d.teams || []) as Array<{
        id: string; station_id: string; station_name: string;
        zone: string; shift: string; status: string;
        members: Array<{ employee_id: number; name_ar: string; role: string }>;
      }>;

      if (mode === 'my_team') {
        // filter teams where empNo matches any member
        const myCtrlTeams = dbTeams.filter(t =>
          t.members?.some(m => String(m.employee_id) === empNo || m.name_ar?.includes(empNo))
        );
        // Also include corrosion field teams
        const myCorrosionTeams = getMyCorrosionTeams(auth.tenantId, empNo);
        const allMyTeams = [...myCtrlTeams, ...myCorrosionTeams];
        return NextResponse.json({
          ok: true,
          teams: allMyTeams,
          has_corrosion_team: myCorrosionTeams.length > 0,
          source: 'db',
        });
      }

      if (mode === 'team_detail') {
        const teamId = req.nextUrl.searchParams.get('team_id') || '';
        // Check corrosion teams first
        const corrTeams = getMyCorrosionTeams(auth.tenantId, empNo);
        const corrTeam = corrTeams.find(t => t.id === teamId);
        if (corrTeam) return NextResponse.json({ ok: true, team: corrTeam, source: 'corrosion_field' });
        const team   = dbTeams.find(t => t.id === teamId);
        if (!team) return NextResponse.json({ detail: 'الفريق غير موجود' }, { status: 404 });
        return NextResponse.json({ ok: true, team, source: 'db' });
      }

      // all_teams_summary: include corrosion teams for the employee
      const myCorrosionTeams = getMyCorrosionTeams(auth.tenantId, empNo);
      return NextResponse.json({
        ok: true,
        teams: [...dbTeams, ...myCorrosionTeams],
        has_corrosion_team: myCorrosionTeams.length > 0,
        source: 'db',
      });
    }
  } catch { /* fall through to in-memory */ }

  // Fallback: in-memory store
  const { getMonitoringTeams } = await import('@/lib/mobile-field-store');
  if (mode === 'my_team') {
    const teams = getMonitoringTeams(auth.tenantId).filter(t => t.supervisor_employee_nos?.includes(empNo));
    return NextResponse.json({ ok: true, teams, source: 'memory' });
  }
  if (mode === 'team_detail') {
    const teamId = req.nextUrl.searchParams.get('team_id') || '';
    const team   = getMonitoringTeam(auth.tenantId, teamId);
    if (!team) return NextResponse.json({ detail: 'الفريق غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, team, source: 'memory' });
  }
  const teams = getMonitoringTeams(auth.tenantId);
  return NextResponse.json({ ok: true, teams, source: 'memory' });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  // Supervisors can create/update teams — save to DB backend
  if (body.action === 'save_team' && SUPERVISOR_ROLES.includes(auth.role)) {
    const teamData = body.team || {};
    try {
      const res = await fetch(`${B}/api/v1/ctrl/monitoring-teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': auth.tenantId || 'aaaaaaaa-0000-4000-a000-000000000001',
        },
        body: JSON.stringify(teamData),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const d = await res.json();
        return NextResponse.json({ ok: true, team: d, source: 'db' });
      }
    } catch { /* fall through to in-memory */ }
    // Fallback
    const team = saveMonitoringTeam(auth.tenantId, teamData);
    return NextResponse.json({ ok: true, team, source: 'memory' });
  }

  // Submit a reading — write to ctrl.station_readings (DB) instead of in-memory store
  const team = body.team_id ? getMonitoringTeam(auth.tenantId, body.team_id) : undefined;

  // Map mobile body fields to ctrl.station_readings format
  const v = body.values || {};
  const stationId = body.station_id || (team as unknown as Record<string, string>)?.station_id || body.team_id || '';

  if (stationId) {
    try {
      const B = process.env.BACKEND_URL ?? 'http://localhost:7860';
      const dbBody = {
        station_id:       stationId,
        reading_date:     body.reading_date || new Date().toISOString().slice(0, 10),
        shift:            body.shift || 'daily',
        flow_m3:          v.flow_m3          ?? v.totalFlow    ?? null,
        pressure_in_bar:  v.pressure_in_bar  ?? v.pressureIn   ?? null,
        pressure_out_bar: v.pressure_out_bar ?? v.pressureOut  ?? null,
        tank_level_pct:   v.tank_level_pct   ?? v.tankLevel    ?? null,
        pumps_running:    v.pumps_running     ?? v.pumpsRunning ?? null,
        power_kw:         v.power_kw          ?? v.powerKw     ?? null,
        chlorine_mg_l:    v.chlorine_mg_l     ?? v.chlorine    ?? null,
        turbidity_ntu:    v.turbidity_ntu     ?? v.turbidity   ?? null,
        ph_value:         v.ph_value          ?? v.ph          ?? null,
        notes:            body.notes || null,
        submitted_by:     0,   // mobile user — no employee_id in JWT yet
        as_draft:         false,
        pumps_detail:     [],
        attachments:      [],
      };
      const dbRes = await fetch(`${B}/api/v1/ctrl/readings/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbBody),
        signal: AbortSignal.timeout(8000),
      });
      const dbData = await dbRes.json().catch(() => ({}));
      if (dbData.success) {
        return NextResponse.json({ ok: true, reading: dbData, source: 'db' });
      }
    } catch {
      // fall through to in-memory backup
    }
  }

  // Fallback: save to in-memory store if DB write fails or no station_id
  const reading = saveMonitoringReading(auth.tenantId, {
    tenant_id:         auth.tenantId,
    team_id:           body.team_id || '',
    team_name:         (team as unknown as Record<string, string>)?.name || body.team_name || '',
    station_type:      team?.station_type || body.station_type || '',
    location_label:    body.location || body.location_label || '',
    reading_date:      body.reading_date || new Date().toISOString().slice(0, 10),
    submitted_by:      empNo,
    submitted_by_name: body.employee_name || empNo,
    values:            body.values || {},
    notes:             body.notes || undefined,
    status:            'submitted',
  });
  return NextResponse.json({ ok: true, reading, source: 'memory' });
}
