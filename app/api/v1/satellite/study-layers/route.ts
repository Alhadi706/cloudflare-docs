/**
 * GET  /api/v1/satellite/study-layers    — قائمة الطبقات
 * POST /api/v1/satellite/study-layers    — إنشاء طبقة جديدة
 *
 * طبقات الدراسة الخاصة بإدارة الاستشعار عن بعد.
 * مخزنة في .data/study-layers/ بشكل ملفات JSON.
 * مخفية عن بقية الإدارات — مرئية فقط في مركز الاستخبارات الفضائية.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data', 'study-layers');

export interface StudyLayerFeature {
  id:         string;
  name:       string;
  type:       'polygon' | 'line' | 'point';
  geometry:   any;           // GeoJSON geometry
  created_at: string;
  analysis_result?: any;
}

export interface StudyLayer {
  id:            string;
  name:          string;
  color:         string;
  description:   string;
  created_at:    string;
  updated_at:    string;
  features:      StudyLayerFeature[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

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

function listLayers(): StudyLayer[] {
  try {
    if (!fs.existsSync(DATA_DIR)) return [];
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a: StudyLayer, b: StudyLayer) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  } catch { return []; }
}

// Palette for auto-assigning colors
const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const layers = listLayers();
  return NextResponse.json({
    ok:     true,
    layers: layers.map(l => ({
      id:            l.id,
      name:          l.name,
      color:         l.color,
      description:   l.description,
      created_at:    l.created_at,
      updated_at:    l.updated_at,
      feature_count: (l.features ?? []).length,
    })),
    total: layers.length,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  // Auto-assign color from palette based on existing layer count
  const existing = listLayers();
  const color = body.color ?? COLOR_PALETTE[existing.length % COLOR_PALETTE.length];

  const now = new Date().toISOString();
  const layer: StudyLayer = {
    id:          randomUUID(),
    name,
    color,
    description: body.description ?? '',
    created_at:  now,
    updated_at:  now,
    features:    [],
  };

  saveLayer(layer);

  return NextResponse.json({
    ok:    true,
    layer: {
      id:            layer.id,
      name:          layer.name,
      color:         layer.color,
      description:   layer.description,
      created_at:    layer.created_at,
      updated_at:    layer.updated_at,
      feature_count: 0,
    },
  }, { status: 201 });
}
