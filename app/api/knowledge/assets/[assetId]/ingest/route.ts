import { NextRequest, NextResponse } from 'next/server';
import { extractKnowledgeFromText } from '@/lib/knowledge/extractor';
import {
  listKnowledgeSources,
  saveKnowledgeExtraction,
  upsertKnowledgeSource,
} from '@/lib/knowledge/store';
import { forwardAuthHeaders, loadAssetCenterFromApi, resolveTenantIdFromRequest } from '@/lib/knowledge/http';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

function toAbsoluteUrl(origin: string, fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

function fileExtensionFromUrl(fileUrl: string): string {
  const clean = String(fileUrl || '').split('?')[0].split('#')[0].trim().toLowerCase();
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx) : '';
}

function inferMimeTypeFromFileUrl(fileUrl: string): string | null {
  const ext = fileExtensionFromUrl(fileUrl);
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.json') return 'application/json';
  return null;
}

function inferFileKind(mimeType: string | null, fileUrl: string): 'text' | 'pdf' | 'docx' | 'spreadsheet' | 'image' | 'other' {
  const mime = String(mimeType || '').toLowerCase();
  const ext = fileExtensionFromUrl(fileUrl);
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || ext === '.txt' || ext === '.csv' || ext === '.json') return 'text';
  if (mime.includes('pdf') || ext === '.pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || mime.includes('msword') || ext === '.docx' || ext === '.doc') return 'docx';
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel') || ext === '.xlsx' || ext === '.xls') return 'spreadsheet';
  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'].includes(ext)) return 'image';
  return 'other';
}

function buildIndexMetaBlock(input: {
  doc: any;
  fileUrl: string;
  mimeType: string | null;
  docType: string;
  sourceKind: string;
}): string {
  const origin = String(input.doc?.department || input.doc?.uploaded_by || input.doc?.source || 'asset_document').trim() || 'asset_document';
  const docDate = String(input.doc?.created_at || input.doc?.uploaded_at || input.doc?.date || '').trim() || new Date().toISOString();
  const docId = String(input.doc?.id || '').trim() || 'unknown';
  const fileKind = inferFileKind(input.mimeType, input.fileUrl);

  return [
    '[INDEX_META]',
    `origin=${origin}`,
    `date=${docDate}`,
    `type=${input.docType}`,
    `source_kind=${input.sourceKind}`,
    `mime_type=${String(input.mimeType || 'unknown')}`,
    `file_kind=${fileKind}`,
    `document_id=${docId}`,
    `file_url=${input.fileUrl}`,
    '[/INDEX_META]',
  ].join('\n');
}

function extractWorkbookText(bytes: Buffer): string | null {
  try {
    const wb = XLSX.read(bytes, { type: 'buffer' });
    const lines: string[] = [];

    for (const sheetName of wb.SheetNames.slice(0, 12)) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
      lines.push(`# sheet:${sheetName}`);

      for (const row of rows.slice(0, 1500)) {
        const flat = row
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .join(' | ');
        if (flat) lines.push(flat.slice(0, 500));
        if (lines.length > 3000) break;
      }

      if (lines.length > 3000) break;
    }

    const text = lines.join('\n').trim();
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
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

  const headerMime = (res.headers.get('content-type') || '').toLowerCase();
  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const mimeType = headerMime || inferMimeTypeFromFileUrl(fileUrl) || null;
  const fileKind = inferFileKind(mimeType, fileUrl);

  const isTextMime =
    fileKind === 'text' ||
    String(mimeType || '').startsWith('text/') ||
    String(mimeType || '').includes('application/json') ||
    String(mimeType || '').includes('application/xml') ||
    String(mimeType || '').includes('text/csv');

  if (isTextMime) {
    return { text: bytes.toString('utf8'), mimeType, bytes };
  }

  if (fileKind === 'pdf') {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: bytes });
      const parsed = await parser.getText();
      const text = String(parsed?.text || '').trim();
      if (text.length >= 20) return { text, mimeType, bytes };
    } catch {
      // fall through to OCR stage
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  }

  // DOCX extraction via mammoth
  if (fileKind === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer: bytes });
      const text = (result?.value || '').trim();
      if (text.length >= 20) return { text, mimeType, bytes };
    } catch {
      // fall through to needs_ocr
    }
  }

  if (fileKind === 'spreadsheet') {
    const text = extractWorkbookText(bytes);
    if (text) return { text, mimeType, bytes };
  }

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

async function recognizeImageBytesByTesseract(imageBytes: Buffer, langs: string): Promise<string | null> {
  try {
    const mod: any = await import('tesseract.js');
    const recognize = mod?.recognize || mod?.default?.recognize;
    if (typeof recognize !== 'function') return null;

    const primary = await recognize(imageBytes, langs, {});
    const primaryText = String(primary?.data?.text || '').trim();
    if (primaryText.length >= 20) return primaryText;

    if (langs !== 'eng') {
      const fallback = await recognize(imageBytes, 'eng', {});
      const fallbackText = String(fallback?.data?.text || '').trim();
      if (fallbackText.length >= 20) return fallbackText;
    }

    return null;
  } catch {
    return null;
  }
}

