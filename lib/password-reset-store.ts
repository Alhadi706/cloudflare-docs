import fs from 'fs';
import path from 'path';

interface PasswordResetEntry {
  code: string;
  email: string;
  expires: number;
  attempts: number;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'password-reset-codes.json');
const MAX_ATTEMPTS = 5;
const TTL_MS = 30 * 60 * 1000; // 30 minutes — survives server restarts

function readStore(): Record<string, PasswordResetEntry> {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, PasswordResetEntry>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

export function storePasswordResetCode(email: string, code: string): void {
  const key = email.toLowerCase().trim();
  const data = readStore();
  data[key] = { code, email: key, expires: Date.now() + TTL_MS, attempts: 0 };
  writeStore(data);
}

export function verifyPasswordResetCode(email: string, code: string): 'ok' | 'invalid' | 'expired' | 'max_attempts' {
  const key = email.toLowerCase().trim();
  const data = readStore();
  const entry = data[key];

  if (!entry) return 'invalid';

  if (Date.now() > entry.expires) {
    delete data[key];
    writeStore(data);
    return 'expired';
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    delete data[key];
    writeStore(data);
    return 'max_attempts';
  }

  entry.attempts += 1;

  if (entry.code !== code.trim()) {
    writeStore(data);
    return 'invalid';
  }

  delete data[key];
  writeStore(data);
  return 'ok';
}
