import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getMonitoringTeams, getMonitoringTeam, saveMonitoringTeam,
  saveMonitoringReading, getPendingMonitoringReadings,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

const SUPERVISOR_ROLES = ['supervisor','manager','admin','dept_manager','section_manager','founder'];

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const mode  = req.nextUrl.searchParams.get('mode') || 'all_teams_summary';
  const empNo = resolveEmpNo(req);
  const isSup = SUPERVISOR_ROLES.includes(auth.role);

  if (mode === 'my_team') {
    const teams = getMonitoringTeams(auth.tenantId).filter(t => t.supervisor_employee_nos?.includes(empNo));
    return NextResponse.json({ ok: true, teams });
  }

  if (mode === 'pending' && isSup) {
    const pending = getPendingMonitoringReadings(auth.tenantId);
    return NextResponse.json({ ok: true, readings: pending });
  }

  if (mode === 'team_detail') {
    const teamId = req.nextUrl.searchParams.get('team_id') || '';
    const team   = getMonitoringTeam(auth.tenantId, teamId);
    if (!team) return NextResponse.json({ detail: 'الفريق غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, team });
  }

  const teams = getMonitoringTeams(auth.tenantId);
  return NextResponse.json({ ok: true, teams });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  // Supervisors can create/update teams
  if (body.action === 'save_team' && SUPERVISOR_ROLES.includes(auth.role)) {
    const team = saveMonitoringTeam(auth.tenantId, body.team || {});
    return NextResponse.json({ ok: true, team });
  }

  // Submit a reading — write to ctrl.station_readings (DB) instead of in-memory store
  const team = body.team_id ? getMonitoringTeam(auth.tenantId, body.team_id) : undefined;

  // Map mobile body fields to ctrl.station_readings format
  const v = body.values || {};
  const stationId = body.station_id || team?.station_id || body.team_id || '';

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
    team_name:         team?.name || body.team_name || '',
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
