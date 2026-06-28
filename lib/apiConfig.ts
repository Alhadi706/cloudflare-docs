/**
 * API Configuration
 * Centralized configuration for API calls with tenant support
 */

export const API_CONFIG = {
  baseURL: '/api',
  tenantCode: null, // Default tenant for ERP modules
};

/**
 * Fetch wrapper with tenant header support
 */
export async function fetchWithTenant(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Code': API_CONFIG.tenantCode,
    ...options.headers,
  };

  return fetch(`${API_CONFIG.baseURL}${endpoint}`, {
    ...options,
    headers,
  });
}

/**
 * GET request with tenant header
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetchWithTenant(endpoint);
  if (!response.ok) {
    throw new Error(`API GET ${endpoint} failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST request with tenant header
 */
export async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithTenant(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`API POST ${endpoint} failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * PUT request with tenant header
 */
export async function apiPut<T>(endpoint: string, data: any): Promise<T> {
  const response = await fetchWithTenant(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API PUT ${endpoint} failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * DELETE request with tenant header
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetchWithTenant(endpoint, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API DELETE ${endpoint} failed: ${response.statusText}`);
  }
  return response.json();
}
