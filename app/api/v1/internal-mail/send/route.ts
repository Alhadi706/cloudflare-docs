import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:7860';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TENANT = 'aaaaaaaa-0000-4000-a000-000000000001';

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

    // Map to backend internal-memos structure
    const payload = {
      subject,
      content,
      priority,
      sender_department_code: fromDepartment,
      recipient_department_codes: broadcast ? [] : toDepartments,
      cc_department_codes: ccDepartments,
      broadcast: !!broadcast,
    };

    const res = await fetch(`${BACKEND}/api/v1/correspondence/internal-memos`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || 'فشل إرسال الرسالة' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, id: data.id || data.memo_id });
  } catch {
    return NextResponse.json({ error: 'خطأ في الاتصال بالخادم' }, { status: 500 });
  }
}
