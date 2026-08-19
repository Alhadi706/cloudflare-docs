/**
 * owner-auth.ts — helper to verify platform owner bearer tokens
 *
 * Phase 0 security fix: shares the same required AUTH_SECRET as
 * lib/auth-tokens.ts — no hardcoded fallback secret (previously a different
 * fallback string than auth-tokens.ts, which was itself a bug).
 */
import crypto from 'crypto';

export interface OwnerClaims {
  email: string;
  role: string;
  iat: number;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET environment variable is required (no default fallback is provided for security reasons).'
    );
  }
  return secret;
}

export function verifyOwnerToken(authHeader: string | null): OwnerClaims | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
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
