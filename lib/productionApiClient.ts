/**
 * Production API Client
 * ======================
 * Real authentication with JWT tokens
 * Multi-tenant support
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LoginRequest {
  username: string;
  password: string;
  tenant_code: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    user_id: string;
    tenant_id: string;
    username: string;
    email: string;
    full_name: string;
    full_name_ar: string;
    roles: string[];
    permissions: string[];
  };
}

export interface ApiError {
  detail: string;
  status?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API Client Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

class ProductionApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tenantId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Load tokens from localStorage
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
      this.tenantId = localStorage.getItem('tenant_id');
    }

    // Request interceptor - add auth headers
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (typeof window !== 'undefined') {
          const storedAccessToken = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
          const storedTenantId = localStorage.getItem('tenant_id');
          if (storedAccessToken) this.accessToken = storedAccessToken;
          if (storedTenantId) this.tenantId = storedTenantId;
        }
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        if (this.tenantId && config.headers) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and we have refresh token, try to refresh
        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          originalRequest._retry = true;

          try {
            const response = await axios.post(`${API_BASE_URL}/v1/auth/refresh`, {
              refresh_token: this.refreshToken,
            });

            const { access_token } = response.data;
            this.setAccessToken(access_token);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            this.clearTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Token Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  setTokens(accessToken: string, refreshToken: string, tenantId: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tenantId = tenantId;

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('tenant_id', tenantId);
    }
  }

  setAccessToken(accessToken: string) {
    this.accessToken = accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tenantId = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('current_user');
    }
  }

  isAuthenticated(): boolean {
    if (this.accessToken) return true;
    if (typeof window === 'undefined') return false;
    return !!(localStorage.getItem('access_token') || localStorage.getItem('auth_token'));
  }

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tenant_id', tenantId);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Authentication APIs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/v1/auth/login', credentials);
    const { access_token, refresh_token, user } = response.data;

    // Save tokens
    this.setTokens(access_token, refresh_token, user.tenant_id);

    // Save user info
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_user', JSON.stringify(user));
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/v1/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser() {
    const response = await this.client.get('/v1/auth/me');
    return response.data;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Projects APIs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getProjects() {
    // المصدر الموحد: workspace.projects هو جدول المشاريع الوحيد
    // فقط المشاريع الإنشائية (project_type=construction) تظهر في قائمة المشاريع
    const response = await this.client.get('/v1/workspace/projects');
    const all = Array.isArray(response.data) ? response.data :
                (response.data?.projects ?? response.data ?? []);
    // Filter out system containers (operational_registry type)
    return Array.isArray(all)
      ? all.filter((p: any) => (p.project_type ?? 'construction') !== 'operational_registry')
      : all;
  }

  async getProject(id: number) {
    const response = await this.client.get(`/v1/workspace/projects/${id}`);
    return response.data;
  }

  async createProject(data: any) {
    const response = await this.client.post('/v1/workspace/projects', data);
    return response.data;
  }

  async updateProject(id: number, data: any) {
    const response = await this.client.put(`/v1/workspace/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: number) {
    const response = await this.client.delete(`/v1/workspace/projects/${id}`);
    return response.data;
  }

  async getProjectStats() {
    // إحصاءات من workspace.projects
    const response = await this.client.get('/v1/workspace/projects');
    const projects = Array.isArray(response.data) ? response.data :
                     (response.data?.projects ?? []);
    return {
      total: projects.length,
      active: projects.filter((p: any) => p.status === 'active').length,
      completed: projects.filter((p: any) => p.status === 'completed').length,
      avg_progress: projects.reduce((s: number, p: any) => s + (p.progress_percentage ?? 0), 0) / (projects.length || 1),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Finance APIs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getBudgets(year?: number) {
    const params = year ? { budget_year: year } : {};
    const response = await this.client.get('/v1/finance/budgets', { params });
    return response.data;
  }

  async createBudget(data: any) {
    const response = await this.client.post('/v1/finance/budgets', data);
    return response.data;
  }

  async getBudgetStats(year: number = 2025) {
    const response = await this.client.get('/v1/finance/budgets/stats/summary', {
      params: { budget_year: year },
    });
    return response.data;
  }

  async getExpenses(params?: any) {
    const response = await this.client.get('/v1/finance/expenses', { params });
    return response.data;
  }

  async createExpense(data: any) {
    const response = await this.client.post('/v1/finance/expenses', data);
    return response.data;
  }

  async getExpenseStats(params?: any) {
    const response = await this.client.get('/v1/finance/expenses/stats/summary', { params });
    return response.data;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HR APIs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getEmployees() {
    const response = await this.client.get('/v1/workspace/employees');
    return response.data;
  }

  async getEmployee(id: number) {
    const response = await this.client.get(`/v1/hr/employees/${id}`);
    return response.data;
  }

  async createEmployee(data: any) {
    const response = await this.client.post('/v1/hr/employees', data);
    return response.data;
  }

  async updateEmployee(id: number, data: any) {
    const response = await this.client.put(`/v1/hr/employees/${id}`, data);
    return response.data;
  }

  async deleteEmployee(id: number) {
    const response = await this.client.delete(`/v1/hr/employees/${id}`);
    return response.data;
  }

  async getEmployeeStats() {
    const response = await this.client.get('/v1/hr/employees/stats/summary');
    return response.data;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Inventory APIs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getInventoryItems(params?: any) {
    const response = await this.client.get('/v1/inventory/items', { params });
    return response.data;
  }

  async createInventoryItem(data: any) {
    const response = await this.client.post('/v1/inventory/items', data);
    return response.data;
  }

  async updateInventoryItem(id: number, data: any) {
    const response = await this.client.put(`/v1/inventory/items/${id}`, data);
    return response.data;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export Singleton Instance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const apiClient = new ProductionApiClient();
