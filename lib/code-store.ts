/**
 * Shared in-memory OTP code store — globalThis singleton so it survives
 * module re-evaluation (Next.js hot-reload / route splitting).
 */

interface CodeEntry {
  code: string;
  email: string;
  name?: string;
  expires: number;
  attempts: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __otpStore: Map<string, CodeEntry> | undefined;
}

// globalThis ensures same Map instance even if module is re-required
const store: Map<string, CodeEntry> = (globalThis.__otpStore ??= new Map());

const MAX_ATTEMPTS = 5;
const TTL_MS       = 10 * 60 * 1000; // 10 minutes

export function storeCode(email: string, code: string, name?: string): void {
  const key = email.toLowerCase().trim();
  store.set(key, { code, email: key, name, expires: Date.now() + TTL_MS, attempts: 0 });
}

export function getStoredName(email: string): string | undefined {
  return store.get(email.toLowerCase().trim())?.name;
}

export function verifyCode(email: string, code: string): 'ok' | 'invalid' | 'expired' | 'max_attempts' {
  const key   = email.toLowerCase().trim();
  const entry = store.get(key);

  if (!entry) return 'invalid';
  if (Date.now() > entry.expires) { store.delete(key); return 'expired'; }
  if (entry.attempts >= MAX_ATTEMPTS) { store.delete(key); return 'max_attempts'; }

  entry.attempts += 1;

  if (entry.code !== code) return 'invalid';

  // Valid — consume the code
  store.delete(key);
  return 'ok';
}
