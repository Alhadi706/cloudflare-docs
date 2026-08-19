// Proxy for individual work order — backend at /work-orders/{id}
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
const BACKEND_URL   = process.env.BACKEND_URL   || 'http://localhost:7860';

function buildTenantHeaders(request: Request) {
  const tenantId = request.headers.get('x-verified-tenant-id')?.trim() || '';
  const tenantCode = request.headers.get('x-verified-tenant-code') || '';
  return {
    'X-Tenant-ID':   tenantId,
    'X-Tenant-Code': tenantCode,
    'X-Staff-Api-Key': STAFF_API_KEY,
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!request.headers.get('x-verified-tenant-id')?.trim()) {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const { id } = params;
  try {
    const response = await fetch(`http://localhost:7860/work-orders/${id}`, {
      headers: buildTenantHeaders(request),
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!request.headers.get('x-verified-tenant-id')?.trim()) {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const { id } = params;
  const woId = parseInt(id);
  if (isNaN(woId)) {
    return new Response(JSON.stringify({ error: 'invalid work order id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const newStatus = body.status ?? body.new_status ?? '';
    if (!newStatus) {
      return new Response(JSON.stringify({ error: 'status is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Try backend first
    try {
      const backendBody = {
        new_status: newStatus,
        actor: request.headers.get('x-verified-email') || request.headers.get('x-verified-employee-no') || '',
      };
      const response = await fetch(`${BACKEND_URL}/api/v1/workflow/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...buildTenantHeaders(request) },
        body: JSON.stringify(backendBody),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    } catch { /* fall through to direct DB update */ }

    // Fallback: direct PostgreSQL update
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      user: process.env.DB_USER || 'digital',
      password: process.env.DB_PASSWORD || 'DigitalPass2026!',
      database: process.env.DB_NAME || 'digital_employees',
      max: 2,
    });
    const result = await pool.query(
      'UPDATE workspace.work_orders SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id, status',
      [newStatus, woId, request.headers.get('x-verified-tenant-id')?.trim() || '']
    );
    await pool.end();
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'work order not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, id: woId, status: newStatus }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!request.headers.get('x-verified-tenant-id')?.trim()) {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const { id } = params;
  try {
    const response = await fetch(`http://localhost:7860/work-orders/${id}`, {
      method: 'DELETE',
      headers: buildTenantHeaders(request),
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
