/**
 * Auth Tokens — signed HMAC-SHA256 tokens for activation and auth sessions.
 */
import crypto from 'crypto';

/**
 * Phase 0 security fix: no hardcoded fallback secret.
 * AUTH_SECRET must be configured explicitly — a guessable default would let
 * anyone forge valid auth/activation tokens offline.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET environment variable is required (no default fallback is provided for security reasons).'
    );
  }
  return secret;
}

/**
 * Compute HMAC-SHA256 signature using Node.js crypto or Web Crypto API.
 */
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
  const secret = getSecret();
  const payload = Buffer.from(
    JSON.stringify({ email, id, iat: Date.now(), type: 'activation' })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
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
    const expectedHex = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
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
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
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
    const expectedHex = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (!timingSafeStringEqual(b64urlToHex(sig), expectedHex)) return null;
    return JSON.parse(decodeBase64url(payload));
  } catch {
    return null;
  }
}

/**
 * Edge-Runtime-safe token verification using the standard Web Crypto API
 * (globalThis.crypto.subtle), used ONLY by middleware.ts.
 *
 * Phase 0 finding: Node's `crypto.createHmac` (used by verifyAuthToken above)
 * does NOT reliably verify signatures when actually run inside the Next.js
 * Edge Runtime (confirmed by test: a token that verifies correctly via
 * verifyAuthToken() in a Node-runtime route handler failed to verify when
 * the identical check ran inside middleware.ts). crypto.subtle is part of
 * the Web Crypto standard and is guaranteed to behave identically in both
 * Node.js (18+) and Edge Runtime, so it is used here instead.
 */
export async function verifyAuthTokenEdge(
  token: string
): Promise<{ email: string; role: string; iat: number; [k: string]: unknown } | null> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const payload = token.slice(0, dot);
    const sig     = token.slice(dot + 1);

    // NOTE: use globalThis.crypto (Web Crypto) explicitly — the module-level
    // `import crypto from 'crypto'` above shadows the global `crypto` binding,
    // which would otherwise resolve to the Node.js crypto module (unsupported
    // in Edge Runtime) instead of the Web Crypto API.
    const webcrypto = globalThis.crypto;
    const enc = new TextEncoder();
    const key = await webcrypto.subtle.importKey(
      'raw',
      enc.encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await webcrypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sigBuf), (b) => b.toString(16).padStart(2, '0')).join('');

    if (!timingSafeStringEqual(b64urlToHex(sig), expectedHex)) return null;
    return JSON.parse(decodeBase64url(payload));
  } catch {
    return null;
  }
}

