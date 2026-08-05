import { pgPool } from '@/lib/db-pg';

export type KnowledgeSourceRow = {
  id: string;
  tenant_id: string;
  asset_id: string;
  document_id: string | null;
  title: string;
  doc_type: string;
  file_url: string;
  mime_type: string;
  source_kind: string;
  content_text: string | null;
  content_excerpt: string | null;
  extraction_status: 'pending' | 'ingested' | 'needs_ocr' | 'failed';
  extracted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEventRow = {
  id: string;
  tenant_id: string;
  asset_id: string;
  source_id: string;
  event_year: number | null;
  event_type: string;
  component: string | null;
  severity: string | null;
  action: string | null;
  evidence_text: string;
  confidence: number;
  created_at: string;
};

let knowledgeSchemaReady = false;

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureKnowledgeSchema(): Promise<void> {
  if (knowledgeSchemaReady) return;

  await pgPool.query('CREATE SCHEMA IF NOT EXISTS workspace;');

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.asset_knowledge_sources (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      document_id TEXT,
      title TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type TEXT,
      source_kind TEXT NOT NULL DEFAULT 'document_original',
      content_text TEXT,
      content_excerpt TEXT,
      extraction_status TEXT NOT NULL DEFAULT 'pending',
      extracted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_asset_knowledge_sources_unique
      ON workspace.asset_knowledge_sources (tenant_id, asset_id, file_url);
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_asset_knowledge_sources_asset
      ON workspace.asset_knowledge_sources (tenant_id, asset_id, updated_at DESC);
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS workspace.asset_knowledge_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      source_id TEXT NOT NULL REFERENCES workspace.asset_knowledge_sources(id) ON DELETE CASCADE,
      event_year INT,
      event_type TEXT NOT NULL,
      component TEXT,
      severity TEXT,
      action TEXT,
      evidence_text TEXT NOT NULL,
      confidence NUMERIC(5,4) NOT NULL DEFAULT 0.7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_asset_knowledge_events_asset
      ON workspace.asset_knowledge_events (tenant_id, asset_id, event_year DESC NULLS LAST, created_at DESC);
  `);

  knowledgeSchemaReady = true;
}

export async function upsertKnowledgeSource(input: {
  tenantId: string;
  assetId: string;
  documentId?: string | null;
  title: string;
  docType: string;
  fileUrl: string;
  mimeType?: string | null;
  sourceKind?: string;
}): Promise<KnowledgeSourceRow> {
  await ensureKnowledgeSchema();

  const id = randomId('ksrc');
  const rs = await pgPool.query(
    `INSERT INTO workspace.asset_knowledge_sources
      (id, tenant_id, asset_id, document_id, title, doc_type, file_url, mime_type, source_kind, extraction_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
     ON CONFLICT (tenant_id, asset_id, file_url)
     DO UPDATE SET
       title = EXCLUDED.title,
       doc_type = EXCLUDED.doc_type,
       document_id = COALESCE(EXCLUDED.document_id, workspace.asset_knowledge_sources.document_id),
       mime_type = COALESCE(EXCLUDED.mime_type, workspace.asset_knowledge_sources.mime_type),
       source_kind = COALESCE(EXCLUDED.source_kind, workspace.asset_knowledge_sources.source_kind),
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      input.tenantId,
      input.assetId,
      input.documentId || null,
      input.title,
      input.docType,
      input.fileUrl,
      input.mimeType || null,
      input.sourceKind || 'document_original',
    ]
  );

  return rs.rows[0] as KnowledgeSourceRow;
}

export async function saveKnowledgeExtraction(input: {
  tenantId: string;
  assetId: string;
  sourceId: string;
  status: 'ingested' | 'needs_ocr' | 'failed';
  contentText?: string | null;
  contentExcerpt?: string | null;
  events?: Array<{
    eventYear?: number | null;
    eventType: string;
    component?: string | null;
    severity?: string | null;
    action?: string | null;
    evidenceText: string;
    confidence?: number;
  }>;
}): Promise<void> {
  await ensureKnowledgeSchema();

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE workspace.asset_knowledge_sources
          SET extraction_status = $1,
              content_text = $2,
              content_excerpt = $3,
              extracted_at = CASE WHEN $1 = 'ingested' THEN NOW() ELSE extracted_at END,
              updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5 AND asset_id = $6`,
      [
        input.status,
        input.contentText || null,
        input.contentExcerpt || null,
        input.sourceId,
        input.tenantId,
        input.assetId,
      ]
    );

    await client.query(
      `DELETE FROM workspace.asset_knowledge_events
        WHERE source_id = $1 AND tenant_id = $2 AND asset_id = $3`,
      [input.sourceId, input.tenantId, input.assetId]
    );

    if (input.status === 'ingested' && Array.isArray(input.events) && input.events.length > 0) {
      for (const ev of input.events) {
        await client.query(
          `INSERT INTO workspace.asset_knowledge_events
            (id, tenant_id, asset_id, source_id, event_year, event_type, component, severity, action, evidence_text, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            randomId('kevt'),
            input.tenantId,
            input.assetId,
            input.sourceId,
            ev.eventYear ?? null,
            ev.eventType,
            ev.component ?? null,
            ev.severity ?? null,
            ev.action ?? null,
            ev.evidenceText,
            Number.isFinite(Number(ev.confidence)) ? Number(ev.confidence) : 0.7,
          ]
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listKnowledgeSources(tenantId: string, assetId: string): Promise<KnowledgeSourceRow[]> {
  await ensureKnowledgeSchema();
  const rs = await pgPool.query(
    `SELECT *
       FROM workspace.asset_knowledge_sources
      WHERE tenant_id = $1 AND asset_id = $2
      ORDER BY updated_at DESC`,
    [tenantId, assetId]
  );
  return rs.rows as KnowledgeSourceRow[];
}

export async function getKnowledgeSourceById(tenantId: string, assetId: string, sourceId: string): Promise<KnowledgeSourceRow | null> {
  await ensureKnowledgeSchema();
  const rs = await pgPool.query(
    `SELECT *
       FROM workspace.asset_knowledge_sources
      WHERE tenant_id = $1 AND asset_id = $2 AND id = $3
      LIMIT 1`,
    [tenantId, assetId, sourceId]
  );
  return (rs.rows[0] as KnowledgeSourceRow) || null;
}

export async function listKnowledgeEvents(tenantId: string, assetId: string): Promise<KnowledgeEventRow[]> {
  await ensureKnowledgeSchema();
  const rs = await pgPool.query(
    `SELECT *
       FROM workspace.asset_knowledge_events
      WHERE tenant_id = $1 AND asset_id = $2
      ORDER BY event_year DESC NULLS LAST, created_at DESC`,
    [tenantId, assetId]
  );
  return rs.rows as KnowledgeEventRow[];
}
