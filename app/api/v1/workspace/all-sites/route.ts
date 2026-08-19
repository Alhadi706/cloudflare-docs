/**
 * GET /api/v1/workspace/all-sites
 * ════════════════════════════════════════════════════════════════
 * Phase 2 — Sites Management (Canonical Asset Architecture)
 *
 * Aggregates ALL sites across ALL accessible projects for the tenant.
 * Returns a flat list so the Asset Registry can show a sites dropdown.
 *
 * Backend model: sites are sub-entities of projects.
 * This endpoint hides that nested structure from the UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

export interface SiteItem {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  code: string | null;
  site_type: string;
  status: string;
}

export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });
  }

  const headers = buildBackendHeaders(tenantId, {
    'X-User-Role': req.headers.get('x-verified-role') || '',
  });

  try {
    // Step 1: get all projects
    const projRes = await fetch(
      `${BACKEND}/api/v1/workspace/projects?tenant_id=${tenantId}&limit=200`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!projRes.ok) {
      return NextResponse.json({ sites: [], total: 0, error: 'فشل جلب المشاريع' });
    }
    const projRaw = await projRes.json();
    const projects: Array<{ id: number; project_name?: string; name?: string }> =
      Array.isArray(projRaw) ? projRaw : (projRaw.projects ?? []);

    // Step 2: fetch sites for each project (in parallel, max 20 concurrent)
    const CHUNK = 20;
    const allSites: SiteItem[] = [];

    for (let i = 0; i < projects.length; i += CHUNK) {
      const chunk = projects.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async (proj) => {
          const sr = await fetch(
            `${BACKEND}/api/v1/workspace/projects/${proj.id}/sites?tenant_id=${tenantId}`,
            { headers, signal: AbortSignal.timeout(8_000) },
          );
          if (!sr.ok) return [];
          const raw = await sr.json();
          const list: Array<{ id: number; name: string; code?: string | null; site_type?: string; status?: string }> =
            Array.isArray(raw) ? raw : (raw.sites ?? raw.items ?? []);
          return list.map((s) => ({
            id: s.id,
            project_id: proj.id,
            project_name: proj.project_name || proj.name || `مشروع #${proj.id}`,
            name: s.name,
            code: s.code ?? null,
            site_type: s.site_type ?? 'operational',
            status: s.status ?? 'active',
          } as SiteItem));
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allSites.push(...r.value);
      }
    }

    return NextResponse.json({
      sites: allSites,
      total: allSites.length,
      projects_count: projects.length,
    });
  } catch (e: any) {
    return NextResponse.json({ sites: [], total: 0, error: e.message }, { status: 500 });
  }
}
