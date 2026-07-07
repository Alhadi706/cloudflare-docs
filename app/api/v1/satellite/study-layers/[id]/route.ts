/**
 * GET    /api/v1/satellite/study-layers/[id]           — تفاصيل الطبقة مع الميزات
 * PUT    /api/v1/satellite/study-layers/[id]           — تحديث اسم / لون
 * DELETE /api/v1/satellite/study-layers/[id]           — حذف الطبقة
 * POST   /api/v1/satellite/study-layers/[id]?add=feature  — إضافة ميزة رسم
 * DELETE /api/v1/satellite/study-layers/[id]?fid=XXX  — حذف ميزة
 */
import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data', 'study-layers');

interface StudyLayerFeature {
  id:         string;
  name:       string;
  type:       'polygon' | 'line' | 'point';
  geometry:   any;
  created_at: string;
  analysis_result?: any;
}

interface StudyLayer {
  id:          string;
  name:        string;
  color:       string;
  description: string;
  created_at:  string;
  updated_at:  string;
  features:    StudyLayerFeature[];
}

function layerFile(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

function loadLayer(id: string): StudyLayer | null {
  try {
    const f = layerFile(id);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return null; }
}

function saveLayer(layer: StudyLayer) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(layerFile(layer.id), JSON.stringify(layer, null, 2));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const layer = loadLayer(params.id);
  if (!layer) {
    return NextResponse.json({ ok: false, error: 'Layer not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, layer });
}

// ── PUT — update name / color / description ───────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const layer = loadLayer(params.id);
  if (!layer) {
    return NextResponse.json({ ok: false, error: 'Layer not found' }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  if (body.name !== undefined) layer.name        = String(body.name).trim() || layer.name;
  if (body.color !== undefined) layer.color       = String(body.color);
  if (body.description !== undefined) layer.description = String(body.description);
  layer.updated_at = new Date().toISOString();

  saveLayer(layer);
  return NextResponse.json({ ok: true, layer });
}

// ── DELETE — delete entire layer OR single feature ───────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const fid = url.searchParams.get('fid');

  const layer = loadLayer(params.id);
  if (!layer) {
    return NextResponse.json({ ok: false, error: 'Layer not found' }, { status: 404 });
  }

  if (fid) {
    // Delete a single feature
    const before = layer.features.length;
    layer.features = layer.features.filter(f => f.id !== fid);
    if (layer.features.length === before) {
      return NextResponse.json({ ok: false, error: 'Feature not found' }, { status: 404 });
    }
    layer.updated_at = new Date().toISOString();
    saveLayer(layer);
    return NextResponse.json({ ok: true, deleted_feature: fid, feature_count: layer.features.length });
  }

  // Delete entire layer
  try {
    fs.unlinkSync(layerFile(params.id));
  } catch { /* already gone */ }

  return NextResponse.json({ ok: true, deleted_layer: params.id });
}

// ── POST — add a feature ──────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const layer = loadLayer(params.id);
  if (!layer) {
    return NextResponse.json({ ok: false, error: 'Layer not found' }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const geometry = body.geometry;
  if (!geometry || !geometry.type) {
    return NextResponse.json({ ok: false, error: 'geometry is required' }, { status: 400 });
  }

  // Determine feature type
  const gt = (geometry.type as string).toLowerCase();
  const ftype: StudyLayerFeature['type'] =
    gt.includes('polygon') ? 'polygon' :
    gt.includes('line')    ? 'line' :
    'point';

  const feature: StudyLayerFeature = {
    id:         randomUUID(),
    name:       body.name ?? `${ftype === 'polygon' ? 'منطقة' : ftype === 'line' ? 'مسار' : 'نقطة'} ${layer.features.length + 1}`,
    type:       ftype,
    geometry,
    created_at: new Date().toISOString(),
  };

  if (body.analysis_result) {
    feature.analysis_result = body.analysis_result;
  }

  layer.features.push(feature);
  layer.updated_at = new Date().toISOString();
  saveLayer(layer);

  return NextResponse.json({
    ok:            true,
    feature,
    feature_count: layer.features.length,
  }, { status: 201 });
}
