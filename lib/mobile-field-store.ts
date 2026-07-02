/**
 * Mobile Field Store
 * Unified filesystem-based persistence for:
 *  - Work-order completion reports (pending approval flow)
 *  - Supervisor approval queue
 *  - Spare-parts requests
 *  - Attendance check-in / check-out
 *  - Emergency fault reports
 *  - Work-order chat threads (Phase 6)
 *  - PM Checklists (Phase 8)
 *  - Team status snapshots (Phase 7)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data', 'mobile-field');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(file: string, data: T) {
  ensureDir();
  const full = path.join(DATA_DIR, file);
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, full);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision';

export interface CompletionReport {
  id: string;
  tenant_id: string;
  work_order_id: number;
  work_order_number?: string;
  employee_no: string;
  employee_name?: string;
  report_text: string;
  materials_used?: string;
  actual_cost?: number | null;
  photos?: string[];               // base64 data-URLs (trimmed for storage)
  submitted_at: string;
  approval_status: ApprovalStatus;
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
}

export interface PartsRequestItem {
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
}

export interface PartsRequest {
  id: string;
  tenant_id: string;
  work_order_id: number;
  work_order_number?: string;
  employee_no: string;
  employee_name?: string;
  items: PartsRequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  requested_at: string;
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
}

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  employee_no: string;
  employee_name?: string;
  date: string;                    // YYYY-MM-DD
  checkin_time: string;            // ISO
  checkin_lat?: number;
  checkin_lng?: number;
  checkout_time?: string;          // ISO
  checkout_lat?: number;
  checkout_lng?: number;
  work_order_id?: number;
  notes?: string;
}

export type FaultSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FaultStatus = 'open' | 'acknowledged' | 'resolved';

export interface FaultReport {
  id: string;
  tenant_id: string;
  employee_no: string;
  employee_name?: string;
  title: string;
  description: string;
  location_name?: string;
  lat?: number;
  lng?: number;
  severity: FaultSeverity;
  reported_at: string;
  status: FaultStatus;
  linked_work_order_id?: number;
  linked_work_order_number?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  photos?: string[];
  /** true when severity=critical|high and WO was created automatically at submission time */
  auto_escalated?: boolean;
}

// ─── File names per tenant ────────────────────────────────────────────────────

function completionFile(tenantId: string) { return `completion_${tenantId}.json`; }
function partsFile(tenantId: string)      { return `parts_${tenantId}.json`; }
function attendanceFile(tenantId: string) { return `attendance_${tenantId}.json`; }
function faultFile(tenantId: string)      { return `faults_${tenantId}.json`; }

// ─── Completion Reports ───────────────────────────────────────────────────────

export function getCompletionReports(tenantId: string): CompletionReport[] {
  return readJson<CompletionReport[]>(completionFile(tenantId), []);
}

export function saveCompletionReport(tenantId: string, report: Omit<CompletionReport, 'id' | 'submitted_at'>): CompletionReport {
  const all = getCompletionReports(tenantId);
  const existing = all.findIndex((r) => r.work_order_id === report.work_order_id && r.employee_no === report.employee_no && r.approval_status === 'pending');
  const record: CompletionReport = {
    ...report,
    id: crypto.randomUUID(),
    submitted_at: new Date().toISOString(),
    approval_status: 'pending',
  };
  if (existing >= 0) {
    all[existing] = record;
  } else {
    all.push(record);
  }
  // Cap to 500 most recent
  const trimmed = all.slice(-500);
  writeJson(completionFile(tenantId), trimmed);
  return record;
}

export function reviewCompletionReport(
  tenantId: string,
  reportId: string,
  action: ApprovalStatus,
  reviewedBy: string,
  notes?: string,
): CompletionReport | null {
  const all = getCompletionReports(tenantId);
  const idx = all.findIndex((r) => r.id === reportId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    approval_status: action,
    reviewed_by: reviewedBy,
    review_notes: notes || undefined,
    reviewed_at: new Date().toISOString(),
  };
  writeJson(completionFile(tenantId), all);
  return all[idx];
}

export function getPendingCompletionReports(tenantId: string): CompletionReport[] {
  return getCompletionReports(tenantId).filter((r) => r.approval_status === 'pending');
}

