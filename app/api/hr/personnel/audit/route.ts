import { NextRequest, NextResponse } from 'next/server';
import { listPersonnelAudit, summarizePersonnelCompliance } from '@/lib/personnel-requests-store';

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
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
