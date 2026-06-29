import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getMonitoringTeams, getTodayAttendance,
  getPendingCompletionReports, getPendingPartsRequests,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const empNo = resolveEmpNo(req);
  const teams = getMonitoringTeams(auth.tenantId).filter(t =>
    t.supervisor_employee_nos?.includes(empNo)
  );

  const memberStatuses = teams.flatMap(team =>
    (team.member_employee_nos || []).map((memberNo: string) => ({
      team_id:     team.id,
      team_name:   team.team_name,
      employee_no: memberNo,
      today_att:   getTodayAttendance(auth.tenantId, memberNo) ?? null,
    }))
  );

  const pendingApprovals = getPendingCompletionReports(auth.tenantId).length;
  const pendingParts     = getPendingPartsRequests(auth.tenantId).length;

  return NextResponse.json({
    ok: true,
    teams,
    member_statuses: memberStatuses,
    pending_approvals: pendingApprovals,
    pending_parts:     pendingParts,
  });
}
