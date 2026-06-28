'use client';
/**
 * OperationalContextSync
 * ─────────────────────────────────────────────────────────────
 * Mount-once component in root layout. On bootstrap:
 *  1. Syncs useUserStore → operationalContext (role, name)
 *  2. Sets tenant identity from NEXT_PUBLIC_TENANT_ID env var
 *  3. Loads activated departments via activatedDepartments store
 *  4. Clears pending_navigation on route change
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useOperationalContext, UserRole } from '@/store/operationalContext';
import { useActivatedDepartments } from '@/store/activatedDepartments';
import { canAccessPathForScope } from '@/lib/appScope';
import { getHomeRoute } from '@/lib/rbac';
import { syncClientAuthState } from '@/lib/client-auth-session';

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveTenantId(): string {
  if (typeof window === 'undefined') return '';
  const localTenant = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (UUID_LIKE.test(localTenant)) return localTenant;

  const cookieTenant = document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith('tenant_id='))
    ?.split('=')[1] ?? '';
  const decodedCookieTenant = decodeURIComponent(cookieTenant);
  if (UUID_LIKE.test(decodedCookieTenant)) return decodedCookieTenant;

  const envTenant = process.env.NEXT_PUBLIC_TENANT_ID ?? '';
  return UUID_LIKE.test(envTenant) ? envTenant : '';
}

export function OperationalContextSync() {
  const { current, setUser } = useUserStore();
  const { setUserRole, clearPendingNavigation, setTenantIdentity } = useOperationalContext();
  const { load: loadDepts, entity_type, registry_entity_id } = useActivatedDepartments();
  const tenantId = resolveTenantId();

  const pathname = usePathname();

  // 0. Bootstrap user store from localStorage if store is empty (e.g. after page reload)
  useEffect(() => {
    if (current) return; // already populated
    if (typeof window === 'undefined') return;
    const name  = localStorage.getItem('user_name')  ?? '';
    const email = localStorage.getItem('user_email') ?? '';
    const role  = localStorage.getItem('user_role')  ?? 'viewer';
    if (email) {
      setUser({
        user_id:      email,
        tenant_id:    tenantId,
        username:     email.split('@')[0],
        email,
        full_name:    name,
        full_name_ar: name,
        roles:        [role],
        permissions:  [],
        name,
        role:         role as any,
      });
    }
  }, [current, setUser, tenantId]);

  // 1. Sync role whenever user switches persona
  useEffect(() => {
    if (current) {
      setUserRole(current.role as UserRole, current.name);
    }
  }, [current, current?.role, current?.name, setUserRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const refreshSession = async () => {
      const token = localStorage.getItem('auth_token') || '';
      if (!token) return;

      const previousRole = localStorage.getItem('user_role') || '';
      const previousDept = localStorage.getItem('dept_code') || '';
      const res = await fetch('/api/auth/me/refresh-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (!res || !res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.token || cancelled) return;

      const synced = await syncClientAuthState(data);
      if (!synced || cancelled) return;

      const nextRole = data.role || '';
      const nextDept = data.department_code || '';
      const roleChanged = previousRole !== nextRole;
      const deptChanged = previousDept !== nextDept;

      if (roleChanged || deptChanged) {
        const nextScope = localStorage.getItem('launch_app') || null;
        const currentPath = window.location.pathname;
        const homeRoute = getHomeRoute(nextRole as UserRole, nextDept || null, nextScope);

        if (!canAccessPathForScope(currentPath, nextScope)) {
          window.location.href = homeRoute;
          return;
        }

        window.location.reload();
      }
    };

    void refreshSession();

    const onFocus = () => { void refreshSession(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };
    const intervalId = window.setInterval(() => { void refreshSession(); }, 60000);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 2. Bootstrap tenant identity once
  useEffect(() => {
    if (tenantId) {
      setTenantIdentity(tenantId, null, null);
    }
  }, [setTenantIdentity, tenantId]);

  // 3. Load activated departments once at mount (idempotent if already loaded)
  useEffect(() => {
    if (tenantId) {
      loadDepts(tenantId);
    }
  }, [loadDepts, tenantId]);

  // 4. Once departments are loaded, persist entity_type + registry_entity_id into operationalContext
  useEffect(() => {
    if (tenantId && entity_type) {
      setTenantIdentity(tenantId, registry_entity_id, entity_type);
    }
  }, [entity_type, registry_entity_id, setTenantIdentity, tenantId]);

  // 5. Clear stale navigation on route change
  useEffect(() => {
    clearPendingNavigation();
  }, [pathname, clearPendingNavigation]);

  return null;
}

