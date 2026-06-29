import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:7860';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TENANT = 'aaaaaaaa-0000-4000-a000-000000000001';

// Map workspace department IDs (61-97) → admin_core department IDs (30-35)
// admin_core.departments: 30=ENG, 31=CORR, 33=MAINT, 34=OPS, 35=GIS
const DEPT_MAP: Record<number, number> = {
  62: 30, // Engineering & Technical Support → ENG
  61: 31, // Corrosion Management → CORR
  63: 33, // Maintenance → MAINT
  64: 34, // Operations → OPS
  65: 35, // GIS → GIS
};
const FALLBACK_DEPT_ID = 34;          // OPS — used for unmapped depts
const FALLBACK_EMPLOYEE_ID = 377;     // alhadiasd@gmail.com — dev user

function toDeptId(workspaceId: number | string | undefined): number {
  const id = Number(workspaceId);
  return DEPT_MAP[id] ?? FALLBACK_DEPT_ID;
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const rawTenant = (req.headers.get('x-tenant-id') || req.cookies.get('tenant_id')?.value || '').trim();
  return {
    'Content-Type':  'application/json',
    'X-Tenant-ID':   UUID_RE.test(rawTenant) ? rawTenant : DEFAULT_TENANT,
    'X-Tenant-Code': req.headers.get('x-tenant-code')  || req.cookies.get('tenant_code')?.value || '',
    'Authorization': req.headers.get('authorization')  || `Bearer ${req.cookies.get('auth_token')?.value || ''}`,
  };
}

export async function POST(req: NextRequest) {
  const headers = forwardHeaders(req);
  try {
    const body = await req.json();
    const {
      fromDepartment, toDepartments = [], ccDepartments = [],
      broadcast, subject, body: content, priority = 'normal',
    } = body;

    const senderDeptId = toDeptId(fromDepartment);
    // For broadcast, send one memo per known recipient dept; otherwise use first target
    const recipientIds: number[] = broadcast
      ? [30, 31, 33, 34, 35]
      : (toDepartments as (number | string)[]).map(toDeptId);

    const sendOne = async (recipientDeptId: number) => {
      const payload = {
        subject,
        content,
        priority,
        sender_employee_id: FALLBACK_EMPLOYEE_ID,
        sender_department_id: senderDeptId,
        recipient_department_id: recipientDeptId,
      };

      const createRes = await fetch(`${BACKEND}/api/v1/correspondence/internal-memos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        return { ok: false, error: err.detail || 'فشل إنشاء الرسالة', status: createRes.status };
      }

      const created = await createRes.json();
      const memoId = created.memo_id || created.id;

      // Auto-send the draft
      const sendRes = await fetch(`${BACKEND}/api/v1/correspondence/internal-memos/${memoId}/send`, {
        method: 'POST',
        headers,
      });

      const sent = await sendRes.json().catch(() => ({}));
      return { ok: sendRes.ok, memoId, sent };
    };

    // Sequential to avoid duplicate reference number race conditions
    const results = [];
    for (const id of recipientIds) { results.push(await sendOne(id)); }
    const allOk = results.every(r => r.ok);
    const sent = results.filter(r => r.ok).length;

    return NextResponse.json({ ok: allOk, sent, total: recipientIds.length, results });
  } catch {
    return NextResponse.json({ error: 'خطأ في الاتصال بالخادم' }, { status: 500 });
  }
}
