/**
 * POST /api/v1/workspace/linear-assets/batch-place
 * ════════════════════════════════════════════════════════════════
 * Receives:
 *   - csvText: string         (CSV with equipment_code, name, type, distance_from_prev)
 *   - lineCoords: [lon,lat][] (GeoJSON LineString coordinates of the pipeline)
 *   - principalAssetId?: string  (optional GIS principal asset to auto-link all placed assets)
 *   - principalAssetName?: string
 *   - anchorIntervalMeters?: number  (default 500)
 *
 * Returns:
 *   - assets: fully placed LinearAsset[] with lat/lng
 *   - anchors: auto-extracted anchor points
 *   - assetGisLinks: created links (if principalAssetId provided)
 *   - stats: { total, placed, failed, warnings }
 *
 * Storage:
 *   - .data/linear-assets/[tenantCode].json   (the placed assets)
 *   - .data/asset-gis-links/[tenantCode].json (the GIS links, if principal provided)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { batchPlaceAssetsOnPolyline } from '@/lib/linear-referencing/engine';
import type { LinearAsset } from '@/lib/linear-referencing/types';

const LINEAR_DIR = path.join(process.cwd(), '.data', 'linear-assets');
const LINKS_DIR  = path.join(process.cwd(), '.data', 'asset-gis-links');

function getTenantCode(req: NextRequest): string {
  return (
    req.headers.get('x-tenant-code') ||
    req.headers.get('X-Tenant-Code') ||
    new URL(req.url).searchParams.get('tenant_code') ||
    'default'
  );
}

function readJson<T>(dir: string, file: string, defaultVal: T): T {
  try {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) return defaultVal;
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as T;
  } catch { return defaultVal; }
}

function writeJson(dir: string, file: string, data: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2), 'utf8');
}

export async function POST(req: NextRequest) {
  try {
    const tenantCode = getTenantCode(req);
    const body = await req.json();

    const {
      csvText,
      lineCoords,
      principalAssetId,
      principalAssetName,
      anchorIntervalMeters = 500,
      linkType = 'part_of',
    } = body as {
      csvText: string;
      lineCoords: [number, number][];
      principalAssetId?: string;
      principalAssetName?: string;
      anchorIntervalMeters?: number;
      linkType?: string;
    };

    // ── Validate ───────────────────────────────────────────────────────────────
    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ ok: false, error: 'csvText مطلوب' }, { status: 400 });
    }
    if (!Array.isArray(lineCoords) || lineCoords.length < 2) {
      return NextResponse.json({ ok: false, error: 'lineCoords يجب أن يكون مصفوفة من نقطتين على الأقل' }, { status: 400 });
    }

    // ── Run LRS engine ─────────────────────────────────────────────────────────
    const { assets, anchors, stats } = batchPlaceAssetsOnPolyline(
      csvText,
      lineCoords,
      anchorIntervalMeters,
    );

    // ── Persist assets ─────────────────────────────────────────────────────────
    const existing = readJson<{ assets: LinearAsset[] }>(LINEAR_DIR, `${tenantCode}.json`, { assets: [] });
    const existingIds = new Set(existing.assets.map((a: LinearAsset) => a.equipment_code));

    // Merge: update if exists, append if new
    const merged = [...existing.assets];
    let added = 0, updated = 0;
    for (const asset of assets) {
      const idx = merged.findIndex((a: LinearAsset) => a.equipment_code === asset.equipment_code);
      if (idx !== -1) {
        merged[idx] = { ...merged[idx], ...asset, updated_at: new Date().toISOString() };
        updated++;
      } else {
        merged.push({ ...asset, id: asset.id || randomUUID() });
        added++;
      }
    }

    writeJson(LINEAR_DIR, `${tenantCode}.json`, {
      assets: merged,
      last_batch_at: new Date().toISOString(),
      total: merged.length,
    });

    // ── Auto-create GIS links if principalAssetId provided ────────────────────
    let linksCreated = 0;
    if (principalAssetId) {
      const linksData = readJson<{ links: unknown[] }>(LINKS_DIR, `${tenantCode}.json`, { links: [] });
      const existingLinks = linksData.links as { erp_asset_id: string; principal_asset_id: string }[];
      const existingLinkKeys = new Set(existingLinks.map(l => `${l.erp_asset_id}::${l.principal_asset_id}`));

      const newLinks = assets
        .filter(a => !existingLinkKeys.has(`${a.equipment_code}::${principalAssetId}`))
        .map(a => ({
          id: randomUUID(),
          erp_asset_id: a.equipment_code,
          erp_asset_name: a.name,
          principal_asset_id: principalAssetId,
          principal_asset_name: principalAssetName || principalAssetId,
          link_type: linkType,
          notes: `لسم تلقائي — station: ${a.station}m`,
          created_at: new Date().toISOString(),
          created_by: 'lrs-batch-import',
          tenant_code: tenantCode,
        }));

      if (newLinks.length > 0) {
        writeJson(LINKS_DIR, `${tenantCode}.json`, {
          links: [...existingLinks, ...newLinks],
          updated_at: new Date().toISOString(),
        });
        linksCreated = newLinks.length;
      }
    }

    // ── Return summary ─────────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      stats: {
        ...stats,
        db_added: added,
        db_updated: updated,
        gis_links_created: linksCreated,
      },
      anchors_extracted: anchors.length,
      anchor_interval_m: anchorIntervalMeters,
      // Return first 10 placed assets as preview
      preview: assets.slice(0, 10).map(a => ({
        equipment_code: a.equipment_code,
        name: a.name,
        station_m: a.station,
        lat: a.latitude,
        lng: a.longitude,
        placed: a.latitude !== null,
      })),
    }, { status: 201 });

  } catch (e: any) {
    console.error('[batch-place] error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── GET: list all placed linear assets for tenant ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantCode = getTenantCode(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const data = readJson<{ assets: LinearAsset[]; total?: number }>(
      LINEAR_DIR, `${tenantCode}.json`, { assets: [] }
    );

    const assets = data.assets || [];
    const slice = assets.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      total: assets.length,
      limit,
      offset,
      assets: slice,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
