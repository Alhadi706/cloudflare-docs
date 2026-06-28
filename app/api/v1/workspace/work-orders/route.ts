// Dedicated proxy for work orders — backend mounts at /work-orders (no /api/v1 prefix)
const BACKEND_WORK_ORDERS = 'http://localhost:7860/work-orders';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

function buildTenantHeaders(request: Request) {
  return {
    'X-Tenant-ID': request.headers.get('X-Tenant-ID') || 'aaaaaaaa-0000-4000-a000-000000000001',
    'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
    'X-Staff-Api-Key': STAFF_API_KEY,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_WORK_ORDERS}${url.search}`;
  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(BACKEND_WORK_ORDERS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildTenantHeaders(request),
      },
      body: JSON.stringify(body),
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
