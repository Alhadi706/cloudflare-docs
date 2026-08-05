import { NextRequest, NextResponse } from 'next/server';
import { extractKnowledgeFromText } from '@/lib/knowledge/extractor';
import { getKnowledgeSourceById, saveKnowledgeExtraction } from '@/lib/knowledge/store';
import { resolveTenantIdFromRequest } from '@/lib/knowledge/http';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { assetId: string; sourceId: string } }
) {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const assetId = String(params.assetId || '').trim();
    const sourceId = String(params.sourceId || '').trim();
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_id_required' }, { status: 400 });
    if (!assetId) return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });
    if (!sourceId) return NextResponse.json({ ok: false, error: 'source_id_required' }, { status: 400 });

    const source = await getKnowledgeSourceById(tenantId, assetId, sourceId);
    if (!source) return NextResponse.json({ ok: false, error: 'source_not_found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    if (text.length < 20) {
      return NextResponse.json({ ok: false, error: 'text_too_short' }, { status: 400 });
    }

    const extracted = extractKnowledgeFromText(text);
    await saveKnowledgeExtraction({
      tenantId,
      assetId,
      sourceId,
      status: 'ingested',
      contentText: text,
      contentExcerpt: text.slice(0, 500),
      events: extracted.events.map((e) => ({
        eventYear: e.eventYear ?? null,
        eventType: e.eventType,
        component: e.component ?? null,
        severity: e.severity ?? null,
        action: e.action ?? null,
        evidenceText: e.evidenceText,
        confidence: e.confidence,
      })),
    });

    return NextResponse.json({
      ok: true,
      source_id: sourceId,
      title: source.title,
      events_count: extracted.events.length,
      tools_count: extracted.tools.length,
      safety_count: extracted.safety.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'source_text_ingest_failed' }, { status: 500 });
  }
}
