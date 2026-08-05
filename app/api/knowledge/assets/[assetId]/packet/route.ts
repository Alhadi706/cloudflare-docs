import { NextRequest, NextResponse } from 'next/server';
import { buildAttachmentPacket } from '@/lib/knowledge/asset-grounded';

export const runtime = 'nodejs';

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = (req.headers.get('x-tenant-id') || req.headers.get('X-Tenant-ID') || '').trim();
  const auth = (req.headers.get('authorization') || '').trim();
  const userId = (req.headers.get('x-user-id') || 'system').trim();
  const userRole = (req.headers.get('x-user-role') || 'viewer').trim();

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
    employees: [],
    financial_summary: { grand_total: 2750000, currency: 'LYD' },
    doc_counts: { total: 2 },
  };
}

export async function GET(req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const assetId = String(params.assetId || '').trim();
    if (!assetId) {
      return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });
    }

    const useDemo = req.nextUrl.searchParams.get('demo') === '1';
    const center = useDemo ? demoAssetCenter(assetId) : await loadAssetCenter(req, assetId);
    const packet = buildAttachmentPacket({
      assetId,
      asset: center?.asset || {},
      documents: Array.isArray(center?.documents) ? center.documents : [],
      employees: Array.isArray(center?.employees) ? center.employees : [],
      financial_summary: center?.financial_summary || {},
      doc_counts: center?.doc_counts || {},
    });

    if (req.nextUrl.searchParams.get('download') === '1') {
      return new NextResponse(packet.checklist_text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="asset-${encodeURIComponent(assetId)}-attachments.txt"`,
        },
      });
    }

    return NextResponse.json({ ok: true, ...packet });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'packet_failed' }, { status: 500 });
  }
}
