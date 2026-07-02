/**
 * Asset GIS Link API
 * ════════════════════════════════════════════════════════════════
 * Links ERP assets (admin registry) to GIS principal assets (engineering workspace).
 * Storage: .data/asset-gis-links/[tenantCode].json
 *
 * GET  /api/v1/workspace/asset-gis-links?erp_asset_id=X   → links for ERP asset
 * GET  /api/v1/workspace/asset-gis-links?principal_asset_id=X → links for GIS asset
 * GET  /api/v1/workspace/asset-gis-links (no filter) → all links for tenant
 * POST /api/v1/workspace/asset-gis-links → create link
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data', 'asset-gis-links');

export type LinkType =
  | 'physical_location'   // هذا الأصل موجود فعلياً في هذا الموقع الجغرافي
  | 'part_of'             // هذا الأصل جزء من هذا المنشأ
  | 'serves'              // هذا الأصل يخدم هذا المقطع الجغرافي
  | 'overlaps';           // يتداخل مع المنطقة الجغرافية

export interface AssetGisLink {
  id: string;
  erp_asset_id: string;
  erp_asset_name: string;
  principal_asset_id: string;
  principal_asset_name: string;
  link_type: LinkType;
  notes?: string;
  created_at: string;
  created_by?: string;
  tenant_code: string;
}

function getDataFile(tenantCode: string): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, `${tenantCode}.json`);
}

function readLinks(tenantCode: string): AssetGisLink[] {
  try {
    const file = getDataFile(tenantCode);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.links) ? data.links : [];
  } catch {
    return [];
  }
}

function writeLinks(tenantCode: string, links: AssetGisLink[]): void {
  const file = getDataFile(tenantCode);
  fs.writeFileSync(file, JSON.stringify({ links, updated_at: new Date().toISOString() }, null, 2), 'utf8');
}

function getTenantCode(req: NextRequest): string {
  return (
    req.headers.get('x-tenant-code') ||
    req.headers.get('X-Tenant-Code') ||
    new URL(req.url).searchParams.get('tenant_code') ||
    'default'
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantCode = getTenantCode(req);
    const url = new URL(req.url);
    const erpAssetId = url.searchParams.get('erp_asset_id');
    const principalAssetId = url.searchParams.get('principal_asset_id');

    let links = readLinks(tenantCode);

    if (erpAssetId) {
      links = links.filter(l => l.erp_asset_id === erpAssetId);
    } else if (principalAssetId) {
      links = links.filter(l => l.principal_asset_id === principalAssetId);
    }

    return NextResponse.json({ ok: true, links, total: links.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const tenantCode = getTenantCode(req);
    const body = await req.json();

    const { erp_asset_id, erp_asset_name, principal_asset_id, principal_asset_name, link_type, notes, created_by } = body;

    if (!erp_asset_id || !principal_asset_id) {
      return NextResponse.json(
        { ok: false, error: 'erp_asset_id و principal_asset_id مطلوبان' },
        { status: 400 }
      );
    }

    const links = readLinks(tenantCode);

    // Prevent duplicate links
    const exists = links.some(
      l => l.erp_asset_id === String(erp_asset_id) && l.principal_asset_id === String(principal_asset_id)
    );
    if (exists) {
      return NextResponse.json({ ok: false, error: 'هذا الربط موجود بالفعل' }, { status: 409 });
    }

    const newLink: AssetGisLink = {
      id: randomUUID(),
      erp_asset_id: String(erp_asset_id),
      erp_asset_name: erp_asset_name || `أصل #${erp_asset_id}`,
      principal_asset_id: String(principal_asset_id),
      principal_asset_name: principal_asset_name || `أصل هندسي`,
      link_type: link_type || 'physical_location',
      notes: notes || '',
      created_at: new Date().toISOString(),
      created_by: created_by || '',
      tenant_code: tenantCode,
    };

    links.push(newLink);
    writeLinks(tenantCode, links);

    return NextResponse.json({ ok: true, link: newLink }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
