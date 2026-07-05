'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
const GisNotifMap = dynamic(() => import('./GisNotifMap'), { ssr: false, loading: () => <div className="h-[260px] w-full rounded-xl bg-slate-900 animate-pulse" /> });
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, MapPin, Camera,
  ChevronRight, X, RefreshCw, Send, LogIn, Phone, Hash, Bell, UserRound, Wallet,
  Wrench, Package, ShieldCheck, TriangleAlert, CalendarCheck, LogOut,
  ThumbsUp, ThumbsDown, RotateCcw, Plus, Trash2, Activity, ChevronDown,
  ChevronUp, Eye, FileText, Users, Building2, Layers, BookOpen, GitBranch,
  ExternalLink, Mail, MessageSquare, Megaphone, ClipboardCheck, Star,
  CheckCircle, XCircle,
} from 'lucide-react';

const MOBILE_TOKEN_KEY = 'mobile_auth_token';
const MOBILE_PROFILE_KEY = 'mobile_auth_profile';
const MOBILE_CACHE_KEY = 'mobile_work_orders_cache';
const MOBILE_SYNC_QUEUE_KEY = 'mobile_sync_queue';
const MOBILE_DEPT_TABS_KEY = 'mobile_dept_tabs';

// ── Department tab (one per department the employee belongs to) ────────────
type DeptTab = {
  dept: string;      // 'control_center' | 'corrosion' | 'maintenance' | ...
  label: string;     // Display label from server
  api: string;       // API endpoint
  tab_key: string;   // Unique key used as mainTab value
};

// Icon map per dept tab type
const DEPT_TAB_ICONS: Record<string, React.ElementType> = {
  ctrl_monitoring: Activity,
  corrosion_team:  Wrench,
  maintenance_team: Wrench,
};
const DEPT_TAB_COLORS: Record<string, string> = {
  ctrl_monitoring: 'text-cyan-400',
  corrosion_team:  'text-amber-400',
  maintenance_team: 'text-emerald-400',
};

// ── Corrosion team types ───────────────────────────────────────────────────
type CorrosionTeamMember = { name: string; role: string; employeeNumber: string; phone?: string };
type CorrosionTeam       = { id: string; name: string; specialization?: string; members: CorrosionTeamMember[]; updatedAt?: string };


type PendingStatusUpdate = {
  id: number;
  status: string;
  queuedAt: number;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem(MOBILE_TOKEN_KEY) || '';
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function getMobileProfile(): {
  employeeNo?: string;
  tenantCode?: string;
  fullName?: string;
  organizationName?: string;
  departmentCode?: string;
  role?: string;
} | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(MOBILE_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadSyncQueue(): PendingStatusUpdate[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(MOBILE_SYNC_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: PendingStatusUpdate[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOBILE_SYNC_QUEUE_KEY, JSON.stringify(queue));
}

// ── Circulars / Inbox ──────────────────────────────────────────────────────
interface SurveyQuestion {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'text' | 'rating';
  options?: string[];
  required?: boolean;
}

interface Circular {
  id: string;
  type: 'announcement' | 'holiday' | 'schedule' | 'policy' | 'survey' | 'training' | 'urgent';
  title: string;
  body: string;
  created_by_name?: string;
  source_dept?: string;
  priority: 'normal' | 'high' | 'urgent';
  created_at: string;
  expires_at?: string;
  questions?: SurveyQuestion[];
  read_by: string[];
  responses?: { employee_no: string; answers: Record<string, string | string[]>; submitted_at: string }[];
}

// ── WO Chat ────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  wo_id: string;
  sender_no: string;
  sender_name?: string;
  sender_role?: string;
  body: string;
  attachments?: string[];
  sent_at: string;
  read_by: string[];
}

interface WorkOrder {
  id: number;
  work_order_number?: string;
  wo_number?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  wo_type?: string;
  assigned_to?: string;
  scheduled_date?: string;
  asset_id?: string;
  asset_code?: string;
  asset_name?: string;
  asset_location?: string;
  latitude?: number;
  longitude?: number;
  source_dept?: string;
  target_department?: string;
  target_team?: string;
  routing_type?: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  created_by?: string;
  acknowledged_by?: string;
  notes?: string;
  completion_notes?: string;
  age_hours?: number;
  sla_state?: string;
  document_cycle_complete?: boolean;
}

type EmployeeRecord = {
  id: number;
  employee_number?: string;
  name?: string;
  name_ar?: string;
  role?: string;
  department?: string;
  email?: string;
  phone?: string | null;
  national_id?: string | null;
  employment_status?: string;
  hire_date?: string;
  created_at?: string;
  annual_leave_balance?: number | null;
  sick_leave_balance?: number | null;
  salary?: number | null;
  base_salary?: number | null;
  overtime_allowance?: number | null;
  field_allowance?: number | null;
  allowances?: number | null;
  deductions?: number | null;
  net_salary?: number | null;
};

type ReportPayload = {
  report: string;
  adminReply: string;
  actualCost: number | null;
};

type WorkOrderReport = {
  id: string;
  actorEmail: string | null;
  actorEmployeeNo: string | null;
  report: string;
  adminReply: string;
  actualCost: number | null;
  createdAt: string;
};

type MobileNotification = {
  id: string;
  type: 'work_order' | 'work_order_urgent' | 'payroll';
  level: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  created_at: string;
  read?: boolean;
};

type AttendanceRecord = {
  id: string;
  date: string;
  checkin_time: string;
  checkin_lat?: number;
  checkin_lng?: number;
  checkout_time?: string;
  checkout_lat?: number;
  checkout_lng?: number;
  work_order_id?: number;
  notes?: string;
};

type PartsRequestItem = { name: string; quantity: number; unit?: string; notes?: string };
type PartsRequest = {
  id: string;
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
};

type FaultReport = {
  id: string;
  title: string;
  description: string;
  location_name?: string;
  lat?: number;
  lng?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reported_at: string;
  status: 'open' | 'acknowledged' | 'resolved';
  employee_no?: string;
  employee_name?: string;
  linked_work_order_id?: number;
};

type CompletionReport = {
  id: string;
  work_order_id: number;
  work_order_number?: string;
  employee_no: string;
  employee_name?: string;
  report_text: string;
  materials_used?: string;
  actual_cost?: number | null;
  submitted_at: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'revision';
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
};

// ── Monitoring types (Phase 10) ─────────────────────────────────────────────
type MonitoringFieldDef = {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'text';
  required: boolean;
  min?: number;
  max?: number;
};
type MonitoringFieldGroup = {
  group_key: string;
  group_label: string;
  fields: MonitoringFieldDef[];
};
type MonitoringTeam = {
  id: string;
  team_name: string;
  station_type: string;
  location_label: string;
  member_employee_nos: string[];
  supervisor_employee_nos: string[];
  field_groups: MonitoringFieldGroup[];
  is_active: boolean;
};
type MonitoringReading = {
  id: string;
  team_id: string;
  team_name: string;
  station_type: string;
  location_label: string;
  reading_date: string;
  submitted_by: string;
  submitted_by_name: string;
  submitted_at: string;
  values: Record<string, number | string | null>;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
};
type MonitoringTeamSummary = {
  team_id: string;
  team_name: string;
  location_label: string;
  station_type: string;
  member_count: number;
  today_submitted: number;
  pending_review: number;
  last_reading_date: string | null;
};

function formatCurrencyLYD(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 2 }).format(Number(value));
}

function normalizeMaybeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; border: string }> = {
  critical: { label: 'حرج',    dot: 'bg-red-400',    border: 'border-red-500/40' },
  high:     { label: 'عالية',  dot: 'bg-orange-400', border: 'border-orange-500/40' },
  normal:   { label: 'عادية',  dot: 'bg-yellow-400', border: 'border-yellow-500/40' },
  medium:   { label: 'متوسطة', dot: 'bg-yellow-400', border: 'border-yellow-500/40' },
  low:      { label: 'منخفضة', dot: 'bg-green-400',  border: 'border-green-500/40' },
};

const STATUS_NEXT: Record<string, { label: string; next: string; color: string }> = {
  assigned:    { label: 'قبول الأمر وبدء التنفيذ', next: 'in_progress', color: 'bg-blue-600 hover:bg-blue-500' },
  open:        { label: 'قبول الأمر وبدء التنفيذ', next: 'in_progress', color: 'bg-blue-600 hover:bg-blue-500' },
  pending:     { label: 'قبول الأمر وبدء التنفيذ', next: 'in_progress', color: 'bg-blue-600 hover:bg-blue-500' },
  in_progress: { label: 'إغلاق وتأكيد الإنجاز',   next: 'completed',   color: 'bg-green-600 hover:bg-green-500' },
};

function normalizeOrdersPayload(input: any): WorkOrder[] {
  const list: WorkOrder[] = Array.isArray(input)
    ? input
    : Array.isArray(input?.work_orders)
      ? input.work_orders
      : Array.isArray(input?.data)
        ? input.data
        : [];

  return list.map((wo: any) => ({
    ...wo,
    wo_type: wo?.wo_type || wo?.work_type,
    work_order_number: wo?.work_order_number || wo?.wo_number,
    status: String(wo?.status || 'open').toLowerCase(),
    priority: String(wo?.priority || 'normal').toLowerCase(),
  }));
}