export function getCompletionReportByWO(tenantId: string, workOrderId: number): CompletionReport | undefined {
  return getCompletionReports(tenantId)
    .filter((r) => r.work_order_id === workOrderId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
}

// ─── Parts Requests ───────────────────────────────────────────────────────────

export function getPartsRequests(tenantId: string): PartsRequest[] {
  return readJson<PartsRequest[]>(partsFile(tenantId), []);
}

export function savePartsRequest(tenantId: string, req: Omit<PartsRequest, 'id' | 'requested_at' | 'status'>): PartsRequest {
  const all = getPartsRequests(tenantId);
  const record: PartsRequest = {
    ...req,
    id: crypto.randomUUID(),
    requested_at: new Date().toISOString(),
    status: 'pending',
  };
  all.push(record);
  writeJson(partsFile(tenantId), all.slice(-1000));
  return record;
}

export function reviewPartsRequest(
  tenantId: string,
  requestId: string,
  status: PartsRequest['status'],
  reviewedBy: string,
  notes?: string,
): PartsRequest | null {
  const all = getPartsRequests(tenantId);
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status, reviewed_by: reviewedBy, review_notes: notes || undefined, reviewed_at: new Date().toISOString() };
  writeJson(partsFile(tenantId), all);
  return all[idx];
}

export function getPartsRequestsByWO(tenantId: string, workOrderId: number): PartsRequest[] {
  return getPartsRequests(tenantId).filter((r) => r.work_order_id === workOrderId);
}

export function getPendingPartsRequests(tenantId: string): PartsRequest[] {
  return getPartsRequests(tenantId).filter((r) => r.status === 'pending');
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function getAttendanceRecords(tenantId: string): AttendanceRecord[] {
  return readJson<AttendanceRecord[]>(attendanceFile(tenantId), []);
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTodayAttendance(tenantId: string, employeeNo: string): AttendanceRecord | undefined {
  const today = todayDate();
  return getAttendanceRecords(tenantId).find((r) => r.employee_no === employeeNo && r.date === today);
}

export function checkin(tenantId: string, data: Omit<AttendanceRecord, 'id' | 'date' | 'checkin_time'>): AttendanceRecord {
  const all = getAttendanceRecords(tenantId);
  const today = todayDate();
  const existing = all.findIndex((r) => r.employee_no === data.employee_no && r.date === today);
  const record: AttendanceRecord = {
    ...data,
    id: existing >= 0 ? all[existing].id : crypto.randomUUID(),
    date: today,
    checkin_time: new Date().toISOString(),
  };
  if (existing >= 0) {
    all[existing] = record;
  } else {
    all.push(record);
  }
  writeJson(attendanceFile(tenantId), all.slice(-5000));
  return record;
}

export function checkout(tenantId: string, employeeNo: string, lat?: number, lng?: number): AttendanceRecord | null {
  const all = getAttendanceRecords(tenantId);
  const today = todayDate();
  const idx = all.findIndex((r) => r.employee_no === employeeNo && r.date === today);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    checkout_time: new Date().toISOString(),
    checkout_lat: lat,
    checkout_lng: lng,
  };
  writeJson(attendanceFile(tenantId), all);
  return all[idx];
}

export function getAttendanceByEmployee(tenantId: string, employeeNo: string, days = 30): AttendanceRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return getAttendanceRecords(tenantId)
    .filter((r) => r.employee_no === employeeNo && r.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Fault Reports ────────────────────────────────────────────────────────────

export function getFaultReports(tenantId: string): FaultReport[] {
  return readJson<FaultReport[]>(faultFile(tenantId), []);
}

export function saveFaultReport(tenantId: string, report: Omit<FaultReport, 'id' | 'reported_at' | 'status'>): FaultReport {
  const all = getFaultReports(tenantId);
  const record: FaultReport = {
    ...report,
    id: crypto.randomUUID(),
    reported_at: new Date().toISOString(),
    status: 'open',
  };
  all.push(record);
  writeJson(faultFile(tenantId), all.slice(-2000));
  return record;
}

export function updateFaultStatus(
  tenantId: string,
  faultId: string,
  status: FaultStatus,
  linkedWoId?: number,
  extra?: { linked_work_order_number?: string; acknowledged_by?: string; auto_escalated?: boolean },
): FaultReport | null {
  const all = getFaultReports(tenantId);
  const idx = all.findIndex((r) => r.id === faultId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    status,
    ...(linkedWoId ? { linked_work_order_id: linkedWoId } : {}),
    ...(extra?.linked_work_order_number ? { linked_work_order_number: extra.linked_work_order_number } : {}),
    ...(extra?.acknowledged_by ? { acknowledged_by: extra.acknowledged_by } : {}),
    ...(extra?.auto_escalated ? { auto_escalated: true } : {}),
    ...(status === 'acknowledged' && !all[idx].acknowledged_at ? { acknowledged_at: now } : {}),
    ...(status === 'resolved' ? { resolved_at: now } : {}),
  };
  writeJson(faultFile(tenantId), all);
  return all[idx];
}

export function getFaultReportsByEmployee(tenantId: string, employeeNo: string): FaultReport[] {
  return getFaultReports(tenantId)
    .filter((r) => r.employee_no === employeeNo)
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at));
}

export function getOpenFaultReports(tenantId: string): FaultReport[] {
  return getFaultReports(tenantId)
    .filter((r) => r.status === 'open')
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at));
}

