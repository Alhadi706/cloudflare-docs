/**
 * GET  /api/v1/satellite/planet-archive        — قائمة المشاهد المؤرشفة
 * POST /api/v1/satellite/planet-archive        — أرشفة مشاهد جديدة لمنطقة
 * DELETE /api/v1/satellite/planet-archive?id=  — حذف مشهد من الأرشيف
 *
 * الأرشيف يُخزَّن في .data/planet-archive/
 * - metadata/{scene_id}.json  — بيانات المشهد
 * - thumbnails/{scene_id}.png — صورة مصغّرة (256×256)
 *
 * عند انتهاء اشتراك Planet، يعمل النظام من الأرشيف المحلي تلقائياً.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';

const ARCHIVE_DIR   = path.join(process.cwd(), '.data', 'planet-archive');
const META_DIR      = path.join(ARCHIVE_DIR, 'metadata');
const THUMB_DIR     = path.join(ARCHIVE_DIR, 'thumbnails');
const PLANET_BASE   = 'https://api.planet.com/data/v1';

function ensureDirs() {
  fs.mkdirSync(META_DIR,  { recursive: true });
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

function planetAuth() {
  const key = process.env.PLANET_API_KEY ?? '';
  if (!key) return null;
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

function listArchived(): any[] {
  try {
    ensureDirs();
    return fs.readdirSync(META_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(META_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.acquisition_date?.localeCompare(a.acquisition_date));
  } catch { return []; }
}

// ── GET — list archived scenes ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url        = req.nextUrl;
  const areaFilter = url.searchParams.get('area');

  let scenes = listArchived();

  if (areaFilter) {
    scenes = scenes.filter(s => s.area_key === areaFilter);
  }

  const byArea: Record<string, number> = {};
  scenes.forEach(s => {
    byArea[s.area_key ?? 'unknown'] = (byArea[s.area_key ?? 'unknown'] ?? 0) + 1;
  });

  return NextResponse.json({
    ok:             true,
    total:          scenes.length,
    storage_mb:     Math.round(getDirSizeMB(ARCHIVE_DIR) * 100) / 100,
    areas:          byArea,
    scenes:         scenes.map(s => ({
      ...s,
      thumbnail_local: `/api/v1/satellite/planet-thumbnail?scene_id=${s.scene_uid}&use_cache=1`,
    })),
  });
}

function getDirSizeMB(dir: string): number {
  try {
    let total = 0;
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) total += getDirSizeMB(fp);
        else total += stat.size;
      } catch { /* skip */ }
    }
    return total / (1024 * 1024);
  } catch { return 0; }
}

