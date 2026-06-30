// Proxy all /api requests to Backend
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKEND_CANDIDATES = (
  process.env.BACKEND_URLS
    ? process.env.BACKEND_URLS.split(',').map((u) => u.trim()).filter(Boolean)
    : [process.env.BACKEND_URL || 'http://localhost:7860', 'http://localhost:8001']
);

function getCookieValue(request: Request, key: string): string {
  const cookie = request.headers.get('cookie') || '';
  if (!cookie) return '';
  const parts = cookie.split(';').map(p => p.trim());
  const hit = parts.find(p => p.startsWith(`${key}=`));
  if (!hit) return '';
  return decodeURIComponent(hit.slice(key.length + 1)).trim();
}

function resolveTenantId(request: Request): string {
  const headerTenant = (request.headers.get('X-Tenant-ID') || '').trim();
  if (UUID_LIKE.test(headerTenant)) return headerTenant;

  const cookieTenant = getCookieValue(request, 'tenant_id');
  if (UUID_LIKE.test(cookieTenant)) return cookieTenant;

  const envTenant = (process.env.NEXT_PUBLIC_TENANT_ID || '').trim();
  return UUID_LIKE.test(envTenant) ? envTenant : '';
}

function tenantHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
    'X-Staff-Api-Key': STAFF_API_KEY,
  };
  const tenantId = resolveTenantId(request);
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

function buildBackendApiUrl(baseUrl: string, path: string, search: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/api${path}${search}`;
}

async function fetchWithBackendFallback(path: string, search: string, init: RequestInit): Promise<Response> {
  let lastError: any = null;

  for (const baseUrl of BACKEND_CANDIDATES) {
    const targetUrl = buildBackendApiUrl(baseUrl, path, search);
    try {
      const response = await fetch(targetUrl, init);

      // Retry on gateway-like backend responses.
      if ([502, 503, 504].includes(response.status)) {
        lastError = new Error(`Backend ${baseUrl} returned ${response.status}`);
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('No backend candidate is reachable');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const search = url.search;

  try {
    const response = await fetchWithBackendFallback(path, search, {
      method: 'GET',
      headers: {
        ...tenantHeaders(request),
        'x-user-id': request.headers.get('x-user-id') || 'system',
        'x-user-role': request.headers.get('x-user-role') || 'admin',
      },
      signal: AbortSignal.timeout(20000),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Backend returned non-JSON (e.g. HTML error page)
      data = { error: rawText.slice(0, 200) };
    }

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

  const scopedTenantHeaders = tenantHeaders(request);

  // Layer extraction may need longer processing than standard CRUD requests.
  const timeoutMs = path.includes('/v1/workspace/layer-extraction/') ? 300000 : 20000;

  try {
    const contentType = request.headers.get('content-type') || '';

    // Multipart file upload -> forward FormData as-is (no Content-Type override)
    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        // Body already consumed by formData() attempt; cannot recover.
        return new Response(JSON.stringify({ error: 'Invalid multipart body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const response = await fetchWithBackendFallback(path, search, {
        method: 'POST',
        headers: scopedTenantHeaders,
        body: formData,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Response may be JSON or plain text
      const responseContentType = response.headers.get('content-type') || '';
      let data: any;
      if (responseContentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text };
        }
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Standard JSON POST
    const body = await request.text();
    const response = await fetchWithBackendFallback(path, search, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...scopedTenantHeaders,
      },
      body: body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const rawText2 = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText2);
    } catch {
      data = { error: rawText2.slice(0, 200) };
    }

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

async function forwardWithBody(method: string, request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const search = url.search;

  const scopedTenantHeaders = tenantHeaders(request);

  try {
    const body = await request.text();
    const response = await fetchWithBackendFallback(path, search, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...scopedTenantHeaders,
      },
      body: body || undefined,
      signal: AbortSignal.timeout(20000),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { error: rawText.slice(0, 200) };
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`API Proxy ${method} Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PATCH(request: Request) {
  return forwardWithBody('PATCH', request);
}

export async function PUT(request: Request) {
  return forwardWithBody('PUT', request);
}

export async function DELETE(request: Request) {
  return forwardWithBody('DELETE', request);
}