// ─── Phase 6: Work-Order Chat ─────────────────────────────────────────────────

export type MessageRole = 'technician' | 'supervisor' | 'system';

export interface ChatMessage {
  id: string;
  work_order_id: number;
  tenant_id: string;
  sender_employee_no: string;
  sender_name?: string;
  role: MessageRole;
  text: string;
  sent_at: string;
  read_by?: string[];   // employee_no list
}

function chatFile(tenantId: string, workOrderId: number) {
  return `chat_${tenantId}_wo${workOrderId}.json`;
}

export function getChatMessages(tenantId: string, workOrderId: number): ChatMessage[] {
  return readJson<ChatMessage[]>(chatFile(tenantId, workOrderId), []);
}

export function postChatMessage(
  tenantId: string,
  workOrderId: number,
  sender: { employee_no: string; name?: string; role: MessageRole },
  text: string,
): ChatMessage {
  const all = getChatMessages(tenantId, workOrderId);
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    work_order_id: workOrderId,
    tenant_id: tenantId,
    sender_employee_no: sender.employee_no,
    sender_name: sender.name,
    role: sender.role,
    text: text.trim(),
    sent_at: new Date().toISOString(),
    read_by: [sender.employee_no],
  };
  all.push(msg);
  writeJson(chatFile(tenantId, workOrderId), all.slice(-200));
  return msg;
}

export function markMessagesRead(tenantId: string, workOrderId: number, employeeNo: string): void {
  const all = getChatMessages(tenantId, workOrderId);
  let changed = false;
  for (const msg of all) {
    if (!msg.read_by) msg.read_by = [];
    if (!msg.read_by.includes(employeeNo)) {
      msg.read_by.push(employeeNo);
      changed = true;
    }
  }
  if (changed) writeJson(chatFile(tenantId, workOrderId), all);
}

export function countUnreadMessages(tenantId: string, workOrderId: number, employeeNo: string): number {
  return getChatMessages(tenantId, workOrderId)
    .filter((m) => !m.read_by?.includes(employeeNo)).length;
}

// ─── Phase 8: PM Checklists ───────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked?: boolean;
  checked_at?: string;
  notes?: string;
}

export interface ChecklistTemplate {
  id: string;
  tenant_id: string;
  name: string;
  wo_type?: string;          // optional link to a work-order type
  items: Omit<ChecklistItem, 'checked' | 'checked_at' | 'notes'>[];
  created_at: string;
}

export interface ChecklistExecution {
  id: string;
  template_id: string;
  template_name: string;
  tenant_id: string;
  work_order_id: number;
  work_order_number?: string;
  employee_no: string;
  employee_name?: string;
  items: ChecklistItem[];
  started_at: string;
  completed_at?: string;
  is_complete: boolean;
}

function checklistTemplateFile(tenantId: string) { return `checklist_templates_${tenantId}.json`; }
function checklistExecFile(tenantId: string) { return `checklist_exec_${tenantId}.json`; }

export function getChecklistTemplates(tenantId: string): ChecklistTemplate[] {
  return readJson<ChecklistTemplate[]>(checklistTemplateFile(tenantId), []);
}