function PriorityDot({ priority }: { priority: string }) {
  const c = PRIORITY_CONFIG[priority?.toLowerCase()] ?? PRIORITY_CONFIG.normal;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot} shrink-0`} />;
}

// ── MobileAssetScreen ──────────────────────────────────────────────────────
type MobileAsset = {
  asset_id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  location: string;
  department: string;
  section: string;
  last_maintenance: string | null;
  open_work_orders: number;
  total_work_orders: number;
  recent_faults: { id: number; title: string; status: string; priority: string }[];
  active_projects: { id: any; name: string }[];
  coordinates: { lat: number; lng: number } | [number, number] | null;
  geometry_type: string;
  map_link_engineering: string | null;
  documents: { id: any; title: string; doc_type: string; url: string | null }[];
  document_count: number;
  recent_governance: { id: any; title: string; action_type: string; status: string; actor: string; at: string | null }[];
  integration_degraded: boolean;
};

function MobileAssetScreen({
  assetId,
  assetName,
  onClose,
  getHeaders,
}: {
  assetId: string;
  assetName?: string;
  onClose: () => void;
  getHeaders: () => Record<string, string>;
}) {
  const [asset, setAsset] = useState<MobileAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'maintenance' | 'documents' | 'governance'>('summary');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/auth/mobile/asset/${encodeURIComponent(assetId)}`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          if (res.status === 404) { setError('الأصل غير موجود في قاعدة البيانات.'); }
          else { setError(`خطأ في جلب بيانات الأصل (${res.status})`); }
          return;
        }
        const json = await res.json();
        if (isMounted) setAsset(json.asset ?? null);
      } catch {
        if (isMounted) setError('تعذر الاتصال بالخادم.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [assetId]);

  const coords = asset?.coordinates;
  const lat = coords ? (Array.isArray(coords) ? coords[1] : (coords as any).lat) : null;
  const lng = coords ? (Array.isArray(coords) ? coords[0] : (coords as any).lng) : null;
  const hasCoords = lat != null && lng != null;

  const STATUS_COLOR: Record<string, string> = {
    active:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    operational:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    maintenance:   'bg-amber-500/20  text-amber-300  border-amber-500/30',
    inactive:      'bg-slate-500/20  text-slate-300  border-slate-500/30',
    decommissioned:'bg-rose-500/20   text-rose-300   border-rose-500/30',
  };
  const statusColor = STATUS_COLOR[asset?.status?.toLowerCase() ?? ''] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';

  const TABS = [
    { id: 'summary' as const,    label: 'الملخص',    icon: <Building2 className="w-4 h-4" /> },
    { id: 'maintenance' as const,label: 'الصيانة',   icon: <Wrench className="w-4 h-4" /> },
    { id: 'documents' as const,  label: 'المستندات', icon: <FileText className="w-4 h-4" /> },
    { id: 'governance' as const, label: 'الحوكمة',   icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur shrink-0">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 shrink-0">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-cyan-400 font-mono">بيانات الأصل</p>
          <p className="text-sm font-bold text-white truncate">{asset?.name || assetName || assetId}</p>
        </div>
        <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 pb-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-400">جاري تحميل بيانات الأصل…</p>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 w-8 h-8 text-rose-400" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}
        {!loading && asset && (
          <>
            {/* SUMMARY TAB */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-cyan-300 font-mono mb-1">{asset.code || asset.asset_id}</p>
                      <h2 className="text-base font-black text-white leading-tight">{asset.name || '—'}</h2>
                    </div>
                    <span className={`shrink-0 text-xs rounded-full border px-2.5 py-1 font-semibold ${statusColor}`}>
                      {asset.status || '—'}
                    </span>
                  </div>
                  {[
                    { label: 'النوع',  value: asset.type,       icon: <Layers className="w-3.5 h-3.5" /> },
                    { label: 'الموقع', value: asset.location,   icon: <MapPin className="w-3.5 h-3.5" /> },
                    { label: 'الإدارة',value: asset.department, icon: <Building2 className="w-3.5 h-3.5" /> },
                    { label: 'القسم',  value: asset.section,    icon: <GitBranch className="w-3.5 h-3.5" /> },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1.5 text-sm border-t border-slate-800/60">
                      <span className="flex items-center gap-1.5 text-slate-400">{row.icon}{row.label}</span>
                      <span className="text-white font-semibold text-right max-w-[60%]">{row.value || '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
                    <p className="text-2xl font-black text-amber-300">{asset.open_work_orders}</p>
                    <p className="text-xs text-slate-400 mt-0.5">أوامر مفتوحة</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
                    <p className="text-2xl font-black text-slate-200">{asset.total_work_orders}</p>
                    <p className="text-xs text-slate-400 mt-0.5">إجمالي الأوامر</p>
                  </div>
                </div>

                {asset.last_maintenance && (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex items-center gap-3">
                    <CalendarCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">آخر صيانة</p>
                      <p className="text-sm font-semibold text-white">
                        {new Date(asset.last_maintenance).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                )}

                {(hasCoords || asset.map_link_engineering) && (
                  <div className="space-y-2">
                    {hasCoords && (
                      <a
                        href={`https://maps.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4 text-teal-200"
                      >
                        <MapPin className="w-5 h-5 text-teal-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">عرض على خرائط Google</p>
                          <p className="text-xs text-slate-400 font-mono">{(lat as number).toFixed(5)}, {(lng as number).toFixed(5)}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    )}
                    {asset.map_link_engineering && (
                      <a
                        href={asset.map_link_engineering}
                        className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-indigo-200"
                      >
                        <Layers className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">فتح في منصة GIS</p>
                          <p className="text-xs text-slate-400">الفضاء الهندسي — Asset 360</p>
                        </div>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MAINTENANCE TAB */}
            {activeTab === 'maintenance' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
                  <div className="px-4 py-3 text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> سياق الصيانة
                  </div>
                  {[
                    { label: 'أوامر مفتوحة',   value: asset.open_work_orders },
                    { label: 'إجمالي الأوامر', value: asset.total_work_orders },
                    { label: 'آخر صيانة', value: asset.last_maintenance
                        ? new Date(asset.last_maintenance).toLocaleDateString('ar-SA')
                        : '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-semibold text-white">{row.value ?? '—'}</span>
                    </div>
                  ))}
                </div>

                {asset.recent_faults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-rose-300 px-1">أعطال حديثة</p>
                    {asset.recent_faults.map(f => (
                      <div key={f.id} className="rounded-xl border border-rose-500/20 bg-rose-950/10 px-4 py-3 text-sm">
                        <p className="font-semibold text-white">{f.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{f.status} — {f.priority}</p>
                      </div>
                    ))}
                  </div>
                )}

                {asset.active_projects.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-violet-300 px-1">مشاريع نشطة مرتبطة</p>
                    {asset.active_projects.map(p => (
                      <div key={p.id} className="rounded-xl border border-violet-500/20 bg-violet-950/10 px-4 py-3 text-sm">
                        <p className="font-semibold text-white">{p.name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {asset.recent_faults.length === 0 && asset.active_projects.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">لا توجد أعطال أو مشاريع نشطة مسجلة.</p>
                )}
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                {asset.document_count > 0 && (
                  <p className="text-xs text-slate-400 px-1">{asset.document_count} وثيقة إجمالاً — يُعرض أحدث 10</p>
                )}
                {asset.documents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">لا توجد وثائق مرفقة.</p>
                ) : (
                  asset.documents.map(doc => (
                    <div key={doc.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 flex items-center gap-3 px-4 py-3">
                      <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{doc.title || 'وثيقة بدون عنوان'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{doc.doc_type || '—'}</p>
                      </div>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-cyan-400">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* GOVERNANCE TAB */}
            {activeTab === 'governance' && (
              <div className="space-y-3">
                {asset.recent_governance.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">لا توجد إجراءات حوكمة مسجلة.</p>
                ) : (
                  asset.recent_governance.map(g => (
                    <div key={g.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-white">{g.title}</p>
                        <span className="shrink-0 text-xs rounded-full px-2 py-0.5 bg-slate-700 text-slate-300">{g.action_type}</span>
                      </div>
                      <p className="text-xs text-slate-400">{g.actor || '—'} — {g.at ? new Date(g.at).toLocaleDateString('ar-SA') : '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{g.status}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {asset.integration_degraded && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-900/10 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                بعض مصادر البيانات غير متاحة حالياً — المعلومات قد تكون غير مكتملة.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── WorkOrderCard ──────────────────────────────────────────────────────────
function WorkOrderCard({
  wo, onSelect, onChat, unreadChat,
}: {
  wo: WorkOrder;
  onSelect: () => void;
  onChat?: () => void;
  unreadChat?: number;
}) {
  const done = ['completed', 'closed'].includes(wo.status?.toLowerCase());
  return (
    <div className={`w-full text-right rounded-2xl border transition-all ${
      done ? 'border-slate-700/40 bg-slate-900/40 opacity-60' : 'border-slate-700/60 bg-slate-900/70'
    }`}>
      <button onClick={onSelect} className="w-full text-right p-4 active:scale-[0.98]">
        <div className="flex items-start gap-3">
          <PriorityDot priority={wo.priority} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-slate-500 font-mono">{wo.wo_number || wo.work_order_number || `#${wo.id}`}</span>
              {!done && <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                wo.status === 'in_progress'
                  ? 'text-blue-300 bg-blue-500/10 border-blue-500/30'
                  : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
              }`}>{wo.status === 'in_progress' ? 'جارٍ' : 'جديد'}</span>}
              {done && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 border text-green-300 bg-green-500/10 border-green-500/20">✓ منجز</span>}
            </div>
            <p className="font-bold text-white text-sm leading-snug line-clamp-2">{wo.title}</p>
            {wo.asset_location && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3 shrink-0" /> {wo.asset_location}
              </p>
            )}
            {wo.scheduled_date && (
              <p className="mt-1 text-[11px] text-slate-500">
                📅 {new Date(wo.scheduled_date).toLocaleDateString('ar-SA')}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        </div>
      </button>
      {onChat && (
        <div className="border-t border-slate-800 px-4 py-2 flex justify-end">
          <button
            onClick={onChat}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            دردشة
            {(unreadChat || 0) > 0 && (
              <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] text-white">{unreadChat}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── WorkOrderDetail ────────────────────────────────────────────────────────
function WorkOrderDetail({
  wo, onClose, onStatusUpdate, onSubmitReport, getHeaders,
}: {
  wo: WorkOrder;
  onClose: () => void;
  onStatusUpdate: (id: number, status: string) => Promise<void>;
  onSubmitReport: (id: number, payload: ReportPayload) => Promise<void>;
  getHeaders: () => Record<string, string>;
}) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportText, setReportText] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [actualCostText, setActualCostText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportHistory, setReportHistory] = useState<WorkOrderReport[]>([]);
  const [showAssetScreen, setShowAssetScreen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextAction = STATUS_NEXT[wo.status?.toLowerCase()];
  const canShowMap = wo.latitude && wo.longitude;
  const assetId = wo.asset_id || wo.asset_code || null;

  useEffect(() => {
    setReportText(wo.completion_notes || '');
    setActualCostText(wo.actual_cost !== null && wo.actual_cost !== undefined ? String(wo.actual_cost) : '');
    setReportSent(false);
    setReportError('');
  }, [wo.id, wo.completion_notes, wo.actual_cost]);

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/v1/workspace/work-orders/${wo.id}/report`, { headers: getHeaders() });
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.data) ? json.data : [];
        if (isMounted) setReportHistory(list);
      } catch {
        if (isMounted) setReportHistory([]);
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [wo.id]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setPhotos((prev) => [...prev, ev.target!.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!nextAction) return;
    setSubmitting(true);
    await onStatusUpdate(wo.id, nextAction.next);
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleSendReport = async () => {
    const normalizedReport = reportText.trim();
    const normalizedAdminReply = adminReply.trim();
    const normalizedCost = actualCostText.trim();
    const parsedCost = normalizedCost ? Number(normalizedCost) : null;

    if (!normalizedReport && !normalizedAdminReply && !normalizedCost) {
      setReportError('أدخل بيانات التقرير قبل الإرسال.');
      return;
    }
    if (normalizedCost && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      setReportError('القيمة المالية غير صحيحة.');
      return;
    }

    setSendingReport(true);
    setReportError('');
    try {
      await onSubmitReport(wo.id, {
        report: normalizedReport,
        adminReply: normalizedAdminReply,
        actualCost: parsedCost,
      });
      setReportSent(true);
      setAdminReply('');
      const res = await fetch(`/api/v1/workspace/work-orders/${wo.id}/report`, { headers: getHeaders() });
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.data) ? json.data : [];
      setReportHistory(list);
    } catch (error: any) {
      setReportError(String(error?.message || 'تعذر إرسال التقرير.'));
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">
      {/* Asset 360 screen overlay */}
      {showAssetScreen && assetId && (
        <MobileAssetScreen
          assetId={assetId}
          assetName={wo.asset_name}
          onClose={() => setShowAssetScreen(false)}
          getHeaders={getHeaders}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-500 font-mono">{wo.wo_number || wo.work_order_number || `#${wo.id}`}</p>
          <p className="text-sm font-bold text-white truncate">{wo.title}</p>
        </div>
        <PriorityDot priority={wo.priority} />
      </div>

      <div className="flex flex-col gap-5 p-4 pb-10">
        {/* Status banner */}
        {submitted ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-950/40 p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-400" />
            <p className="text-lg font-black text-green-300">تم تحديث الأمر بنجاح</p>
            <p className="text-sm text-slate-400 mt-1">
              {nextAction?.next === 'completed' ? 'تم إغلاق أمر العمل وتسجيل الإنجاز' : 'تم بدء تنفيذ أمر العمل'}
            </p>
          </div>
        ) : (
          <>
            {/* Details */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
              {[
                { label: 'النوع',     value: wo.wo_type || '—' },
                { label: 'الأولوية', value: (PRIORITY_CONFIG[wo.priority?.toLowerCase()]?.label ?? wo.priority) || '—' },
                { label: 'الأصل',    value: wo.asset_name || '—' },
                { label: 'الموقع',   value: wo.asset_location || '—' },
                { label: 'الموعد',   value: wo.scheduled_date ? new Date(wo.scheduled_date).toLocaleDateString('ar-SA') : '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-semibold text-white text-left max-w-[60%] text-right">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Asset 360 context button */}
            {assetId && (
              <button
                onClick={() => setShowAssetScreen(true)}
                className="flex items-center gap-3 w-full rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-cyan-200 text-right"
              >
                <Building2 className="h-5 w-5 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">عرض بيانات الأصل الكاملة</p>
                  <p className="text-xs text-slate-400 mt-0.5">الصيانة — المستندات — الحوكمة — الخرائط</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            )}

            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
              <div className="px-4 py-3 text-xs font-bold text-cyan-300">البيانات المالية والإدارية</div>
              {[
                { label: 'القسم المصدر', value: wo.source_dept || '—' },
                { label: 'القسم المستهدف', value: wo.target_department || '—' },
                { label: 'الفريق المستهدف', value: wo.target_team || wo.assigned_team || '—' },
                { label: 'نوع التوجيه', value: wo.routing_type || '—' },
                { label: 'منشئ الأمر', value: wo.created_by || '—' },
                { label: 'آخر اعتماد', value: wo.acknowledged_by || '—' },
                { label: 'التكلفة التقديرية', value: formatCurrencyLYD(wo.estimated_cost) },
                { label: 'التكلفة الفعلية', value: formatCurrencyLYD(wo.actual_cost) },
                { label: 'SLA', value: wo.sla_state || '—' },
                { label: 'عمر الأمر (ساعة)', value: wo.age_hours !== undefined ? String(wo.age_hours) : '—' },
                { label: 'اكتمال الدورة', value: wo.document_cycle_complete ? 'مكتملة' : 'غير مكتملة' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-semibold text-white text-left max-w-[60%] text-right">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            {wo.description && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 mb-2">وصف المهمة</p>
                <p className="text-sm text-slate-200 leading-6">{wo.description}</p>
              </div>
            )}

            {/* Map link */}
            {(canShowMap || wo.asset_location) && (
              <a
                href={canShowMap
                  ? `https://maps.google.com/maps?q=${wo.latitude},${wo.longitude}`
                  : `https://maps.google.com/maps?q=${encodeURIComponent(wo.asset_location!)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-cyan-200 font-bold"
              >
                <MapPin className="h-5 w-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold">عرض موقع التنفيذ</p>
                  <p className="text-xs text-slate-400 mt-0.5">{wo.asset_location || `${wo.latitude}, ${wo.longitude}`}</p>
                </div>
                <ChevronRight className="h-4 w-4 mr-auto" />
              </a>
            )}

            {/* Notes */}
            {nextAction && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
                <label className="text-xs text-slate-400 mb-2 block">ملاحظات الإنجاز (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none"
                />
              </div>
            )}

            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
              <p className="text-xs font-bold text-cyan-300">إرسال تقرير رد على أمر العمل</p>
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                rows={3}
                placeholder="التقرير التنفيذي أو النتيجة الفنية"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <textarea
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                rows={2}
                placeholder="ملاحظة إدارية (اختياري)"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={actualCostText}
                onChange={(e) => setActualCostText(e.target.value)}
                placeholder="التكلفة الفعلية (اختياري)"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {reportError && <p className="text-xs text-rose-300">{reportError}</p>}
              {reportSent && <p className="text-xs text-emerald-300">تم إرسال التقرير بنجاح.</p>}
              <button
                onClick={handleSendReport}
                disabled={sendingReport}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-700 py-3 text-sm font-black text-white hover:bg-cyan-600 disabled:opacity-60"
              >
                {sendingReport ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingReport ? 'جارٍ إرسال التقرير...' : 'إرسال التقرير'}
              </button>

              {reportHistory.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                  <p className="text-[11px] text-slate-400">آخر التقارير المرسلة</p>
                  {reportHistory.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-700/70 bg-slate-800/70 p-2">
                      <p className="text-[11px] text-slate-400">
                        {new Date(row.createdAt).toLocaleString('ar-SA')} • {row.actorEmployeeNo || row.actorEmail || '—'}
                      </p>
                      {row.report && <p className="text-xs text-slate-200 mt-1">{row.report}</p>}
                      {row.adminReply && <p className="text-xs text-cyan-200 mt-1">{row.adminReply}</p>}
                      {row.actualCost !== null && <p className="text-xs text-emerald-300 mt-1">التكلفة: {formatCurrencyLYD(row.actualCost)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Photo upload */}
            {nextAction && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 mb-3">صور ميدانية (اختياري)</p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => fileRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-all">
                    <Camera className="h-5 w-5 mb-1" />
                    <span className="text-[10px]">أضف صورة</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={handlePhoto} />
                </div>
              </div>
            )}

            {/* Action button */}
            {nextAction && (
              <button onClick={handleSubmit} disabled={submitting}
                className={`w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-60 ${nextAction.color}`}>
                {submitting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : nextAction.next === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
                {submitting ? 'جارٍ التحديث...' : nextAction.label}
              </button>
            )}

            {!nextAction && (
              <div className="rounded-2xl border border-green-500/20 bg-green-950/30 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-400" />
                <p className="text-sm font-bold text-green-300">أمر العمل مكتمل</p>
              </div>
            )}

            {/* Phase 8 — Checklist */}
            <ChecklistPanel wo={wo} getHeaders={getHeaders} />

            {/* Phase 6 — Chat */}
            <WorkOrderChat wo={wo} getHeaders={getHeaders} />
          </>
        )}
      </div>
    </div>
  );
}

// ── WorkOrderChat ─────────────────────────────────────────────────────────
function WorkOrderChat({ wo, getHeaders }: { wo: WorkOrder; getHeaders: () => Record<string, string> }) {
  type Msg = { id: string; sender_name?: string; sender_employee_no: string; role: string; text: string; sent_at: string };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/auth/mobile/chat?wo_id=${wo.id}`, { headers: getHeaders() })
      .then((r) => r.ok ? r.json() : {})
      .then((d) => { setMessages(Array.isArray(d.messages) ? d.messages : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wo.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText('');
    try {
      const res = await fetch('/api/auth/mobile/chat', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ work_order_id: wo.id, text: t }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages((prev) => [...prev, d.message]);
      }
    } finally { setSending(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60">
      <div className="px-4 py-3 text-xs font-bold text-slate-300 border-b border-slate-700">💬 المحادثة</div>
      <div className="max-h-56 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-center text-xs text-slate-400">جارٍ التحميل...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-slate-500">لا توجد رسائل. ابدأ المحادثة مع الفريق</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'supervisor' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${
              msg.role === 'supervisor'
                ? 'bg-indigo-700/80 text-white rounded-tr-sm'
                : 'bg-slate-700/80 text-slate-100 rounded-tl-sm'
            }`}>
              <p className={`text-[10px] font-bold mb-0.5 ${msg.role === 'supervisor' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {msg.sender_name || msg.sender_employee_no} {msg.role === 'supervisor' ? '(مشرف)' : ''}
              </p>
              <p>{msg.text}</p>
              <p className="text-[9px] mt-1 opacity-50">{new Date(msg.sent_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-slate-700">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
          placeholder="اكتب رسالة..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
        <button onClick={() => void send()} disabled={sending || !text.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-700 text-white disabled:opacity-40 hover:bg-indigo-600">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── ChecklistPanel ────────────────────────────────────────────────────────
function ChecklistPanel({ wo, getHeaders }: { wo: WorkOrder; getHeaders: () => Record<string, string> }) {
  type TmplItem = { id: string; label: string; required: boolean };
  type Tmpl = { id: string; name: string; items: TmplItem[] };
  type ExecItem = { id: string; label: string; required: boolean; checked?: boolean; notes?: string };
  type Exec = { id: string; template_name: string; items: ExecItem[]; is_complete: boolean; started_at: string };

  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [executions, setExecutions] = useState<Exec[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTmpl, setSelectedTmpl] = useState('');
  const [starting, setStarting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeExec, setActiveExec] = useState<Exec | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/auth/mobile/checklist?mode=templates`, { headers: getHeaders() }).then((r) => r.ok ? r.json() : {}),
      fetch(`/api/auth/mobile/checklist?wo_id=${wo.id}`, { headers: getHeaders() }).then((r) => r.ok ? r.json() : {}),
    ]).then(([td, ed]) => {
      const tmpls = Array.isArray(td.templates) ? td.templates : [];
      setTemplates(tmpls);
      const execs = Array.isArray(ed.executions) ? ed.executions : [];
      setExecutions(execs);
      const incomplete = execs.find((e: Exec) => !e.is_complete);
      if (incomplete) setActiveExec(incomplete);
      if (tmpls.length && !selectedTmpl) setSelectedTmpl(tmpls[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [wo.id]);

  const startExec = async () => {
    if (!selectedTmpl) return;
    setStarting(true);
    try {
      const res = await fetch('/api/auth/mobile/checklist', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'start', template_id: selectedTmpl, work_order_id: wo.id, work_order_number: wo.work_order_number || wo.wo_number }),
      });
      if (res.ok) {
        const d = await res.json();
        setActiveExec(d.execution);
        setExecutions((prev) => [d.execution, ...prev]);
      }
    } finally { setStarting(false); }
  };

  const toggleItem = async (execId: string, itemId: string, checked: boolean) => {
    setUpdating(itemId);
    try {
      const res = await fetch('/api/auth/mobile/checklist', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'check', execution_id: execId, item_id: itemId, checked }),
      });
      if (res.ok) {
        const d = await res.json();
        setActiveExec(d.execution);
        setExecutions((prev) => prev.map((e) => e.id === execId ? d.execution : e));
      }
    } finally { setUpdating(null); }
  };

  if (loading) return <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-center text-xs text-slate-400">جارٍ التحميل...</div>;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60">
      <div className="px-4 py-3 text-xs font-bold text-slate-300 border-b border-slate-700">📋 قائمة فحص الصيانة</div>
      {activeExec ? (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">{activeExec.template_name}</p>
            {activeExec.is_complete && (
              <span className="text-[10px] bg-emerald-700/60 text-emerald-200 rounded-full px-2 py-0.5 font-bold">✓ مكتمل</span>
            )}
          </div>
          <div className="space-y-1.5">
            {activeExec.items.map((item) => (
              <button
                key={item.id}
                onClick={() => void toggleItem(activeExec.id, item.id, !item.checked)}
                disabled={updating === item.id}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-right transition-all ${
                  item.checked
                    ? 'border-emerald-500/30 bg-emerald-950/30'
                    : item.required
                      ? 'border-slate-600 bg-slate-800/80 hover:border-slate-500'
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600'
                }`}
              >
                <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                  item.checked ? 'border-emerald-400 bg-emerald-400' : 'border-slate-500'
                }`}>
                  {item.checked && <span className="text-[10px] text-white font-black">✓</span>}
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${item.checked ? 'line-through text-slate-400' : 'text-white'}`}>{item.label}</p>
                  {item.required && !item.checked && <p className="text-[10px] text-amber-400">مطلوب</p>}
                </div>
                {updating === item.id && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
              </button>
            ))}
          </div>
          {!activeExec.is_complete && (
            <p className="text-[11px] text-amber-300 text-center pt-1">
              {activeExec.items.filter((i) => i.required && !i.checked).length} بند مطلوب متبقٍ
            </p>
          )}
          <button onClick={() => setActiveExec(null)} className="w-full text-xs text-slate-500 py-1">عرض قوائم أخرى</button>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {executions.filter((e) => e.is_complete).length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2 text-center text-xs text-emerald-300">
              ✓ يوجد {executions.filter((e) => e.is_complete).length} قائمة مكتملة مسبقاً
            </div>
          )}
          <p className="text-xs text-slate-400">اختر قائمة فحص لبدء التنفيذ</p>
          <select
            value={selectedTmpl}
            onChange={(e) => setSelectedTmpl(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none"
          >
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => void startExec()} disabled={starting || !selectedTmpl}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-700 py-2.5 text-xs font-black text-white hover:bg-slate-600 disabled:opacity-60">
            {starting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
            بدء قائمة الفحص
          </button>
        </div>
      )}
    </div>
  );
}

// ── ApprovalCard ─────────────────────────────────────────────────────────
function ApprovalCard({ report, onReview }: {
  report: CompletionReport;
  onReview: (id: string, action: 'approved' | 'rejected' | 'revision', notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async (action: 'approved' | 'rejected' | 'revision') => {
    setBusy(true);
    await onReview(report.id, action, notes || undefined);
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Wrench className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-slate-400">أمر عمل #{report.work_order_number || report.work_order_id}</p>
          <p className="text-xs text-slate-400">{report.employee_name || report.employee_no}</p>
        </div>
        <span className="text-[10px] text-slate-500">{new Date(report.submitted_at).toLocaleDateString('ar-SA')}</span>
      </div>
      <p className="text-sm text-white">{report.report_text}</p>
      {report.materials_used && <p className="text-xs text-slate-300">المواد: {report.materials_used}</p>}
      {report.actual_cost != null && <p className="text-xs text-emerald-300">التكلفة: {formatCurrencyLYD(report.actual_cost)}</p>}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        rows={2}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
      />
      <div className="flex gap-2">
        <button onClick={() => void handle('approved')} disabled={busy}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-60">
          <ThumbsUp className="h-3.5 w-3.5" /> اعتماد
        </button>
        <button onClick={() => void handle('revision')} disabled={busy}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-amber-700 py-2.5 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-60">
          <RotateCcw className="h-3.5 w-3.5" /> مراجعة
        </button>
        <button onClick={() => void handle('rejected')} disabled={busy}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-rose-700 py-2.5 text-xs font-black text-white hover:bg-rose-600 disabled:opacity-60">
          <ThumbsDown className="h-3.5 w-3.5" /> رفض
        </button>
      </div>
    </div>
  );
}

// ── PartsApprovalCard ─────────────────────────────────────────────────────
function PartsApprovalCard({ request, onReview }: {
  request: PartsRequest;
  onReview: (id: string, status: string, notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async (status: string) => {
    setBusy(true);
    await onReview(request.id, status, notes || undefined);
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Package className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-slate-400">أمر عمل #{request.work_order_number || request.work_order_id}</p>
          <p className="text-xs text-slate-400">{request.employee_name || request.employee_no}</p>
        </div>
      </div>
      <div className="space-y-1">
        {request.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white">{item.name}</span>
            <span className="text-slate-400">{item.quantity} {item.unit || ''}</span>
          </div>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظة"
        rows={1}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
      />
      <div className="flex gap-2">
        <button onClick={() => void handle('approved')} disabled={busy}
          className="flex-1 rounded-xl bg-emerald-700 py-2 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-60">
          موافقة
        </button>
        <button onClick={() => void handle('rejected')} disabled={busy}
          className="flex-1 rounded-xl bg-rose-700 py-2 text-xs font-black text-white hover:bg-rose-600 disabled:opacity-60">
          رفض
        </button>
      </div>
    </div>
  );
}

// ── FaultReportModal ──────────────────────────────────────────────────────
function FaultReportModal({ onClose, onSubmitted, getHeaders }: {
  onClose: () => void;
  onSubmitted: () => void;
  getHeaders: () => Record<string, string>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoEscalated, setAutoEscalated] = useState(false);
  const [escalationWo, setEscalationWo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const faultFileRef = useRef<HTMLInputElement>(null);

  const handleFaultPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 4) { setError('الحد الأقصى 4 صور'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setPhotos((prev) => [...prev, ev.target!.result as string]);
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) { setError('العنوان والوصف مطلوبان'); return; }
    setSubmitting(true);
    setError('');
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        await new Promise<void>((resolve) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(); return; }
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 4000 },
          );
        });
      } catch { /* skip GPS */ }

      const res = await fetch('/api/auth/mobile/fault-report', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location_name: locationName.trim() || undefined,
          severity,
          lat,
          lng,
          photos: photos.length > 0 ? photos : undefined,
        }),
      });

      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        setAutoEscalated(!!d.auto_escalated);
        setEscalationWo(d.work_order_number ?? null);
        setSubmitted(true);
        setTimeout(onSubmitted, 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(String(d?.detail || 'تعذر إرسال البلاغ'));
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
          <X className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-slate-400">بلاغ عطل</p>
          <p className="text-sm font-bold text-red-300">إبلاغ عن عطل طارئ</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4 pb-10">
        {submitted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
            <p className="text-lg font-black text-emerald-300">تم إرسال البلاغ</p>
            {autoEscalated ? (
              <>
                <p className="text-sm text-red-300 mt-1 font-bold">⚡ تم التصعيد التلقائي — أمر عمل طارئ أُنشئ فوراً</p>
                {escalationWo && <p className="text-xs text-cyan-300 mt-1 font-mono">{escalationWo}</p>}
                <p className="text-xs text-slate-400 mt-1">تم إشعار مدراء الإدارات المعنية</p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-1">سيراجعه المشرف ويعتمده</p>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-3 flex items-start gap-2">
              <TriangleAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200">يُستخدم هذا النموذج لإبلاغ عن أعطال طارئة تحتاج تدخلاً سريعاً. المشرف سيتولى إنشاء أمر العمل.</p>
            </div>

            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان العطل (مثال: تسرب ماء في محطة الضخ)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500" />

            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={4} placeholder="وصف تفصيلي للعطل..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none" />

            <input value={locationName} onChange={(e) => setLocationName(e.target.value)}
              placeholder="الموقع (اختياري)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none" />

            {/* Severity */}
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs text-slate-400 mb-2">درجة الخطورة</p>
              <div className="grid grid-cols-4 gap-1">
                {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
                  <button key={s} onClick={() => setSeverity(s)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${severity === s
                      ? s === 'critical' ? 'bg-red-700 text-white' : s === 'high' ? 'bg-orange-700 text-white' : s === 'medium' ? 'bg-amber-700 text-white' : 'bg-green-700 text-white'
                      : 'bg-slate-800 text-slate-400'}`}>
                    {s === 'critical' ? 'حرج' : s === 'high' ? 'عالي' : s === 'medium' ? 'متوسط' : 'منخفض'}
                  </button>
                ))}
              </div>
              {/* Severity routing hint */}
              {(severity === 'critical' || severity === 'high') ? (
                <div className="mt-2 rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1.5 flex items-start gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300">سيُحوَّل تلقائياً لأمر عمل طارئ ويُشعَر مدراء الإدارات فور الإرسال</p>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/10 px-2.5 py-1.5 flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300">سيُراجَع من المشرف للاعتماد وإنشاء أمر عمل</p>
                </div>
              )}
            </div>

            {/* Photo upload */}
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs text-slate-400 mb-3">صور الموقع <span className="text-slate-500">(حتى 4 صور — اختياري)</span></p>
              <div className="flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    onClick={() => faultFileRef.current?.click()}
                    className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-slate-500 hover:border-red-500/50 hover:text-red-400 transition-all">
                    <Camera className="h-5 w-5 mb-1" />
                    <span className="text-[10px]">أضف صورة</span>
                  </button>
                )}
                <input
                  ref={faultFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFaultPhoto}
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-300">{error}</p>}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-700 py-4 text-base font-black text-white hover:bg-red-600 disabled:opacity-60 active:scale-[0.98]">
              {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {submitting ? 'جارٍ الإرسال...' : 'إرسال البلاغ الطارئ'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MobileFieldPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('all');
  const [mainTab, setMainTab] = useState<string>('orders');
  const [deptTabs, setDeptTabs] = useState<DeptTab[]>([]);
  // Corrosion team state
  const [corrosionTeams, setCorrosionTeams] = useState<CorrosionTeam[]>([]);
  const [corrosionWorkOrders, setCorrosionWorkOrders] = useState<WorkOrder[]>([]);
  const [corrosionLoading, setCorrosionLoading] = useState(false);
  const [tenantCode, setTenantCode] = useState('');
  const [empId, setEmpId] = useState('');
  const [secret, setSecret] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [employeeLabel, setEmployeeLabel] = useState('—');
  const [profile, setProfile] = useState<ReturnType<typeof getMobileProfile>>(null);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [serverAlerts, setServerAlerts] = useState<MobileNotification[]>([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [gisNotifs, setGisNotifs] = useState<any[]>([]);
  const [gisNotifsLoading, setGisNotifsLoading] = useState(false);
  const [gisUnreadCount, setGisUnreadCount] = useState(0);
  const [selectedGisNotif, setSelectedGisNotif] = useState<any>(null);
  const pendingNotifIdRef = useRef<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [alertFilter, setAlertFilter] = useState<'all' | 'urgent' | 'payroll'>('all');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [installReady, setInstallReady] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  // Leave requests
  type LeaveReqItem = { id: string; leave_type: string; start_date: string; end_date: string; days: number; reason: string; status: string; submitted_at: string; rejection_reason?: string };
  const [leaveRequests, setLeaveRequests] = useState<LeaveReqItem[]>([]);
  const [leaveUsedDays, setLeaveUsedDays] = useState<Record<string, number>>({});
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveSubmitMsg, setLeaveSubmitMsg] = useState('');

  // Phase 4: Attendance
  const [attendance, setAttendance] = useState<{ today: AttendanceRecord | null; checked_in: boolean; checked_out: boolean } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);

  // Phase 3: Parts Requests
  const [showPartsModal, setShowPartsModal] = useState<WorkOrder | null>(null);
  const [partsItems, setPartsItems] = useState<PartsRequestItem[]>([{ name: '', quantity: 1, unit: '' }]);
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsSent, setPartsSent] = useState(false);

  // Phase 5: Fault Report
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [myFaultReports, setMyFaultReports] = useState<FaultReport[]>([]);
  const [faultLoading, setFaultLoading] = useState(false);

  // Phase 2: Approval Queue (for supervisors)
  const [approvalQueue, setApprovalQueue] = useState<CompletionReport[]>([]);
  const [pendingPartsReqs, setPendingPartsReqs] = useState<PartsRequest[]>([]);
  const [openFaultReports, setOpenFaultReports] = useState<FaultReport[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const announcedAlertIdsRef = useRef<Set<string>>(new Set());

  // Phase 10: Monitoring (رصد)
  const [isMonitoringObserver, setIsMonitoringObserver] = useState(false);
  const [myMonitoringTeam, setMyMonitoringTeam] = useState<MonitoringTeam | null>(null);
  const [myMonitoringTeams, setMyMonitoringTeams] = useState<MonitoringTeam[]>([]);
  const [selectedMonitoringTeamId, setSelectedMonitoringTeamId] = useState<string | null>(null);
  const [myRecentReadings, setMyRecentReadings] = useState<MonitoringReading[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringFormValues, setMonitoringFormValues] = useState<Record<string, string>>({});
  const [monitoringNotes, setMonitoringNotes] = useState('');
  const [monitoringDate, setMonitoringDate] = useState(new Date().toISOString().slice(0, 10));
  const [monitoringSubmitting, setMonitoringSubmitting] = useState(false);
  const [monitoringSubmitDone, setMonitoringSubmitDone] = useState(false);
  const [monitoringSubmitError, setMonitoringSubmitError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [monitoringView, setMonitoringView] = useState<'form' | 'history'>('form');
  // Supervisor monitoring state
  const [monitoringTeamsSummary, setMonitoringTeamsSummary] = useState<MonitoringTeamSummary[]>([]);
  const [pendingMonitoringReadings, setPendingMonitoringReadings] = useState<MonitoringReading[]>([]);
  const [monitoringReviewLoading, setMonitoringReviewLoading] = useState(false);
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null);

  // Inbox (circulars + surveys)
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [circularsLoading, setCircularsLoading] = useState(false);
  const [unreadCirculars, setUnreadCirculars] = useState(0);
  const [openCircular, setOpenCircular] = useState<Circular | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string | string[]>>({});
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyDone, setSurveyDone] = useState(false);

  // WO Chat
  const [chatWo, setChatWo] = useState<WorkOrder | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});

  const startAlertPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    const interval = setInterval(() => {
      void fetchMobileAlerts();
    }, 30000);
    setPollingInterval(interval);
  };

  const stopAlertPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const flushSyncQueue = async () => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;

    const queue = loadSyncQueue();
    if (!queue.length) {
      setPendingSyncCount(0);
      return;
    }

    const remaining: PendingStatusUpdate[] = [];
    for (const item of queue) {
      try {
        const res = await fetch(`/api/v1/workspace/work-orders/${item.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ status: item.status }),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }

    saveSyncQueue(remaining);
    setPendingSyncCount(remaining.length);
    if (!remaining.length) {
      fetchOrders();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
      // Auto-register push subscription if permission already granted
      if (Notification.permission === 'granted') {
        void registerPushSubscription();
      }
    }
    const initialOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    setIsOnline(initialOnline);
    const initialQueue = loadSyncQueue();
    setPendingSyncCount(initialQueue.length);
    // Auto-flush on load if already online and there are pending items
    if (initialOnline && initialQueue.length > 0) {
      setTimeout(() => { void flushSyncQueue(); }, 1500);
    }

    const onOnline = () => {
      setIsOnline(true);
      flushSyncQueue();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { __mobileInstallPrompt?: InstallPromptEvent }).__mobileInstallPrompt = event as InstallPromptEvent;
      setInstallReady(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    const token = localStorage.getItem(MOBILE_TOKEN_KEY);
    if (token) {
      const profile = getMobileProfile();
      setProfile(profile);
      if (profile?.fullName) {
        setEmployeeLabel(`${profile.fullName}${profile.employeeNo ? ` (${profile.employeeNo})` : ''}`);
      } else if (profile?.employeeNo) {
        setEmployeeLabel(profile.employeeNo);
      }
      setLoggedIn(true);
      // Load stored dept_tabs
      try {
        const storedDeptTabs = localStorage.getItem(MOBILE_DEPT_TABS_KEY);
        if (storedDeptTabs) {
          const parsed: DeptTab[] = JSON.parse(storedDeptTabs);
          if (Array.isArray(parsed)) {
            setDeptTabs(parsed);
            // Fetch data for each stored dept tab
            for (const dt of parsed) {
              if (dt.tab_key === 'corrosion_team') void fetchCorrosionTeam();
            }
          }
        }
      } catch { /* ignore */ }
      // Handle deep-link tab from URL param (e.g. push notification click)
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab === 'gis-alerts') setMainTab('gis-alerts');
      if (urlTab === 'access-requests') setMainTab('access-requests');
      const urlNotifId = new URLSearchParams(window.location.search).get('notif_id');
      if (urlNotifId) pendingNotifIdRef.current = urlNotifId;
      if (profile?.employeeNo) {
        void fetchMobileProfile();
        void fetchMobileAlerts();
        void fetchAttendance();
        void fetchMyFaults();
        void fetchCirculars();
        void fetchMyMonitoringTeam();
        void fetchGisNotifs();
        // Auto-refresh dept_tabs if localStorage is empty (session from before dept_tabs feature)
        void refreshDeptTabsIfNeeded();
        if (['dept_manager', 'section_manager', 'admin', 'founder'].includes(profile?.role || '')) {
          void fetchAccessRequests();
        }
        startAlertPolling();
      }
      fetchOrders();
      flushSyncQueue();
    } else {
      setLoading(false);
    }

    // Refresh monitoring team when user returns to the app (tab switch / PWA foreground)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem(MOBILE_TOKEN_KEY)) {
        void fetchMyMonitoringTeam();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopAlertPolling();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const requestInstall = async () => {
    const deferred = (window as Window & { __mobileInstallPrompt?: InstallPromptEvent }).__mobileInstallPrompt;
    if (!deferred) {
      setInstallMessage('من المتصفح اختر Add to Home Screen لإظهار أيقونة التطبيق.');
      return;
    }

    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallMessage('تم إرسال طلب التثبيت.');
      setInstallReady(false);
    } else {
      setInstallMessage('تم إلغاء التثبيت. يمكنك المحاولة مرة أخرى.');
    }
  };

  const fetchMobileProfile = async () => {
    try {
      const res = await fetch('/api/auth/mobile/me', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      // me endpoint returns flat structure; admin/finance are optional enrichment
      const admin   = data?.admin   || {};
      const finance = data?.finance || {};
      const fullName = data?.full_name || admin?.full_name || '';
      // Update employeeLabel with correct name from server
      if (fullName) {
        const empNo = data?.employee_no || profile?.employeeNo || '';
        setEmployeeLabel(`${fullName}${empNo ? ` (${empNo})` : ''}`);
      }
      setEmployeeRecord({
        id: Number(admin?.id || data?.id || 0),
        employee_number: data?.employee_no || admin?.employee_number || profile?.employeeNo || undefined,
        name:    fullName || undefined,
        name_ar: fullName || undefined,
        role:              admin?.role     || data?.role          || undefined,
        department:        admin?.department || data?.department_code || undefined,
        email:             admin?.email    || data?.email         || undefined,
        employment_status: admin?.employment_status              || undefined,
        hire_date:         admin?.hire_date                      || undefined,
        annual_leave_balance: normalizeMaybeNumber(admin?.annual_leave_balance),
        sick_leave_balance:   normalizeMaybeNumber(admin?.sick_leave_balance),
        base_salary:        normalizeMaybeNumber(finance?.base_salary),
        overtime_allowance: normalizeMaybeNumber(finance?.overtime_allowance),
        field_allowance:    normalizeMaybeNumber(finance?.field_allowance),
        allowances:         normalizeMaybeNumber(finance?.allowances),
        deductions:         normalizeMaybeNumber(finance?.deductions),
        net_salary:         normalizeMaybeNumber(finance?.net_salary),
      });
    } catch { /* ignore */ }
  };

  const fetchMobileAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/notifications', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      setServerAlerts(items);
      setServerUnreadCount(Number(data?.unread_count || 0));

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        for (const item of items) {
          if (item?.read) continue;
          if (announcedAlertIdsRef.current.has(item.id)) continue;
          if (item.level !== 'high' && item.level !== 'medium') continue;
          announcedAlertIdsRef.current.add(item.id);
          try {
            // Native browser notification while app is open.
            new Notification(item.title, { body: item.message });
          } catch {
            // Ignore browser notification failures.
          }
        }
      }
    } catch {
      // Keep local alerts fallback.
    } finally {
      setAlertsLoading(false);
    }
  };

  const enableDeviceNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      // After permission granted, register Web Push subscription
      if (permission === 'granted') {
        void registerPushSubscription();
      }
    } catch {
      setNotificationPermission('denied');
    }
  };

  const registerPushSubscription = async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      // Fetch VAPID public key
      const keyRes = await fetch('/api/auth/mobile/push-subscribe');
      const keyData = await keyRes.json().catch(() => ({}));
      const vapidKey = keyData?.vapid_public_key;
      if (!vapidKey) return;

      const reg = await navigator.serviceWorker.ready;
      // Convert base64url VAPID key to Uint8Array
      const b64 = vapidKey.replace(/-/g, '+').replace(/_/g, '/');
      const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: raw,
      });

      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch('/api/auth/mobile/push-subscribe', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'subscribe', subscription: subJson }),
      });
    } catch {
      // Push subscription failed — fall back to in-app polling only
    }
  };

  const markAllServerAlertsRead = async () => {
    const ids = serverAlerts.map((item) => item.id).filter(Boolean);
    if (!ids.length) return;

    setMarkingRead(true);
    try {
      const res = await fetch('/api/auth/mobile/notifications', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'mark_all_read', ids }),
      });

      if (res.ok) {
        setServerAlerts((prev) => prev.map((item) => ({ ...item, read: true })));
        setServerUnreadCount(0);
      }
    } finally {
      setMarkingRead(false);
    }
  };

  const markSingleAlertRead = async (alertId: string) => {
    try {
      const res = await fetch('/api/auth/mobile/notifications', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'mark_read', ids: [alertId] }),
      });

      if (res.ok) {
        setServerAlerts((prev) => prev.map((item) => (item.id === alertId ? { ...item, read: true } : item)));
        setServerUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch {
      // Ignore mark error
    }
  };

  // Phase 4 — Attendance
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/attendance', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setAttendance({ today: data.today, checked_in: data.checked_in, checked_out: data.checked_out });
      }
      const histRes = await fetch('/api/auth/mobile/attendance?mode=history&days=14', { headers: getHeaders() });
      if (histRes.ok) {
        const data = await histRes.json().catch(() => ({}));
        setAttendanceHistory(Array.isArray(data.records) ? data.records : []);
      }
    } catch { /* keep existing state */ } finally {
      setAttendanceLoading(false);
    }
  };

  const doCheckin = async (lat?: number, lng?: number) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/attendance', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'checkin', lat, lng }),
      });
      if (res.ok) { await fetchAttendance(); }
    } catch { /* ignore */ } finally { setAttendanceLoading(false); }
  };

  const doCheckout = async (lat?: number, lng?: number) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/attendance', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'checkout', lat, lng }),
      });
      if (res.ok) { await fetchAttendance(); }
    } catch { /* ignore */ } finally { setAttendanceLoading(false); }
  };

  const requestGpsAndCheckin = (action: 'checkin' | 'checkout') => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (action === 'checkin') void doCheckin(pos.coords.latitude, pos.coords.longitude);
          else void doCheckout(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (action === 'checkin') void doCheckin();
          else void doCheckout();
        },
        { timeout: 5000 },
      );
    } else {
      if (action === 'checkin') void doCheckin();
      else void doCheckout();
    }
  };

  // Phase 2 — Approval Queue
  const fetchApprovalQueue = async () => {
    if (!profile?.role) return;
    setApprovalLoading(true);
    try {
      const [compRes, partsRes, faultRes] = await Promise.all([
        fetch('/api/auth/mobile/approval?mode=pending', { headers: getHeaders() }),
        fetch('/api/auth/mobile/parts-request?mode=pending', { headers: getHeaders() }),
        fetch('/api/auth/mobile/fault-report?mode=open', { headers: getHeaders() }),
      ]);
      if (compRes.ok) {
        const d = await compRes.json().catch(() => ({}));
        setApprovalQueue(Array.isArray(d.reports) ? d.reports : []);
      }
      if (partsRes.ok) {
        const d = await partsRes.json().catch(() => ({}));
        setPendingPartsReqs(Array.isArray(d.requests) ? d.requests : []);
      }
      if (faultRes.ok) {
        const d = await faultRes.json().catch(() => ({}));
        setOpenFaultReports(Array.isArray(d.reports) ? d.reports : []);
      }
    } catch { /* ignore */ } finally { setApprovalLoading(false); }
  };

  const reviewReport = async (reportId: string, approval: 'approved' | 'rejected' | 'revision', notes?: string) => {
    const res = await fetch('/api/auth/mobile/approval', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ action: 'review', report_id: reportId, approval, notes }),
    });
    if (res.ok) { await fetchApprovalQueue(); }
  };

  const reviewPartsReq = async (requestId: string, status: string, notes?: string) => {
    const res = await fetch('/api/auth/mobile/parts-request', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ action: 'review', request_id: requestId, status, notes }),
    });
    if (res.ok) { await fetchApprovalQueue(); }
  };

  const acknowledgeFault = async (faultId: string) => {
    const res = await fetch('/api/auth/mobile/fault-report', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ action: 'update_status', fault_id: faultId, status: 'acknowledged' }),
    });
    if (res.ok) { await fetchApprovalQueue(); }
  };

  // Phase 5 — My Fault Reports
  const fetchGisNotifs = useCallback(async () => {
    setGisNotifsLoading(true);
    try {
      const res = await fetch('/api/gis/notifications?limit=30');
      if (res.ok) {
        const d = await res.json();
        const notifs: any[] = d.notifications || [];
        setGisNotifs(notifs);
        setGisUnreadCount(d.unread_count || 0);
        // Auto-open notification from push notification click
        if (pendingNotifIdRef.current) {
          const found = notifs.find((n) => n.id === pendingNotifIdRef.current);
          if (found) { setSelectedGisNotif(found); pendingNotifIdRef.current = null; }
        }
      }
    } catch { /* ignore */ } finally { setGisNotifsLoading(false); }
  }, []);

  const fetchAccessRequests = useCallback(async () => {
    setAccessRequestsLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/access-requests?status=pending', { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setAccessRequests(d.requests || []);
      }
    } catch { /* ignore */ } finally { setAccessRequestsLoading(false); }
  }, []);

  const reviewAccessRequest = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setReviewingRequest(requestId);
    try {
      const res = await fetch('/api/auth/mobile/access-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ request_id: requestId, action, reason }),
      });
      if (res.ok) {
        void fetchAccessRequests();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || 'خطأ في المراجعة');
      }
    } catch { alert('تعذر الاتصال'); } finally { setReviewingRequest(null); }
  };

  const markGisNotifRead = async (id: string | 'all') => {
    await fetch(`/api/gis/notifications?id=${id}`, { method: 'PATCH' }).catch(() => null);
    void fetchGisNotifs();
  };

  const fetchMyFaults = async () => {
    setFaultLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/fault-report', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setMyFaultReports(Array.isArray(data.reports) ? data.reports : []);
      }
    } catch { /* ignore */ } finally { setFaultLoading(false); }
  };

  // Phase 7 — Team Status Dashboard
  const [teamStatus, setTeamStatus] = useState<any | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  const fetchTeamStatus = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/team-status', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTeamStatus(data);
      }
    } catch { /* ignore */ } finally { setTeamLoading(false); }
  };

  // Inbox — circulars & surveys
  const fetchCirculars = async () => {
    setCircularsLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/circulars', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => []);
        const list: Circular[] = Array.isArray(data) ? data : [];
        setCirculars(list);
        const myNo = getMobileProfile()?.employeeNo || '';
        setUnreadCirculars(list.filter(c => myNo && !c.read_by.includes(myNo)).length);
      }
    } catch { /* ignore */ } finally { setCircularsLoading(false); }
  };

  const markCircularRead = async (id: string) => {
    try {
      await fetch('/api/auth/mobile/circulars', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'mark_read', id }),
      });
      setCirculars(prev => prev.map(c => {
        if (c.id !== id) return c;
        const myNo = getMobileProfile()?.employeeNo || '';
        if (!c.read_by.includes(myNo)) {
          setUnreadCirculars(n => Math.max(0, n - 1));
          return { ...c, read_by: [...c.read_by, myNo] };
        }
        return c;
      }));
    } catch { /* ignore */ }
  };

  const submitSurvey = async (circularId: string) => {
    setSurveySubmitting(true);
    try {
      const res = await fetch('/api/auth/mobile/circulars', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'submit_survey', id: circularId, answers: surveyAnswers }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setSurveyDone(true);
        void fetchCirculars();
      }
    } catch { /* ignore */ } finally { setSurveySubmitting(false); }
  };

  // WO Chat
  const openChat = async (wo: WorkOrder) => {
    setChatWo(wo);
    setChatLoading(true);
    setChatMessages([]);
    try {
      const woId = String(wo.id);
      const res = await fetch(`/api/auth/mobile/wo-chat?wo_id=${woId}&action=mark_read`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setChatMessages(Array.isArray(data) ? data : []);
      }
      // Update chat unread count for this WO to 0
      setChatUnread(prev => ({ ...prev, [woId]: 0 }));
    } catch { /* ignore */ } finally { setChatLoading(false); }
  };

  const sendChatMsg = async () => {
    if (!chatWo || !chatInput.trim() || chatSending) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatSending(true);
    try {
      const res = await fetch('/api/auth/mobile/wo-chat', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          wo_id: String(chatWo.id),
          body: text,
          wo_title: chatWo.title,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.message) setChatMessages(prev => [...prev, data.message]);
      }
    } catch { /* ignore */ } finally { setChatSending(false); }
  };

  const fetchChatUnread = async (woIds: string[]) => {
    if (!woIds.length) return;
    try {
      const res = await fetch(`/api/auth/mobile/wo-chat?wo_ids=${woIds.join(',')}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatUnread(prev => ({ ...prev, ...data }));
      }
    } catch { /* ignore */ }
  };


  // Phase 10 — Monitoring (رصد)
  const fetchMyMonitoringTeam = async () => {
    setMonitoringLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/monitoring?mode=my_team', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const allTeams: MonitoringTeam[] = Array.isArray(data.teams) ? data.teams : [];
        const primaryTeam = data.team ?? allTeams[0] ?? null;
        setMyMonitoringTeams(allTeams);
        setMyMonitoringTeam(primaryTeam);
        setIsMonitoringObserver(allTeams.length > 0);
        setMyRecentReadings(Array.isArray(data.recent_readings) ? data.recent_readings : []);
        if (primaryTeam) {
          setExpandedGroups(new Set(primaryTeam.field_groups.map((g: MonitoringFieldGroup) => g.group_key)));
          if (!selectedMonitoringTeamId) setSelectedMonitoringTeamId(primaryTeam.id);
        }
        if (allTeams.length > 0) {
          const stored = localStorage.getItem(MOBILE_DEPT_TABS_KEY);
          if (stored) {
            try { setDeptTabs(JSON.parse(stored)); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ } finally { setMonitoringLoading(false); }
  };

  // ── Corrosion team fetch ─────────────────────────────────────────────────
  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/leave-request', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setLeaveRequests(Array.isArray(data.leave_requests) ? data.leave_requests : []);
        setLeaveUsedDays(data.used_days || {});
      }
    } catch { /* ignore */ } finally { setLeaveLoading(false); }
  };

  const submitLeaveRequest = async () => {
    if (!leaveType || !leaveStartDate || !leaveEndDate) return;
    setLeaveSubmitting(true);
    setLeaveSubmitMsg('');
    try {
      const res = await fetch('/api/auth/mobile/leave-request', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ leave_type: leaveType, start_date: leaveStartDate, end_date: leaveEndDate, reason: leaveReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLeaveSubmitMsg('✓ تم إرسال الطلب بنجاح — في انتظار الموافقة');
        setShowLeaveForm(false);
        setLeaveStartDate(''); setLeaveEndDate(''); setLeaveReason(''); setLeaveType('annual');
        void fetchLeaveRequests();
      } else {
        setLeaveSubmitMsg(`⚠ ${data.detail || 'حدث خطأ'}`);
      }
    } catch { setLeaveSubmitMsg('⚠ تعذر الاتصال'); } finally { setLeaveSubmitting(false); }
  };

  const cancelLeaveRequest = async (id: string) => {
    const res = await fetch('/api/auth/mobile/leave-request', {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ id }),
    });
    if (res.ok) void fetchLeaveRequests();
  };

  const fetchCorrosionTeam = async () => {
    setCorrosionLoading(true);
    try {
      const res = await fetch('/api/auth/mobile/corrosion-teams', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCorrosionTeams(Array.isArray(data.teams) ? data.teams : []);
        const wos = Array.isArray(data.work_orders) ? data.work_orders : [];
        setCorrosionWorkOrders(wos.map((w: any) => ({
          id:               w.id,
          title:            w.title || w.title_ar || 'أمر عمل',
          status:           w.status || 'open',
          priority:         w.priority || 'medium',
          work_order_number: w.work_order_number || w.wo_number,
          scheduled_date:   w.scheduled_date,
          asset_name:       w.asset_name,
          _team_name:       w._team_name,
        } as WorkOrder & { _team_name?: string })));
      }
    } catch { /* ignore */ } finally { setCorrosionLoading(false); }
  };

  // Auto-detect dept tabs on mount (for sessions created before dept_tabs feature)
  const refreshDeptTabsIfNeeded = async () => {
    const stored = localStorage.getItem(MOBILE_DEPT_TABS_KEY);
    const hasTabs = stored && JSON.parse(stored).length > 0;
    if (hasTabs) return; // Already have tabs, nothing to do

    const tabs: DeptTab[] = [];
    try {
      // Check monitoring membership
      const mRes = await fetch('/api/auth/mobile/monitoring?mode=my_team', { headers: getHeaders() });
      if (mRes.ok) {
        const mData = await mRes.json().catch(() => ({}));
        if (mData.team) {
          tabs.push({
            dept: 'control_center',
            label: `راصد — ${mData.team.team_name || mData.team.station_name || 'الرصد'}`,
            api: '/api/auth/mobile/monitoring',
            tab_key: 'ctrl_monitoring',
          });
          setMyMonitoringTeam(mData.team);
          setIsMonitoringObserver(true);
          if (mData.team.field_groups) {
            setExpandedGroups(new Set(mData.team.field_groups.map((g: MonitoringFieldGroup) => g.group_key)));
          }
        }
      }
    } catch { /* ignore */ }

    try {
      // Check corrosion team membership
      const cRes = await fetch('/api/auth/mobile/corrosion-teams', { headers: getHeaders() });
      if (cRes.ok) {
        const cData = await cRes.json().catch(() => ({}));
        if (cData.has_team && cData.teams?.length) {
          tabs.push({
            dept: 'corrosion',
            label: `فريقي — ${cData.teams[0].name}`,
            api: '/api/auth/mobile/corrosion-teams',
            tab_key: 'corrosion_team',
          });
          setCorrosionTeams(cData.teams);
          setCorrosionWorkOrders(cData.work_orders || []);
        }
      }
    } catch { /* ignore */ }

    if (tabs.length) {
      setDeptTabs(tabs);
      localStorage.setItem(MOBILE_DEPT_TABS_KEY, JSON.stringify(tabs));
    }
  };

  const fetchMonitoringApprovalQueue = async () => {
    setMonitoringReviewLoading(true);
    try {
      const [pendingRes, summaryRes] = await Promise.all([
        fetch('/api/auth/mobile/monitoring?mode=pending', { headers: getHeaders() }),
        fetch('/api/auth/mobile/monitoring?mode=all_teams_summary', { headers: getHeaders() }),
      ]);
      if (pendingRes.ok) {
        const data = await pendingRes.json().catch(() => ({}));
        setPendingMonitoringReadings(Array.isArray(data.readings) ? data.readings : []);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json().catch(() => ({}));
        setMonitoringTeamsSummary(Array.isArray(data.teams) ? data.teams : []);
      }
    } catch { /* ignore */ } finally { setMonitoringReviewLoading(false); }
  };

  const submitMonitoringReading = async (asDraft = false) => {
    if (!myMonitoringTeam) return;
    setMonitoringSubmitting(true);
    setMonitoringSubmitError('');
    try {
      const values: Record<string, number | string | null> = {};
      const currentTeam = myMonitoringTeams.find(t => t.id === selectedMonitoringTeamId) ?? myMonitoringTeam;
      for (const group of (currentTeam?.field_groups ?? [])) {
        for (const field of group.fields) {
          const raw = monitoringFormValues[field.key] ?? '';
          if (raw === '') {
            values[field.key] = null;
          } else if (field.type === 'number') {
            const n = parseFloat(raw);
            values[field.key] = isNaN(n) ? null : n;
          } else {
            values[field.key] = raw;
          }
        }
      }
      const res = await fetch('/api/auth/mobile/monitoring', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: asDraft ? 'save_draft' : 'submit',
          team_id:      currentTeam?.id,
          station_id:   (currentTeam as any)?.station_id,
          reading_date: monitoringDate,
          values,
          notes: monitoringNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMonitoringSubmitDone(true);
        setMonitoringFormValues({});
        setMonitoringNotes('');
        void fetchMyMonitoringTeam();
        setTimeout(() => setMonitoringSubmitDone(false), 4000);
      } else {
        setMonitoringSubmitError(data.message || data.error || 'حدث خطأ أثناء الإرسال');
      }
    } catch { setMonitoringSubmitError('تعذر الاتصال بالخادم'); } finally { setMonitoringSubmitting(false); }
  };

  const reviewMonitoringReading = async (readingId: string, approval: 'approved' | 'rejected', notes = '') => {
    const res = await fetch('/api/auth/mobile/monitoring', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'review', reading_id: readingId, approval, notes }),
    });
    if (res.ok) { void fetchMonitoringApprovalQueue(); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantCode.trim() || !empId.trim() || !secret.trim()) return;
    setLoginError('');
    setLoading(true);

    const res = await fetch('/api/auth/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_code: tenantCode.trim(),
        employee_no: empId.trim(),
        secret: secret.trim(),
      }),
    }).catch(() => null);

    if (!res) {
      setLoading(false);
      setLoginError('تعذر الاتصال بالخادم. حاول مرة أخرى.');
      return;
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.token) {
      setLoading(false);
      setLoginError(String(payload?.detail || payload?.error || 'تعذر تسجيل الدخول'));
      return;
    }

    localStorage.setItem(MOBILE_TOKEN_KEY, payload.token);
    const nextProfile = {
      employeeNo: empId.trim(),
      tenantCode: payload?.tenant_code || tenantCode.trim(),
      fullName: payload?.full_name || '',
      organizationName: payload?.organization_name || '',
      departmentCode: payload?.department_code || '',
      role: payload?.role || 'employee',
    };
    localStorage.setItem(MOBILE_PROFILE_KEY, JSON.stringify({ ...nextProfile }));

    // Store dept_tabs from login response
    const loginDeptTabs: DeptTab[] = Array.isArray(payload?.dept_tabs) ? payload.dept_tabs : [];
    setDeptTabs(loginDeptTabs);
    if (loginDeptTabs.length) {
      localStorage.setItem(MOBILE_DEPT_TABS_KEY, JSON.stringify(loginDeptTabs));
    }

    setProfile(nextProfile);
    setEmployeeLabel(payload?.full_name ? `${payload.full_name} (${empId.trim()})` : empId.trim());
    setLoggedIn(true);
    setSecret('');
    void fetchMobileProfile();
    void fetchMobileAlerts();
    void fetchAttendance();
    void fetchMyFaults();
    void fetchCirculars();
    void fetchMyMonitoringTeam();
    // Load each dept-specific API on login
    for (const dt of loginDeptTabs) {
      if (dt.tab_key === 'corrosion_team') void fetchCorrosionTeam();
    }
    startAlertPolling();
    await fetchOrders();
    await flushSyncQueue();
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const workflowRes = await fetch('/api/v1/workspace/workflow-orders?limit=50', { headers: getHeaders() });
      if (workflowRes.ok) {
        const d = await workflowRes.json();
        const list = normalizeOrdersPayload(d);
        setWorkOrders(list);
        localStorage.setItem(MOBILE_CACHE_KEY, JSON.stringify(list));
        // Fetch chat unread counts for these work orders
        if (list.length) void fetchChatUnread(list.map((w: WorkOrder) => String(w.id)));
        return;
      }

      const legacyRes = await fetch('/api/v1/workspace/work-orders?limit=50', { headers: getHeaders() });
      if (legacyRes.ok) {
        const d = await legacyRes.json();
        const list = normalizeOrdersPayload(d);
        setWorkOrders(list);
        localStorage.setItem(MOBILE_CACHE_KEY, JSON.stringify(list));
        if (list.length) void fetchChatUnread(list.map((w: WorkOrder) => String(w.id)));
      }
    } catch {
      const raw = localStorage.getItem(MOBILE_CACHE_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (Array.isArray(cached)) setWorkOrders(cached);
        } catch {
          // Ignore corrupted cache
        }
      }
    } finally { setLoading(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    setWorkOrders((prev) => prev.map((wo) => wo.id === id ? { ...wo, status } : wo));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);

    try {
      const res = await fetch(`/api/v1/workspace/work-orders/${id}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const queue = loadSyncQueue();
        queue.push({ id, status, queuedAt: Date.now() });
        saveSyncQueue(queue);
        setPendingSyncCount(queue.length);
      } else if (['completed', 'closed'].includes(status)) {
        // Auto-resolve any fault report linked to this work order
        void fetch('/api/auth/mobile/fault-report', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: 'resolve_by_wo', work_order_id: id }),
        }).catch(() => null);
      }
    } catch {
      const queue = loadSyncQueue();
      queue.push({ id, status, queuedAt: Date.now() });
      saveSyncQueue(queue);
      setPendingSyncCount(queue.length);
    }
  };

  const submitReport = async (id: number, payload: ReportPayload) => {
    const res = await fetch(`/api/v1/workspace/work-orders/${id}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(String(err?.detail || err?.error || 'تعذر إرسال التقرير.'));
    }

    setWorkOrders((prev) => prev.map((wo) => (
      wo.id === id
        ? {
          ...wo,
          ...(payload.report ? { completion_notes: payload.report } : {}),
          ...(payload.actualCost !== null ? { actual_cost: payload.actualCost } : {}),
        }
        : wo
    )));

    if (selected?.id === id) {
      setSelected({
        ...selected,
        ...(payload.report ? { completion_notes: payload.report } : {}),
        ...(payload.actualCost !== null ? { actual_cost: payload.actualCost } : {}),
      });
    }
  };

  const filteredOrders = workOrders.filter((wo) => {
    const done = ['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase());
    if (filter === 'active') return !done;
    if (filter === 'done')   return done;
    return true;
  });

  const activeCount = workOrders.filter((wo) => !['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase())).length;
  const urgentCount = workOrders.filter((wo) => ['critical', 'high'].includes(wo.priority?.toLowerCase()) && !['completed', 'closed'].includes(wo.status?.toLowerCase())).length;
  const localAlerts = [
    ...(urgentCount > 0 ? [{ id: 'urgent', level: 'high', text: `لديك ${urgentCount} أمر/أوامر عاجلة تحتاج متابعة` }] : []),
    ...(pendingSyncCount > 0 ? [{ id: 'sync', level: 'medium', text: `يوجد ${pendingSyncCount} تحديث بانتظار المزامنة` }] : []),
    ...(activeCount === 0 && workOrders.length > 0 ? [{ id: 'done', level: 'low', text: 'كل الأوامر الحالية مكتملة، راجع الأرشيف أو التقارير' }] : []),
  ];
  const unreadAlerts = serverUnreadCount + localAlerts.filter((a) => a.level === 'high' || a.level === 'medium').length;
  
  const filteredServerAlerts = serverAlerts.filter((item) => {
    if (alertFilter === 'urgent') return item.level === 'high' || item.level === 'medium';
    if (alertFilter === 'payroll') return item.type === 'payroll';
    return true;
  });

  const isSupervisor = ['supervisor', 'manager', 'admin', 'department_head', 'dept_manager', 'section_manager'].includes(profile?.role || '');
  // رصد tab visible only to supervisors or confirmed monitoring team members
  const showMonitoringTab = isSupervisor || isMonitoringObserver;
  // Active monitoring team: prefer selectedMonitoringTeamId, fallback to primary
  const activeMonitoringTeam = myMonitoringTeams.find(t => t.id === selectedMonitoringTeamId)
    ?? myMonitoringTeam;
  const approvalBadge = approvalQueue.length + pendingPartsReqs.length + openFaultReports.length;

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 gap-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 border border-emerald-500/30">
            <ClipboardList className="h-10 w-10 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-black text-white">أوامري — الميدان</h1>
          <p className="mt-2 text-sm text-slate-400">الدخول يتطلب موافقة المؤسسة ثم الرقم السري</p>
        </div>
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              placeholder="رمز المؤسسة"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 pr-10 pl-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              autoComplete="organization"
            />
            <p className="mt-1 text-[11px] text-slate-500">للدخول السريع استخدم: asset</p>
          </div>
          <div className="relative">
            <Hash className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="الرقم الوظيفي"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 pr-10 pl-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              inputMode="text"
              autoComplete="username"
            />
            <p className="mt-1 text-[11px] text-slate-500">مثال: EMP-1001 (ليس الدور مثل member/admin)</p>
          </div>
          <div className="relative">
            <LogIn className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="الرقم السري"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 pr-10 pl-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              autoComplete="current-password"
            />
          </div>
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-500 active:scale-[0.98] transition-all">
            <LogIn className="h-5 w-5" /> دخول
          </button>
          {loginError && (
            <p className="text-xs text-rose-300 text-center">{loginError}</p>
          )}
          <button
            type="button"
            onClick={requestInstall}
            className="w-full rounded-2xl border border-cyan-600/50 bg-cyan-900/20 py-3 text-sm font-bold text-cyan-200"
          >
            {installReady ? 'تثبيت كتطبيق' : 'إرشادات التثبيت'}
          </button>
          {installMessage && <p className="text-xs text-cyan-200 text-center">{installMessage}</p>}

          <a
            href="/entry"
            className="block w-full text-center rounded-2xl border border-emerald-600/40 bg-emerald-900/20 py-3 text-sm font-bold text-emerald-200"
          >
            تسجيل حساب جديد
          </a>
        </form>
        <p className="text-xs text-slate-600 text-center">
          تحتاج اعتماد طلب الوصول أولاً عبر الإدارة<br />
          <a href="/entry/mobile-qa" className="text-emerald-500 underline">فتح خطوات التفعيل</a>
        </p>
      </div>
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 pb-40">

      {selected && (
        <WorkOrderDetail
          wo={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={updateStatus}
          onSubmitReport={submitReport}
          getHeaders={getHeaders}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        {(!isOnline || pendingSyncCount > 0) && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>{!isOnline ? 'أنت الآن بدون إنترنت. سيتم حفظ التحديثات محلياً.' : `يوجد ${pendingSyncCount} تحديث بانتظار المزامنة.`}</span>
            {isOnline && pendingSyncCount > 0 && (
              <button
                onClick={() => { void flushSyncQueue(); }}
                className="shrink-0 rounded-md bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/40 px-2 py-1 text-amber-100 transition-colors"
              >
                مزامنة الآن
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-emerald-400 font-semibold">موظف: {employeeLabel}</p>
            <h1 className="text-base font-black text-white leading-tight">أوامر العمل</h1>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                {urgentCount}
              </span>
            )}
            <button onClick={() => {
              void fetchMobileProfile();
              void fetchMobileAlerts();
              void fetchOrders();
            }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            </button>
            <button onClick={() => {
              localStorage.removeItem(MOBILE_TOKEN_KEY);
              localStorage.removeItem(MOBILE_PROFILE_KEY);
              localStorage.removeItem(MOBILE_CACHE_KEY);
              setEmployeeLabel('—');
              setLoggedIn(false);
              setWorkOrders([]);
            }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-center">
            <p className="text-base font-black text-amber-300">{activeCount}</p>
            <p className="text-[10px] text-slate-400">مفتوحة</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-center">
            <p className="text-base font-black text-red-300">{urgentCount}</p>
            <p className="text-[10px] text-slate-400">عاجلة</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-center">
            <p className="text-base font-black text-green-300">{workOrders.length - activeCount}</p>
            <p className="text-[10px] text-slate-400">مكتملة</p>
          </div>
        </div>

        {/* Main app tabs */}
        <div className="mt-3 grid gap-1 rounded-xl bg-slate-900/60 p-1" style={{ gridTemplateColumns: `repeat(${5 + deptTabs.length + (isSupervisor ? 2 : 0)},1fr)` }}>
          {([
            ['orders',     'أوامر',    ClipboardList],
            ['attendance', 'حضور',     CalendarCheck],
            ['faults',     'بلاغات',   TriangleAlert],
            ['inbox',      'بريد',     Mail],
            ['info',       'معلوماتي', UserRound],
            ['alerts',     'تنبيهات',  Bell],
            ['gis-alerts', 'كوارث',    MapPin],
            ...(isSupervisor ? [['approval', 'اعتماد', ShieldCheck] as const] : []),
            ...(isSupervisor ? [['access-requests', 'تسجيلات', Users] as const] : []),
          ] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => {
                setMainTab(val);
                if (val === 'approval') {
                  void fetchApprovalQueue();
                  void fetchTeamStatus();
                }
                if (val === 'inbox') void fetchCirculars();
                if (val === 'info') void fetchLeaveRequests();
                if (val === 'gis-alerts') void fetchGisNotifs();
                if (val === 'access-requests') void fetchAccessRequests();
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-bold transition-all ${
                mainTab === val ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {val === 'alerts' && unreadAlerts > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{unreadAlerts}</span>
              )}
              {val === 'faults' && myFaultReports.filter(f => f.status === 'open').length > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{myFaultReports.filter(f => f.status === 'open').length}</span>
              )}
              {val === 'approval' && approvalBadge > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white">{approvalBadge}</span>
              )}
            </button>
          ))}

          {/* Dynamic dept tabs — one per department the employee belongs to */}
          {deptTabs.map((dt) => {
            const Icon = DEPT_TAB_ICONS[dt.tab_key] ?? Activity;
            const color = DEPT_TAB_COLORS[dt.tab_key] ?? 'text-cyan-400';
            // Short label: first word before —
            const shortLabel = dt.label.split('—')[0].trim().slice(0, 5);
            return (
              <button
                key={dt.tab_key}
                onClick={() => {
                  setMainTab(dt.tab_key);
                  if (dt.tab_key === 'ctrl_monitoring') {
                    isSupervisor ? void fetchMonitoringApprovalQueue() : void fetchMyMonitoringTeam();
                  }
                  if (dt.tab_key === 'corrosion_team') void fetchCorrosionTeam();
                }}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-bold transition-all ${
                  mainTab === dt.tab_key ? 'bg-slate-700 text-white' : `${color} hover:text-white`
                }`}
                title={dt.label}
              >
                <Icon className="h-3.5 w-3.5" />
                {shortLabel}
              </button>
            );
          })}
        </div>

        {/* Filter tabs */}
        {mainTab === 'orders' && <div className="mt-3 flex gap-1 rounded-xl bg-slate-900/60 p-1">
          {([['active', 'النشطة'], ['done', 'المكتملة'], ['all', 'الكل']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                filter === val ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>}
      </div>

      {/* List */}
      <div className="px-4 pt-4 space-y-3">
        {mainTab === 'orders' && (loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">جارٍ تحميل أوامر العمل...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <ClipboardList className="h-12 w-12 text-slate-700" />
            <p className="text-slate-400 font-bold">
              {filter === 'active' ? 'لا توجد أوامر عمل نشطة' : filter === 'done' ? 'لا توجد أوامر مكتملة' : 'لا توجد أوامر عمل'}
            </p>
          </div>
        ) : (
          filteredOrders.map((wo) => (
            <WorkOrderCard
              key={wo.id}
              wo={wo}
              onSelect={() => setSelected(wo)}
              onChat={() => openChat(wo)}
              unreadChat={chatUnread[String(wo.id)] || 0}
            />
          ))
        ))}

        {mainTab === 'info' && (
          <>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
              <div className="px-4 py-3 text-xs font-bold text-emerald-300">معلوماتي الإدارية</div>
              {[
                { label: 'الاسم', value: employeeRecord?.name_ar || employeeRecord?.name || profile?.fullName || '—' },
                { label: 'الرقم الوظيفي', value: employeeRecord?.employee_number || profile?.employeeNo || '—' },
                { label: 'المؤسسة', value: profile?.organizationName || '—' },
                { label: 'رمز المؤسسة', value: profile?.tenantCode || tenantCode || '—' },
                { label: 'القسم', value: employeeRecord?.department || profile?.departmentCode || '—' },
                { label: 'الدور', value: employeeRecord?.role || profile?.role || 'employee' },
                { label: 'الحالة', value: employeeRecord?.employment_status || '—' },
                { label: 'تاريخ التعيين', value: employeeRecord?.hire_date ? new Date(employeeRecord.hire_date).toLocaleDateString('ar-SA') : '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-semibold text-white text-left max-w-[62%] text-right">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 divide-y divide-cyan-900/50">
              <div className="px-4 py-3 text-xs font-bold text-cyan-300 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                معلوماتي المالية الشخصية
              </div>
              {[
                { label: 'الراتب الأساسي', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.base_salary ?? employeeRecord?.salary)) },
                { label: 'الإضافي / overtime', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.overtime_allowance)) },
                { label: 'الحقلية', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.field_allowance)) },
                { label: 'البدلات الأخرى', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.allowances)) },
                { label: 'الاستقطاعات', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.deductions)) },
                { label: 'الصافي', value: formatCurrencyLYD(normalizeMaybeNumber(employeeRecord?.net_salary)) },
                { label: 'الإجازة السنوية', value: employeeRecord?.annual_leave_balance != null ? `${employeeRecord.annual_leave_balance} يوم` : '—' },
                { label: 'الإجازة المرضية', value: employeeRecord?.sick_leave_balance != null ? `${employeeRecord.sick_leave_balance} يوم` : '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-300">{row.label}</span>
                  <span className="font-semibold text-white">{row.value}</span>
                </div>
              ))}
              <div className="px-4 py-3 text-[11px] text-slate-400 leading-5">
                إذا لم تظهر الأرقام هنا فهذا يعني أن كشف الرواتب الفردي غير مربوط بعد من الشؤون الإدارية. عند تفعيله سيظهر الراتب والإضافي والحقلية تلقائياً.
              </div>
            </div>
          </>
        )}

        {mainTab === 'alerts' && (
          <>
            {notificationPermission !== 'granted' && (
              <button
                onClick={enableDeviceNotifications}
                className="w-full rounded-xl border border-emerald-500/40 bg-emerald-900/30 px-4 py-2.5 text-sm font-bold text-emerald-200"
              >
                تفعيل إشعارات الجهاز
              </button>
            )}

            {serverUnreadCount > 0 && (
              <button
                onClick={markAllServerAlertsRead}
                disabled={markingRead}
                className="w-full rounded-xl border border-cyan-500/40 bg-cyan-900/30 px-4 py-2.5 text-sm font-bold text-cyan-200 disabled:opacity-60"
              >
                {markingRead ? 'جارٍ التحديث...' : 'تعليم كل إشعارات السيرفر كمقروءة'}
              </button>
            )}

            {alertsLoading ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-400" />
                <p className="mt-2 text-sm text-slate-300 font-bold">جاري تحميل الإشعارات...</p>
              </div>
            ) : serverAlerts.length === 0 && localAlerts.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-300 font-bold">لا توجد إشعارات حالياً</p>
                <p className="mt-1 text-xs text-slate-500">أي تنبيه جديد سيظهر هنا تلقائياً</p>
              </div>
            ) : (
              <>
                {
                  [
                    ...filteredServerAlerts.map((item) => ({
                      id: item.id,
                      level: item.level,
                      text: `${item.title}: ${item.message}`,
                      read: item.read === true,
                      isServer: true,
                    })),
                    ...localAlerts.map((item) => ({ ...item, isServer: false })),
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if ((item as any).isServer) {
                          void markSingleAlertRead(item.id);
                        }
                      }}
                      className={`w-full text-right rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                        item.level === 'high'
                          ? 'border-red-500/30 bg-red-950/20 hover:border-red-500/50'
                          : item.level === 'medium'
                            ? 'border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50'
                            : 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50'
                      }`}
                    >
                      <p className={`text-sm text-right ${item.read ? 'text-slate-300' : 'font-bold text-white'}`}>{item.text}</p>
                      {item.read && <p className="mt-1 text-[10px] text-slate-500">✓ مقروء</p>}
                    </button>
                  ))
                }
              </>
            )}

            {serverAlerts.length > 0 && (
              <div className="mt-3 flex gap-1 rounded-xl bg-slate-900/60 p-1">
                {([
                  ['all', 'الكل'],
                  ['urgent', 'عاجل'],
                  ['payroll', 'رواتب'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAlertFilter(val)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      alertFilter === val ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ Phase 4: Attendance Tab ══ */}
        {mainTab === 'attendance' && (
          <>
            {/* Check-in / Check-out card */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
              <p className="text-xs font-bold text-emerald-300">حضور اليوم</p>
              {attendance?.today ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">وصول</span>
                    <span className="text-white font-bold">{new Date(attendance.today.checkin_time).toLocaleTimeString('ar-SA')}</span>
                  </div>
                  {attendance.today.checkout_time ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">انصراف</span>
                      <span className="text-emerald-300 font-bold">{new Date(attendance.today.checkout_time).toLocaleTimeString('ar-SA')}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => requestGpsAndCheckin('checkout')}
                      disabled={attendanceLoading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 py-3 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                      {attendanceLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      تسجيل الانصراف
                    </button>
                  )}
                  {attendance.today.checkin_lat && (
                    <p className="text-[11px] text-slate-500">📍 {attendance.today.checkin_lat.toFixed(4)}, {attendance.today.checkin_lng?.toFixed(4)}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => requestGpsAndCheckin('checkin')}
                  disabled={attendanceLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 text-base font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {attendanceLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-5 w-5" />}
                  تسجيل الوصول
                </button>
              )}
            </div>

            {/* Attendance history */}
            {attendanceHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
                <div className="px-4 py-3 text-xs font-bold text-slate-300">سجل الحضور</div>
                {attendanceHistory.slice(0, 14).map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[11px] text-slate-400">{rec.date}</span>
                    <div className="text-left">
                      <p className="text-xs text-white">⭢ {new Date(rec.checkin_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                      {rec.checkout_time && <p className="text-xs text-emerald-300">⭠ {new Date(rec.checkout_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ Inbox Tab — مراسلات، مناشير، استبيانات ══ */}
        {mainTab === 'inbox' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-400" />
                البريد الوارد
              </h2>
              <button
                onClick={() => void fetchCirculars()}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className="h-3 w-3" />
                تحديث
              </button>
            </div>

            {circularsLoading && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            )}

            {!circularsLoading && circulars.length === 0 && (
              <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-8 text-center">
                <Mail className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="text-sm font-bold text-slate-400">لا توجد رسائل أو مناشير</p>
                <p className="text-xs text-slate-600 mt-1">ستظهر هنا المناشير الإدارية والاستبيانات</p>
              </div>
            )}

            {!circularsLoading && circulars.map(c => {
              const myNo = profile?.employeeNo || '';
              const isRead = c.read_by.includes(myNo);
              const isSurvey = c.type === 'survey';
              const hasResponded = isSurvey && c.responses?.some(r => r.employee_no === myNo);

              const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                announcement: { icon: <Megaphone className="h-4 w-4" />, color: 'text-blue-300 bg-blue-500/10 border-blue-500/30', label: 'إعلان' },
                holiday:      { icon: <CalendarCheck className="h-4 w-4" />, color: 'text-green-300 bg-green-500/10 border-green-500/30', label: 'إجازة' },
                schedule:     { icon: <Clock className="h-4 w-4" />, color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', label: 'توقيت' },
                policy:       { icon: <FileText className="h-4 w-4" />, color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', label: 'تعميم' },
                survey:       { icon: <ClipboardCheck className="h-4 w-4" />, color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30', label: 'استبيان' },
                training:     { icon: <BookOpen className="h-4 w-4" />, color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30', label: 'تدريب' },
                urgent:       { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-300 bg-red-500/10 border-red-500/30', label: 'عاجل' },
              };
              const tc = typeConfig[c.type] || typeConfig.announcement;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpenCircular(c);
                    setSurveyAnswers({});
                    setSurveyDone(false);
                    if (!isRead) void markCircularRead(c.id);
                  }}
                  className={`w-full text-right rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                    !isRead
                      ? 'border-indigo-500/40 bg-indigo-950/30'
                      : 'border-slate-700/40 bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tc.color}`}>
                      {tc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${tc.color}`}>{tc.label}</span>
                        {c.priority === 'urgent' && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 border text-red-300 bg-red-500/10 border-red-500/30">🚨 عاجل</span>}
                        {isSurvey && hasResponded && <span className="text-[10px] rounded-full px-2 py-0.5 border text-green-300 bg-green-500/10 border-green-500/30">✓ تمت الإجابة</span>}
                        {!isRead && <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />}
                      </div>
                      <p className={`font-bold text-sm leading-snug line-clamp-2 ${!isRead ? 'text-white' : 'text-slate-300'}`}>{c.title}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">{c.body.slice(0, 80)}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-600">
                        {c.source_dept && <span>{c.source_dept}</span>}
                        <span>•</span>
                        <span>{new Date(c.created_at).toLocaleDateString('ar-SA')}</span>
                        {c.expires_at && <><span>•</span><span>ينتهي: {new Date(c.expires_at).toLocaleDateString('ar-SA')}</span></>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ══ Faults Tab ══ */}
        {mainTab === 'faults' && (
          <>
            {/* New fault button */}
            <button
              onClick={() => {
                setShowFaultModal(true);
                void fetchMyFaults();
              }}
              className="w-full flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-right hover:border-red-500/60 transition-all active:scale-[0.98]"
            >
              <TriangleAlert className="h-8 w-8 text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="font-black text-red-200">إرسال بلاغ عطل جديد</p>
                <p className="text-xs text-slate-400 mt-0.5">مع صور ميدانية — يصل للمشرف فوراً</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
            </button>

            {/* My fault reports list */}
            {faultLoading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <RefreshCw className="h-5 w-5 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-400">جارٍ التحميل…</span>
              </div>
            ) : myFaultReports.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-sm text-slate-400">لا توجد بلاغات مسجلة</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-slate-400">بلاغاتي ({myFaultReports.length})</p>
                  <button onClick={() => void fetchMyFaults()} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> تحديث
                  </button>
                </div>
                {myFaultReports.map((f) => (
                  <div key={f.id} className={`rounded-2xl border bg-slate-900/60 p-4 space-y-2 ${
                    f.status === 'resolved' ? 'border-slate-700/40 opacity-75' :
                    (f as any).auto_escalated ? 'border-red-500/40' :
                    'border-slate-700/60'
                  }`}>
                    {/* Auto-escalation banner */}
                    {(f as any).auto_escalated && f.status !== 'resolved' && (
                      <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-1.5 flex items-center gap-2">
                        <TriangleAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="text-[11px] text-red-300 font-semibold">تم التصعيد التلقائي لمدراء الإدارات — أمر عمل طارئ أُنشئ فوراً</span>
                      </div>
                    )}
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        f.severity === 'critical' ? 'bg-red-900/60 text-red-200' :
                        f.severity === 'high'     ? 'bg-orange-900/60 text-orange-200' :
                        f.severity === 'medium'   ? 'bg-amber-900/60 text-amber-200' :
                                                    'bg-green-900/60 text-green-200'
                      }`}>
                        {f.severity === 'critical' ? '⚡ حرج' : f.severity === 'high' ? '🔴 عالي' : f.severity === 'medium' ? '🟡 متوسط' : '🟢 منخفض'}
                      </span>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 border font-semibold ${
                        f.status === 'open'         ? 'border-red-500/40 text-red-300' :
                        f.status === 'acknowledged' ? 'border-amber-500/40 text-amber-300' :
                                                      'border-emerald-500/40 text-emerald-300'
                      }`}>
                        {f.status === 'open' ? 'بانتظار المشرف' : f.status === 'acknowledged' ? '⏳ تحت المعالجة' : '✓ محلول'}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-auto">
                        {new Date(f.reported_at).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white leading-snug">{f.title}</p>
                    {/* Linked WO */}
                    {f.linked_work_order_id && (
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3 py-1.5 flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="text-xs text-cyan-300">
                          أمر عمل: <span className="font-mono font-bold">{(f as any).linked_work_order_number || `#${f.linked_work_order_id}`}</span>
                          {(f as any).auto_escalated && <span className="mr-1 text-red-300 text-[10px]">(طارئ)</span>}
                        </span>
                      </div>
                    )}
                    {/* Photos preview */}
                    {Array.isArray((f as any).photos) && (f as any).photos.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {(f as any).photos.slice(0, 4).map((src: string, i: number) => (
                          <div key={i} className="h-14 w-14 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ GIS Alerts Tab ══ */}
        {mainTab === 'gis-alerts' && (() => {
          const GIS_SEVERITY: Record<string, string> = {
            critical: 'حرج', warning: 'تحذير', info: 'معلوماتي',
          };
          const GIS_ALERT_TYPE: Record<string, string> = {
            construction_intrusion:   'تعدٍّ أو إنشاء داخل الحرم',
            moisture_anomaly:         'شذوذ في مستوى الرطوبة',
            vegetation_loss:          'تراجع الغطاء النباتي',
            land_subsidence:          'هبوط في منسوب الأرض',
            flood_risk:               'خطر فيضان',
            erosion_detected:         'رصد تآكل في التربة',
            deforestation:            'إزالة أشجار أو تجريف',
            thermal_anomaly:          'شذوذ حراري',
            unauthorized_excavation:  'حفر أو تنقيب غير مرخص',
            oil_spill:                'تسرب نفطي',
            industrial_discharge:     'تصريف صناعي',
            illegal_dumping:          'طمر أو رمي نفايات غير قانوني',
            satellite_real_analysis:  'تحليل بالاستشعار الفضائي',
          };
          const translateType = (t: string) => GIS_ALERT_TYPE[t] ?? t.replace(/_/g, ' ');
          const translateSource = (s: string) =>
            s === 'satellite_real_analysis' ? 'استشعار فضائي' :
            s === 'manual' ? 'رصد يدوي' : s ?? '—';

          return (
          <div className="space-y-3">
            {selectedGisNotif ? (
              /* ════════ تقرير تفصيلي ════════ */
              <div className="space-y-4" dir="rtl">

                {/* شريط الأوامر */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedGisNotif(null)}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 active:bg-slate-700"
                  >
                    <ChevronRight className="h-4 w-4" /> القائمة
                  </button>
                  {!selectedGisNotif.read && (
                    <button
                      onClick={() => {
                        void markGisNotifRead(selectedGisNotif.id);
                        setSelectedGisNotif({ ...selectedGisNotif, read: true });
                      }}
                      className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-3 py-1.5 text-sm font-bold text-emerald-300 active:scale-95"
                    >
                      ✓ تمت المراجعة
                    </button>
                  )}
                </div>

                {/* ───── رأس التقرير ───── */}
                <div className={`rounded-2xl border p-4 ${selectedGisNotif.severity === 'critical' ? 'border-red-500/40 bg-red-950/20' : 'border-amber-500/30 bg-amber-950/15'}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      selectedGisNotif.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'
                    }`}>
                      {selectedGisNotif.severity === 'critical' ? '🔴 تنبيه حرج' : '🟡 تحذير'}
                    </span>
                    {selectedGisNotif.read && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">تمت المراجعة</span>}
                  </div>
                  <h2 className="mt-2 text-lg font-black leading-snug text-white">{selectedGisNotif.alert_name || '—'}</h2>
                  {selectedGisNotif.summary && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{selectedGisNotif.summary}</p>
                  )}
                </div>

                {/* ───── بيانات الموقع والتوقيت ───── */}
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 divide-y divide-slate-700/30 text-sm">
                  {[
                    { label: 'نطاق المراقبة', value: selectedGisNotif.corridor || '—' },
                    {
                      label: 'وقت الرصد',
                      value: new Date(selectedGisNotif.checked_at || selectedGisNotif.created_at)
                        .toLocaleString('ar-LY', { dateStyle: 'full', timeStyle: 'short' }),
                    },
                    {
                      label: 'مصدر الفحص',
                      value: selectedGisNotif.triggered_by === 'cron' ? 'فحص تلقائي دوري' : 'فحص يدوي',
                    },
                    {
                      label: 'إجمالي الأحداث',
                      value: `${selectedGisNotif.total_events ?? 0} حدث  —  ${selectedGisNotif.critical_count ?? 0} حرج  —  ${selectedGisNotif.warning_count ?? 0} تحذير`,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 px-4 py-2.5">
                      <span className="w-28 shrink-0 text-slate-500">{label}</span>
                      <span className="text-slate-200">{value}</span>
                    </div>
                  ))}
                </div>

                {/* ───── خريطة الموقع ───── */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-300">
                    <MapPin className="h-4 w-4 text-red-400" /> خريطة الموقع الفضائية
                  </h3>
                  {selectedGisNotif.geojson ? (
                    <GisNotifMap geojson={selectedGisNotif.geojson} />
                  ) : (
                    <div className="rounded-xl border border-slate-700/30 bg-slate-900/40 py-8 text-center text-xs text-slate-500">
                      لا تتوفر بيانات جغرافية لهذا الإشعار
                    </div>
                  )}
                </div>

                {/* ───── تفاصيل الأحداث ───── */}
                {Array.isArray(selectedGisNotif.events) && selectedGisNotif.events.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-300">
                      سجل الأحداث المرصودة ({selectedGisNotif.events.length})
                    </h3>
                    {(selectedGisNotif.events as any[]).slice(0, 10).map((ev: any, i: number) => (
                      <div key={i} className={`rounded-xl border p-3 ${ev.severity === 'critical' ? 'border-red-500/30 bg-red-950/20' : 'border-amber-500/30 bg-amber-950/15'}`}>
                        {/* نوع الحدث */}
                        <div className="mb-2 flex items-center justify-between">
                          <span className={`text-sm font-bold ${ev.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
                            {ev.severity === 'critical' ? '🔴' : '🟡'} {translateType(ev.alert_type || ev.type || ev.event_type || '')}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ev.severity === 'critical' ? 'bg-red-800/60 text-red-200' : 'bg-amber-800/60 text-amber-200'}`}>
                            {GIS_SEVERITY[ev.severity] ?? ev.severity}
                          </span>
                        </div>
                        {/* بيانات القياس */}
                        <div className="space-y-0.5 text-xs text-slate-400">
                          {ev.confidence != null && (
                            <p>نسبة الثقة في الرصد: <span className="font-bold text-slate-200">{ev.confidence}٪</span></p>
                          )}
                          {ev.area_m2 != null && (
                            <p>المساحة المتأثرة: <span className="font-bold text-slate-200">
                              {ev.area_m2 >= 1_000_000
                                ? `${(ev.area_m2 / 1_000_000).toFixed(2)} كم²`
                                : ev.area_m2 >= 1_000
                                ? `${(ev.area_m2 / 1_000).toFixed(1)} ألف م²`
                                : `${Math.round(ev.area_m2)} م²`}
                            </span></p>
                          )}
                          {ev.z_score != null && (
                            <p>مؤشر الشذوذ الإحصائي (Z): <span className="font-bold text-slate-200">{Number(ev.z_score).toFixed(2)}</span></p>
                          )}
                          {ev.source && (
                            <p>مصدر البيانات: <span className="font-bold text-slate-200">{translateSource(ev.source)}</span></p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ════════ قائمة الإشعارات ════════ */
              <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-400" />
                    <span className="font-black text-slate-100">تنبيهات الكوارث والمخاطر</span>
                    {gisUnreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white font-bold">{gisUnreadCount} جديد</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void fetchGisNotifs()}
                      className="rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 text-slate-400 hover:text-slate-200 active:scale-95 transition-all"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${gisNotifsLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {gisUnreadCount > 0 && (
                      <button
                        onClick={() => void markGisNotifRead('all')}
                        className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-2.5 py-1 text-xs font-bold text-emerald-300 active:scale-95 transition-all"
                      >
                        تم المراجعة (الكل)
                      </button>
                    )}
                  </div>
                </div>

                {gisNotifsLoading && gisNotifs.length === 0 ? (
                  <div className="flex items-center justify-center py-12 gap-2">
                    <RefreshCw className="h-5 w-5 text-slate-400 animate-spin" />
                    <span className="text-sm text-slate-400">جارٍ التحميل…</span>
                  </div>
                ) : gisNotifs.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-10 text-center">
                    <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                    <p className="text-sm text-slate-400">لا توجد تنبيهات GIS حالياً</p>
                    <p className="text-xs text-slate-600 mt-1">يتم الفحص التلقائي كل ساعة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gisNotifs.map((n: any) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setSelectedGisNotif(n)}
                        className={`w-full rounded-2xl border p-4 text-right transition-all active:scale-[0.99] ${
                          !n.read
                            ? n.severity === 'critical'
                              ? 'border-red-500/50 bg-red-950/25'
                              : 'border-amber-500/40 bg-amber-950/20'
                            : 'border-slate-700/30 bg-slate-900/20 opacity-70'
                        }`}
                      >
                        {/* Severity + name + read btn */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                              n.severity === 'critical' ? 'bg-red-600 text-white' : n.severity === 'warning' ? 'bg-amber-500 text-black' : 'bg-slate-600 text-slate-200'
                            }`}>
                              {n.severity === 'critical' ? '🔴 حرج' : n.severity === 'warning' ? '🟡 تحذير' : 'معلومة'}
                            </span>
                            <p className="font-bold text-slate-100 text-sm truncate">{n.alert_name || '—'}</p>
                          </div>
                          {!n.read && (
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); void markGisNotifRead(n.id); }}
                              className="shrink-0 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-2 py-1 text-[10px] font-bold text-emerald-300 active:scale-95"
                            >
                              تم
                            </span>
                          )}
                        </div>

                        {n.corridor && (
                          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500 shrink-0" />{n.corridor}
                          </p>
                        )}

                        {n.summary && (
                          <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{n.summary}</p>
                        )}

                        {(n.total_events > 0 || n.critical_count > 0) && (
                          <div className="mt-2 flex gap-3 text-xs">
                            {n.total_events > 0 && <span className="text-slate-400">{n.total_events} حدث</span>}
                            {n.critical_count > 0 && <span className="text-red-400 font-bold">{n.critical_count} حرج</span>}
                            {n.warning_count > 0 && <span className="text-amber-400">{n.warning_count} تحذير</span>}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] text-slate-600">
                            {new Date(n.checked_at || n.created_at).toLocaleString('ar-LY')}
                            {n.triggered_by === 'cron' ? ' · تلقائي' : ' · يدوي'}
                          </p>
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                            {n.geojson ? 'تفاصيل + خريطة' : 'تفاصيل'} <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
        })()}

        {/* ══ Corrosion Team Tab ══ */}
        {mainTab === 'corrosion_team' && (
          <div className="space-y-4 pb-32">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-amber-300">فريق التآكل الميداني</p>
              <button
                onClick={() => void fetchCorrosionTeam()}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300"
              >
                <RefreshCw className={`h-3 w-3 ${corrosionLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {corrosionLoading && !corrosionTeams.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm text-slate-400">جارٍ تحميل بيانات الفريق...</p>
              </div>
            ) : corrosionTeams.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center space-y-2">
                <Wrench className="mx-auto h-12 w-12 text-slate-600" />
                <p className="text-slate-300 font-bold">لم يتم تعيينك في فريق تآكل</p>
                <p className="text-xs text-slate-500">تواصل مع مشرفك في إدارة التآكل</p>
              </div>
            ) : (
              <>
                {/* Teams */}
                {corrosionTeams.map((team) => (
                  <div key={team.id} className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-amber-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-black text-white">{team.name}</p>
                        {team.specialization && (
                          <p className="text-[11px] text-amber-300/70">{team.specialization}</p>
                        )}
                      </div>
                      <span className="text-[10px] bg-amber-800/40 text-amber-200 rounded-full px-2 py-0.5">
                        {team.members.length} أعضاء
                      </span>
                    </div>
                    {/* Members */}
                    <div className="divide-y divide-slate-800/60">
                      {team.members.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                          <div>
                            <p className="font-bold text-white">{m.name}</p>
                            <p className="text-slate-400">{m.role}</p>
                          </div>
                          {m.phone && (
                            <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-emerald-400 font-bold">
                              <Phone className="h-3 w-3" /> {m.phone}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Work Orders */}
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">
                    أوامر العمل المُسندة ({corrosionWorkOrders.length})
                  </p>
                  {corrosionWorkOrders.length === 0 ? (
                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 text-center">
                      <p className="text-xs text-slate-500">لا توجد أوامر عمل مُسندة حالياً</p>
                    </div>
                  ) : (
                    corrosionWorkOrders.map((wo) => (
                      <div
                        key={wo.id}
                        className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 mb-2 cursor-pointer hover:border-amber-500/30"
                        onClick={() => setSelected(wo)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{wo.title}</p>
                            {wo.work_order_number && (
                              <p className="text-[11px] text-slate-400">{wo.work_order_number}</p>
                            )}
                          </div>
                          <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 font-bold ${
                            wo.status === 'open' ? 'bg-amber-800/60 text-amber-200' :
                            wo.status === 'in_progress' ? 'bg-blue-800/60 text-blue-200' :
                            'bg-emerald-800/60 text-emerald-200'
                          }`}>
                            {wo.status === 'open' ? 'مفتوح' : wo.status === 'in_progress' ? 'جارٍ' : 'مكتمل'}
                          </span>
                        </div>
                        {wo.scheduled_date && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {new Date(wo.scheduled_date).toLocaleDateString('ar')}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ Access Requests Tab (managers only) ══ */}
        {mainTab === 'access-requests' && isSupervisor && (
          <div className="space-y-3" dir="rtl">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-white">طلبات التسجيل المعلقة</span>
              <button
                onClick={() => void fetchAccessRequests()}
                className="rounded-lg bg-slate-700 p-2 text-slate-300 active:bg-slate-600"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {accessRequestsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              </div>
            ) : accessRequests.length === 0 ? (
              <div className="rounded-xl bg-slate-800/60 py-10 text-center text-slate-400">لا توجد طلبات معلقة</div>
            ) : (
              <div className="space-y-3">
                {accessRequests.map((req: any) => (
                  <div key={req.id} className="rounded-xl border border-slate-700/50 bg-slate-800/80 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{req.full_name || req.employee_no}</p>
                        <p className="text-xs text-slate-400">{req.employee_no} — {req.department_code || '—'}</p>
                        {req.requested_at && (
                          <p className="text-xs text-slate-500">
                            {new Date(req.requested_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        )}
                      </div>
                      {req.mobile_role && (
                        <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300">{req.mobile_role}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={reviewingRequest === req.id}
                        onClick={() => void reviewAccessRequest(req.id, 'approve')}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700/80 py-1.5 text-sm font-medium text-white active:bg-emerald-600 disabled:opacity-50"
                      >
                        {reviewingRequest === req.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <><CheckCircle size={13} /> موافقة</>
                        )}
                      </button>
                      <button
                        disabled={reviewingRequest === req.id}
                        onClick={() => void reviewAccessRequest(req.id, 'reject')}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-700/80 py-1.5 text-sm font-medium text-white active:bg-red-600 disabled:opacity-50"
                      >
                        {reviewingRequest === req.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <><XCircle size={13} /> رفض</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Phase 2 + 7: Supervisor Approval Tab ══ */}
        {mainTab === 'approval' && isSupervisor && (
          <>
            {/* Phase 7 — Team Status Dashboard */}
            {teamStatus && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'حضر اليوم', value: teamStatus.checked_in_today, color: 'border-emerald-500/30 text-emerald-300' },
                    { label: 'تقارير', value: teamStatus.pending_approval, color: 'border-orange-500/30 text-orange-300' },
                    { label: 'قطع غيار', value: teamStatus.pending_parts, color: 'border-cyan-500/30 text-cyan-300' },
                    { label: 'أعطال', value: teamStatus.open_faults, color: 'border-red-500/30 text-red-300' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border ${item.color} bg-slate-900/60 p-2 text-center`}>
                      <p className={`text-lg font-black ${item.color.split(' ')[1]}`}>{item.value}</p>
                      <p className="text-[10px] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* Attendance last 7 days bar */}
                {teamStatus.attendance_last7?.length > 0 && (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-xs font-bold text-slate-300 mb-2">الحضور — آخر 7 أيام</p>
                    <div className="flex items-end gap-1 h-10">
                      {teamStatus.attendance_last7.map((day: { date: string; count: number }, i: number) => {
                        const max = Math.max(...teamStatus.attendance_last7.map((d: any) => d.count), 1);
                        const h = Math.round((day.count / max) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-sm bg-emerald-500/60" style={{ height: `${h}%`, minHeight: day.count > 0 ? 4 : 0 }} />
                            <p className="text-[8px] text-slate-500">{day.date.slice(8)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Team member status cards */}
                {teamStatus.team?.length > 0 && (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
                    <p className="px-4 py-2 text-xs font-bold text-slate-300">الفريق اليوم</p>
                    {teamStatus.team.map((member: any) => (
                      <div key={member.employee_no} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-bold text-white">{member.employee_name || member.employee_no}</p>
                          <p className="text-[11px] text-slate-400">
                            {member.checkin_time ? `وصل ${new Date(member.checkin_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : 'لم يسجل بعد'}
                            {member.checkout_time ? ` • انصرف ${new Date(member.checkout_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          member.checked_out ? 'bg-slate-700 text-slate-300' :
                          member.checked_in ? 'bg-emerald-700/60 text-emerald-200' :
                          'bg-red-900/40 text-red-400'
                        }`}>
                          {member.checked_out ? 'انصرف' : member.checked_in ? 'حاضر' : 'غائب'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {teamLoading && !teamStatus && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
                جارٍ تحميل بيانات الفريق...
              </div>
            )}

            {approvalLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
                <p className="text-sm text-slate-400">جاري تحميل طابور الاعتماد...</p>
              </div>
            ) : (
              <>
                {/* Completion Reports awaiting approval */}
                {approvalQueue.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-orange-300">تقارير إتمام بانتظار الاعتماد ({approvalQueue.length})</p>
                    {approvalQueue.map((rep) => (
                      <ApprovalCard key={rep.id} report={rep} onReview={reviewReport} />
                    ))}
                  </div>
                )}

                {/* Parts Requests awaiting approval */}
                {pendingPartsReqs.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-cyan-300">طلبات قطع غيار معلقة ({pendingPartsReqs.length})</p>
                    {pendingPartsReqs.map((req) => (
                      <PartsApprovalCard key={req.id} request={req} onReview={reviewPartsReq} />
                    ))}
                  </div>
                )}

                {/* Open Fault Reports */}
                {openFaultReports.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-red-300">بلاغات أعطال مفتوحة ({openFaultReports.length})</p>
                    {openFaultReports.map((f) => (
                      <div key={f.id} className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <TriangleAlert className="h-4 w-4 text-red-400" />
                          <p className="font-bold text-white text-sm">{f.title}</p>
                        </div>
                        <p className="text-xs text-slate-300">{f.description}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>الموظف: {f.employee_name || f.employee_no}</span>
                          {f.location_name && <span>• {f.location_name}</span>}
                        </div>
                        <button
                          onClick={() => void acknowledgeFault(f.id)}
                          className="w-full rounded-xl bg-amber-700/80 py-2 text-xs font-bold text-white hover:bg-amber-600"
                        >
                          تأكيد الاستلام
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {approvalQueue.length === 0 && pendingPartsReqs.length === 0 && openFaultReports.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <ShieldCheck className="h-12 w-12 text-emerald-600" />
                    <p className="text-slate-400 font-bold">لا يوجد شيء بانتظار الاعتماد</p>
                    <p className="text-xs text-slate-500">كل التقارير تمت معالجتها</p>
                  </div>
                )}

                <button
                  onClick={() => void fetchApprovalQueue()}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300"
                >
                  <RefreshCw className="inline h-3.5 w-3.5 mr-1" /> تحديث طابور الاعتماد
                </button>
              </>
            )}
          </>
        )}

        {/* ══ Monitoring Tab (Phase 10 — رصد) ══ */}
        {/* ctrl_monitoring = monitoring from control center dept */}
        {(mainTab === 'monitoring' || mainTab === 'ctrl_monitoring') && (
          <div className="space-y-4 pb-32">
            {isSupervisor ? (
              /* ── Supervisor Monitoring View ── */
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-cyan-300">لوحة مراقبة التشغيل</p>
                  <button
                    onClick={() => void fetchMonitoringApprovalQueue()}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <RefreshCw className={`h-3 w-3 ${monitoringReviewLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Teams Summary Cards */}
                {monitoringTeamsSummary.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400">فرق الرصد الميداني</p>
                    {monitoringTeamsSummary.map((team) => (
                      <div key={team.team_id} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-white">{team.team_name}</p>
                            <p className="text-[11px] text-slate-400">{team.location_label}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                              team.pending_review > 0 ? 'bg-cyan-700/60 text-cyan-200' : 'bg-slate-700 text-slate-400'
                            }`}>
                              {team.pending_review > 0 ? `${team.pending_review} بانتظار الاعتماد` : 'لا يوجد معلق'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                          <span><Users className="inline h-3 w-3 mr-0.5" />{team.member_count} راصدين</span>
                          <span>اليوم: {team.today_submitted} قراءة</span>
                          {team.last_reading_date && <span>آخر اعتماد: {team.last_reading_date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Monitoring Readings */}
                {pendingMonitoringReadings.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-cyan-300">قراءات بانتظار الاعتماد ({pendingMonitoringReadings.length})</p>
                    {pendingMonitoringReadings.map((reading) => {
                      const isExpanded = expandedReadingId === reading.id;
                      return (
                        <div key={reading.id} className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 overflow-hidden">
                          <button
                            onClick={() => setExpandedReadingId(isExpanded ? null : reading.id)}
                            className="w-full flex items-center justify-between p-3 text-left"
                          >
                            <div>
                              <p className="text-sm font-bold text-white">{reading.team_name}</p>
                              <p className="text-[11px] text-slate-400">{reading.location_label} — {reading.reading_date}</p>
                              <p className="text-[11px] text-slate-500">الراصد: {reading.submitted_by_name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] bg-cyan-800/60 text-cyan-200 rounded-full px-2 py-0.5">معلق</span>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-800 p-3 space-y-3">
                              {/* Reading values */}
                              <div className="grid grid-cols-2 gap-1.5">
                                {Object.entries(reading.values).map(([key, val]) => (
                                  val !== null && val !== '' ? (
                                    <div key={key} className="rounded-lg bg-slate-800/60 px-2.5 py-1.5">
                                      <p className="text-[10px] text-slate-500 leading-tight">{key.replace(/_/g, ' ')}</p>
                                      <p className="text-sm font-bold text-white">{String(val)}</p>
                                    </div>
                                  ) : null
                                ))}
                              </div>
                              {reading.notes && (
                                <p className="text-xs text-slate-400 italic">ملاحظات: {reading.notes}</p>
                              )}
                              {/* Approve / Reject */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => void reviewMonitoringReading(reading.id, 'approved')}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-700/80 py-2.5 text-xs font-black text-white hover:bg-emerald-600"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" /> اعتماد وإرسال لإدارة التحكم
                                </button>
                                <button
                                  onClick={() => void reviewMonitoringReading(reading.id, 'rejected', 'يرجى مراجعة البيانات')}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-red-800/70 py-2.5 text-xs font-black text-white hover:bg-red-700"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" /> رفض
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !monitoringReviewLoading && (
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center">
                      <Activity className="mx-auto mb-2 h-10 w-10 text-slate-600" />
                      <p className="text-slate-400 font-bold text-sm">لا توجد قراءات معلقة</p>
                      <p className="text-xs text-slate-500 mt-1">جميع القراءات المقدمة تمت معالجتها</p>
                    </div>
                  )
                )}

                {monitoringReviewLoading && (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                )}
              </>
            ) : (
              /* ── Observer (Technician) Monitoring View ── */
              <>
                {monitoringLoading && !myMonitoringTeam ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                    <p className="text-sm text-slate-400">جارٍ تحميل بيانات الرصد...</p>
                  </div>
                ) : myMonitoringTeams.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center space-y-2">
                    <Activity className="mx-auto h-12 w-12 text-slate-600" />
                    <p className="text-slate-300 font-bold">لم يتم تعيينك في فريق رصد</p>
                    <p className="text-xs text-slate-500">تواصل مع مشرفك لإضافتك إلى فريق رصد ميداني</p>
                  </div>
                ) : (
                  <>
                    {/* Team Selector (shown when member of multiple teams) */}
                    {myMonitoringTeams.length > 1 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-400">اختر الفريق ({myMonitoringTeams.length} فريق)</p>
                        <div className="flex flex-wrap gap-2">
                          {myMonitoringTeams.map(t => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setSelectedMonitoringTeamId(t.id);
                                setMonitoringFormValues({});
                                setExpandedGroups(new Set(t.field_groups.map((g: MonitoringFieldGroup) => g.group_key)));
                                setMonitoringSubmitDone(false);
                                setMonitoringSubmitError('');
                              }}
                              className={`rounded-full px-3 py-1 text-xs font-bold transition-all border ${
                                (selectedMonitoringTeamId ?? myMonitoringTeam?.id) === t.id
                                  ? 'bg-cyan-700 border-cyan-500 text-white'
                                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-cyan-500/50'
                              }`}
                            >
                              {t.team_name}
                              {t.member_role === 'رئيس فريق' && <span className="mr-1 text-amber-400">★</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Info Header */}
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-cyan-400 shrink-0" />
                        <div>
                          <p className="text-sm font-black text-white">{activeMonitoringTeam?.team_name}</p>
                          <p className="text-[11px] text-slate-400">{activeMonitoringTeam?.location_label}</p>
                          {activeMonitoringTeam?.member_role && (
                            <p className="text-[10px] text-cyan-400/70 mt-0.5">{activeMonitoringTeam.member_role}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex rounded-xl bg-slate-900/60 p-1 gap-1">
                      {(['form', 'history'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setMonitoringView(v)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                            monitoringView === v ? 'bg-slate-700 text-white' : 'text-slate-500'
                          }`}
                        >
                          {v === 'form' ? 'إدخال قراءة' : 'السجل التاريخي'}
                        </button>
                      ))}
                    </div>

                    {monitoringView === 'form' ? (
                      /* ─ Reading Entry Form ─ */
                      <div className="space-y-3">
                        {/* Success Message */}
                        {monitoringSubmitDone && (
                          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-center">
                            <CheckCircle2 className="mx-auto mb-1 h-8 w-8 text-emerald-400" />
                            <p className="text-sm font-black text-emerald-300">تم إرسال القراءة بنجاح</p>
                            <p className="text-xs text-slate-400 mt-1">في انتظار اعتماد المشرف</p>
                          </div>
                        )}

                        {monitoringSubmitError && (
                          <div className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                            monitoringSubmitError.includes('بانتظار الاعتماد') || monitoringSubmitError.includes('تم تقديم')
                              ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                              : 'border-red-500/30 bg-red-950/20 text-red-300'
                          }`}>
                            {monitoringSubmitError.includes('بانتظار الاعتماد') || monitoringSubmitError.includes('تم تقديم')
                              ? '✓ ' : '⚠ '}{monitoringSubmitError}
                          </div>
                        )}

                        {/* Reading Date */}
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                          <p className="text-xs text-slate-400 mb-1.5">تاريخ القراءة</p>
                          <input
                            type="date"
                            value={monitoringDate}
                            onChange={(e) => setMonitoringDate(e.target.value)}
                            max={new Date().toISOString().slice(0, 10)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        {/* Field Groups */}
                        {(activeMonitoringTeam?.field_groups ?? []).map((group) => {
                          const isOpen = expandedGroups.has(group.group_key);
                          return (
                            <div key={group.group_key} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
                              <button
                                onClick={() => {
                                  const next = new Set(expandedGroups);
                                  if (isOpen) next.delete(group.group_key);
                                  else next.add(group.group_key);
                                  setExpandedGroups(next);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3"
                              >
                                <p className="text-sm font-bold text-white">{group.group_label}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500">{group.fields.length} حقل</span>
                                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                </div>
                              </button>
                              {isOpen && (
                                <div className="border-t border-slate-800 p-3 grid grid-cols-2 gap-2">
                                  {group.fields.map((field) => (
                                    <div key={field.key} className={field.type === 'text' ? 'col-span-2' : ''}>
                                      <label className="block text-[11px] text-slate-400 mb-1">
                                        {field.label}
                                        {field.unit && <span className="text-slate-500 ml-1">({field.unit})</span>}
                                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                                      </label>
                                      <input
                                        type={field.type === 'number' ? 'number' : 'text'}
                                        min={field.min}
                                        max={field.max}
                                        step="any"
                                        value={monitoringFormValues[field.key] ?? ''}
                                        onChange={(e) => setMonitoringFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                                        placeholder={field.unit ? `0 ${field.unit}` : '—'}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Notes */}
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                          <p className="text-xs text-slate-400 mb-1.5">ملاحظات إضافية (اختياري)</p>
                          <textarea
                            rows={2}
                            value={monitoringNotes}
                            onChange={(e) => setMonitoringNotes(e.target.value)}
                            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                            placeholder="أي ملاحظات تشغيلية..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => void submitMonitoringReading(false)}
                            disabled={monitoringSubmitting}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 py-3 text-sm font-black text-white hover:bg-cyan-600 disabled:opacity-50"
                          >
                            {monitoringSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            إرسال للاعتماد
                          </button>
                          <button
                            onClick={() => void submitMonitoringReading(true)}
                            disabled={monitoringSubmitting}
                            className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                          >
                            حفظ مسودة
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ─ Reading History ─ */
                      <div className="space-y-2">
                        {myRecentReadings.length === 0 ? (
                          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center">
                            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                            <p className="text-sm text-slate-400">لا توجد قراءات سابقة</p>
                          </div>
                        ) : (
                          [...myRecentReadings].reverse().map((reading) => (
                            <div key={reading.id} className={`rounded-2xl border p-3 space-y-1 ${
                              reading.status === 'approved' ? 'border-emerald-500/30 bg-emerald-950/20' :
                              reading.status === 'rejected' ? 'border-red-500/30 bg-red-950/20' :
                              reading.status === 'submitted' ? 'border-cyan-500/20 bg-slate-900/60' :
                              'border-slate-700/60 bg-slate-900/40'
                            }`}>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white">{reading.reading_date}</p>
                                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                                  reading.status === 'approved' ? 'bg-emerald-800/60 text-emerald-300' :
                                  reading.status === 'rejected' ? 'bg-red-800/60 text-red-300' :
                                  reading.status === 'submitted' ? 'bg-cyan-800/60 text-cyan-200' :
                                  'bg-slate-700 text-slate-400'
                                }`}>
                                  {reading.status === 'approved' ? 'معتمد' :
                                   reading.status === 'rejected' ? 'مرفوض' :
                                   reading.status === 'submitted' ? 'قيد المراجعة' : 'مسودة'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {new Date(reading.submitted_at).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                              </p>
                              {reading.review_notes && (
                                <p className="text-xs text-amber-300 mt-1">ملاحظة المشرف: {reading.review_notes}</p>
                              )}
                              {reading.status === 'approved' && (
                                <p className={`text-[10px] mt-0.5 ${
                                  (reading as any).ingested_to_db === true
                                    ? 'text-emerald-500'
                                    : (reading as any).ingest_error
                                    ? 'text-red-400'
                                    : 'text-slate-500'
                                }`}>
                                  {(reading as any).ingested_to_db === true
                                    ? '✓ دخلت إدارة التحكم'
                                    : (reading as any).ingest_error
                                    ? '⚠ خطأ في الإرسال لإدارة التحكم'
                                    : '⏳ جارٍ الإرسال لإدارة التحكم...'}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                        <button
                          onClick={() => void fetchMyMonitoringTeam()}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300"
                        >
                          <RefreshCw className="inline h-3.5 w-3.5 mr-1" /> تحديث
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ Parts Request Modal ══ */}
      {showPartsModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <button onClick={() => { setShowPartsModal(null); setPartsSent(false); setPartsItems([{ name: '', quantity: 1, unit: '' }]); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <X className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs text-slate-400">طلب قطع غيار</p>
              <p className="text-sm font-bold text-white">{showPartsModal.work_order_number || showPartsModal.wo_number || `#${showPartsModal.id}`}</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4 pb-10">
            {partsSent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                <p className="text-lg font-black text-emerald-300">تم إرسال الطلب</p>
                <p className="text-sm text-slate-400 mt-1">سيتم مراجعته من قبل المشرف</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400">أدخل المواد والكميات المطلوبة</p>
                {partsItems.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">قطعة {idx + 1}</p>
                      {partsItems.length > 1 && (
                        <button onClick={() => setPartsItems((p) => p.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      value={item.name}
                      onChange={(e) => setPartsItems((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      placeholder="اسم القطعة"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => setPartsItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))}
                        placeholder="الكمية"
                        className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        value={item.unit || ''}
                        onChange={(e) => setPartsItems((p) => p.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))}
                        placeholder="الوحدة"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setPartsItems((p) => [...p, { name: '', quantity: 1, unit: '' }])}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 py-2.5 text-xs font-bold text-slate-400 hover:border-slate-500"
                >
                  <Plus className="h-4 w-4" /> إضافة قطعة
                </button>
                <button
                  onClick={async () => {
                    const clean = partsItems.filter((i) => i.name.trim() && i.quantity > 0);
                    if (!clean.length) return;
                    setPartsSubmitting(true);
                    try {
                      const res = await fetch('/api/auth/mobile/parts-request', {
                        method: 'POST', headers: getHeaders(),
                        body: JSON.stringify({
                          work_order_id: showPartsModal!.id,
                          work_order_number: showPartsModal!.work_order_number || showPartsModal!.wo_number,
                          items: clean,
                        }),
                      });
                      if (res.ok) setPartsSent(true);
                    } finally { setPartsSubmitting(false); }
                  }}
                  disabled={partsSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-700 py-3 text-sm font-black text-white hover:bg-cyan-600 disabled:opacity-60"
                >
                  {partsSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال طلب القطع
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Circular Detail / Survey Modal ══ */}
      {openCircular && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <button onClick={() => setOpenCircular(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500">{openCircular.source_dept || 'الإدارة'}</p>
              <p className="text-sm font-bold text-white truncate">{openCircular.title}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 pb-10">
            {/* Meta */}
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{new Date(openCircular.created_at).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {openCircular.created_by_name && <span>• {openCircular.created_by_name}</span>}
              {openCircular.expires_at && <span>• ينتهي: {new Date(openCircular.expires_at).toLocaleDateString('ar-SA')}</span>}
            </div>

            {/* Body */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{openCircular.body}</p>
            </div>

            {/* Survey Section */}
            {openCircular.type === 'survey' && openCircular.questions && openCircular.questions.length > 0 && (
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                  <ClipboardCheck className="h-4 w-4" />
                  الاستبيان
                </h3>

                {surveyDone ? (
                  <div className="rounded-2xl border border-green-500/30 bg-green-950/30 p-6 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-400" />
                    <p className="font-bold text-green-300">شكراً! تم تسجيل إجابتك</p>
                  </div>
                ) : openCircular.responses?.some(r => r.employee_no === (profile?.employeeNo || '')) ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-4 text-center">
                    <p className="text-sm text-slate-400">✓ لقد قمت بالإجابة على هذا الاستبيان مسبقاً</p>
                  </div>
                ) : (
                  <>
                    {openCircular.questions.map((q) => (
                      <div key={q.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
                        <p className="text-sm font-bold text-white">
                          {q.text}
                          {q.required && <span className="text-red-400 mr-1">*</span>}
                        </p>

                        {q.type === 'text' && (
                          <textarea
                            value={String(surveyAnswers[q.id] || '')}
                            onChange={e => setSurveyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            rows={3}
                            placeholder="اكتب إجابتك..."
                            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                          />
                        )}

                        {q.type === 'rating' && (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: String(n) }))}
                                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                                  surveyAnswers[q.id] === String(n)
                                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            <Star className="my-auto h-4 w-4 text-amber-400" />
                          </div>
                        )}

                        {(q.type === 'single' || q.type === 'multi') && q.options && (
                          <div className="space-y-2">
                            {q.options.map(opt => {
                              const isSelected = q.type === 'multi'
                                ? (Array.isArray(surveyAnswers[q.id]) ? (surveyAnswers[q.id] as string[]).includes(opt) : false)
                                : surveyAnswers[q.id] === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => {
                                    if (q.type === 'single') {
                                      setSurveyAnswers(prev => ({ ...prev, [q.id]: opt }));
                                    } else {
                                      setSurveyAnswers(prev => {
                                        const cur = (Array.isArray(prev[q.id]) ? prev[q.id] : []) as string[];
                                        return { ...prev, [q.id]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] };
                                      });
                                    }
                                  }}
                                  className={`w-full text-right rounded-xl border px-4 py-2.5 text-sm transition-all ${
                                    isSelected
                                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                                      : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                                  }`}
                                >
                                  {isSelected ? '● ' : '○ '}{opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => void submitSurvey(openCircular.id)}
                      disabled={surveySubmitting}
                      className="w-full rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                    >
                      {surveySubmitting ? 'جارٍ الإرسال...' : 'إرسال الإجابات'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ WO Chat Modal ══ */}
      {chatWo && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950" dir="rtl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur shrink-0">
            <button onClick={() => setChatWo(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500 font-mono">{chatWo.wo_number || chatWo.work_order_number || `#${chatWo.id}`}</p>
              <p className="text-sm font-bold text-white truncate">{chatWo.title}</p>
            </div>
            <MessageSquare className="h-5 w-5 text-indigo-400 shrink-0" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatLoading && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            )}
            {!chatLoading && chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-12 w-12 text-slate-700 mb-3" />
                <p className="text-sm text-slate-500 font-bold">لا توجد رسائل</p>
                <p className="text-xs text-slate-600 mt-1">ابدأ المحادثة مع مشرفك</p>
              </div>
            )}
            {chatMessages.map((msg) => {
              const isMe = msg.sender_no === (profile?.employeeNo || '');
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <p className="text-[10px] text-slate-500 mb-1 px-1">{msg.sender_name || msg.sender_no}</p>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm bg-slate-800 border border-slate-700 text-slate-200'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.body}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att, i) => (
                          <img key={i} src={att} alt="" className="h-24 w-24 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={`text-[10px] text-slate-600 mt-0.5 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.sent_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-3 safe-area-pb">
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMsg(); } }}
                placeholder="اكتب رسالتك..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                style={{ maxHeight: '96px', overflowY: 'auto' }}
              />
              <button
                onClick={() => void sendChatMsg()}
                disabled={!chatInput.trim() || chatSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
              >
                {chatSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Fault Report Modal ══ */}
      {showFaultModal && (
        <FaultReportModal
          onClose={() => setShowFaultModal(false)}
          onSubmitted={() => { setShowFaultModal(false); void fetchMyFaults(); }}
          getHeaders={getHeaders}
        />
      )}

      {/* Parts request trigger inside work orders - adds button to WorkOrderCard context */}
      {selected && showPartsModal === null && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => setShowPartsModal(selected)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-900/90 py-3 text-sm font-black text-cyan-200 backdrop-blur"
          >
            <Package className="h-4 w-4" /> طلب قطعة غيار لهذا الأمر
          </button>
        </div>
      )}

      {/* Footer link to full dashboard */}
      <div className="mt-8 px-4 text-center">
        <a href="/dashboard/my-portal" className="text-xs text-slate-600 underline">
          الدخول إلى لوحة التحكم الكاملة
        </a>
      </div>
    </div>
  );
}
