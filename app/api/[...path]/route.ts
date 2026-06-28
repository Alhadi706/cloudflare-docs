// Proxy all /api requests to Backend
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
const DEFAULT_TENANT_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveTenantId(request: Request): string {
  const raw = (request.headers.get('X-Tenant-ID') || '').trim();
  return UUID_LIKE.test(raw) ? raw : DEFAULT_TENANT_ID;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const search = url.search;
  
  const backendUrl = `http://localhost:7860/api${path}${search}`;
  
  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'X-Tenant-ID': resolveTenantId(request),
        'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
        'X-Staff-Api-Key': STAFF_API_KEY,
      },
    });
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('API Proxy Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const search = url.search;
  
  const backendUrl = `http://localhost:7860/api${path}${search}`;
  
  const tenantHeaders = {
    'X-Tenant-ID':   resolveTenantId(request),
    'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
    'X-Staff-Api-Key': STAFF_API_KEY,
  };

  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Multipart file upload → forward FormData as-is (no Content-Type override)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: tenantHeaders,   // fetch sets Content-Type + boundary automatically
        body: formData,
      });

      // Response may be JSON or plain text
      const responseContentType = response.headers.get('content-type') || '';
      let data: any;
      if (responseContentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try { data = JSON.parse(text); } catch { data = { detail: text }; }
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Standard JSON POST
    const body = await request.text();
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...tenantHeaders,
      },
      body: body,
    });
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API Proxy Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