export function saveChecklistTemplate(tenantId: string, tmpl: Omit<ChecklistTemplate, 'id' | 'created_at'>): ChecklistTemplate {
  const all = getChecklistTemplates(tenantId);
  const record: ChecklistTemplate = { ...tmpl, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  all.push(record);
  writeJson(checklistTemplateFile(tenantId), all);
  return record;
}

export function deleteChecklistTemplate(tenantId: string, templateId: string): boolean {
  const all = getChecklistTemplates(tenantId);
  const next = all.filter((t) => t.id !== templateId);
  if (next.length === all.length) return false;
  writeJson(checklistTemplateFile(tenantId), next);
  return true;
}

export function getChecklistExecutions(tenantId: string): ChecklistExecution[] {
  return readJson<ChecklistExecution[]>(checklistExecFile(tenantId), []);
}

export function startChecklist(
  tenantId: string,
  templateId: string,
  workOrderId: number,
  employee: { employee_no: string; name?: string; work_order_number?: string },
): ChecklistExecution {
  const templates = getChecklistTemplates(tenantId);
  const tmpl = templates.find((t) => t.id === templateId);
  if (!tmpl) throw new Error('template_not_found');

  const all = getChecklistExecutions(tenantId);
  // Don't duplicate for same WO
  const existing = all.find((e) => e.work_order_id === workOrderId && e.template_id === templateId && !e.is_complete);
  if (existing) return existing;

  const exec: ChecklistExecution = {
    id: crypto.randomUUID(),
    template_id: templateId,
    template_name: tmpl.name,
    tenant_id: tenantId,
    work_order_id: workOrderId,
    work_order_number: employee.work_order_number,
    employee_no: employee.employee_no,
    employee_name: employee.name,
    items: tmpl.items.map((item) => ({ ...item, checked: false })),
    started_at: new Date().toISOString(),
    is_complete: false,
  };

  all.push(exec);
  writeJson(checklistExecFile(tenantId), all.slice(-2000));
  return exec;
}

export function updateChecklistItem(
  tenantId: string,
  execId: string,
  itemId: string,
  checked: boolean,
  notes?: string,
): ChecklistExecution | null {
  const all = getChecklistExecutions(tenantId);
  const idx = all.findIndex((e) => e.id === execId);
  if (idx < 0) return null;

  const exec = all[idx];
  exec.items = exec.items.map((item) =>
    item.id === itemId
      ? { ...item, checked, checked_at: checked ? new Date().toISOString() : undefined, notes: notes || item.notes }
      : item,
  );

  const allRequired = exec.items.filter((i) => i.required);
  exec.is_complete = allRequired.every((i) => i.checked);
  if (exec.is_complete && !exec.completed_at) {
    exec.completed_at = new Date().toISOString();
  }

  all[idx] = exec;
  writeJson(checklistExecFile(tenantId), all);
  return exec;
}

export function getChecklistForWO(tenantId: string, workOrderId: number): ChecklistExecution[] {
  return getChecklistExecutions(tenantId)
    .filter((e) => e.work_order_id === workOrderId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

// ─── Phase 7: Team Status ─────────────────────────────────────────────────────

export interface TeamMemberStatus {
  employee_no: string;
  employee_name?: string;
  checked_in: boolean;
  checked_out: boolean;
  checkin_time?: string;
  checkout_time?: string;
  lat?: number;
  lng?: number;
  active_work_order_id?: number;
  active_work_order_number?: string;
  last_seen?: string;
}

export function getTeamStatus(tenantId: string): TeamMemberStatus[] {
  const today = todayDate();
  const records = getAttendanceRecords(tenantId).filter((r) => r.date === today);
  return records.map((r) => ({
    employee_no: r.employee_no,
    employee_name: r.employee_name,
    checked_in: !!r.checkin_time,
    checked_out: !!r.checkout_time,
    checkin_time: r.checkin_time,
    checkout_time: r.checkout_time,
    lat: r.checkin_lat,
    lng: r.checkin_lng,
    active_work_order_id: r.work_order_id,
    last_seen: r.checkout_time || r.checkin_time,
  }));
}

// ─── Phase 9: Offline Queue helpers ──────────────────────────────────────────

export interface OfflineQueueItem {
  id: string;
  tenant_id: string;
  employee_no: string;
  type: 'completion_report' | 'chat_message' | 'checklist_item' | 'fault_report' | 'parts_request';
  payload: Record<string, unknown>;
  queued_at: string;
  retries: number;
}

function offlineFile(tenantId: string) { return `offline_queue_${tenantId}.json`; }

export function enqueueOffline(tenantId: string, item: Omit<OfflineQueueItem, 'id' | 'queued_at' | 'retries'>): OfflineQueueItem {
  const all = readJson<OfflineQueueItem[]>(offlineFile(tenantId), []);
  const record: OfflineQueueItem = { ...item, id: crypto.randomUUID(), queued_at: new Date().toISOString(), retries: 0 };
  all.push(record);
  writeJson(offlineFile(tenantId), all.slice(-500));
  return record;
}

export function getOfflineQueue(tenantId: string): OfflineQueueItem[] {
  return readJson<OfflineQueueItem[]>(offlineFile(tenantId), []);
}

export function removeFromOfflineQueue(tenantId: string, ids: string[]): void {
  const all = readJson<OfflineQueueItem[]>(offlineFile(tenantId), []);
  writeJson(offlineFile(tenantId), all.filter((i) => !ids.includes(i.id)));
}

// ─── Phase 10: Field Observer Monitoring Readings ────────────────────────────

export interface MonitoringFieldDef {
  key: string;           // e.g. "ps1_inlet_pressure"
  label: string;         // Arabic label e.g. "ضغط الدخل PS1"
  unit?: string;         // e.g. "بار", "م³/يوم", "م", "عدد", "%"
  type: 'number' | 'text';
  required: boolean;
  min?: number;
  max?: number;
}

export interface MonitoringFieldGroup {
  group_key: string;     // e.g. "ps1"
  group_label: string;   // e.g. "محطة الضخ PS1"
  fields: MonitoringFieldDef[];
  ctrl_station_id?: string;  // maps to ctrl.stations.id e.g. "PS1", "EJH" — null = no DB push
}

export interface MonitoringTeam {
  id: string;
  tenant_id: string;
  team_name: string;           // e.g. "فريق محطة طاز"
  station_type: string;        // e.g. "taz", "central_branch", "well_fields", "eastern_branch", "custom"
  location_label: string;      // e.g. "منطقة طاز"
  member_employee_nos: string[];
  supervisor_employee_nos: string[];
  field_groups: MonitoringFieldGroup[];
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export interface MonitoringReading {
  id: string;
  tenant_id: string;
  team_id: string;
  team_name: string;
  station_type: string;
  location_label: string;
  reading_date: string;           // YYYY-MM-DD
  submitted_by: string;           // employee_no
  submitted_by_name: string;
  submitted_at: string;
  values: Record<string, number | string | null>;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  ingested_to_db: boolean;
  ingest_error?: string;
}

// ── Ctrl API field extractor ───────────────────────────────────────────────
// Maps STATION_PRESETS field keys → ctrl.station_readings column names
export type CtrlPayload = {
  flow_m3?: number;
  pressure_in_bar?: number;
  pressure_out_bar?: number;
  tank_level_pct?: number;
  pumps_running?: number;
  power_kw?: number;
  notes_extra?: string;
};

export function extractCtrlPayload(
  values: Record<string, number | string | null>,
  groupKey: string
): CtrlPayload {
  const n = (key: string): number | undefined => {
    const v = values[key];
    if (v === null || v === undefined || v === '') return undefined;
    const num = Number(v);
    return isNaN(num) ? undefined : num;
  };

  // suffix → ctrl column (first match wins per column)
  const SUFFIX_MAP: Record<string, keyof CtrlPayload> = {
    total_flow:             'flow_m3',
    daily_flow:             'flow_m3',
    well_field_daily_flow:  'flow_m3',
    daily_flow_pump:        'flow_m3',
    pumping_volume:         'flow_m3',
    pumping_to_tank:        'flow_m3',
    fcs_daily_flow:         'flow_m3',
    inlet_pressure:         'pressure_in_bar',
    level:                  'tank_level_pct',
    rt_level:               'tank_level_pct',
    forebay_tank_level:     'tank_level_pct',
    outlet_pressure:        'pressure_out_bar',
    active_pump_no:         'pumps_running',
    operating_pumps:        'pumps_running',
    no_pumps:               'pumps_running',
    working_wells:          'pumps_running',
    total_operation_hours:  'power_kw',
  };

  const result: Partial<Record<keyof CtrlPayload, number>> = {};
  const valveNotes: string[] = [];

  for (const [valueKey, rawVal] of Object.entries(values)) {
    if (rawVal === null || rawVal === '') continue;
    const num = Number(rawVal);
    if (isNaN(num)) continue;

    // Strip the group prefix if present
    const stripped = valueKey.startsWith(groupKey + '_')
      ? valueKey.slice(groupKey.length + 1)
      : valueKey;

    // Collect valve % readings as notes
    if (stripped.includes('opening_valve') || stripped.includes('valve_pct')) {
      valveNotes.push(`${stripped.replace(/_/g, ' ')}: ${num}%`);
      continue;
    }

    const ctrlField = SUFFIX_MAP[stripped];
    if (ctrlField && result[ctrlField] === undefined) {
      (result as Record<string, number>)[ctrlField] = num;
    }
  }

  return {
    ...result,
    pumps_running: result.pumps_running !== undefined ? Math.round(result.pumps_running) : undefined,
    notes_extra: valveNotes.length ? valveNotes.join(' | ') : undefined,
  };
}

// Station type presets — pre-defined field groups for known station types
export const STATION_PRESETS: Record<string, { label: string; field_groups: MonitoringFieldGroup[] }> = {
  central_branch: {
    label: 'المحطة المركزية (وادي الزمزم)',
    field_groups: [
      {
        group_key: 'cross_connections',
        group_label: 'محطة التوصيلات المتقاطعة',
        ctrl_station_id: undefined,   // not registered in ctrl.stations yet
        fields: [
          { key: 'cross_connections_opening_valve_1', label: 'نسبة فتح الصمام 1', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'cross_connections_opening_valve_2', label: 'نسبة فتح الصمام 2', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'cross_connections_opening_valve_3', label: 'نسبة فتح الصمام 3', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'cross_connections_total_flow', label: 'إجمالي التدفق', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'cross_connections_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'cross_connections_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'sidi_sied',
        group_label: 'خزان سيدي سيد',
        ctrl_station_id: 'SIDSD',
        fields: [
          { key: 'sidi_sied_level', label: 'منسوب الخزان', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'sidi_sied_total_flow', label: 'إجمالي التدفق', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'tarhunah',
        group_label: 'محطة ترهونة',
        ctrl_station_id: 'TARH',
        fields: [
          { key: 'tarhunah_level', label: 'مستوى الخزان', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'tarhunah_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'tarhunah_no_pumps', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'tarhunah_total_flow', label: 'إجمالي التدفق', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'ash_shwayrif_fcs',
        group_label: 'محطة الشويرف FCS',
        ctrl_station_id: 'SHWF',
        fields: [
          { key: 'ash_shwayrif_fcs_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ash_shwayrif_fcs_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ash_shwayrif_fcs_opening_valve_1', label: 'نسبة فتح الصمام 1', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_2', label: 'نسبة فتح الصمام 2', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_3', label: 'نسبة فتح الصمام 3', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_4', label: 'نسبة فتح الصمام 4', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_total_flow', label: 'إجمالي التدفق', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
        ],
      },
    ],
  },
  well_fields: {
    label: 'حقول الآبار والمضخات',
    field_groups: [
      {
        group_key: 'fezzan',
        group_label: 'خزان فزان',
        ctrl_station_id: 'FEZ',
        fields: [
          { key: 'fezzan_tank_level', label: 'مستوى الخزان', unit: 'م', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'ejh',
        group_label: 'حقل آبار EJH',
        ctrl_station_id: 'EJH',
        fields: [
          { key: 'ejh_daily_flow_pump', label: 'التدفق اليومي للمضخة', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'ejh_operating_pumps', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'ejh_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ejh_forebay_tank_level', label: 'مستوى حوض الاستقبال', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'ejh_well_field_daily_flow', label: 'التدفق اليومي لحقل الآبار', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'ejh_working_wells', label: 'عدد الآبار العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'nejh_s',
        group_label: 'حقل آبار NEJH-S',
        ctrl_station_id: 'NEJHS',
        fields: [
          { key: 'nejhs_daily_flow_pump', label: 'التدفق اليومي للمضخة', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'nejhs_operating_pumps', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'nejhs_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'nejhs_forebay_tank_level', label: 'مستوى حوض الاستقبال', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'nejhs_well_field_daily_flow', label: 'التدفق اليومي لحقل الآبار', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'nejhs_working_wells', label: 'عدد الآبار العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'nejh_n',
        group_label: 'حقل آبار NEJH-N',
        ctrl_station_id: 'NEJHN',
        fields: [
          { key: 'nejhn_daily_flow_pump', label: 'التدفق اليومي للمضخة', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'nejhn_operating_pumps', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'nejhn_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'nejhn_forebay_tank_level', label: 'مستوى حوض الاستقبال', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'nejhn_well_field_daily_flow', label: 'التدفق اليومي لحقل الآبار', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'nejhn_working_wells', label: 'عدد الآبار العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
        ],
      },
    ],
  },
  eastern_branch: {
    label: 'الفرع الشرقي',
    field_groups: [
      {
        group_key: 'aen_zara',
        group_label: 'محطة عين زارة',
        ctrl_station_id: undefined,   // not in ctrl.stations yet
        fields: [
          { key: 'aen_zara_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'aen_zara_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'aen_zara_opening_valve_pct', label: 'نسبة فتح الصمام', unit: '%', type: 'number', required: true, min: 0, max: 100 },
        ],
      },
      {
        group_key: 'airport',
        group_label: 'محطة المطار',
        ctrl_station_id: 'AIRP',
        fields: [
          { key: 'airport_daily_flow', label: 'التدفق اليومي', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'airport_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'airport_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'airport_opening_valve_pct', label: 'نسبة فتح الصمام', unit: '%', type: 'number', required: true, min: 0, max: 100 },
        ],
      },
      {
        group_key: 'sidi_saiah',
        group_label: 'خزان سيدي سعياح',
        ctrl_station_id: 'SSAI',
        fields: [
          { key: 'sidi_saiah_rt_level', label: 'مستوى الخزان', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'sidi_saiah_daily_flow', label: 'التدفق اليومي', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'sidi_saiah_opening_valve_2', label: 'نسبة فتح الصمام 2', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'sidi_saiah_opening_valve_3', label: 'نسبة فتح الصمام 3', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'sidi_saiah_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'sidi_saiah_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'wadi_tumallah',
        group_label: 'خزان وادي تملاح',
        ctrl_station_id: 'WADI',
        fields: [
          { key: 'wadi_tumallah_daily_flow', label: 'التدفق اليومي', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'wadi_tumallah_opening_valve_1', label: 'نسبة فتح الصمام 1', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'wadi_tumallah_opening_valve_2', label: 'نسبة فتح الصمام 2', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'wadi_tumallah_opening_valve_3', label: 'نسبة فتح الصمام 3', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'wadi_tumallah_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'wadi_tumallah_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'garabulli',
        group_label: 'خزان قرابولي',
        ctrl_station_id: 'GARB',
        fields: [
          { key: 'garabulli_level', label: 'مستوى الخزان', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'garabulli_daily_flow', label: 'التدفق اليومي', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'ash_shwayrif_rt',
        group_label: 'خزان الشويرف RT',
        ctrl_station_id: 'SHWF',
        fields: [
          { key: 'ash_shwayrif_rt_level', label: 'مستوى الخزان', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'ash_shwayrif_fcs_daily_flow', label: 'التدفق اليومي FCS', unit: 'م³/يوم', type: 'number', required: true, min: 0 },
          { key: 'ash_shwayrif_fcs_opening_valve_5', label: 'نسبة فتح الصمام 5', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_6', label: 'نسبة فتح الصمام 6', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_7', label: 'نسبة فتح الصمام 7', unit: '%', type: 'number', required: true, min: 0, max: 100 },
          { key: 'ash_shwayrif_fcs_opening_valve_8', label: 'نسبة فتح الصمام 8', unit: '%', type: 'number', required: true, min: 0, max: 100 },
        ],
      },
    ],
  },
  taz: {
    label: 'منطقة طاز',
    field_groups: [
      {
        group_key: 'ps1',
        group_label: 'محطة الضخ PS1',
        ctrl_station_id: 'PS1',
        fields: [
          { key: 'ps1_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ps1_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ps1_active_pump_no', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'ps1_total_operation_hours', label: 'ساعات التشغيل الإجمالية', unit: 'ساعة', type: 'number', required: true, min: 0 },
          { key: 'ps1_pumping_volume', label: 'حجم الضخ', unit: 'م³', type: 'number', required: true, min: 0 },
        ],
      },
      {
        group_key: 'ps2',
        group_label: 'محطة الضخ PS2',
        ctrl_station_id: 'PS2',
        fields: [
          { key: 'ps2_inlet_pressure', label: 'ضغط الدخل', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ps2_outlet_pressure', label: 'ضغط الخروج', unit: 'بار', type: 'number', required: true, min: 0 },
          { key: 'ps2_active_pump_no', label: 'عدد المضخات العاملة', unit: 'عدد', type: 'number', required: true, min: 0 },
          { key: 'ps2_total_operation_hours', label: 'ساعات التشغيل الإجمالية', unit: 'ساعة', type: 'number', required: true, min: 0 },
          { key: 'ps2_pumping_volume', label: 'حجم الضخ', unit: 'م³', type: 'number', required: true, min: 0 },
          { key: 'ps2_pumping_to_tank', label: 'الضخ إلى الخزان', unit: 'م³', type: 'number', required: false, min: 0 },
        ],
      },
      {
        group_key: 'tanks',
        group_label: 'خزانات المياه',
        ctrl_station_id: 'GHAR',
        fields: [
          { key: 'tank_cell_a', label: 'خلية A', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'tank_cell_b', label: 'خلية B', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'tank_cell_c', label: 'خلية C', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'tank_cell_d', label: 'خلية D', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'tank_cell_e', label: 'خلية E', unit: 'م', type: 'number', required: true, min: 0 },
          { key: 'gharyan_consumption', label: 'استهلاك غريان', unit: 'م³', type: 'number', required: true, min: 0 },
        ],
      },
    ],
  },

  // ── فريق مكافحة التآكل الميداني ─────────────────────────────────────────
  corrosion_field: {
    label: 'فريق المسح الميداني — مكافحة التآكل',
    field_groups: [
      {
        group_key: 'cp_survey',
        group_label: 'قراءات المسح الكاثودي CP',
        ctrl_station_id: undefined,
        fields: [
          { key: 'cp_on_potential',      label: 'جهد التشغيل (On Potential)',   unit: 'mV', type: 'number', required: true },
          { key: 'cp_off_potential',     label: 'جهد الإيقاف (Off Potential)',  unit: 'mV', type: 'number', required: true },
          { key: 'cp_natural_potential', label: 'الجهد الطبيعي',                unit: 'mV', type: 'number', required: false },
          { key: 'cp_current_output',    label: 'تيار الخروج',                  unit: 'mA', type: 'number', required: false },
          { key: 'cp_chainage',          label: 'الكيلومتراج',                  unit: 'م',  type: 'number', required: true },
          { key: 'cp_pipeline_id',       label: 'رقم المسار / الخط',            unit: '',   type: 'text',   required: true },
        ],
      },
      {
        group_key: 'coating_inspection',
        group_label: 'فحص الطلاء والمكونات',
        ctrl_station_id: undefined,
        fields: [
          { key: 'coating_condition',    label: 'حالة الطلاء',                  unit: '',   type: 'select', required: true,
            options: ['ممتاز', 'جيد', 'مقبول', 'تالف', 'مفقود'] },
          { key: 'coating_type',         label: 'نوع الطلاء',                   unit: '',   type: 'text',   required: false },
          { key: 'holiday_detected',     label: 'وجود ثقوب في الطلاء',          unit: '',   type: 'boolean', required: true },
          { key: 'holiday_count',        label: 'عدد الثقوب المكتشفة',          unit: 'عدد', type: 'number', required: false },
          { key: 'anode_condition',      label: 'حالة الأنود',                  unit: '',   type: 'select', required: false,
            options: ['فعّال', 'منتهي جزئياً', 'منتهي كلياً', 'غائب'] },
        ],
      },
      {
        group_key: 'obstacle_report',
        group_label: 'تقرير عوائق وملاحظات ميدانية',
        ctrl_station_id: undefined,
        fields: [
          { key: 'obstacle_type',        label: 'نوع العائق',                   unit: '',   type: 'select', required: false,
            options: ['بناء', 'طريق مغلق', 'حفريات', 'منشآت خاصة', 'مخاطر أمنية', 'أخرى'] },
          { key: 'obstacle_location',    label: 'موقع العائق',                  unit: '',   type: 'text',   required: false },
          { key: 'gps_lat',              label: 'خط العرض GPS',                 unit: '',   type: 'number', required: false },
          { key: 'gps_lon',              label: 'خط الطول GPS',                 unit: '',   type: 'number', required: false },
          { key: 'field_notes',          label: 'ملاحظات ميدانية',              unit: '',   type: 'textarea', required: false },
        ],
      },
    ],
  },
};

function monitoringTeamsFile(tenantId: string) { return `monitoring_teams_${tenantId}.json`; }
function monitoringReadingsFile(tenantId: string) { return `monitoring_readings_${tenantId}.json`; }

// ── Teams ──────────────────────────────────────────────────────────────────

export function getMonitoringTeams(tenantId: string): MonitoringTeam[] {
  return readJson<MonitoringTeam[]>(monitoringTeamsFile(tenantId), []);
}

export function getMonitoringTeam(tenantId: string, teamId: string): MonitoringTeam | undefined {
  return getMonitoringTeams(tenantId).find((t) => t.id === teamId);
}

export function saveMonitoringTeam(tenantId: string, team: Omit<MonitoringTeam, 'id' | 'created_at'>): MonitoringTeam {
  const all = getMonitoringTeams(tenantId);
  const record: MonitoringTeam = { ...team, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  all.push(record);
  writeJson(monitoringTeamsFile(tenantId), all);
  return record;
}

export function updateMonitoringTeam(tenantId: string, teamId: string, updates: Partial<MonitoringTeam>): MonitoringTeam | null {
  const all = getMonitoringTeams(tenantId);
  const idx = all.findIndex((t) => t.id === teamId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, id: teamId };
  writeJson(monitoringTeamsFile(tenantId), all);
  return all[idx];
}

// ── Readings ──────────────────────────────────────────────────────────────────

export function getMonitoringReadings(tenantId: string): MonitoringReading[] {
  return readJson<MonitoringReading[]>(monitoringReadingsFile(tenantId), []);
}

export function saveMonitoringReading(
  tenantId: string,
  reading: Omit<MonitoringReading, 'id' | 'submitted_at' | 'ingested_to_db'>
): MonitoringReading {
  const all = getMonitoringReadings(tenantId);
  const record: MonitoringReading = {
    ...reading,
    id: crypto.randomUUID(),
    submitted_at: new Date().toISOString(),
    ingested_to_db: false,
  };
  all.push(record);
  writeJson(monitoringReadingsFile(tenantId), all.slice(-2000));
  return record;
}

export function reviewMonitoringReading(
  tenantId: string,
  readingId: string,
  action: 'approved' | 'rejected',
  reviewerNo: string,
  reviewerName: string,
  notes: string
): MonitoringReading | null {
  const all = getMonitoringReadings(tenantId);
  const idx = all.findIndex((r) => r.id === readingId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    status: action,
    reviewed_by: reviewerNo,
    reviewed_by_name: reviewerName,
    reviewed_at: new Date().toISOString(),
    review_notes: notes,
  };
  writeJson(monitoringReadingsFile(tenantId), all);
  return all[idx];
}

export function markReadingIngested(tenantId: string, readingId: string, error?: string): void {
  const all = getMonitoringReadings(tenantId);
  const idx = all.findIndex((r) => r.id === readingId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ingested_to_db: !error, ingest_error: error };
  writeJson(monitoringReadingsFile(tenantId), all);
}

export function getPendingMonitoringReadings(tenantId: string): MonitoringReading[] {
  return getMonitoringReadings(tenantId).filter((r) => r.status === 'submitted');
}

export function getReadingsByTeam(tenantId: string, teamId: string, limitDays = 30): MonitoringReading[] {
  const cutoff = new Date(Date.now() - limitDays * 86400_000).toISOString().slice(0, 10);
  return getMonitoringReadings(tenantId).filter((r) => r.team_id === teamId && r.reading_date >= cutoff);
}

