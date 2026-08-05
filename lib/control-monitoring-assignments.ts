type CtrlEmployee = {
  id?: string | number;
  employee_id?: string | number;
  employee_number?: string | number;
  employee_no?: string | number;
  full_name_ar?: string;
  name_ar?: string;
};

type CtrlMember = {
  id?: string | number;
  employee_id?: string | number;
  employee_number?: string | number;
  employee_no?: string | number;
  name_ar?: string;
  name?: string;
};

type CtrlTeam = {
  id?: string | number;
  station_id?: string;
  station_name?: string;
  members?: CtrlMember[];
  [k: string]: unknown;
};

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

function norm(v: unknown): string {
  return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

async function fetchJson(url: string, tenantId: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Tenant-ID': tenantId },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function resolveEmployeeIdCandidates(tenantId: string, employeeNo: string): Promise<Set<string>> {
  const ids = new Set<string>();
  if (/^\d+$/.test(employeeNo)) ids.add(String(Number(employeeNo)));

  const employeesPayload = await fetchJson(`${B}/api/v1/ctrl/employees`, tenantId);
  const employees = asArray<CtrlEmployee>(employeesPayload?.employees ?? employeesPayload?.data ?? []);
  for (const emp of employees) {
    const empNo = String(emp.employee_number ?? emp.employee_no ?? '').trim().toUpperCase();
    if (empNo !== employeeNo) continue;
    const id = String(emp.id ?? emp.employee_id ?? '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

export async function getAssignedCtrlMonitoringTeams(
  tenantId: string,
  employeeNoRaw: string,
  fullNameRaw?: string,
): Promise<CtrlTeam[]> {
  const employeeNo = String(employeeNoRaw || '').trim().toUpperCase();
  if (!tenantId || !employeeNo) return [];

  const [teamsPayload, idCandidates] = await Promise.all([
    fetchJson(`${B}/api/v1/ctrl/monitoring-teams`, tenantId),
    resolveEmployeeIdCandidates(tenantId, employeeNo),
  ]);

  const teams = asArray<CtrlTeam>(teamsPayload?.teams ?? teamsPayload?.data ?? []);
  const fullName = norm(fullNameRaw);

  return teams.filter((team) => {
    const members = asArray<CtrlMember>(team.members);
    return members.some((member) => {
      const memberId = String(member.employee_id ?? member.id ?? '').trim();
      const memberNo = String(member.employee_number ?? member.employee_no ?? '').trim().toUpperCase();
      const memberName = norm(member.name_ar ?? member.name ?? '');
      if (memberNo && memberNo === employeeNo) return true;
      if (memberId && idCandidates.has(memberId)) return true;
      if (fullName && memberName && memberName === fullName) return true;
      return false;
    });
  });
}
