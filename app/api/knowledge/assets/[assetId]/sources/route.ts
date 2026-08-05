import { NextRequest, NextResponse } from 'next/server';
import { listKnowledgeSources } from '@/lib/knowledge/store';
import { resolveTenantIdFromRequest } from '@/lib/knowledge/http';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const assetId = String(params.assetId || '').trim();
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_id_required' }, { status: 400 });
    if (!assetId) return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });

    const rows = await listKnowledgeSources(tenantId, assetId);

    return NextResponse.json({
      ok: true,
      asset_id: assetId,
      tenant_id: tenantId,
      total: rows.length,
      needs_ocr: rows.filter((r) => r.extraction_status === 'needs_ocr').length,
      ingested: rows.filter((r) => r.extraction_status === 'ingested').length,
      items: rows,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'sources_list_failed' }, { status: 500 });
  }
}
