import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute, getHomeRoute, ROLE_LEVEL } from './lib/rbac';
import type { UserRole, DepartmentCode } from './lib/user-store';
import { canAccessPathForScope, getDefaultRouteForScope, normalizeAppScope } from './lib/appScope';
import { verifyAuthTokenEdge } from './lib/auth-tokens';

/**
 * Auth middleware — enforces the routing model:
 *   /entry          → public (login / register / activation)
 *   /activate       → public (email activation links)
 *   /               → public marketing/landing page
 *   /dashboard/*    → protected — redirect to /entry if no session
 *
 * RBAC enforcement:
 *   Reads `user_role` and `user_dept` cookies (set by LoginPanel on login)
 *   and enforces route-level access rules defined in lib/rbac.ts.
 *   Unauthorized access → redirect to the user's home route.
 *
 * The auth_session cookie is a signal cookie (non-HttpOnly) set by
 * LoginPanel.tsx after successful authentication.
 * The actual bearer token stays in localStorage for API calls.
 */

// Paths that never require authentication (frontend routes + Next internals)
const PUBLIC_PREFIXES = [
  '/entry',
  '/activate',
  '/tiles/',
  '/_next/',
  '/favicon.ico',
];

// API routes that are intentionally public (no auth required)
const PUBLIC_API_PATHS = [
  '/api/auth/',               // login, register, activate, OTP, etc.
  '/api/health',              // health check
  '/api/geo/',                // public geographic reference data
  '/api/gis/',                // GIS analysis APIs (optimal path, change detection, alerts, etc.)
  '/api/tiles/',              // map tile proxies
  '/api/terrain3d',           // terrain elevation analysis (SRTM/Copernicus DEM)
  '/api/onboarding/tenant-request', // new org registration form (POST)
  '/api/v1/satellite/',       // satellite intelligence APIs (fire, thermal, scenes, etc.)
  '/api/v1/gis/',             // GIS data APIs (buildings, parcels, etc.)
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname.startsWith(p));
}

// Only these paths need auth enforcement
function requiresAuth(pathname: string): boolean {
  return pathname.startsWith('/dashboard');
}

function requiresApiAuth(pathname: string): boolean {
  return pathname.startsWith('/api/') && !isPublicApiPath(pathname);
}

/**
 * Verify a Bearer JWT and return enriched Headers (Phase 0: real signature check).
 */

/**
 * Fallback: when no Bearer token is present, inject x-verified-* headers
 * from the httpOnly session cookies set by /api/auth/session.
 *
 * Phase 0 security fix: this NO LONGER falls back to the client-supplied
 * X-Tenant-ID request header. That header is fully attacker-controlled
 * (any fetch() call can set it) and previously let a request masquerade as
 * belonging to an arbitrary tenant whenever the tenant_id cookie was absent.
 * Tenant context must come ONLY from the verified, httpOnly `tenant_id`
 * cookie (itself only ever set by /api/auth/session after signature
 * verification) — never from anything the browser can freely set.
 */
async function buildCookieVerifiedHeaders(request: NextRequest): Promise<Headers | null> {
  const sessionToken = request.cookies.get('auth_session')?.value?.trim() ?? '';
  if (!sessionToken || sessionToken === '1' || sessionToken === 'true') return null;

  const claims = await verifyAuthTokenEdge(sessionToken);
  if (!claims?.tenant_id || !claims.role) return null;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-verified-tenant-id', String(claims.tenant_id));
  requestHeaders.set('x-verified-tenant-code', String(claims.tenant_code ?? ''));
  requestHeaders.set('x-verified-role', String(claims.role));
  requestHeaders.set('x-verified-dept-code', String(claims.department_code ?? ''));
  requestHeaders.set('x-verified-email', String(claims.email ?? ''));
  requestHeaders.set('x-verified-full-name', String(claims.full_name ?? ''));
  requestHeaders.set('x-verified-employee-no', String(claims.employee_no ?? ''));
  requestHeaders.set('x-verified-section-id', String(claims.section_id ?? ''));
  requestHeaders.set('x-verified-section-code', String(claims.section_code ?? ''));
  return requestHeaders;
}

