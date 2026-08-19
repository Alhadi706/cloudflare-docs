import { NextRequest, NextResponse } from 'next/server';
import { buildAssetGroundedBrief } from '@/lib/knowledge/asset-grounded';

export const runtime = 'nodejs';

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();
  const auth = (req.headers.get('authorization') || '').trim();
  const userId = (req.headers.get('x-verified-user-id') || '').trim();
  const userRole = (req.headers.get('x-verified-role') || '').trim();

  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (auth) headers.Authorization = auth;
  headers['x-user-id'] = userId;
  headers['x-user-role'] = userRole;
  return headers;
}

async function loadAssetCenter(req: NextRequest, assetId: string): Promise<any> {
  const origin = req.nextUrl.origin;
  const url = `${origin}/api/v1/workspace/assets/${encodeURIComponent(assetId)}/center`;
  const res = await fetch(url, {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`asset_center_fetch_failed:${res.status}:${txt.slice(0, 200)}`);
  }

  return res.json();
}

function demoAssetCenter(assetId: string): any {
  return {
    asset: {
      id: assetId,
      asset_name: 'أصل تجريبي - محطة تحويل جنوب',
      classification: 'substation',
      status: 'active',
      owner_department: 'engineering',
    },
    documents: [
      {
        id: 'demo-doc-1',
        doc_type: 'technical',
        title: 'مخطط التنفيذ النهائي',
        file_url: '/api/engineering/workspace/files/demo-doc-1',
        created_at: '2026-08-01T09:00:00.000Z',
      },
      {
        id: 'demo-doc-2',
        doc_type: 'contract',
        title: 'عقد التوريد والتركيب',
        file_url: '/api/engineering/workspace/files/demo-doc-2',
        created_at: '2026-07-18T11:30:00.000Z',
      },
    ],
    employees: [{ id: 'e-1', employee_name: 'مسؤول التشغيل' }],
    financial_summary: { grand_total: 2750000, currency: 'LYD' },
    doc_counts: { total: 2 },
  };
}

function extractQuestionHint(question: string): string {
  const q = question.trim();
  if (!q) return 'ملخص عام';
  if (q.includes('مال') || q.includes('تكلفة') || q.includes('ميزانية')) return 'محور مالي';
  if (q.includes('مسؤول') || q.includes('موظف')) return 'محور مسؤوليات';
  if (q.includes('عقد') || q.includes('وثيقة') || q.includes('مستند')) return 'محور وثائقي';
  return 'استعلام مخصص';
}

export async function POST(req: NextRequest, { params }: { params: { assetId: string } }) {
  if (!req.headers.get('x-verified-tenant-id')?.trim()) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const assetId = String(params.assetId || '').trim();
    if (!assetId) {
      return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || '').trim();

    const useDemo = req.nextUrl.searchParams.get('demo') === '1' || body?.demo === true;
    const center = useDemo ? demoAssetCenter(assetId) : await loadAssetCenter(req, assetId);
    const brief = buildAssetGroundedBrief({
      assetId,
      asset: center?.asset || {},
      documents: Array.isArray(center?.documents) ? center.documents : [],
      employees: Array.isArray(center?.employees) ? center.employees : [],
      financial_summary: center?.financial_summary || {},
      doc_counts: center?.doc_counts || {},
    });

    return NextResponse.json({
      ok: true,
      mode: 'grounded_asset_brief_v1',
      hint: extractQuestionHint(question),
      question: question || null,
      answer: brief.answer,
      sentences: brief.sentences,
      sources: brief.sources,
      generated_at: brief.generated_at,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'brief_failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: { params: { assetId: string } }) {
  const cloneReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
  });
  return POST(cloneReq, ctx);
}
