/**
 * GET    /api/v1/pic/projects/[id]   — get project + scans + events
 * PUT    /api/v1/pic/projects/[id]   — update project
 * DELETE /api/v1/pic/projects/[id]   — delete project
 * POST   /api/v1/pic/projects/[id]?action=analyze — trigger analysis
 * POST   /api/v1/pic/projects/[id]?action=timeline — get timeline
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractTenantId } from '@/lib/backendProxy';
import { getProject, updateProject, deleteProject, listScans, listEvents, listAlerts } from '@/lib/picDB';
import { analyzeProjectAndPersist, buildTimeline, findScenesForBbox } from '@/lib/pic/analyzer';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const include = req.nextUrl.searchParams.get('include') ?? 'scans,events';

  try {
    const project = await getProject(id, tenantId);
    if (!project) return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });

    const result: any = { ok: true, project };

    if (include.includes('scans')) {
      result.scans = await listScans(id, 200);
    }
    if (include.includes('events')) {
      result.events = await listEvents(id);
    }
    if (include.includes('timeline') && result.scans) {
      result.timeline = buildTimeline(project, result.scans);
    }

    // ── Archive scenes from local Planet cache ────────────────────────────
    if (include.includes('archive') && project.bbox?.length) {
      const dateFrom = req.nextUrl.searchParams.get('date_from') ?? '2016-01-01';
      const dateTo   = req.nextUrl.searchParams.get('date_to')   ?? new Date().toISOString().slice(0, 10);
      const maxCloud = parseInt(req.nextUrl.searchParams.get('max_cloud') ?? '30');
      const rawScenes = findScenesForBbox(project.bbox, dateFrom, dateTo, maxCloud);
      result.archive_scenes = rawScenes.map(s => ({
        uid:           s.scene_uid,
        date:          s.acquisition_date,
        cloud:         s.cloud_cover_pct,
        bbox:          s.scene_bbox,   // real scene footprint for correct map overlay
        project_bbox:  s.bbox,         // project overlap bbox for context
        thumbnail_url: `/api/v1/satellite/planet-thumbnail?scene_id=${s.scene_uid}&use_cache=1`,
      }));
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const project = await updateProject(id, tenantId, body);
    if (!project) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const ok = await deleteProject(id, tenantId);
    if (!ok) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id }    = await ctx.params;
  const action    = req.nextUrl.searchParams.get('action') ?? 'analyze';

  const project = await getProject(id, tenantId);
  if (!project) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  if (action === 'analyze') {
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    try {
      const result = await analyzeProjectAndPersist(project as any, tenantId, {
        dateFrom: body.date_from,
        dateTo:   body.date_to,
        maxCloud: body.max_cloud,
      });

      return NextResponse.json({
        ok:          true,
        project_id:  id,
        scans_added: result.scans_added,
        timeline:    result.timeline,
        alerts:      result.alerts,
        message_ar:  `تم تحليل ${result.scans_added} مشهد جديد للمشروع "${project.name}"`,
      });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  if (action === 'timeline') {
    const scans    = await listScans(id, 500);
    const timeline = buildTimeline(project, scans);
    return NextResponse.json({ ok: true, timeline });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
}
