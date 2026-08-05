import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const ROOT_DIR = path.join(process.cwd(), '.data', 'asset-documents');
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const INDEX_FILE = path.join(ROOT_DIR, 'index.json');

type StoredFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  docType: string;
  uploadedAt: string;
};

function readIndex(): Record<string, StoredFileRecord> {
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function cleanDownloadName(name: string): string {
  return name.replace(/[\r\n"]/g, '_').trim() || 'document';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const fileId = String(params.fileId || '').trim();
    if (!fileId) {
      return NextResponse.json({ error: 'file_id_required' }, { status: 400 });
    }

    const index = readIndex();
    const record = index[fileId];
    if (!record) {
      return NextResponse.json({ error: 'file_not_found' }, { status: 404 });
    }

    const absPath = path.join(BIN_DIR, record.storedName);
    if (!fs.existsSync(absPath)) {
      return NextResponse.json({ error: 'file_missing_on_disk' }, { status: 404 });
    }

    const data = fs.readFileSync(absPath);
    const isDownload = req.nextUrl.searchParams.get('download') === '1';
    const dispType = isDownload ? 'attachment' : 'inline';
    const fileName = cleanDownloadName(record.originalName);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': record.mimeType || 'application/octet-stream',
        'Content-Length': String(data.length),
        'Content-Disposition': `${dispType}; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
        'X-Asset-Document-Type': record.docType || 'other',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'file_read_failed' }, { status: 500 });
  }
}
