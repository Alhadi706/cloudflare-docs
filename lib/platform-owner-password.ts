import fs from 'fs';
import path from 'path';
import { hashPassword, verifyPassword } from '@/lib/user-store';

type OwnerPasswordRecord = {
  hash: string;
  salt: string;
  updated_at: number;
};

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'platform-owner-password.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRecord(): OwnerPasswordRecord | null {
  try {
    if (!fs.existsSync(FILE_PATH)) return null;
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<OwnerPasswordRecord>;
    if (!parsed.hash || !parsed.salt) return null;
    return {
      hash: String(parsed.hash),
      salt: String(parsed.salt),
      updated_at: Number(parsed.updated_at || Date.now()),
    };
  } catch {
    return null;
  }
}

export function setPlatformOwnerPassword(newPassword: string): void {
  const { hash, salt } = hashPassword(newPassword);
  const payload: OwnerPasswordRecord = { hash, salt, updated_at: Date.now() };
  ensureDir();
  const tmp = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, FILE_PATH);
}

export function verifyPlatformOwnerPassword(password: string): boolean {
  const record = readRecord();
  if (!record) return false;
  return verifyPassword(password, record.hash, record.salt);
}

export function hasPlatformOwnerPasswordOverride(): boolean {
  return !!readRecord();
}
