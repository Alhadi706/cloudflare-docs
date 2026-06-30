/**
 * owner-auth.ts — helper to verify platform owner bearer tokens
 */
import crypto from 'crypto';

export interface OwnerClaims {
  email: string;
  role: string;
  iat: number;
}

export function verifyOwnerToken(authHeader: string | null): OwnerClaims | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', process.env.AUTH_SECRET || 'sovereign-dev-secret')
    .update(payloadB64)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as OwnerClaims;
    if (!claims.email || !claims.role) return null;
    return claims;
  } catch {
    return null;
  }
}
