/**
 * POST /api/engineering/workspace/principal-assets/bulk-delete
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

function mapRole(role: string): string {
  if (['admin','founder','owner','super_admin'].includes(role)) return 'super_admin';
  if (['dept_manager','section_manager','engineer'].includes(role)) return 'layer_owner';
  return role || 'viewer';
}

export async function POST(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  const rawRole = req.headers.get('x-verified-role') || '';
  const userId  = req.headers.get('x-verified-employee-no') || req.headers.get('x-verified-email') || '';
  const headers = buildBackendHeaders(tenantId, { 'x-user-role': mapRole(rawRole), 'x-user-id': userId });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? [];
  if (!ids.length) return NextResponse.json({ deleted: 0 });

  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`${BACKEND}/api/v1/workspace/assets/${id}?tenant_id=${tenantId}`, {
        method: 'DELETE', headers, signal: AbortSignal.timeout(10_000),
      })
    )
  );
  const deleted = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
  return NextResponse.json({ ok: true, deleted, total: ids.length });
}