async function tryOcrLocally(bytes: Buffer, mimeType: string | null, fileUrl: string): Promise<string | null> {
  const fileKind = inferFileKind(mimeType, fileUrl);
  if (fileKind !== 'image' && fileKind !== 'pdf') return null;

  const maxLocalOcrBytes = Number(process.env.KNOWLEDGE_LOCAL_OCR_MAX_BYTES || 12 * 1024 * 1024);
  if (!Number.isFinite(maxLocalOcrBytes) || maxLocalOcrBytes <= 0 || bytes.length > maxLocalOcrBytes) {
    return null;
  }

  const langs = String(process.env.KNOWLEDGE_OCR_LANGS || 'ara+eng').trim() || 'ara+eng';

  if (fileKind === 'image') {
    return recognizeImageBytesByTesseract(bytes, langs);
  }

  // For scanned PDFs: render first pages as screenshots then OCR each page.
  let parser: PDFParse | null = null;
  try {
    const pageLimit = Number(process.env.KNOWLEDGE_LOCAL_OCR_PDF_PAGES || 3);
    const safePageLimit = Number.isFinite(pageLimit) && pageLimit > 0 ? Math.min(Math.floor(pageLimit), 8) : 3;

    parser = new PDFParse({ data: bytes });
    const shots = await parser.getScreenshot({
      first: safePageLimit,
      imageBuffer: true,
      imageDataUrl: false,
      scale: 1.5,
    });

    const chunks: string[] = [];
    for (const page of shots?.pages || []) {
      const imageData = page?.data ? Buffer.from(page.data) : null;
      if (!imageData || imageData.length === 0) continue;
      const text = await recognizeImageBytesByTesseract(imageData, langs);
      if (text) {
        chunks.push(`[page:${page.pageNumber}]\n${text}`);
      }
      if (chunks.join('\n\n').length > 18000) break;
    }

    const merged = chunks.join('\n\n').trim();
    return merged.length >= 20 ? merged : null;
  } catch {
    return null;
  } finally {
    await parser?.destroy().catch(() => undefined);
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
    const onlyFileUrls = Array.isArray(body?.onlyFileUrls)
      ? body.onlyFileUrls.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : null;
    const onlyFileUrlsSet = onlyFileUrls && onlyFileUrls.length > 0 ? new Set(onlyFileUrls) : null;

    const demo = body?.demo === true || req.nextUrl.searchParams.get('demo') === '1';
    const center = demo ? { documents: demoDocuments(assetId) } : await loadAssetCenterFromApi(req, assetId);
    const docsRaw = Array.isArray(center?.documents) ? center.documents : [];
    const docs = onlyFileUrlsSet
      ? docsRaw.filter((d: any) => onlyFileUrlsSet.has(String(d?.file_url || '').trim()))
      : docsRaw;

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

      const docType = normalizeDocType(doc?.doc_type);
      const sourceKind = 'document_original';
      const defaultMimeFromUrl = inferMimeTypeFromFileUrl(fileUrl);

      const overrideText = String(textByFileUrl[fileUrl] || doc?.__demo_text || '').trim();
      let extractedText = overrideText;
      let mimeType: string | null = defaultMimeFromUrl;

      if (!extractedText) {
        const fileExtract = await extractTextFromFileUrl(req, fileUrl);
        extractedText = String(fileExtract.text || '').trim();
        mimeType = fileExtract.mimeType || defaultMimeFromUrl;

        if (!extractedText && fileExtract.bytes) {
          const ocrByApi = await tryOcrByApi(fileExtract.bytes, fileExtract.mimeType);
          extractedText = String(ocrByApi || '').trim();

          if (!extractedText) {
            const ocrLocal = await tryOcrLocally(fileExtract.bytes, fileExtract.mimeType, fileUrl);
            extractedText = String(ocrLocal || '').trim();
          }
        }
      }

      const source = await upsertKnowledgeSource({
        tenantId,
        assetId,
        documentId: doc?.id ? String(doc.id) : null,
        title: String(doc?.title || doc?.id || 'وثيقة بدون عنوان'),
        docType,
        fileUrl,
        mimeType,
        sourceKind,
      });
      stats.linked_sources += 1;

      const metaBlock = buildIndexMetaBlock({ doc, fileUrl, mimeType, docType, sourceKind });

      if (!extractedText || extractedText.length < 20) {
        await saveKnowledgeExtraction({
          tenantId,
          assetId,
          sourceId: source.id,
          status: 'needs_ocr',
          contentText: null,
          contentExcerpt: mimeType ? `needs_ocr:${inferFileKind(mimeType, fileUrl)}:${mimeType}` : 'needs_ocr:unknown_type',
          events: [],
        });
        stats.needs_ocr_sources += 1;
        details.push({ source_id: source.id, title: source.title, file_url: source.file_url, status: 'needs_ocr', events: 0 });
        continue;
      }

      try {
        const extracted = extractKnowledgeFromText(extractedText);
        const indexedText = `${metaBlock}\n\n${extractedText}`;
        await saveKnowledgeExtraction({
          tenantId,
          assetId,
          sourceId: source.id,
          status: 'ingested',
          contentText: indexedText,
          contentExcerpt: `${metaBlock}\n${extractedText.slice(0, 320)}`.slice(0, 500),
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
      note: onlyFileUrlsSet
        ? 'Selective re-index complete for requested files. Built-in OCR now handles scanned images and scanned PDF pages.'
        : 'Indexing supports text, DOCX, PDF, spreadsheets, scanned images, and scanned PDF pages using built-in OCR.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'ingest_failed' }, { status: 500 });
  }
}
