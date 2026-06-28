/**
 * Work-Order Chat store
 * One chat thread per work order (by wo_id).
 * Storage: .data/mobile-field/wo_chat_{tenantId}.json
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  wo_id: string;            // work order ID
  tenant_id: string;
  sender_no: string;        // employee_no
  sender_name?: string;
  sender_role?: string;     // 'employee' | 'supervisor' | 'manager' | etc.
  body: string;
  attachments?: string[];   // base64 data-URIs for photos
  sent_at: string;
  read_by: string[];        // employee_nos who read it
}

// ── File helpers ─────────────────────────────────────────────────────────────

function getPath(tenantId: string): string {
  const dir = path.join(process.cwd(), '.data', 'mobile-field');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `wo_chat_${tenantId}.json`);
}

function readAll(tenantId: string): ChatMessage[] {
  const p = getPath(tenantId);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function writeAll(tenantId: string, msgs: ChatMessage[]): void {
  fs.writeFileSync(getPath(tenantId), JSON.stringify(msgs, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get all messages for a work order, oldest-first. */
export function getChatMessages(tenantId: string, woId: string): ChatMessage[] {
  return readAll(tenantId)
    .filter(m => m.wo_id === woId)
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}

/** Send a new chat message. */
export function sendChatMessage(
  tenantId: string,
  woId: string,
  senderNo: string,
  body: string,
  opts?: {
    sender_name?: string;
    sender_role?: string;
    attachments?: string[];
  },
): ChatMessage {
  const all = readAll(tenantId);
  const msg: ChatMessage = {
    id: randomUUID(),
    wo_id: woId,
    tenant_id: tenantId,
    sender_no: senderNo,
    sender_name: opts?.sender_name,
    sender_role: opts?.sender_role,
    body,
    attachments: opts?.attachments?.length ? opts.attachments : undefined,
    sent_at: new Date().toISOString(),
    read_by: [senderNo], // sender always "reads" their own message
  };
  all.push(msg);
  writeAll(tenantId, all);
  return msg;
}

/** Mark messages in a WO thread as read by an employee. */
export function markThreadRead(tenantId: string, woId: string, employeeNo: string): void {
  const all = readAll(tenantId);
  let changed = false;
  for (const m of all) {
    if (m.wo_id === woId && !m.read_by.includes(employeeNo)) {
      m.read_by.push(employeeNo);
      changed = true;
    }
  }
  if (changed) writeAll(tenantId, all);
}

/** Count unread messages across all WOs for an employee. */
export function totalUnreadForEmployee(tenantId: string, employeeNo: string): number {
  return readAll(tenantId).filter(
    m => m.sender_no !== employeeNo && !m.read_by.includes(employeeNo),
  ).length;
}

/** Count unread messages in a specific WO thread for an employee. */
export function unreadInThread(tenantId: string, woId: string, employeeNo: string): number {
  return getChatMessages(tenantId, woId).filter(
    m => m.sender_no !== employeeNo && !m.read_by.includes(employeeNo),
  ).length;
}

/** Get a map of woId → unread count for a list of work order IDs. */
export function unreadByWo(
  tenantId: string,
  woIds: string[],
  employeeNo: string,
): Record<string, number> {
  const all = readAll(tenantId);
  const result: Record<string, number> = {};
  for (const woId of woIds) result[woId] = 0;
  for (const m of all) {
    if (woIds.includes(m.wo_id) && m.sender_no !== employeeNo && !m.read_by.includes(employeeNo)) {
      result[m.wo_id] = (result[m.wo_id] || 0) + 1;
    }
  }
  return result;
}
