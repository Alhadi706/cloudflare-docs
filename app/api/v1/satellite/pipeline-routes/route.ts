/**
 * GET/POST /api/v1/satellite/pipeline-routes
 * إدارة مسارات خطوط الأنابيب المرسومة يدوياً
 *
 * يتيح حفظ وتحميل نقاط طريق دقيقة لمسارات النهر الصناعي وخطوط النفط
 * النقاط المحفوظة تُستخدم في كشف التسريبات بدلاً من النقاط الافتراضية
 */
import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'pipeline-routes');

interface PipelineRoute {
  id:          string;
  name:        string;
  name_en:     string;
  type:        'gmmr_west' | 'gmmr_east' | 'oil_pipeline' | 'custom';
  color:       string;
  waypoints:   [number, number][];   // [lon, lat][]
  buffer_m:    number;               // buffer width in meters for analysis
  created_at:  string;
  updated_at:  string;
  source:      'manual' | 'overpass' | 'import';
  description?: string;
  total_km?:   number;
}

// Default GMMR routes (shown when no custom route exists)
const DEFAULT_ROUTES: PipelineRoute[] = [
  {
    id:          'gmmr_west_default',
    name:        'النهر الصناعي — الفرع الغربي (افتراضي)',
    name_en:     'GMMR Western Branch (default)',
    type:        'gmmr_west',
    color:       '#38bdf8',
    buffer_m:    500,
    source:      'manual',
    created_at:  '2026-01-01T00:00:00Z',
    updated_at:  '2026-01-01T00:00:00Z',
    description: 'مسار تقريبي — يمكن تحسينه بالرسم اليدوي',
    total_km:    1100,
    waypoints: [
      [14.35, 27.25], [14.40, 27.65], [14.35, 28.05], [14.28, 28.55],
      [14.25, 29.05], [14.27, 29.55], [14.27, 30.08], [14.15, 30.50],
      [14.00, 30.95], [13.92, 31.20], [13.97, 31.60], [13.97, 31.78],
      [13.70, 31.90], [13.52, 31.92], [13.25, 32.05], [13.01, 32.17],
      [13.08, 32.42], [13.12, 32.55], [13.15, 32.72], [13.18, 32.90],
    ],
  },
  {
    id:          'gmmr_east_default',
    name:        'النهر الصناعي — الفرع الشرقي (افتراضي)',
    name_en:     'GMMR Eastern Branch (default)',
    type:        'gmmr_east',
    color:       '#34d399',
    buffer_m:    500,
    source:      'manual',
    created_at:  '2026-01-01T00:00:00Z',
    updated_at:  '2026-01-01T00:00:00Z',
    description: 'مسار تقريبي',
    total_km:    1600,
    waypoints: [
      [23.30, 24.20], [22.50, 24.85], [21.58, 25.75], [21.10, 26.60],
      [20.95, 27.40], [20.40, 28.10], [20.13, 29.02], [20.07, 30.05],
      [20.07, 32.11],
    ],
  },
];

function routeFile(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

function loadRoute(id: string): PipelineRoute | null {
  try {
    const f = routeFile(id);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return null; }
}

function saveRoute(route: PipelineRoute) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(routeFile(route.id), JSON.stringify(route, null, 2));
}

function listRoutes(): PipelineRoute[] {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));
  } catch { return []; }
}

function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[1]-a[1])*Math.PI/180;
  const dLon = (b[0]-a[0])*Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function calcTotalKm(waypoints: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += distKm(waypoints[i], waypoints[i+1]);
  }
  return Math.round(total);
}

// GET — list all routes (saved custom + defaults for missing types)
export async function GET(_req: NextRequest) {
  const saved = listRoutes();
  const savedTypes = new Set(saved.map(r => r.type));

  // Fill missing types from defaults
  const defaults = DEFAULT_ROUTES.filter(d => !savedTypes.has(d.type));
  const all = [...saved, ...defaults];

  return NextResponse.json({
    ok: true,
    routes: all.map(r => ({
      ...r,
      waypoints_count: r.waypoints.length,
      is_default: !saved.find(s => s.id === r.id),
    })),
    total: all.length,
  });
}

// POST — save a new or updated route
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const { id, name, type, waypoints, buffer_m, color, description } = body;

  if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json({ ok: false, error: 'waypoints مطلوب (مصفوفة ≥2 نقطة)' }, { status: 400 });
  }
  if (!type || !['gmmr_west','gmmr_east','oil_pipeline','custom'].includes(type)) {
    return NextResponse.json({ ok: false, error: 'type غير صالح' }, { status: 400 });
  }

  const now    = new Date().toISOString();
  const routeId = id || `${type}_${Date.now()}`;

  const existing = loadRoute(routeId);
  const route: PipelineRoute = {
    id:          routeId,
    name:        name || existing?.name || `مسار ${type}`,
    name_en:     body.name_en || existing?.name_en || routeId,
    type:        type as PipelineRoute['type'],
    color:       color || existing?.color || '#38bdf8',
    buffer_m:    buffer_m ?? existing?.buffer_m ?? 500,
    waypoints:   waypoints as [number, number][],
    source:      'manual',
    created_at:  existing?.created_at ?? now,
    updated_at:  now,
    description: description || existing?.description,
    total_km:    calcTotalKm(waypoints as [number, number][]),
  };

  saveRoute(route);

  return NextResponse.json({
    ok:          true,
    route_id:    route.id,
    waypoints_count: route.waypoints.length,
    total_km:    route.total_km,
    message:     `تم حفظ المسار "${route.name}" — ${route.waypoints.length} نقطة، ${route.total_km} كم`,
  });
}

// DELETE — remove a custom route (reverts to default)
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'id مطلوب' }, { status: 400 });

  const f = routeFile(id);
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    return NextResponse.json({ ok: true, message: 'تم الحذف — سيُستخدم المسار الافتراضي' });
  }
  return NextResponse.json({ ok: false, error: 'المسار غير موجود' }, { status: 404 });
}