/**
 * Phase 0 security fix: this used to do a "payload-only decode" of the
 * Bearer token — i.e. it trusted whatever tenant_id/role/email an attacker
 * put in the JWT payload, WITHOUT checking the HMAC signature at all
 * (any string after the last '.' was accepted as a "signature"). Any
 * route that consumed the resulting x-verified-* headers directly
 * (lib/authorize.ts, lib/auth-tenant-context.ts, the API proxy) was
 * therefore fully bypassable with a forged, unsigned token.
 *
 * This now calls verifyAuthTokenEdge() — real HMAC-SHA256 verification via
 * the Web Crypto API (Edge-Runtime-safe) — so headers are only ever set
 * from a cryptographically verified token.
 */
async function buildVerifiedHeaders(request: NextRequest): Promise<Headers | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  const claims = await verifyAuthTokenEdge(token);
  if (!claims || !claims.tenant_id) return null;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-verified-tenant-id',   String(claims.tenant_id        ?? ''));
  requestHeaders.set('x-verified-tenant-code',  String(claims.tenant_code      ?? ''));
  requestHeaders.set('x-verified-employee-no',  String(claims.employee_no      ?? ''));
  requestHeaders.set('x-verified-full-name',    String(claims.full_name        ?? ''));
  requestHeaders.set('x-verified-email',        String(claims.email            ?? ''));
  requestHeaders.set('x-verified-role',         String(claims.role             ?? ''));
  requestHeaders.set('x-verified-dept-code',    String(claims.department_code  ?? ''));
  requestHeaders.set('x-verified-section-id',   String(claims.section_id       ?? ''));
  requestHeaders.set('x-verified-section-code',  String(claims.section_code     ?? ''));

  return requestHeaders;
}


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const enrichedHeaders = await buildVerifiedHeaders(request);
  const cookieVerifiedHeaders = enrichedHeaders ? null : await buildCookieVerifiedHeaders(request);
  const isAuthenticated = Boolean(enrichedHeaders || cookieVerifiedHeaders);

  // Always start from the login/entry shell instead of install marketing page.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/entry', request.url));
  }

  // ── Developer portal access gate (/dev, /api/dev/*) ─────────────────────
  if (pathname.startsWith('/dev') || pathname.startsWith('/api/dev/')) {
    const devEnabled = process.env.DEV_PORTAL_ENABLED === '1';
    if (!devEnabled) {
      return NextResponse.redirect(new URL('/entry', request.url));
    }

    const devSecret = process.env.DEV_PORTAL_SECRET;
    if (devSecret) {
      const providedKey =
        request.nextUrl.searchParams.get('key') ||
        request.cookies.get('dev_portal_key')?.value ||
        request.headers.get('x-dev-portal-key');

      if (providedKey !== devSecret) {
        return NextResponse.json(
          { detail: 'Developer key required', code: 'forbidden' },
          { status: 403 },
        );
      }

      const res = NextResponse.next();
      // Persist key in a short-lived cookie so page API calls keep working.
      res.cookies.set('dev_portal_key', devSecret, {
        path: '/',
        maxAge: 3600,
        sameSite: 'lax',
      });
      return res;
    }

    return NextResponse.next();
  }

  // ── Inject x-verified-* headers from Bearer JWT (for all API routes) ─────
  // Route handlers read these headers for tenant/employee context.
  // buildVerifiedHeaders() fully verifies the HMAC signature (Phase 0 fix) —
  // headers are only set from a cryptographically verified token.
  const withDashboardNoStore = (res: NextResponse) => {
    if (pathname === '/' || pathname === '/entry' || pathname.startsWith('/dashboard')) {
      // Prevent stale app-shell HTML from being cached by proxies/CDNs.
      // Stale HTML can reference outdated _next chunks and break styling/scripts.
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Expires', '0');
      res.headers.set('Vary', 'Cookie, Accept-Encoding');
    }
    return res;
  };

  // Keep /entry as the universal first screen (login/dev-login entrypoint),
  // even when a session already exists.

  // Always allow static assets and public paths
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return withDashboardNoStore(NextResponse.next());
  }

  // ── API auth enforcement ─────────────────────────────────────────────────
  // Protected API routes must carry a valid Bearer token.
  // We do a lightweight presence check here (JWT verification happens in each
  // route handler). This prevents completely unauthenticated access.
  if (requiresApiAuth(pathname)) {
    const authHeader = request.headers.get('authorization') ?? '';
    const hasBearerToken = authHeader.startsWith('Bearer ') && authHeader.length > 10;
    // Also accept cookie-based session for same-origin browser requests
    const hasCookieSession = Boolean(cookieVerifiedHeaders);

    if (!hasBearerToken && !hasCookieSession) {
      return NextResponse.json(
        { detail: 'غير مصرح — يرجى تسجيل الدخول', code: 'unauthorized' },
        { status: 401 }
      );
    }
  }

  // Protected route without a session → send to login
  if (requiresAuth(pathname) && !isAuthenticated) {
    return withDashboardNoStore(NextResponse.redirect(new URL('/entry', request.url)));
  }

  // ── RBAC enforcement (only for authenticated dashboard routes) ───────────
  if (isAuthenticated && pathname.startsWith('/dashboard')) {
    const role        = (request.cookies.get('user_role')?.value ?? 'member') as UserRole;
    const deptCode    = (request.cookies.get('user_dept')?.value ?? null) as DepartmentCode | null;
    const appScope    = request.cookies.get('app_scope')?.value ?? null;
    const normalizedScope = normalizeAppScope(appScope);

    // Extract section_code from the JWT claims (already parsed in buildVerifiedHeaders)
    let sectionCode: string | null = null;
    try {
      const token = request.cookies.get('auth_session')?.value;
      if (token) {
        const dot = token.lastIndexOf('.');
        const payload = dot >= 0 ? token.slice(0, dot) : token;
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(json) as Record<string, unknown>;
        sectionCode = (claims.section_id as string) || null;
      }
    } catch { /* ignore */ }

    if (pathname === '/dashboard' && normalizedScope !== 'all') {
      const scopeHome = getDefaultRouteForScope(normalizedScope);
      if (scopeHome !== '/dashboard') {
        return withDashboardNoStore(NextResponse.redirect(new URL(scopeHome, request.url)));
      }
    }

    if (!canAccessPathForScope(pathname, appScope)) {
      return withDashboardNoStore(NextResponse.redirect(new URL(getDefaultRouteForScope(normalizedScope), request.url)));
    }

    // Skip RBAC for roles not in our registry (e.g. legacy cookies)
    if (ROLE_LEVEL[role] !== undefined) {
      const allowed = canAccessRoute(role, deptCode, pathname);
      if (!allowed) {
        // Redirect to the user's appropriate home page
        const home = getHomeRoute(role, deptCode, normalizedScope);
        return withDashboardNoStore(NextResponse.redirect(new URL(home, request.url)));
      }
    }
  }

  // Pass the enriched request (with x-verified-* headers) to the route handler.
  // Prefer Bearer-derived headers; fall back to cookie-derived headers for
  // same-origin browser sessions that don't carry a Bearer token.
  const headersToForward = enrichedHeaders ?? cookieVerifiedHeaders;
  if (headersToForward) {
    return withDashboardNoStore(
      NextResponse.next({ request: { headers: headersToForward } })
    );
  }

  // Never allow a client to impersonate middleware-derived identity headers.
  // This matters especially for intentionally public API paths, which do not
  // pass through the API authentication gate above.
  const sanitizedHeaders = new Headers(request.headers);
  for (const header of Array.from(sanitizedHeaders.keys())) {
    if (header.startsWith('x-verified-')) sanitizedHeaders.delete(header);
  }
  return withDashboardNoStore(
    NextResponse.next({ request: { headers: sanitizedHeaders } })
  );
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
