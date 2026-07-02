/**
 * client-auth-session.ts
 * Client-side helpers for reading/writing the auth session.
 * Called from LoginPanel, entry/page, and dashboard/layout.
 */

'use client';

type SessionData = {
  token?: string;
  email?: string;
  role?: string;
  department_code?: string;
  section_id?: string | null;
  tenant_id?: string | null;
  tenant_code?: string | null;
  app_scope?: string | null;
  [key: string]: unknown;
};

const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setCookie(name: string, value: string, maxAge: number = AUTH_COOKIE_MAX_AGE): void {
  if (typeof document === 'undefined') return;
  const exp = new Date(Date.now() + maxAge * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${exp}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * syncClientAuthState — called after a successful login API response.
 * Stores token, role, dept, section, tenant info in cookies and localStorage.
 * Returns true on success, false on failure.
 */
export async function syncClientAuthState(data: SessionData): Promise<boolean> {
  try {
    const token = data.token as string | undefined;
    if (!token) return false;

    // Store in cookies (for middleware/SSR)
    setCookie('auth_session', token);
    if (data.role)            setCookie('user_role', data.role as string);
    if (data.department_code) setCookie('user_dept', data.department_code as string);
    if (data.app_scope)       setCookie('app_scope', data.app_scope as string);
    if (data.tenant_code)     setCookie('tenant_code', data.tenant_code as string);
    if (data.section_id)      setCookie('section_id', data.section_id as string);

    // Also store in localStorage (for client-side reads)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token);
      if (data.email)           localStorage.setItem('user_email', data.email as string);
      if (data.role)            localStorage.setItem('user_role', data.role as string);
      if (data.department_code) localStorage.setItem('dept_code', data.department_code as string);
      if (data.tenant_code)     localStorage.setItem('tenant_code', data.tenant_code as string);
      if (data.section_id)      localStorage.setItem('section_id', data.section_id as string);
      // Store tenant_id so buildHeaders() can send it for dept-admin and other API calls
      if (data.tenant_id)       localStorage.setItem('tenant_id', data.tenant_id as string);
      if (data.tenant_id)       localStorage.setItem('active_tenant_id', data.tenant_id as string);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * applyServerSession — called after change-password flow.
 * Applies a token + optional app_scope to session storage.
 * Returns true on success, false on failure.
 */
export async function applyServerSession(token: string, appScope?: string | null): Promise<boolean> {
  try {
    if (!token) return false;

    setCookie('auth_session', token);
    if (appScope) {
      setCookie('app_scope', appScope);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('launch_app', appScope);
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * clearServerSession — called on logout.
 * Removes all auth cookies and localStorage entries.
 */
export async function clearServerSession(): Promise<void> {
  // Delete cookies
  deleteCookie('auth_session');
  deleteCookie('user_role');
  deleteCookie('user_dept');
  deleteCookie('app_scope');
  deleteCookie('tenant_code');
  deleteCookie('section_id');

  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('dept_code');
    localStorage.removeItem('tenant_code');
    localStorage.removeItem('section_id');
    localStorage.removeItem('launch_app');
    localStorage.removeItem('needs_bootstrap');
  }
}
