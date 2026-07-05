import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getMonitoringTeam, saveMonitoringTeam,
  saveMonitoringReading, getPendingMonitoringReadings,
} from '@/lib/mobile-field-store';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

/**
 * Resolve the employee number from middleware-verified headers.
 * This endpoint is ONLY for مركز التحكم (Control Center) teams.
 * Corrosion field teams use /api/auth/mobile/corrosion-teams.
 */
function resolveEmpNo(req: NextRequest): string {
  const fromHeader = (req.headers.get('x-verified-employee-no') ?? '').trim().toUpperCase();
  if (fromHeader) return fromHeader;
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
        // Use /by-employee which correctly resolves employee_no → employee_id
        try {
          const byEmpRes = await fetch(
            `${B}/api/v1/ctrl/monitoring-teams/by-employee?employee_no=${encodeURIComponent(empNo)}`,
            { cache: 'no-store', signal: AbortSignal.timeout(8000) }
          );
          if (byEmpRes.ok) {
            const byEmpData = await byEmpRes.json();
            const byEmpTeams = (byEmpData.teams || []) as Array<{
              id: string; station_id: string; station_name: string;
              zone: string; shift: string; status: string; member_role: string;
            }>;
            const ZONE_MAP: Record<string, string> = {
              'المسار الأوسط': 'central_branch', 'حقول الآبار': 'well_fields',
              'المسار الشرقي': 'eastern_branch', 'منطقة طاز': 'taz',
            };
            const { STATION_PRESETS } = await import('@/lib/mobile-field-store');
            const builtTeams = byEmpTeams.map(t => {
              const presetKey = ZONE_MAP[t.zone] || 'central_branch';
              return {
                id: t.id, team_name: t.station_name || t.station_id,
                station_type: presetKey, location_label: t.zone || '',
                station_id: t.station_id, shift: t.shift || 'صباحي',
                member_role: t.member_role || 'راصد',
                member_employee_nos: [] as string[], supervisor_employee_nos: [] as string[],
                field_groups: STATION_PRESETS[presetKey]?.field_groups ?? [],
                is_active: t.status === 'نشط' || t.status === 'active',
              };
            });
            const primary = builtTeams.find(t => t.member_role === 'رئيس فريق') ?? builtTeams[0] ?? null;
            return NextResponse.json({
              ok: true, team: primary, teams: builtTeams,
              recent_readings: [], source: 'db', dept: 'control_center',
            });
          }
        } catch { /* fall through */ }
        // Memory fallback
        const { getMonitoringTeams } = await import('@/lib/mobile-field-store');
        const localTeams = getMonitoringTeams(auth.tenantId).filter(t =>
          t.member_employee_nos?.includes(empNo) || t.supervisor_employee_nos?.includes(empNo)
        );
        return NextResponse.json({
          ok: true, team: localTeams[0] ?? null, teams: localTeams,
          recent_readings: [], source: 'memory', dept: 'control_center',
        });
      }

      if (mode === 'team_detail') {
        const teamId = req.nextUrl.searchParams.get('team_id') || '';
        const team   = dbTeams.find(t => t.id === teamId);
        if (!team) return NextResponse.json({ detail: 'الفريق غير موجود' }, { status: 404 });
        return NextResponse.json({ ok: true, team, source: 'db', dept: 'control_center' });
      }

      // all_teams_summary: control center teams only
      return NextResponse.json({
        ok: true,
        teams: dbTeams,
        source: 'db',
        dept: 'control_center',
      });
    }
  } catch { /* fall through to in-memory */ }

  // Fallback: in-memory store (control center only)
  const { getMonitoringTeams } = await import('@/lib/mobile-field-store');
  if (mode === 'my_team') {
    const teams = getMonitoringTeams(auth.tenantId).filter(t =>
      t.supervisor_employee_nos?.includes(empNo) || t.member_employee_nos?.includes(empNo)
    );
    return NextResponse.json({
      ok: true,
      team: teams[0] ?? null,
      teams,
      recent_readings: [],
      source: 'memory',
      dept: 'control_center',
    });
  }
  if (mode === 'team_detail') {
    const teamId = req.nextUrl.searchParams.get('team_id') || '';
    const team   = getMonitoringTeam(auth.tenantId, teamId);
    if (!team) return NextResponse.json({ detail: 'الفريق غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, team, source: 'memory', dept: 'control_center' });
  }
  const teams = getMonitoringTeams(auth.tenantId);
  return NextResponse.json({
    ok: true,
    teams,
    source: 'memory',
    dept: 'control_center',
  });
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
