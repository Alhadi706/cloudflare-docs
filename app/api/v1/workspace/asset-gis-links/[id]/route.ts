/**
 * DELETE /api/v1/workspace/asset-gis-links/[id]
 * Removes a specific GIS link by ID.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { AssetGisLink } from '../route';

const DATA_DIR = path.join(process.cwd(), '.data', 'asset-gis-links');

function getTenantCode(req: NextRequest): string {
  return (
    req.headers.get('x-tenant-code') ||
    req.headers.get('X-Tenant-Code') ||
    new URL(req.url).searchParams.get('tenant_code') ||
    'default'
  );
}

function getDataFile(tenantCode: string): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, `${tenantCode}.json`);
}

function readLinks(tenantCode: string): AssetGisLink[] {
  try {
    const file = getDataFile(tenantCode);
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data.links) ? data.links : [];
  } catch { return []; }
}

function writeLinks(tenantCode: string, links: AssetGisLink[]): void {
  const file = getDataFile(tenantCode);
  fs.writeFileSync(file, JSON.stringify({ links, updated_at: new Date().toISOString() }, null, 2), 'utf8');
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantCode = getTenantCode(req);
    const links = readLinks(tenantCode);
    const idx = links.findIndex(l => l.id === params.id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: 'الربط غير موجود' }, { status: 404 });
    }
    links.splice(idx, 1);
    writeLinks(tenantCode, links);
    return NextResponse.json({ ok: true, message: 'تم حذف الربط' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
