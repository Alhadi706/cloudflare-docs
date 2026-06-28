import type { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';

const PLATFORM_OWNER_EMAIL = (process.env.PLATFORM_OWNER_EMAIL || 'admin@system').toLowerCase().trim();

export interface OwnerIdentity {
  email: string;
  role: string;
}

export function resolveOwnerIdentity(req: NextRequest): OwnerIdentity | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded?.email || !decoded?.role) return null;

  const role = String(decoded.role);
  const email = String(decoded.email).toLowerCase();
  if (role !== 'super_admin' || email !== PLATFORM_OWNER_EMAIL) {
    return null;
  }

  return { email, role };
}

export function requirePlatformOwner(req: NextRequest): OwnerIdentity | Response {
  const identity = resolveOwnerIdentity(req);
  if (identity) return identity;

  return new Response(JSON.stringify({ detail: 'هذه العملية للمؤسس/مالك المنصة فقط', code: 'owner_only' }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
