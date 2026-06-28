import fs from 'fs';
import path from 'path';

export interface PlatformAssistantRecord {
  id: string;
  name: string;
  email: string;
  role: 'assistant' | 'delegate';
  notes?: string;
  active: boolean;
  created_at: number;
  updated_at: number;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'platform-owner-assistants.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): PlatformAssistantRecord[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PlatformAssistantRecord[] : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PlatformAssistantRecord[]): void {
  ensureDir();
  const tmp = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE_PATH);
}

export function listPlatformAssistants(): PlatformAssistantRecord[] {
  return readAll().sort((a, b) => b.created_at - a.created_at);
}

export function addPlatformAssistant(input: {
  name: string;
  email: string;
  role: 'assistant' | 'delegate';
  notes?: string;
}): PlatformAssistantRecord {
  const rows = readAll();
  const now = Date.now();
  const record: PlatformAssistantRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    notes: input.notes?.trim() || undefined,
    active: true,
    created_at: now,
    updated_at: now,
  };
  rows.unshift(record);
  writeAll(rows);
  return record;
}

export function setPlatformAssistantActive(id: string, active: boolean): PlatformAssistantRecord | null {
  const rows = readAll();
  const target = rows.find((row) => row.id === id);
  if (!target) return null;
  target.active = active;
  target.updated_at = Date.now();
  writeAll(rows);
  return target;
}

export function deletePlatformAssistant(id: string): boolean {
  const rows = readAll();
  const next = rows.filter((row) => row.id !== id);
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}
