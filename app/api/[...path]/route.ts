// Proxy all /api requests to Backend
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
const BACKEND_CANDIDATES = (
  process.env.BACKEND_URLS
    ? process.env.BACKEND_URLS.split(',').map((u) => u.trim()).filter(Boolean)
    : [process.env.BACKEND_URL || 'http://localhost:7860', 'http://localhost:8001']
);

/**
 * Phase 0 security fix: tenant/role are now read ONLY from the
 * x-verified-* headers set by middleware.ts after it cryptographically
 * verifies the caller's Bearer token (or verified session cookies).
 * Previously this read the client-supplied `X-Tenant-ID` request header
 * directly (and unconditionally forwarded `X-User-Role: super_admin` for
 * every request) — letting any browser request pick an arbitrary tenant
 * and always get super_admin on the downstream backend. CANNOT CONFIRM how
 * the external backend (source not in this repo) behaves for non-super_admin
 * roles — flagged as a residual risk in the Phase 0 report.
 */
function resolveVerifiedTenantId(request: Request): string {
  return (request.headers.get('x-verified-tenant-id') || '').trim();
}

function resolveVerifiedRole(request: Request): string {
  return (request.headers.get('x-verified-role') || '').trim();
}

function tenantHeaders(request: Request): Record<string, string> {
  const tenantId = resolveVerifiedTenantId(request);
  const role = resolveVerifiedRole(request);

  const headers: Record<string, string> = {
    'X-Tenant-Code': request.headers.get('x-verified-tenant-code') || '',
    'X-Staff-Api-Key': STAFF_API_KEY,
    // Forward the caller's REAL, verified role instead of a hardcoded
    // super_admin — the proxy must never manufacture elevated privileges.
    'X-User-Role': role,
  };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

function sanitizeTenantQuery(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('tenant_id');
  return params.toString() ? `?${params.toString()}` : '';
}

function sanitizeJsonBody(body: string): string {
  if (!body.trim()) return body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      delete parsed.tenant_id;
      return JSON.stringify(parsed);
    }
  } catch { /* preserve non-JSON body for backend validation */ }
  return body;
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
  const search = sanitizeTenantQuery(url.search);

  if (!resolveVerifiedTenantId(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized: no verified tenant context' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetchWithBackendFallback(path, search, {
      method: 'GET',
      headers: {
        ...tenantHeaders(request),
        'x-user-id': request.headers.get('x-verified-email') || '',
        'x-user-role': request.headers.get('x-verified-role') || '',
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
  const search = sanitizeTenantQuery(url.search);

  if (!resolveVerifiedTenantId(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized: no verified tenant context' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
    const body = sanitizeJsonBody(await request.text());
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
  const search = sanitizeTenantQuery(url.search);

  if (!resolveVerifiedTenantId(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized: no verified tenant context' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scopedTenantHeaders = tenantHeaders(request);

  try {
    const body = sanitizeJsonBody(await request.text());
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
