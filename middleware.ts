import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute, getHomeRoute, ROLE_LEVEL } from './lib/rbac';
import type { UserRole, DepartmentCode } from './lib/user-store';
import { canAccessPathForScope, getDefaultRouteForScope, normalizeAppScope } from './lib/appScope';

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
  '/api/onboarding/tenant-request', // new org registration form (POST)
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
 * Decode a Bearer JWT payload and return enriched Headers.
 * Returns null if no valid Bearer token with tenant_id is present.
 */
function buildVerifiedHeaders(request: NextRequest): Headers | null {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  try {
    const payloadB64 = token.slice(0, dot);
    // base64url → base64: replace - with +, _ with /
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const claims = JSON.parse(json) as Record<string, unknown>;

    if (!claims.tenant_id) return null;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-verified-tenant-id',   String(claims.tenant_id   ?? ''));
    requestHeaders.set('x-verified-tenant-code',  String(claims.tenant_code ?? ''));
    requestHeaders.set('x-verified-employee-no',  String(claims.employee_no ?? ''));
    requestHeaders.set('x-verified-full-name',    String(claims.full_name   ?? ''));
    requestHeaders.set('x-verified-email',        String(claims.email       ?? ''));
    requestHeaders.set('x-verified-role',         String(claims.role        ?? ''));

    return requestHeaders;
  } catch {
    return null; // malformed token — ignore
  }
}


export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has('auth_session');

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
  // We do a payload-only decode here; full HMAC verification happens per route.
  const enrichedHeaders = buildVerifiedHeaders(request);

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

  // Already logged in, trying to visit /entry → send to correct app home
  // Priority: ?app= query param (from Tauri/desktop launcher) > cookie scope
  if (pathname === '/entry' && isAuthenticated) {
    const urlAppParam = request.nextUrl.searchParams.get('app');
    const resolvedScope = urlAppParam ? normalizeAppScope(urlAppParam) : normalizeAppScope(request.cookies.get('app_scope')?.value);
    const destination = getDefaultRouteForScope(resolvedScope);
    const redirectRes = NextResponse.redirect(new URL(destination, request.url));
    // Update cookie so subsequent dashboard requests also respect the new scope
    if (urlAppParam) {
      const exp = new Date(Date.now() + 7 * 86400 * 1000).toUTCString();
      redirectRes.headers.append(
        'Set-Cookie',
        `app_scope=${encodeURIComponent(resolvedScope)}; Path=/; Expires=${exp}; SameSite=Lax`
      );
    }
    return withDashboardNoStore(redirectRes);
  }

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
    const hasCookieSession = request.cookies.has('auth_session');

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
    const role     = (request.cookies.get('user_role')?.value ?? 'member') as UserRole;
    const deptCode = (request.cookies.get('user_dept')?.value ?? null) as DepartmentCode | null;
    const appScope = request.cookies.get('app_scope')?.value ?? process.env.NEXT_PUBLIC_APP_SCOPE ?? null;
    const normalizedScope = normalizeAppScope(appScope);

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

  // Pass the enriched request (with x-verified-* headers) to the route handler
  if (enrichedHeaders) {
    return NextResponse.next({ request: { headers: enrichedHeaders } });
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