// ── POST — archive scenes for an area ────────────────────────────────────────
export async function POST(req: NextRequest) {
  ensureDirs();
  const auth = planetAuth();

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    bbox,
    area_key     = 'custom',
    date_from    = '2026-01-01',
    date_to      = new Date().toISOString().slice(0, 10),
    max_cloud    = 0.3,
    limit        = 50,
    item_types   = ['PSScene'],
    skip_existing = true,
  } = body;

  if (!bbox || bbox.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bbox مطلوب' }, { status: 400 });
  }

  // ── If no auth, still return what's already cached ──────────────────────
  if (!auth) {
    const cached = listArchived().filter(s => s.area_key === area_key);
    return NextResponse.json({
      ok:      true,
      mode:    'cache_only',
      message: 'PLANET_API_KEY غير مضبوط — يتم تقديم المشاهد المؤرشفة فقط',
      archived: cached.length,
      scenes:   cached,
    });
  }

  // ── Search Planet for scenes ─────────────────────────────────────────────
  const searchBody = {
    item_types,
    limit,
    filter: {
      type: 'AndFilter',
      config: [
        { type: 'GeometryFilter', field_name: 'geometry',
          config: { type: 'Polygon', coordinates: [[[bbox[0],bbox[1]],[bbox[2],bbox[1]],[bbox[2],bbox[3]],[bbox[0],bbox[3]],[bbox[0],bbox[1]]]] } },
        { type: 'DateRangeFilter', field_name: 'acquired',
          config: { gte: `${date_from}T00:00:00Z`, lte: `${date_to}T23:59:59Z` } },
        { type: 'RangeFilter', field_name: 'cloud_cover', config: { lte: max_cloud } },
      ],
    },
  };

  const searchRes = await fetch(`${PLANET_BASE}/quick-search`, {
    method:  'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body:    JSON.stringify(searchBody),
    signal:  AbortSignal.timeout(20_000),
  });

  if (!searchRes.ok) {
    return NextResponse.json({ ok: false, error: `Planet search failed: ${searchRes.status}` }, { status: searchRes.status });
  }

  const searchData = await searchRes.json();
  const features: any[] = searchData.features ?? [];

  if (!features.length) {
    return NextResponse.json({
      ok:      true,
      message: 'لا توجد مشاهد متاحة لهذه المنطقة والفترة الزمنية',
      archived: 0,
    });
  }

  // ── Download and save each scene ─────────────────────────────────────────
  let archived = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const f of features) {
    const sceneId  = f.id;
    const p        = f.properties ?? {};
    const itemType = p.item_type ?? 'PSScene';
    const metaPath = path.join(META_DIR,  `${sceneId}.json`);
    const thumbPath = path.join(THUMB_DIR, `${sceneId}.png`);

    // Skip if already archived
    if (skip_existing && fs.existsSync(metaPath) && fs.existsSync(thumbPath)) {
      skipped++;
      continue;
    }

    // Save metadata
    const meta = {
      scene_uid:          sceneId,
      area_key,
      acquisition_date:   p.acquired?.slice(0, 10) ?? '',
      acquisition_time:   p.acquired?.slice(11, 16) ?? '',
      cloud_cover_pct:    Math.round((p.cloud_cover ?? 0) * 100),
      satellite_id:       p.satellite_id ?? '',
      pixel_resolution_m: p.pixel_resolution ?? 3,
      item_type:          itemType,
      bbox,
      geometry:           f.geometry,
      source:             'PlanetScope',
      archived_at:        new Date().toISOString(),
      data_is_real:       true,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    // Download thumbnail
    if (!fs.existsSync(thumbPath)) {
      try {
        const thumbUrl = `https://tiles.planet.com/data/v1/item-types/${itemType}/items/${sceneId}/thumb`;
        const thumbRes = await fetch(thumbUrl, {
          headers: { Authorization: auth },
          signal:  AbortSignal.timeout(15_000),
        });
        if (thumbRes.ok) {
          const buf = await thumbRes.arrayBuffer();
          fs.writeFileSync(thumbPath, Buffer.from(buf));
        }
      } catch (e: any) {
        errors.push(`thumb_${sceneId}: ${e.message}`);
      }
    }

    archived++;
  }

  const totalArchived = listArchived().filter(s => s.area_key === area_key).length;

  return NextResponse.json({
    ok:             true,
    area_key,
    newly_archived: archived,
    skipped,
    total_in_area:  totalArchived,
    errors:         errors.length > 0 ? errors.slice(0, 5) : undefined,
    storage_mb:     Math.round(getDirSizeMB(ARCHIVE_DIR) * 100) / 100,
    message:        `✅ تمت أرشفة ${archived} مشهد جديد (${skipped} موجود مسبقاً) — إجمالي: ${totalArchived} مشهد`,
  }, { status: 201 });
}

// ── DELETE — remove a scene from archive ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const sceneId = req.nextUrl.searchParams.get('id');
  if (!sceneId) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  try {
    const metaPath  = path.join(META_DIR,  `${sceneId}.json`);
    const thumbPath = path.join(THUMB_DIR, `${sceneId}.png`);
    if (fs.existsSync(metaPath))  fs.unlinkSync(metaPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    return NextResponse.json({ ok: true, deleted: sceneId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
