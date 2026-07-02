// Proxy for individual work order — backend at /work-orders/{id}
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
const BACKEND_URL   = process.env.BACKEND_URL   || 'http://localhost:7860';

function buildTenantHeaders(request: Request) {
  return {
    'X-Tenant-ID': request.headers.get('X-Tenant-ID') || 'aaaaaaaa-0000-4000-a000-000000000001',
    'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
    'X-Staff-Api-Key': STAFF_API_KEY,
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
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
  const { id } = params;
  try {
    const body = await request.json();
    // Forward to the correct backend endpoint for status updates
    // Backend expects { new_status } but client sends { status }
    const backendBody = { new_status: body.status ?? body.new_status, ...body };
    const response = await fetch(`${BACKEND_URL}/api/v1/workflow/work-orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...buildTenantHeaders(request),
      },
      body: JSON.stringify(backendBody),
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
