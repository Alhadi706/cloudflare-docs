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

  // Submit a reading
  const team = body.team_id ? getMonitoringTeam(auth.tenantId, body.team_id) : undefined;
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
  return NextResponse.json({ ok: true, reading });
}
