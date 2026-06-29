import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  getChecklistTemplates, getChecklistExecutions, startChecklist,
  updateChecklistItem, getChecklistForWO,
} from '@/lib/mobile-field-store';

function resolveEmpNo(req: NextRequest): string {
  return (req.headers.get('x-verified-email') ?? '')
    .replace('@mobile.local', '').split('_').slice(1).join('_').toUpperCase();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const execId = req.nextUrl.searchParams.get('exec_id');
  if (execId) {
    const exec = getChecklistExecutions(auth.tenantId).find(e => e.id === execId);
    if (!exec) return NextResponse.json({ detail: 'التنفيذ غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, execution: exec });
  }

  const woId = req.nextUrl.searchParams.get('work_order_id');
  if (woId) {
    return NextResponse.json({ ok: true, executions: getChecklistForWO(auth.tenantId, parseInt(woId)) });
  }

  const templates = getChecklistTemplates(auth.tenantId);
  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const body  = await req.json().catch(() => ({}));
  const empNo = resolveEmpNo(req);

  // Update a checklist item
  if (body.action === 'update_item' && body.exec_id && body.item_id) {
    const exec = updateChecklistItem(
      auth.tenantId,
      body.exec_id,
      body.item_id,
      body.checked ?? false,
      body.notes,
    );
    if (!exec) return NextResponse.json({ detail: 'التنفيذ غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true, execution: exec });
  }

  // Start a new checklist execution
  const exec = startChecklist(
    auth.tenantId,
    String(body.template_id || '').trim(),
    parseInt(body.work_order_id) || 0,
    { employee_no: empNo, name: body.employee_name || empNo, work_order_number: body.work_order_number },
  );
  return NextResponse.json({ ok: true, execution: exec });
}
