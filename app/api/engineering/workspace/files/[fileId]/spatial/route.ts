import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const ROOT_DIR = path.join(process.cwd(), '.data', 'asset-documents');
const SPATIAL_DIR = path.join(ROOT_DIR, 'spatial');

export async function GET(
  _req: Request,
  { params }: { params: { fileId: string } }
) {
  try {
    const fileId = String(params.fileId || '').trim();
    if (!fileId) {
      return NextResponse.json({ error: 'file_id_required' }, { status: 400 });
    }

    const spatialPath = path.join(SPATIAL_DIR, `${fileId}.json`);
    if (!fs.existsSync(spatialPath)) {
      return NextResponse.json({ error: 'spatial_not_found' }, { status: 404 });
    }

    const raw = fs.readFileSync(spatialPath, 'utf8');
    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'spatial_invalid_json' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      type: payload?.type || null,
      feature_count: Array.isArray(payload?.features) ? payload.features.length : 0,
      feature_collection: payload,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'spatial_read_failed' }, { status: 500 });
  }
}
