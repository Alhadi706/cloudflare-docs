import { NextRequest, NextResponse } from 'next/server';
import {
  createMaterialRequest,
  getDepartmentTemplates,
  listMaterialRequests,
} from '@/lib/material-requests-store';

function resolveTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.cookies.get('tenant_id')?.value ||
    'dev-default-tenant'
  ).trim();
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const templates = getDepartmentTemplates();
  const rows = listMaterialRequests(tenantId);
  return NextResponse.json({ requests: rows, templates, source: 'gateway_store' });
}

export async function POST(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  const body = await req.json().catch(() => ({}));

  const requesterDept = String(body?.requester_dept || '').trim();
  const requesterName = String(body?.requester_name || '').trim() || String(req.headers.get('x-verified-full-name') || req.cookies.get('user_name')?.value || req.headers.get('x-verified-email') || 'system').trim();
  const requesterContact = String(body?.requester_contact || '').trim();
  const targetUseCase = String(body?.target_use_case || '').trim();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!requesterDept) {
    return NextResponse.json({ detail: 'requester_dept مطلوب' }, { status: 400 });
  }

  if (!requesterName) {
    return NextResponse.json({ detail: 'requester_name مطلوب' }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ detail: 'يجب إضافة صنف واحد على الأقل' }, { status: 400 });
  }

  const created = createMaterialRequest(tenantId, {
    requester_dept: requesterDept,
    requester_name: requesterName,
    requester_contact: requesterContact,
    target_use_case: targetUseCase,
    items,
  });

  return NextResponse.json({ ok: true, request: created, source: 'gateway_store' }, { status: 201 });
}
