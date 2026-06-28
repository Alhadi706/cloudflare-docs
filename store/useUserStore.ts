import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkspaceRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'project_admin'
  | 'site_manager'
  | 'layer_owner'
  | 'project_manager'
  | 'hr_manager'
  | 'finance_manager'
  | 'employee'
  | 'viewer';

export interface WorkspaceUser {
  user_id: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  full_name_ar: string;
  roles: string[];
  permissions: string[];
  // Legacy fields for compatibility
  employeeId?: number;
  name?: string;
  nameAr?: string;
  role?: WorkspaceRole;
  token?: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface UserStoreState {
  current: WorkspaceUser | null;
  isAuthenticated: boolean;
  setUser: (user: WorkspaceUser) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      current: null,
      isAuthenticated: false,
      
      setUser: (user) => set({ 
        current: user, 
        isAuthenticated: true 
      }),
      
      logout: () => {
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('tenant_id');
          localStorage.removeItem('current_user');
        }
        set({ current: null, isAuthenticated: false });
      },

      hasPermission: (permission: string) => {
        const user = get().current;
        if (!user) return false;
        
        // Check for wildcard permissions (e.g., "finance.*")
        return user.permissions.some(p => {
          if (p === permission) return true;
          if (p.endsWith('.*')) {
            const prefix = p.slice(0, -2);
            return permission.startsWith(prefix + '.');
          }
          return false;
        });
      },

      hasRole: (role: string) => {
        const user = get().current;
        if (!user) return false;
        return user.roles.includes(role);
      },
    }),
    {
      name: 'workspace-user',
    }
  )
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getUserAuthHeaders(): Record<string, string> {
  try {
    const state = useUserStore.getState();
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const tenantIdFromStorage = typeof window !== 'undefined'
      ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id'))
      : null;
    const tenantId = state.current?.tenant_id || tenantIdFromStorage || null;

    const headers: Record<string, string> = {};

    const token = accessToken || authToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return headers;
  } catch {
    return {};
  }
}
