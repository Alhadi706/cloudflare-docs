import { NextRequest, NextResponse } from 'next/server';
import { listTrainingAudit, listTrainingNeeds, listTrainingNominations } from '@/lib/training-workflow-store';

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }
  const audit = listTrainingAudit(tenantId).slice(0, 200);
  const needs = listTrainingNeeds(tenantId);
  const nominations = listTrainingNominations(tenantId);

  return NextResponse.json({
    audit,
    summary: {
      needs_total: needs.length,
      needs_approved: needs.filter((n) => n.status === 'training_approved').length,
      nominations_total: nominations.length,
      nominations_hr_approved: nominations.filter((n) => n.status === 'hr_approved').length,
      nominations_completed: nominations.filter((n) => n.status === 'completed').length,
    },
    source: 'training_workflow_store',
  });
}
