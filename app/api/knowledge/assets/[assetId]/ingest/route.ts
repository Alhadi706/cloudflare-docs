import { NextRequest, NextResponse } from 'next/server';
import { extractKnowledgeFromText } from '@/lib/knowledge/extractor';
import {
  listKnowledgeSources,
  saveKnowledgeExtraction,
  upsertKnowledgeSource,
} from '@/lib/knowledge/store';
import { forwardAuthHeaders, loadAssetCenterFromApi, resolveTenantIdFromRequest } from '@/lib/knowledge/http';

export const runtime = 'nodejs';

function toAbsoluteUrl(origin: string, fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

async function extractTextFromFileUrl(req: NextRequest, fileUrl: string): Promise<{ text: string | null; mimeType: string | null; bytes: Buffer | null }> {
  const absoluteUrl = toAbsoluteUrl(req.nextUrl.origin, fileUrl);
  const res = await fetch(absoluteUrl, {
    method: 'GET',
    headers: forwardAuthHeaders(req),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { text: null, mimeType: null, bytes: null };
  }

  const mimeType = (res.headers.get('content-type') || '').toLowerCase();
  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const isTextMime =
    mimeType.startsWith('text/') ||
    mimeType.includes('application/json') ||
    mimeType.includes('application/xml') ||
    mimeType.includes('text/csv');

  if (isTextMime) {
    return { text: bytes.toString('utf8'), mimeType, bytes };
  }

  // We intentionally avoid fake OCR here. Unsupported formats must be sent to OCR stage.
  return { text: null, mimeType, bytes };
}

async function tryOcrByApi(bytes: Buffer, mimeType: string | null): Promise<string | null> {
  const ocrUrl = String(process.env.KNOWLEDGE_OCR_API_URL || '').trim();
  if (!ocrUrl) return null;

  const form = new FormData();
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  form.append('file', blob, 'source.bin');

  const headers: Record<string, string> = {};
  const apiKey = String(process.env.KNOWLEDGE_OCR_API_KEY || '').trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(ocrUrl, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const text = String(data?.text || data?.ocr_text || data?.content || '').trim();
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}

function normalizeDocType(input: unknown): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'other';
  if (['admin', 'technical', 'financial', 'contract', 'manual', 'drawing', 'photo', 'other'].includes(raw)) return raw;
  return raw;
}

function demoDocuments(assetId: string): any[] {
  return [
    {
      id: `demo-doc-ops-${assetId}`,
      title: 'سجل صيانة تاريخي',
      doc_type: 'technical',
      file_url: `/api/engineering/workspace/files/demo-doc-ops-${assetId}`,
      __demo_text: 'في سنة 2017 تم تغيير رينق بسبب تآكل عالي. في سنة 2022 تم الفحص وتبين أن الأصل يعمل بشكل جيد. في سنة 2025 تم استبدال مقياس الضغط.',
    },
    {
      id: `demo-doc-manual-${assetId}`,
      title: 'كتيب تشغيل - تغيير الرينق',
      doc_type: 'manual',
      file_url: `/api/engineering/workspace/files/demo-doc-manual-${assetId}`,
      __demo_text: 'الأدوات\n- مفتاح ربط\n- عزم متر\n- شحم مانع تسرب\n\nاحتياطات السلامة\n- فصل الطاقة بالكامل\n- ارتداء القفازات والنظارات\n- التأكد من تفريغ الضغط قبل الفك\n',
    },
  ];
}

export async function POST(req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const assetId = String(params.assetId || '').trim();
    if (!assetId) {
      return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });
    }
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: 'tenant_id_required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const textByFileUrl = (body?.textByFileUrl && typeof body.textByFileUrl === 'object') ? body.textByFileUrl as Record<string, string> : {};

    const demo = body?.demo === true || req.nextUrl.searchParams.get('demo') === '1';
    const center = demo ? { documents: demoDocuments(assetId) } : await loadAssetCenterFromApi(req, assetId);
    const docs = Array.isArray(center?.documents) ? center.documents : [];

    const stats = {
      scanned_documents: docs.length,
      linked_sources: 0,
      ingested_sources: 0,
      needs_ocr_sources: 0,
      failed_sources: 0,
    };

    const details: Array<{ source_id: string; title: string; file_url: string; status: string; events: number }> = [];

    for (const doc of docs) {
      const fileUrl = String(doc?.file_url || '').trim();
      if (!fileUrl) continue;

      const source = await upsertKnowledgeSource({
        tenantId,
        assetId,
        documentId: doc?.id ? String(doc.id) : null,
        title: String(doc?.title || doc?.id || 'وثيقة بدون عنوان'),
        docType: normalizeDocType(doc?.doc_type),
        fileUrl,
        mimeType: null,
        sourceKind: 'document_original',
      });
      stats.linked_sources += 1;

      const overrideText = String(textByFileUrl[fileUrl] || doc?.__demo_text || '').trim();
      let extractedText = overrideText;
      let mimeType: string | null = null;

      if (!extractedText) {
        const fileExtract = await extractTextFromFileUrl(req, fileUrl);
        extractedText = String(fileExtract.text || '').trim();
        mimeType = fileExtract.mimeType;

        if (!extractedText && fileExtract.bytes) {
          const ocrText = await tryOcrByApi(fileExtract.bytes, fileExtract.mimeType);
          extractedText = String(ocrText || '').trim();
        }
      }

      if (!extractedText || extractedText.length < 20) {
        await saveKnowledgeExtraction({
          tenantId,
          assetId,
          sourceId: source.id,
          status: 'needs_ocr',
          contentText: null,
          contentExcerpt: mimeType ? `unsupported_direct_text_extraction:${mimeType}` : 'unsupported_direct_text_extraction',
          events: [],
        });
        stats.needs_ocr_sources += 1;
        details.push({ source_id: source.id, title: source.title, file_url: source.file_url, status: 'needs_ocr', events: 0 });
        continue;
      }

      try {
        const extracted = extractKnowledgeFromText(extractedText);
        await saveKnowledgeExtraction({
          tenantId,
          assetId,
          sourceId: source.id,
          status: 'ingested',
          contentText: extractedText,
          contentExcerpt: extractedText.slice(0, 500),
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
        stats.ingested_sources += 1;
        details.push({ source_id: source.id, title: source.title, file_url: source.file_url, status: 'ingested', events: extracted.events.length });
      } catch {
        await saveKnowledgeExtraction({
          tenantId,
          assetId,
          sourceId: source.id,
          status: 'failed',
          contentText: null,
          contentExcerpt: 'text_processing_failed',
          events: [],
        });
        stats.failed_sources += 1;
        details.push({ source_id: source.id, title: source.title, file_url: source.file_url, status: 'failed', events: 0 });
      }
    }

    const sourcesAfter = await listKnowledgeSources(tenantId, assetId);

    return NextResponse.json({
      ok: true,
      asset_id: assetId,
      tenant_id: tenantId,
      stats,
      details,
      sources_total: sourcesAfter.length,
      note: 'Only direct text extraction is automatic here. PDF/Image OCR must be provided via OCR stage.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'ingest_failed' }, { status: 500 });
  }
}
