import { resolveCompatibleAppScope } from '@/lib/appScope';
import { useUserStore } from '@/store/useUserStore';

type SessionLikePayload = {
  token: string;
  role?: string | null;
  full_name?: string | null;
  email?: string | null;
  tenant_id?: string | null;
  tenant_code?: string | null;
  department_code?: string | null;
  organization_name?: string | null;
};

export async function applyServerSession(token: string, appScope?: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ app_scope: appScope || null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function persistClientAuthState(data: SessionLikePayload): string | null {
  if (typeof window === 'undefined') return null;

  localStorage.setItem('auth_token', data.token);
  if (data.email) localStorage.setItem('user_email', data.email);
  if (data.full_name) localStorage.setItem('user_name', data.full_name);
  if (data.organization_name) localStorage.setItem('org_name', data.organization_name);
  if (data.role) localStorage.setItem('user_role', data.role);

  if (data.department_code) {
    localStorage.setItem('dept_code', data.department_code);
  } else {
    localStorage.removeItem('dept_code');
  }

  if (data.tenant_id) {
    localStorage.setItem('tenant_id', data.tenant_id);
    localStorage.setItem('active_tenant_id', data.tenant_id);
  }

  if (data.tenant_code) {
    localStorage.setItem('tenant_code', data.tenant_code);
    localStorage.setItem('active_tenant_code', data.tenant_code);
  }

  const currentScope = localStorage.getItem('launch_app') || null;
  const resolvedScope = resolveCompatibleAppScope(currentScope, data.department_code);

  if (resolvedScope && resolvedScope !== 'all') {
    localStorage.setItem('launch_app', resolvedScope);
  } else if (resolvedScope === 'all') {
    localStorage.removeItem('launch_app');
  }

  const currentUser = useUserStore.getState().current;
  useUserStore.getState().setUser({
    user_id: currentUser?.user_id || data.email || '',
    tenant_id: data.tenant_id || currentUser?.tenant_id || '',
    username: currentUser?.username || (data.email ? data.email.split('@')[0] : ''),
    email: data.email || currentUser?.email || '',
    full_name: data.full_name || currentUser?.full_name || '',
    full_name_ar: currentUser?.full_name_ar || data.full_name || '',
    roles: data.role ? [data.role] : (currentUser?.roles || []),
    permissions: currentUser?.permissions || [],
    name: data.full_name || currentUser?.name,
    role: (data.role || currentUser?.role) as any,
    token: data.token,
  });

  return resolvedScope === 'all' ? null : resolvedScope;
}

export async function syncClientAuthState(data: SessionLikePayload): Promise<boolean> {
  const appScope = persistClientAuthState(data);
  return applyServerSession(data.token, appScope);
}

export async function clearServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Ignore network failure during logout cleanup.
  }
}
