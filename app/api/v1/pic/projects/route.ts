/**
 * GET  /api/v1/pic/projects   — list projects
 * POST /api/v1/pic/projects   — create project
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractTenantId } from '@/lib/backendProxy';
import { listProjects, createProject } from '@/lib/picDB';

export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const url    = req.nextUrl;
  const status = url.searchParams.get('status') ?? undefined;
  const type   = url.searchParams.get('type')   ?? undefined;
  const limit  = parseInt(url.searchParams.get('limit') ?? '200');

  try {
    const projects = await listProjects(tenantId, { status, type, limit });
    return NextResponse.json({ ok: true, projects, total: projects.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.name) return NextResponse.json({ ok: false, error: 'name مطلوب' }, { status: 400 });
  if (!body.geometry_json) return NextResponse.json({ ok: false, error: 'geometry_json مطلوب' }, { status: 400 });

  // Compute bbox from geometry
  if (!body.bbox && body.geometry_json) {
    const coords = extractCoords(body.geometry_json);
    if (coords.length > 0) {
      body.bbox = [
        Math.min(...coords.map((c: number[]) => c[0])),
        Math.min(...coords.map((c: number[]) => c[1])),
        Math.max(...coords.map((c: number[]) => c[0])),
        Math.max(...coords.map((c: number[]) => c[1])),
      ];
    }
  }

  try {
    const project = await createProject(tenantId, body);
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function extractCoords(geometry: any): number[][] {
  if (!geometry) return [];
  if (geometry.type === 'Point')           return [geometry.coordinates];
  if (geometry.type === 'LineString')      return geometry.coordinates;
  if (geometry.type === 'Polygon')         return geometry.coordinates.flat();
  if (geometry.type === 'MultiPolygon')    return geometry.coordinates.flat(2);
  return [];
}
