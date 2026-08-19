import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

const ROOT_DIR = path.join(process.cwd(), '.data', 'asset-documents');
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const SPATIAL_DIR = path.join(ROOT_DIR, 'spatial');
const INDEX_FILE = path.join(ROOT_DIR, 'index.json');

type StoredFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  contentHash?: string;
  docType: string;
  uploadedAt: string;
};

function ensureDirs(): void {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.mkdirSync(SPATIAL_DIR, { recursive: true });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'file';
}

function readIndex(): Record<string, StoredFileRecord> {
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, StoredFileRecord>): void {
  ensureDirs();
  const tmp = `${INDEX_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tmp, INDEX_FILE);
}

function findExistingByContent(index: Record<string, StoredFileRecord>, hash: string, size: number): StoredFileRecord | null {
  const rows = Object.values(index);
  for (const row of rows) {
    if (!row) continue;
    if (row.contentHash !== hash) continue;
    if (Number(row.size || 0) !== Number(size || 0)) continue;
    const absPath = path.join(BIN_DIR, row.storedName || '');
    if (row.storedName && fs.existsSync(absPath)) return row;
  }
  return null;
}

function normalizeGeoJsonToFeatureCollection(input: any): { type: 'FeatureCollection'; features: any[] } | null {
  if (!input || typeof input !== 'object') return null;
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    return { type: 'FeatureCollection', features: input.features };
  }
  if (input.type === 'Feature' && input.geometry) {
    return { type: 'FeatureCollection', features: [input] };
  }
  if (typeof input.type === 'string' && Array.isArray(input.coordinates)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: input }],
    };
  }
  return null;
}

function parseKmlToFeatureCollection(xml: string): { type: 'FeatureCollection'; features: any[] } | null {
  const coordTags = [...xml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
  if (!coordTags.length) return null;

  const features: any[] = [];
  for (const tag of coordTags) {
    const raw = String(tag[1] || '').trim();
    if (!raw) continue;
    const tuples = raw
      .split(/\s+/)
      .map((entry) => entry.split(',').map((x) => Number(x)))
      .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
      .map((parts) => [parts[0], parts[1]]);

    if (tuples.length === 1) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: tuples[0] },
      });
      continue;
    }

    const first = tuples[0];
    const last = tuples[tuples.length - 1];
    const closed = tuples.length >= 4 && first[0] === last[0] && first[1] === last[1];
    if (closed) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [tuples] },
      });
    } else {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: tuples },
      });
    }
  }

  return features.length ? { type: 'FeatureCollection', features } : null;
}

function detectSpatialFeatureCollection(fileName: string, mimeType: string, data: Buffer): { type: 'FeatureCollection'; features: any[] } | null {
  const lowerName = fileName.toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  const text = data.toString('utf8');

  const looksLikeGeoJson =
    lowerName.endsWith('.geojson') ||
    lowerName.endsWith('.json') ||
    lowerMime.includes('geo+json') ||
    lowerMime.includes('application/json');

  if (looksLikeGeoJson) {
    try {
      const parsed = JSON.parse(text);
      const fc = normalizeGeoJsonToFeatureCollection(parsed);
      if (fc) return fc;
    } catch {
      // continue to next parser
    }
  }

  const looksLikeKml =
    lowerName.endsWith('.kml') ||
    lowerMime.includes('application/vnd.google-earth.kml+xml') ||
    text.includes('<kml') ||
    text.includes('<Placemark');
  if (looksLikeKml) {
    return parseKmlToFeatureCollection(text);
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const requestedDocType = String(form.get('docType') || 'other').trim().toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const maxBytes = 30 * 1024 * 1024;
    if (file.size <= 0) {
      return NextResponse.json({ error: 'empty file' }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'file too large (max 30MB)' }, { status: 413 });
    }

    ensureDirs();

    const id = randomUUID();
    const safeName = sanitizeName(file.name);
    const storedName = `${id}__${safeName}`;
    const absPath = path.join(BIN_DIR, storedName);

    const bytes = Buffer.from(await file.arrayBuffer());

    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const index = readIndex();
    const existing = findExistingByContent(index, contentHash, file.size);
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        fileId: existing.id,
        fileName: existing.originalName,
        fileSize: existing.size,
        mimeType: existing.mimeType,
        docType: requestedDocType || existing.docType || 'other',
        fileUrl: `/api/engineering/workspace/files/${existing.id}`,
        spatialAvailable: fs.existsSync(path.join(SPATIAL_DIR, `${existing.id}.json`)),
        spatialFeatureCount: 0,
        spatialUrl: fs.existsSync(path.join(SPATIAL_DIR, `${existing.id}.json`)) ? `/api/engineering/workspace/files/${existing.id}/spatial` : null,
      });
    }

    fs.writeFileSync(absPath, bytes);

    const spatialFc = detectSpatialFeatureCollection(file.name, file.type || '', bytes);
    if (spatialFc) {
      const spatialPath = path.join(SPATIAL_DIR, `${id}.json`);
      fs.writeFileSync(spatialPath, JSON.stringify(spatialFc), 'utf8');
    }

    const record: StoredFileRecord = {
      id,
      originalName: file.name,
      storedName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      contentHash,
      docType: requestedDocType || 'other',
      uploadedAt: new Date().toISOString(),
    };

    index[id] = record;
    writeIndex(index);

    return NextResponse.json({
      ok: true,
      fileId: id,
      fileName: record.originalName,
      fileSize: record.size,
      mimeType: record.mimeType,
      docType: record.docType,
      fileUrl: `/api/engineering/workspace/files/${id}`,
      spatialAvailable: Boolean(spatialFc),
      spatialFeatureCount: spatialFc?.features?.length || 0,
      spatialUrl: spatialFc ? `/api/engineering/workspace/files/${id}/spatial` : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload_failed' }, { status: 500 });
  }
}
