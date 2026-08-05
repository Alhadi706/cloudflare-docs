import { NextRequest, NextResponse } from 'next/server';
import { listPersonnelAudit, summarizePersonnelCompliance } from '@/lib/personnel-requests-store';

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
  const limitRaw = Number(new URL(req.url).searchParams.get('limit') || '50');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  const audit = listPersonnelAudit(tenantId, limit);
  const summary = summarizePersonnelCompliance(tenantId);

  return NextResponse.json({
    audit,
    summary,
    source: 'personnel_workflow_store',
  });
}
