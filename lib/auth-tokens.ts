/**
 * Auth Tokens — signed HMAC-SHA256 tokens for activation and auth sessions.
 */
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'sovereign-dev-secret-change-in-production';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Timing-safe string comparison — pure JS, works in both Node.js and Edge Runtime.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Decode a base64url string to a UTF-8 string.
 * Converts to standard base64 first to avoid Edge Runtime Buffer polyfill issues.
 */
function decodeBase64url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Convert a base64url string to lowercase hex.
 * Used so we can compare signatures with digest('hex') instead of digest('base64url'),
 * because digest('base64url') is unreliable in the Next.js Edge Runtime polyfill.
 */
function b64urlToHex(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  // atob is available in both Node.js 16+ and Edge Runtime
  return Array.from(atob(b64), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

export function generateOTP(): string {
  // Cryptographically random 6-digit integer
  const buf = crypto.randomBytes(4);
  return (100000 + (buf.readUInt32BE(0) % 900000)).toString();
}

// ── Activation token (email link) ───────────────────────────────
export function generateActivationToken(email: string, id: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, id, iat: Date.now(), type: 'activation' })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyActivationToken(
  token: string
): { email: string; id: string; iat: number } | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload     = token.slice(0, dot);
    const sig         = token.slice(dot + 1);
    const expectedHex = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!timingSafeStringEqual(b64urlToHex(sig), expectedHex)) return null;
    return JSON.parse(decodeBase64url(payload));
  } catch {
    return null;
  }
}

// ── Session auth token (JWT-like) ────────────────────────────────
export function makeAuthToken(
  email: string,
  role:  string,
  extra: Record<string, unknown> = {}
): string {
  const payload = Buffer.from(
    JSON.stringify({ email, role, iat: Date.now(), ...extra })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(
  token: string
): { email: string; role: string; iat: number; [k: string]: unknown } | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload     = token.slice(0, dot);
    const sig         = token.slice(dot + 1);
    const expectedHex = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!timingSafeStringEqual(b64urlToHex(sig), expectedHex)) return null;
    return JSON.parse(decodeBase64url(payload));
  } catch {
    return null;
  }
}
