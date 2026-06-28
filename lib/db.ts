import { Pool } from 'pg';

// Create a connection pool for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PG_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || process.env.DB_PORT || '5433', 10),
  database: process.env.PG_DB || process.env.DB_NAME || 'digital_employees',
  user: process.env.PG_USER || process.env.DB_USER || 'alhadi',
  password: String(process.env.PG_PASSWORD || process.env.DB_PASSWORD || 'alhadi2026'),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create extraction_catalog table
    await client.query(`
      CREATE TABLE IF NOT EXISTS extraction_catalog (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) UNIQUE,
        region_key VARCHAR(100),
        scope_label VARCHAR(255),
        geometry_hash VARCHAR(64),
        layer_count INT,
        run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        backend_job_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'success',
        quality_metrics JSONB,
        layer_data JSONB,
        created_by VARCHAR(255),
        tenant_id VARCHAR(36)
      );
    `);

    // Create extraction_catalog_layers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS extraction_catalog_layers (
        id SERIAL PRIMARY KEY,
        catalog_id INT REFERENCES extraction_catalog(id) ON DELETE CASCADE,
        layer_key VARCHAR(255),
        layer_name VARCHAR(255),
        feature_count INT,
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_extraction_catalog_tenant_region 
      ON extraction_catalog(tenant_id, region_key);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_extraction_catalog_date 
      ON extraction_catalog(run_date DESC);
    `);

    // Keep multiple versions per region/day; drop old uniqueness index/constraint if present.
    await client.query(`
      DROP INDEX IF EXISTS idx_extraction_catalog_region_day;
    `);
    await client.query(`
      ALTER TABLE extraction_catalog DROP CONSTRAINT IF EXISTS idx_extraction_catalog_region_day;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_extraction_catalog_layers_catalog_id 
      ON extraction_catalog_layers(catalog_id);
    `);

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Error initializing database schema:', err);
  } finally {
    client.release();
  }
}

// Get extraction catalog entries
export async function getExtractionCatalog(
  tenantId: string,
  regionKey?: string,
  limit: number = 50,
  offset: number = 0
) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT
        id,
        job_id,
        region_key,
        scope_label,
        layer_count,
        run_date,
        status,
        COALESCE(layer_data, '[]'::jsonb) AS layers
      FROM extraction_catalog
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (regionKey) {
      query += ' AND region_key = $2';
      params.push(regionKey);
    }

    query += ' ORDER BY run_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Get extraction details with layers
export async function getExtractionDetails(catalogId: number, tenantId: string) {
  const client = await pool.connect();
  try {
    // Get main extraction record
    const extractionResult = await client.query(
      'SELECT * FROM extraction_catalog WHERE id = $1 AND tenant_id = $2',
      [catalogId, tenantId]
    );

    if (extractionResult.rows.length === 0) {
      return null;
    }

    const extraction = extractionResult.rows[0];

    // Get layers for this extraction
    const layersResult = await client.query(
      'SELECT * FROM extraction_catalog_layers WHERE catalog_id = $1',
      [catalogId]
    );

    const layersFromJson = Array.isArray(extraction.layer_data) ? extraction.layer_data : [];
    const layers = layersFromJson.length > 0 ? layersFromJson : layersResult.rows;

    return {
      ...extraction,
      layers,
    };
  } finally {
    client.release();
  }
}

// Save extraction to catalog
export async function saveExtractionToCatalog(data: {
  jobId: string;
  regionKey: string;
  scopeLabel: string;
  geometryHash: string;
  layerCount: number;
  backendJobId?: string;
  status: string;
  qualityMetrics?: any;
  layerData: any;
  createdBy?: string;
  tenantId: string;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO extraction_catalog 
       (job_id, region_key, scope_label, geometry_hash, layer_count, 
        backend_job_id, status, quality_metrics, layer_data, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (job_id) DO UPDATE SET
       status = $7,
       layer_data = $9,
       layer_count = $5,
       quality_metrics = $8,
       scope_label = $3,
       region_key = $2
       RETURNING id, job_id, region_key, run_date;`,
      [
        data.jobId,
        data.regionKey,
        data.scopeLabel,
        data.geometryHash,
        data.layerCount,
        data.backendJobId,
        data.status,
        data.qualityMetrics ? JSON.stringify(data.qualityMetrics) : null,
        JSON.stringify(data.layerData),
        data.createdBy,
        data.tenantId,
      ]
    );

    const catalogId = result.rows[0].id;

    await client.query('DELETE FROM extraction_catalog_layers WHERE catalog_id = $1', [catalogId]);

    // Insert individual layer records
    if (Array.isArray(data.layerData) && data.layerData.length > 0) {
      for (const layer of data.layerData) {
        await client.query(
          `INSERT INTO extraction_catalog_layers 
           (catalog_id, layer_key, layer_name, feature_count, color)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            catalogId,
            layer.layer_key,
            layer.layer_name,
            layer.feature_count || 0,
            layer.color || '#ffffff',
          ]
        );
      }
    }

    await client.query('COMMIT');

    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Delete extraction from catalog
export async function deleteExtractionFromCatalog(catalogId: number, tenantId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM extraction_catalog WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [catalogId, tenantId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

// Search extractions by region and date range
export async function searchExtractions(
  tenantId: string,
  filters: {
    regionKey?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  } = {}
) {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM extraction_catalog WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.regionKey) {
      query += ` AND region_key = $${paramIndex}`;
      params.push(filters.regionKey);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND run_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND run_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ' ORDER BY run_date DESC';

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
