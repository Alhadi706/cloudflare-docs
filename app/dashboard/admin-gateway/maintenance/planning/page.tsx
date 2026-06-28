'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Wrench, ClipboardList, Settings, Users, Package,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  BarChart3, Calendar, Target, Zap, Shield, RefreshCw,
  AlertCircle, Info, ChevronRight, Search, Filter, Upload, FileSpreadsheet,
  DollarSign, Activity, Cpu, FileText, Eye,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
type PlanTab =
  | 'overview' | 'workorders' | 'calendar' | 'preventive'
  | 'predictive' | 'lifecycle' | 'teams' | 'spareparts'
  | 'history' | 'kpis';

interface WorkOrder {
  id: number;
  work_order_number?: string;
  title: string;
  title_ar?: string;
  asset_name?: string;
  work_type: string;
  priority: string;
  status: string;
  scheduled_date?: string;
  start_date?: string;
  completion_date?: string;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_team?: string;
  age_hours?: number;
  sla_state?: string;
}

interface WorkOrderImportStats {
  totalRows: number;
  equipmentCount: number;
  lastBatchId: string | null;
  lastImportAt: string | null;
}

interface WorkOrderImportResult {
  success: boolean;
  duplicate?: boolean;
  batchId?: string;
  fileName?: string;
  totalRows?: number;
  archivedInserted?: number;
  archivedUpdated?: number;
  workflowCreated?: number;
  previousBatchId?: string;
  previousImportAt?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// STATIC DATA (Planning, Prediction, Lifecycle, etc.)
// ═══════════════════════════════════════════════════════════════

// ── PM Schedules ─────────────────────────────────────────────
const PM_SCHEDULES = [
  { id: 'PM-01', asset: 'مضخة رئيسية M-3', station: 'NEJH(N)', freq: 'شهري',    nextDue: '2026-05-28', lastDone: '2026-04-28', team: 'فريق ميكانيك أ', status: 'متأخر',     compliance: 62 },
  { id: 'PM-02', asset: 'محول TR-1',        station: 'EJH',     freq: 'ربعي',    nextDue: '2026-06-01', lastDone: '2026-03-01', team: 'فريق كهرباء',   status: 'قادم',      compliance: 87 },
  { id: 'PM-03', asset: 'صمام PV-7',        station: 'NEJH(S)', freq: 'نصف سنوي',nextDue: '2026-07-15', lastDone: '2026-01-15', team: 'فريق هيدروليك', status: 'مجدول',     compliance: 91 },
  { id: 'PM-04', asset: 'وحدة PLC-2',       station: 'NEJH(N)', freq: 'سنوي',    nextDue: '2026-08-10', lastDone: '2025-08-10', team: 'فريق تحكم',     status: 'مجدول',     compliance: 95 },
  { id: 'PM-05', asset: 'مضخة B-5',         station: 'EJH',     freq: 'شهري',    nextDue: '2026-06-05', lastDone: '2026-05-05', team: 'فريق ميكانيك ب', status: 'قادم',     compliance: 78 },
  { id: 'PM-06', asset: 'مضخة H-2',         station: 'NEJH(N)', freq: 'ربعي',    nextDue: '2026-05-25', lastDone: '2026-02-25', team: 'فريق ميكانيك أ', status: 'متأخر',    compliance: 71 },
  { id: 'PM-07', asset: 'ضاغط C-1',         station: 'NEJH(S)', freq: 'نصف سنوي',nextDue: '2026-10-01', lastDone: '2026-04-01', team: 'فريق ميكانيك ب', status: 'مجدول',   compliance: 98 },
  { id: 'PM-08', asset: 'مضخة S-1',         station: 'NEJH(S)', freq: 'شهري',    nextDue: '2026-06-10', lastDone: '2026-05-10', team: 'فريق هيدروليك', status: 'قادم',      compliance: 93 },
];

// ── Predictive Data ───────────────────────────────────────────
const PREDICTIVE = [
  { id: 'PD-01', asset: 'مضخة M-3',    station: 'NEJH(N)', risk: 94, days: 3,    trigger: 'اهتزاز 12.4 mm/s + تآكل محامل',      action: 'إيقاف فوري',          costAvoid: 42000, sev: 'critical' as const },
  { id: 'PD-02', asset: 'محول TR-1',   station: 'EJH',     risk: 88, days: 5,    trigger: 'حرارة ملف 98°C + تحميل زائد',        action: 'عزل وفحص',            costAvoid: 38000, sev: 'critical' as const },
  { id: 'PD-03', asset: 'صمام PV-7',   station: 'NEJH(S)', risk: 71, days: 12,   trigger: 'تسريب ضغط 0.8 بار',                  action: 'استبدال حشوة',        costAvoid: 8500,  sev: 'high' as const },
  { id: 'PD-04', asset: 'وحدة PLC-2',  station: 'NEJH(N)', risk: 65, days: 18,   trigger: 'أخطاء اتصال I/O متكررة',             action: 'تحديث firmware',      costAvoid: 15000, sev: 'high' as const },
  { id: 'PD-05', asset: 'مضخة B-5',    station: 'EJH',     risk: 55, days: 25,   trigger: 'كفاءة هبطت إلى 68%',                 action: 'فحص الدوّار',         costAvoid: 12000, sev: 'medium' as const },
  { id: 'PD-06', asset: 'مضخة H-2',    station: 'NEJH(N)', risk: 48, days: 32,   trigger: 'تآكل إيروسيفي في الدوّار',           action: 'تركيب فلتر شفط',      costAvoid: 9000,  sev: 'medium' as const },
];

// ── Asset Lifecycle ───────────────────────────────────────────
const LIFECYCLE = [
  { id: 'LC-01', name: 'مضخة M-3',     type: 'مضخة',   age: 14,  life: 15, health: 34, replaceCost: 185000, status: 'استبدال عاجل', risk: 'critical' as const },
  { id: 'LC-02', name: 'محول TR-1',    type: 'محول',   age: 12,  life: 20, health: 38, replaceCost: 420000, status: 'تجديد مطلوب',  risk: 'high' as const },
  { id: 'LC-03', name: 'صمام PV-7',    type: 'صمام',   age: 8,   life: 12, health: 55, replaceCost: 28000,  status: 'مراقبة',       risk: 'high' as const },
  { id: 'LC-04', name: 'وحدة PLC-2',   type: 'تحكم',   age: 9,   life: 10, health: 62, replaceCost: 95000,  status: 'ترقية قريبة',  risk: 'medium' as const },
  { id: 'LC-05', name: 'مضخة B-5',     type: 'مضخة',   age: 7,   life: 15, health: 68, replaceCost: 140000, status: 'جيد',           risk: 'medium' as const },
  { id: 'LC-06', name: 'مضخة H-2',     type: 'مضخة',   age: 6,   life: 15, health: 71, replaceCost: 160000, status: 'جيد',           risk: 'medium' as const },
  { id: 'LC-07', name: 'ضاغط C-1',     type: 'ضاغط',   age: 4,   life: 12, health: 84, replaceCost: 75000,  status: 'جيد',           risk: 'low' as const },
  { id: 'LC-08', name: 'مضخة S-1',     type: 'مضخة',   age: 3,   life: 15, health: 88, replaceCost: 130000, status: 'ممتاز',         risk: 'low' as const },
];

// ── Teams ─────────────────────────────────────────────────────
const TEAMS_DATA = [
  { id: 1, name: 'فريق ميكانيك أ', specialty: 'ميكانيكا', leader: 'م. سالم المبروك', members: 6, status: 'active', capacity: 5, assigned: 4, completed: 28, overdue: 1 },
  { id: 2, name: 'فريق ميكانيك ب', specialty: 'ميكانيكا', leader: 'م. خالد الفضيل',  members: 5, status: 'active', capacity: 4, assigned: 3, completed: 22, overdue: 0 },
  { id: 3, name: 'فريق كهرباء',    specialty: 'كهرباء',   leader: 'م. أحمد الزروق',  members: 4, status: 'active', capacity: 3, assigned: 3, completed: 19, overdue: 1 },
  { id: 4, name: 'فريق هيدروليك',  specialty: 'هيدروليك', leader: 'م. يوسف البشير',  members: 4, status: 'active', capacity: 4, assigned: 2, completed: 15, overdue: 0 },
  { id: 5, name: 'فريق تحكم',      specialty: 'تحكم',     leader: 'م. عمر الشلماني', members: 3, status: 'active', capacity: 2, assigned: 2, completed: 12, overdue: 0 },
  { id: 6, name: 'فريق إنشائي',    specialty: 'هيكلي',    leader: 'م. ناصر القذافي', members: 4, status: 'on_break', capacity: 3, assigned: 1, completed: 9, overdue: 0 },
];

// ── Spare Parts ───────────────────────────────────────────────
const SPARE_PARTS = [
  { id: 1, partNum: 'SP-101', name: 'محامل 6205 ZZ',  cat: 'محامل',     qty: 2,  minStock: 5,  unitPrice: 180,   supplier: 'شركة SKF',    leadDays: 14 },
  { id: 2, partNum: 'SP-102', name: 'حشوة مضخة DN80', cat: 'أختام',     qty: 0,  minStock: 4,  unitPrice: 320,   supplier: 'مخزن محلي',   leadDays: 3  },
  { id: 3, partNum: 'SP-103', name: 'مرشح زيت HF-40', cat: 'فلاتر',     qty: 12, minStock: 6,  unitPrice: 95,    supplier: 'مكتب الفلاتر',leadDays: 7  },
  { id: 4, partNum: 'SP-104', name: 'سير ناقل B-80',  cat: 'أحزمة',     qty: 3,  minStock: 4,  unitPrice: 250,   supplier: 'شركة Gates',  leadDays: 21 },
  { id: 5, partNum: 'SP-105', name: 'كابل XLPE 4×50', cat: 'كهربائي',   qty: 80, minStock: 50, unitPrice: 45,    supplier: 'كابلات ليبيا',leadDays: 10 },
  { id: 6, partNum: 'SP-106', name: 'صمام كروي 2"',   cat: 'هيدروليكي', qty: 4,  minStock: 6,  unitPrice: 420,   supplier: 'مخزن محلي',   leadDays: 5  },
  { id: 7, partNum: 'SP-107', name: 'مستشعر ضغط',     cat: 'كهربائي',   qty: 7,  minStock: 4,  unitPrice: 650,   supplier: 'Siemens',     leadDays: 30 },
  { id: 8, partNum: 'SP-108', name: 'دوّار مضخة 4"',  cat: 'ميكانيكي',  qty: 1,  minStock: 2,  unitPrice: 8500,  supplier: 'Grundfos',    leadDays: 45 },
  { id: 9, partNum: 'SP-109', name: 'بطارية UPS 7Ah', cat: 'كهربائي',   qty: 6,  minStock: 4,  unitPrice: 280,   supplier: 'مكتب الطاقة', leadDays: 7  },
  { id: 10,partNum: 'SP-110', name: 'زيت هيدروليك 46',cat: 'زيوت',      qty: 40, minStock: 20, unitPrice: 18,    supplier: 'نفط برقة',    leadDays: 3  },
];

// ── Maintenance History (12 months) ──────────────────────────
const HISTORY_MONTHLY = [
  { month: 'يونيو 25',  total: 14, completed: 13, cancelled: 1, cost: 48200,  pmCount: 8, cmCount: 6 },
  { month: 'يوليو 25',  total: 16, completed: 14, cancelled: 2, cost: 55400,  pmCount: 9, cmCount: 7 },
  { month: 'أغسطس 25',  total: 15, completed: 14, cancelled: 1, cost: 51800,  pmCount: 8, cmCount: 7 },
  { month: 'سبتمبر 25', total: 18, completed: 16, cancelled: 2, cost: 62100,  pmCount: 10,cmCount: 8 },
  { month: 'أكتوبر 25', total: 13, completed: 13, cancelled: 0, cost: 44500,  pmCount: 8, cmCount: 5 },
  { month: 'نوفمبر 25', total: 17, completed: 15, cancelled: 2, cost: 59300,  pmCount: 9, cmCount: 8 },
  { month: 'ديسمبر 25', total: 20, completed: 17, cancelled: 3, cost: 71400,  pmCount: 10,cmCount: 10},
  { month: 'يناير 26',  total: 22, completed: 19, cancelled: 3, cost: 78200,  pmCount: 11,cmCount: 11},
  { month: 'فبراير 26', total: 21, completed: 18, cancelled: 3, cost: 74600,  pmCount: 10,cmCount: 11},
  { month: 'مارس 26',   total: 19, completed: 17, cancelled: 2, cost: 67800,  pmCount: 10,cmCount: 9 },
  { month: 'أبريل 26',  total: 16, completed: 15, cancelled: 1, cost: 56200,  pmCount: 9, cmCount: 7 },
  { month: 'مايو 26',   total: 18, completed: 14, cancelled: 0, cost: 61500,  pmCount: 9, cmCount: 9 },
];

// ── Upcoming Calendar (next 30 days) ─────────────────────────
const CALENDAR_UPCOMING = [
  { date: '2026-05-23', task: 'تشحيم محامل مضخة M-1', type: 'وقائي', team: 'فريق ميكانيك أ', priority: 'high' },
  { date: '2026-05-25', task: 'فحص عوازل محول TR-1',  type: 'تصحيحي',team: 'فريق كهرباء',   priority: 'critical' },
  { date: '2026-05-26', task: 'صيانة مضخة H-2',       type: 'وقائي', team: 'فريق ميكانيك أ', priority: 'high' },
  { date: '2026-05-28', task: 'صيانة شهرية M-3',      type: 'وقائي', team: 'فريق ميكانيك أ', priority: 'critical' },
  { date: '2026-05-30', task: 'معايرة مستشعرات SCADA',type: 'وقائي', team: 'فريق تحكم',       priority: 'medium' },
  { date: '2026-06-01', task: 'صيانة ربعية محول TR-1', type: 'وقائي', team: 'فريق كهرباء',   priority: 'high' },
  { date: '2026-06-02', task: 'فحص صمامات الشبكة',    type: 'وقائي', team: 'فريق هيدروليك',  priority: 'medium' },
  { date: '2026-06-05', task: 'صيانة شهرية B-5',      type: 'وقائي', team: 'فريق ميكانيك ب', priority: 'medium' },
  { date: '2026-06-10', task: 'صيانة شهرية S-1',      type: 'وقائي', team: 'فريق هيدروليك',  priority: 'medium' },
  { date: '2026-06-15', task: 'فحص شامل لخطوط الأنابيب',type:'هيكلي',team: 'فريق إنشائي',   priority: 'low' },
];

// ── KPI Targets ───────────────────────────────────────────────
const KPI_TARGETS = [
  { kpi: 'نسبة إتمام أوامر العمل',   unit: '%', target: 90, weight: 'عالٍ' },
  { kpi: 'الالتزام بـ SLA',           unit: '%', target: 85, weight: 'عالٍ' },
  { kpi: 'التزام الصيانة الوقائية',   unit: '%', target: 92, weight: 'عالٍ' },
  { kpi: 'MTBF',                       unit: 'س', target: 900,weight: 'متوسط' },
  { kpi: 'MTTR',                       unit: 'س', target: 3.0, weight: 'متوسط' },
  { kpi: 'كفاءة تكلفة الصيانة',       unit: '%', target: 95, weight: 'متوسط' },
  { kpi: 'نسبة PM إلى CM',             unit: '%', target: 60, weight: 'متوسط' },
  { kpi: 'استجابة الفرق ≤ 2س',        unit: '%', target: 80, weight: 'منخفض' },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const STATUS_AR: Record<string, string> = {
  pending: 'معلق', open: 'مفتوح', in_progress: 'قيد التنفيذ',
  on_hold: 'موقوف', completed: 'مكتمل', closed: 'مغلق', cancelled: 'ملغى',
};
const PRIORITY_AR: Record<string, string> = {
  urgent: 'عاجل', normal: 'عادي', low: 'منخفض', critical: 'حرج', high: 'عالي',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-500/20 text-slate-300', open: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-amber-500/20 text-amber-300', on_hold: 'bg-slate-600/30 text-slate-400',
  completed: 'bg-emerald-500/20 text-emerald-300', closed: 'bg-slate-700/30 text-slate-500',
  cancelled: 'bg-red-500/20 text-red-300',
};
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400', urgent: 'text-orange-400',
  high: 'text-yellow-400', normal: 'text-sky-400', low: 'text-slate-400',
};
const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400',
};
const SEV_BG: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30',
  high:     'bg-orange-500/10 border-orange-500/30',
  medium:   'bg-yellow-500/10 border-yellow-500/30',
  low:      'bg-green-500/10 border-green-500/30',
};
const hColor = (h: number) => h < 40 ? 'bg-red-500' : h < 60 ? 'bg-orange-500' : h < 80 ? 'bg-yellow-500' : 'bg-emerald-500';
const hText  = (h: number) => h < 40 ? 'text-red-400' : h < 60 ? 'text-orange-400' : h < 80 ? 'text-yellow-400' : 'text-emerald-400';
const fmtCost = (n: number) => n >= 1000 ? (n / 1000).toFixed(0) + 'K' : String(n);

type PMSchedule = (typeof PM_SCHEDULES)[number];
type PredictiveItem = (typeof PREDICTIVE)[number];
type LifecycleItem = (typeof LIFECYCLE)[number];
type TeamItem = (typeof TEAMS_DATA)[number];
type SparePartItem = (typeof SPARE_PARTS)[number];

function toSafeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPmStatus(value: unknown): 'متأخر' | 'قادم' | 'مجدول' {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('overdue') || normalized.includes('late') || normalized.includes('متأخر')) return 'متأخر';
  if (normalized.includes('soon') || normalized.includes('due') || normalized.includes('قاد')) return 'قادم';
  return 'مجدول';
}

function toRiskBand(value: number): 'critical' | 'high' | 'medium' | 'low' {
  if (value >= 85) return 'critical';
  if (value >= 65) return 'high';
  if (value >= 45) return 'medium';
  return 'low';
}

// ── Compute KPIs from WO list ─────────────────────────────────
function computeKPIs(wos: WorkOrder[]) {
  if (!wos.length) return null;
  const total     = wos.length;
  const completed = wos.filter(w => ['completed','closed'].includes(w.status)).length;
  const inProg    = wos.filter(w => w.status === 'in_progress').length;
  const overdue   = wos.filter(w => w.sla_state === 'overdue').length;
  const pending   = wos.filter(w => ['pending','open'].includes(w.status)).length;
  const compPct   = Math.round((completed / total) * 100);
  const slaPct    = Math.round(((total - overdue) / total) * 100);
  const ages      = wos.filter(w => w.age_hours != null).map(w => w.age_hours!);
  const avgAge    = ages.length ? Math.round(ages.reduce((s,a) => s + a, 0) / ages.length) : 0;
  const estCost   = wos.reduce((s,w) => s + (w.estimated_cost || 0), 0);
  const actCost   = wos.reduce((s,w) => s + (w.actual_cost || 0), 0);
  const costEff   = estCost > 0 ? Math.round((actCost / estCost) * 100) : 0;
  // PM vs CM ratio
  const pmCount   = wos.filter(w => w.work_type === 'preventive').length;
  const pmRatio   = total > 0 ? Math.round((pmCount / total) * 100) : 0;
  return { total, completed, inProg, overdue, pending, compPct, slaPct, avgAge, estCost, actCost, costEff, pmRatio };
}

// ═══════════════════════════════════════════════════════════════
// TABS CONFIG
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview'    as PlanTab, label: 'الملخص التنفيذي'      },
  { id: 'workorders'  as PlanTab, label: 'أوامر العمل'          },
  { id: 'calendar'    as PlanTab, label: 'تخطيط الجدولة'        },
  { id: 'preventive'  as PlanTab, label: 'الصيانة الوقائية'     },
  { id: 'predictive'  as PlanTab, label: 'الصيانة التنبؤية'     },
  { id: 'lifecycle'   as PlanTab, label: 'دورة حياة الأصول'     },
  { id: 'teams'       as PlanTab, label: 'جدولة الفرق'          },
  { id: 'spareparts'  as PlanTab, label: 'قطع الغيار'           },
  { id: 'history'     as PlanTab, label: 'سجل الصيانة'          },
  { id: 'kpis'        as PlanTab, label: 'مؤشرات الأداء'        },
] as const;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function MaintenancePlanningPage() {
  const [activeTab,  setActiveTab]  = useState<PlanTab>('overview');
  const [wos,        setWos]        = useState<WorkOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [woSearch,   setWoSearch]   = useState('');
  const [woStatus,   setWoStatus]   = useState('all');
  const [woPriority, setWoPriority] = useState('all');
  const [dbPmSchedules, setDbPmSchedules] = useState<PMSchedule[]>([]);
  const [dbPredictive, setDbPredictive] = useState<PredictiveItem[]>([]);
  const [dbLifecycle, setDbLifecycle] = useState<LifecycleItem[]>([]);
  const [dbTeams, setDbTeams] = useState<TeamItem[]>([]);
  const [dbSpareParts, setDbSpareParts] = useState<SparePartItem[]>([]);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStats, setImportStats] = useState<WorkOrderImportStats | null>(null);
  const [importResult, setImportResult] = useState<WorkOrderImportResult | null>(null);
  const [archiveStats, setArchiveStats] = useState<any | null>(null);

  const fetchWOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/workspace/work-orders?limit=500');
      if (res.ok) { const d = await res.json(); setWos(d.data || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);

  const fetchImportStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/workspace/work-orders/import');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setImportStats({
          totalRows: Number(data.totalRows || 0),
          equipmentCount: Number(data.equipmentCount || 0),
          lastBatchId: data.lastBatchId || null,
          lastImportAt: data.lastImportAt || null,
        });
      }
    } catch {
      // keep UI silent and fallback to null stats
    }
  }, []);

  useEffect(() => {
    fetchImportStats();
  }, [fetchImportStats]);

  const fetchArchiveStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/workspace/work-orders/archive-stats');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) setArchiveStats(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchArchiveStats(); }, [fetchArchiveStats]);

  const handleImportArchive = useCallback(async (fileArg?: File, force = false) => {
    const fileToImport = fileArg ?? archiveFile;
    if (!fileToImport) {
      setImportResult({ success: false, error: 'يرجى اختيار ملف Excel أولاً' });
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', fileToImport);
      if (force) fd.append('force', 'true');
      const res = await fetch('/api/v1/workspace/work-orders/import', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setImportResult({
          success: false,
          duplicate: data?.duplicate === true,
          error: data?.error || 'فشل استيراد الملف',
          previousBatchId: data?.previousBatchId,
          previousImportAt: data?.previousImportAt,
        });
        return;
      }

      setImportResult({
        success: true,
        batchId: data.batchId,
        fileName: data.fileName,
        totalRows: Number(data.totalRows || 0),
        archivedInserted: Number(data.archivedInserted || 0),
        archivedUpdated: Number(data.archivedUpdated || 0),
        workflowCreated: Number(data.workflowCreated || 0),
      });
      setArchiveFile(null);
      fetchWOs();
      fetchImportStats();
      fetchArchiveStats();
    } catch {
      setImportResult({ success: false, error: 'حدث خطأ غير متوقع أثناء الاستيراد' });
    } finally {
      setImportLoading(false);
    }
  }, [archiveFile, fetchImportStats, fetchWOs, fetchArchiveStats]);

  const fetchPlanningSources = useCallback(async () => {
    const [pmRes, teamsRes, balanceRes, assetsRes, predictiveRes] = await Promise.allSettled([
      fetch('/api/v1/hr-structure/preventive-maintenance'),
      fetch('/api/v1/hr-structure/maintenance-teams'),
      fetch('/api/v1/inventory/balance'),
      fetch('/api/v1/maintenance/assets'),
      fetch('/api/v1/twin/predictions/maintenance'),
    ]);

    if (pmRes.status === 'fulfilled' && pmRes.value.ok) {
      const payload = await pmRes.value.json().catch(() => ({}));
      const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];
      const mapped: PMSchedule[] = schedules
        .map((s: any, idx: number) => ({
          id: String(s.schedule_id || s.id || `PM-${idx + 1}`),
          asset: String(s.asset_name || s.asset || s.asset_code || `PM Asset ${idx + 1}`),
          station: String(s.station || s.location || s.route_sector || '—'),
          freq: String(s.frequency || s.freq || s.interval || 'دوري'),
          nextDue: String(s.next_due_date || s.next_maintenance_date || s.nextDue || '—'),
          lastDone: String(s.last_done_date || s.last_maintenance_date || s.lastDone || '—'),
          team: String(s.assigned_team || s.team_name || s.team || '—'),
          status: toPmStatus(s.status),
          compliance: Math.max(0, Math.min(100, Math.round(toSafeNumber(s.compliance_pct ?? s.compliance, 80)))),
        }))
        .filter((s: PMSchedule) => s.asset && s.id);
      setDbPmSchedules(mapped);
    }

    if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
      const payload = await teamsRes.value.json().catch(() => ({}));
      const teams = Array.isArray(payload?.teams) ? payload.teams : [];
      const mapped: TeamItem[] = teams
        .map((t: any, idx: number) => ({
          id: Number(t.id ?? idx + 1),
          name: String(t.team_name_ar || t.team_name || `فريق ${idx + 1}`),
          specialty: String(t.specialization || t.specialty || 'عام'),
          leader: String(t.team_leader_name || t.team_leader || '—'),
          members: Math.max(0, Math.round(toSafeNumber(t.members_count, 0))),
          status: t.is_active === false ? 'on_break' : 'active',
          capacity: Math.max(1, Math.round(toSafeNumber(t.capacity, Math.max(2, toSafeNumber(t.members_count, 2))))),
          assigned: 0,
          completed: 0,
          overdue: 0,
        }))
        .filter((t: TeamItem) => t.name);
      setDbTeams(mapped);
    }

    if (balanceRes.status === 'fulfilled' && balanceRes.value.ok) {
      const payload = await balanceRes.value.json().catch(() => ({}));
      const balance = Array.isArray(payload?.balance) ? payload.balance : [];
      const mapped: SparePartItem[] = balance
        .map((item: any, idx: number) => ({
          id: Number(item.item_id ?? idx + 1),
          partNum: String(item.item_code || `ITEM-${idx + 1}`),
          name: String(item.item_name || 'عنصر مخزون'),
          cat: String(item.category || item.unit || 'مخزون'),
          qty: Math.max(0, Math.round(toSafeNumber(item.current_balance, 0))),
          minStock: Math.max(0, Math.round(toSafeNumber(item.min_stock_level, 0))),
          unitPrice: Math.max(0, Math.round(toSafeNumber(item.default_cost, 0))),
          supplier: String(item.supplier_name || '—'),
          leadDays: Math.max(0, Math.round(toSafeNumber(item.lead_time_days, 0))),
        }))
        .filter((item: SparePartItem) => item.name && item.partNum);
      setDbSpareParts(mapped);
    }

    if (assetsRes.status === 'fulfilled' && assetsRes.value.ok) {
      const payload = await assetsRes.value.json().catch(() => ({}));
      const assets = Array.isArray(payload?.assets) ? payload.assets : [];
      const mapped: LifecycleItem[] = assets
        .map((asset: any, idx: number) => {
          const status = String(asset.status || '').toLowerCase();
          const health = status.includes('down') || status.includes('failed') ? 35 : status.includes('maintenance') ? 55 : 80;
          const risk = health <= 40 ? 'critical' : health <= 60 ? 'high' : health <= 75 ? 'medium' : 'low';
          const age = Math.max(1, Math.round(toSafeNumber(asset.age_years, 6)));
          const life = Math.max(age + 1, Math.round(toSafeNumber(asset.life_years, 15)));
          return {
            id: String(asset.id ?? `LC-${idx + 1}`),
            name: String(asset.name || asset.asset_code || `Asset ${idx + 1}`),
            type: String(asset.category || asset.type || 'أصل'),
            age,
            life,
            health,
            replaceCost: Math.max(0, Math.round(toSafeNumber(asset.replace_cost, 0))),
            status: risk === 'critical' ? 'استبدال عاجل' : risk === 'high' ? 'تجديد مطلوب' : risk === 'medium' ? 'مراقبة' : 'جيد',
            risk,
          } as LifecycleItem;
        })
        .filter((item: LifecycleItem) => item.name);
      setDbLifecycle(mapped);
    }

    if (predictiveRes.status === 'fulfilled' && predictiveRes.value.ok) {
      const payload = await predictiveRes.value.json().catch(() => ({}));
      const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
      const mapped: PredictiveItem[] = predictions
        .map((p: any, idx: number) => {
          const risk = Math.max(0, Math.min(100, Math.round(toSafeNumber(p.risk_score ?? p.risk, 0))));
          return {
            id: String(p.id || `PD-${idx + 1}`),
            asset: String(p.asset_name || p.asset || p.asset_code || `Asset ${idx + 1}`),
            station: String(p.station || p.location || '—'),
            risk,
            days: Math.max(1, Math.round(toSafeNumber(p.days_to_failure ?? p.days, 30))),
            trigger: String(p.trigger || p.reason || 'Predictive trigger'),
            action: String(p.action || p.recommended_action || 'Field review'),
            costAvoid: Math.max(0, Math.round(toSafeNumber(p.cost_avoidance ?? p.costAvoid, 0))),
            sev: toRiskBand(risk),
          } as PredictiveItem;
        })
        .filter((item: PredictiveItem) => item.asset);
      setDbPredictive(mapped);
    }
  }, []);

  useEffect(() => {
    fetchPlanningSources();
  }, [fetchPlanningSources]);

  const pmSchedules = useMemo(() => (dbPmSchedules.length ? dbPmSchedules : PM_SCHEDULES), [dbPmSchedules]);
  const predictiveData = useMemo(() => (dbPredictive.length ? dbPredictive : PREDICTIVE), [dbPredictive]);
  const lifecycleData = useMemo(() => (dbLifecycle.length ? dbLifecycle : LIFECYCLE), [dbLifecycle]);
  const sparePartsData = useMemo(() => (dbSpareParts.length ? dbSpareParts : SPARE_PARTS), [dbSpareParts]);

  const teamsData = useMemo(() => {
    const base = dbTeams.length ? dbTeams : TEAMS_DATA;
    return base.map((team) => {
      const teamName = team.name.toLowerCase();
      const teamWos = wos.filter((wo) => (wo.assigned_team || '').toLowerCase().includes(teamName));
      return {
        ...team,
        assigned: teamWos.filter((wo) => ['pending', 'open', 'in_progress'].includes(wo.status)).length,
        completed: teamWos.filter((wo) => ['completed', 'closed'].includes(wo.status)).length,
        overdue: teamWos.filter((wo) => wo.sla_state === 'overdue').length,
      };
    });
  }, [dbTeams, wos]);

  const kpi = useMemo(() => computeKPIs(wos), [wos]);

  const filteredWOs = useMemo(() => wos.filter(w => {
    if (woStatus   !== 'all' && w.status   !== woStatus)   return false;
    if (woPriority !== 'all' && w.priority !== woPriority) return false;
    if (woSearch && !(w.title + (w.asset_name || '') + (w.assigned_team || '')).toLowerCase().includes(woSearch.toLowerCase())) return false;
    return true;
  }), [wos, woStatus, woPriority, woSearch]);

  // KPI actuals — prefer archive data (full dataset) over work orders (capped at 500)
  const kpiActuals: Record<string, number> = useMemo(() => {
    const as = archiveStats?.summary;
    return {
      'نسبة إتمام أوامر العمل':  as?.completionRate  ?? kpi?.compPct  ?? 82,
      'الالتزام بـ SLA':           kpi?.slaPct         ?? 78,
      'التزام الصيانة الوقائية':   73,
      'MTBF':                       847,
      'MTTR':                       3.2,
      'كفاءة تكلفة الصيانة':       kpi?.costEff        ?? 88,
      'نسبة PM إلى CM':             as?.pmRatio         ?? kpi?.pmRatio  ?? 51,
      'استجابة الفرق ≤ 2س':        72,
    };
  }, [kpi, archiveStats]);

  // Use archive monthly data when available, else fall back to hardcoded
  const historyData = useMemo(() => {
    if (archiveStats?.monthly?.length) {
      return archiveStats.monthly.map((m: any) => ({
        month: m.month_label || m.month_key,
        total: m.total || 0,
        completed: m.completed || 0,
        cancelled: m.cancelled || 0,
        cost: 0,
        pmCount: m.pm_count || 0,
        cmCount: m.cm_count || 0,
      }));
    }
    return HISTORY_MONTHLY;
  }, [archiveStats]);

  const lowStock = useMemo(() => sparePartsData.filter(p => p.qty <= p.minStock), [sparePartsData]);
  const overdueWOs = useMemo(() => wos.filter(w => w.sla_state === 'overdue').length, [wos]);
  const overduePMs = useMemo(() => pmSchedules.filter(p => p.status === 'متأخر').length, [pmSchedules]);
  const totalReplCost = useMemo(() => lifecycleData.filter(l => l.risk === 'critical' || l.risk === 'high').reduce((s,l) => s + l.replaceCost, 0), [lifecycleData]);
  const totalCostAvoid = useMemo(() => predictiveData.reduce((s,p) => s + p.costAvoid, 0), [predictiveData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/dashboard/admin-gateway/maintenance"
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" /> إدارة الصيانة
            </Link>
            <span>/</span>
            <span className="text-amber-400">تخطيط الصيانة</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">تخطيط الصيانة المتكامل</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                أوامر العمل · الجدولة · الصيانة الوقائية والتنبؤية · دورة حياة الأصول
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {overdueWOs > 0 && (
                <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 rounded-lg px-2.5 py-1 text-red-300 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" /> {overdueWOs} أوامر متأخرة
                </span>
              )}
              {overduePMs > 0 && (
                <span className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/40 rounded-lg px-2.5 py-1 text-orange-300 text-xs">
                  <Clock className="w-3.5 h-3.5" /> {overduePMs} PM متأخر
                </span>
              )}
              <button onClick={fetchWOs}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 text-xs transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> تحديث
              </button>
            </div>
          </div>

          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  رفع أرشيف أوامر العمل التاريخية
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  متاح من أي تبويب داخل تخطيط الصيانة لاستيراد ملفات Excel وربطها بالسجل التاريخي للمعدات.
                </p>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>الأرشيف المخزن: <span className="text-slate-200 font-semibold">{importStats?.totalRows ?? 0}</span></div>
                <div>المعدات المرتبطة: <span className="text-slate-200 font-semibold">{importStats?.equipmentCount ?? 0}</span></div>
                {importStats?.lastImportAt && (
                  <div>آخر استيراد: <span className="text-slate-300">{new Date(importStats.lastImportAt).toLocaleString('ar-LY')}</span></div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
              <label className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                importLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}>
                {importLoading
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري الاستيراد...</>
                  : <><Upload className="w-3.5 h-3.5" /> اختر ملف واستيراد</>}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={importLoading}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setArchiveFile(f);
                    handleImportArchive(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {importLoading && archiveFile && (
                <span className="text-xs text-slate-400 truncate max-w-xs">جاري معالجة: {archiveFile.name}</span>
              )}
            </div>

            {importResult && (
              <div className={`mt-3 rounded-lg border p-3 text-xs ${importResult.success ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : importResult.duplicate ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>
                {importResult.success ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>إجمالي الصفوف: {importResult.totalRows ?? 0}</span>
                    <span>مضاف للأرشيف: {importResult.archivedInserted ?? 0}</span>
                    <span>محدث: {importResult.archivedUpdated ?? 0}</span>
                    <span>أُنشئ كنشاط عمل: {importResult.workflowCreated ?? 0}</span>
                    {importResult.batchId && <span>Batch: {importResult.batchId}</span>}
                  </div>
                ) : importResult.duplicate ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span>⚠ {importResult.error}</span>
                    <button
                      onClick={() => handleImportArchive(archiveFile ?? undefined, true)}
                      disabled={importLoading}
                      className="shrink-0 rounded px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      إعادة الاستيراد بالقوة
                    </button>
                  </div>
                ) : (
                  <span>{importResult.error || 'فشل الاستيراد'}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ OVERVIEW ═══════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" /> جاري التحميل…
              </div>
            ) : (
              <>
                {/* KPI Grid — uses archive totals when available, falls back to live work orders */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(() => {
                    const as = archiveStats?.summary;
                    const totalWOs   = as?.total        ?? kpi?.total    ?? 0;
                    const compPct    = as?.completionRate ?? kpi?.compPct ?? 0;
                    const compCount  = as?.completedTotal ?? kpi?.completed ?? 0;
                    const pmRatio    = as?.pmRatio       ?? kpi?.pmRatio  ?? 0;
                    const pmCount    = as?.pmTotal       ?? 0;
                    const inProgress = as?.inProgress    ?? kpi?.inProg   ?? 0;
                    const waitingPlan= as?.waitingPlan   ?? kpi?.pending  ?? 0;
                    const equipCount = as?.equipmentCount ?? 0;
                    return [
                      { label: 'إجمالي أوامر العمل',  value: totalWOs.toLocaleString(),  color: 'text-white',         sub: equipCount ? `${equipCount.toLocaleString()} معدة` : `${inProgress} قيد التنفيذ` },
                      { label: 'نسبة الإتمام',         value: compPct+'%',                color: compPct>=90?'text-emerald-400':'text-yellow-400', sub: `${compCount.toLocaleString()} مكتمل` },
                      { label: 'نسبة PM',               value: pmRatio+'%',                color: pmRatio>=60?'text-emerald-400':'text-yellow-400', sub: `${pmCount.toLocaleString()} وقائي` },
                      { label: 'قيد التنفيذ / معلق',   value: inProgress + waitingPlan,  color: 'text-orange-400',    sub: `${inProgress} جارية · ${waitingPlan} معلقة` },
                      { label: 'الالتزام بـ SLA',       value: (kpi?.slaPct ?? '—')+(kpi ? '%' : ''), color: (kpi?.slaPct??0)>=85?'text-emerald-400':'text-red-400', sub: kpi ? `${kpi.overdue} متأخر` : 'لا بيانات' },
                      { label: 'متوسط عمر الأمر',      value: kpi ? kpi.avgAge+'س' : '—', color: 'text-violet-400',    sub: 'ساعة منذ الفتح' },
                      { label: 'التكلفة التقديرية',    value: kpi ? 'LD '+fmtCost(kpi.estCost) : '—', color: 'text-sky-400', sub: 'إجمالي مقدّر' },
                      { label: 'التكلفة الفعلية',      value: kpi ? 'LD '+fmtCost(kpi.actCost) : '—', color: kpi ? (kpi.costEff<=100?'text-emerald-400':'text-red-400') : 'text-slate-400', sub: kpi ? `كفاءة ${kpi.costEff}%` : '' },
                    ];
                  })().map(k => (
                    <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="text-slate-500 text-xs mb-1">{k.label}</div>
                      <div className={`text-2xl font-bold ${k.color}`}>{String(k.value)}</div>
                      {k.sub && <div className="text-slate-500 text-[10px] mt-0.5">{k.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">اتجاه تكاليف الصيانة (12 شهراً) — LD</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={historyData}>
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }}
                          formatter={(v: number) => ['LD ' + v.toLocaleString(), 'التكلفة']} />
                        <Area type="monotone" dataKey="cost" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} name="التكلفة" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">PM مقابل CM (12 شهراً)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="pmCount" name="وقائي PM" fill="#10b981" stackId="a" />
                        <Bar dataKey="cmCount" name="تصحيحي CM" fill="#f97316" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Alert panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> تنبيهات عاجلة</h3>
                    <div className="space-y-1.5">
                      {predictiveData.filter(p => p.sev === 'critical').map(p => (
                        <div key={p.id} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5 shrink-0">●</span>
                          <span>{p.asset} — {p.trigger}</span>
                        </div>
                      ))}
                      {lowStock.filter(s => s.qty === 0).map(s => (
                        <div key={s.id} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-orange-400 mt-0.5 shrink-0">●</span>
                          <span>{s.name} — نفذ المخزون</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> PM متأخرة</h3>
                    <div className="space-y-1.5">
                      {pmSchedules.filter(p => p.status === 'متأخر').map(p => (
                        <div key={p.id} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5 shrink-0">●</span>
                          <span>{p.asset} ({p.station}) — كان: {p.nextDue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-violet-300 mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> توفير تنبؤي محتمل</h3>
                    <div className="text-2xl font-bold text-violet-400 mb-1">LD {totalCostAvoid.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-400">عبر تدخل وقائي مبكر لـ {predictiveData.length} أصول</div>
                    <div className="mt-2 text-[11px] text-slate-500">تكلفة استبدال مخاطر عالية: <span className="text-orange-400">LD {totalReplCost.toLocaleString()}</span></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ WORK ORDERS ═══════════════ */}
        {activeTab === 'workorders' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={woSearch} onChange={e => setWoSearch(e.target.value)}
                  placeholder="بحث في أوامر العمل…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pr-8 pl-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500" />
              </div>
              <select value={woStatus} onChange={e => setWoStatus(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500">
                <option value="all">كل الحالات</option>
                {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={woPriority} onChange={e => setWoPriority(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500">
                <option value="all">كل الأولويات</option>
                {Object.entries(PRIORITY_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-slate-400 py-12">
                <RefreshCw className="w-4 h-4 animate-spin" /> جاري التحميل…
              </div>
            ) : filteredWOs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                لا توجد أوامر تطابق معايير البحث
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">أوامر العمل ({filteredWOs.length})</span>
                  {kpi && <span className="text-xs text-slate-500">{kpi.overdue} متأخر · {kpi.inProg} قيد التنفيذ</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                        <th className="px-3 py-2 text-right font-medium">الرقم</th>
                        <th className="px-3 py-2 text-right font-medium">العنوان</th>
                        <th className="px-3 py-2 text-right font-medium">الأصل</th>
                        <th className="px-3 py-2 text-right font-medium">النوع</th>
                        <th className="px-3 py-2 text-right font-medium">الأولوية</th>
                        <th className="px-3 py-2 text-right font-medium">الحالة</th>
                        <th className="px-3 py-2 text-right font-medium">الفريق</th>
                        <th className="px-3 py-2 text-right font-medium">التكلفة المقدرة</th>
                        <th className="px-3 py-2 text-right font-medium">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWOs.slice(0, 50).map(w => (
                        <tr key={w.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                          <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{w.work_order_number || '#' + w.id}</td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <div className="truncate text-slate-200">{w.title_ar || w.title}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-400 truncate max-w-[120px]">{w.asset_name || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{w.work_type === 'preventive' ? 'وقائي' : w.work_type === 'corrective' ? 'تصحيحي' : w.work_type}</td>
                          <td className={`px-3 py-2 font-semibold ${PRIORITY_COLOR[w.priority] || 'text-slate-400'}`}>
                            {PRIORITY_AR[w.priority] || w.priority}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLOR[w.status] || 'bg-slate-700 text-slate-400'}`}>
                              {STATUS_AR[w.status] || w.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400 truncate max-w-[120px]">{w.assigned_team || '—'}</td>
                          <td className="px-3 py-2 text-slate-300">{w.estimated_cost ? 'LD ' + w.estimated_cost.toLocaleString() : '—'}</td>
                          <td className="px-3 py-2">
                            {w.sla_state === 'overdue'
                              ? <span className="text-red-400 text-[10px] font-semibold">متأخر</span>
                              : <span className="text-emerald-400 text-[10px]">ضمن المهلة</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredWOs.length > 50 && (
                    <div className="p-3 text-center text-xs text-slate-500">يُعرض 50 من {filteredWOs.length} — استخدم البحث للتصفية</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ PLANNING CALENDAR ═══════════════ */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">المهام المجدولة — 30 يوماً القادمة</h3>
                <div className="space-y-2">
                  {CALENDAR_UPCOMING.map((task, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${SEV_BG[task.priority] || 'border-slate-700 bg-slate-800/20'}`}>
                      <div className="shrink-0 text-center w-14">
                        <div className="text-[10px] text-slate-500">{task.date.slice(5)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-200">{task.task}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{task.team} · {task.type}</div>
                      </div>
                      <span className={`text-[10px] font-semibold shrink-0 ${SEV_COLOR[task.priority] || 'text-slate-400'}`}>
                        {task.priority === 'critical' ? 'حرج' : task.priority === 'high' ? 'عالٍ' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">توزيع المهام حسب النوع</h3>
                  {[
                    { type: 'وقائي', count: CALENDAR_UPCOMING.filter(t => t.type === 'وقائي').length, color: 'bg-emerald-500' },
                    { type: 'تصحيحي', count: CALENDAR_UPCOMING.filter(t => t.type === 'تصحيحي').length, color: 'bg-red-500' },
                    { type: 'هيكلي', count: CALENDAR_UPCOMING.filter(t => t.type === 'هيكلي').length, color: 'bg-blue-500' },
                  ].map(t => (
                    <div key={t.type} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{t.type}</span>
                        <span className="text-slate-300">{t.count} مهام</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${t.color}`} style={{ width: `${(t.count / CALENDAR_UPCOMING.length) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-300 mb-2">توزيع الأحمال الأسبوعية</h3>
                  {[
                    { week: 'الأسبوع 1 (22-28 مايو)', tasks: 4, cap: 8 },
                    { week: 'الأسبوع 2 (29 مايو - 4 يونيو)', tasks: 5, cap: 8 },
                    { week: 'الأسبوع 3 (5-11 يونيو)', tasks: 2, cap: 8 },
                    { week: 'الأسبوع 4 (12-18 يونيو)', tasks: 1, cap: 8 },
                  ].map(w => (
                    <div key={w.week} className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">{w.week}</span>
                        <span className={w.tasks >= w.cap * 0.8 ? 'text-red-400' : 'text-slate-300'}>{w.tasks}/{w.cap}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${w.tasks >= w.cap * 0.8 ? 'bg-red-500' : w.tasks >= w.cap * 0.6 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                          style={{ width: `${(w.tasks / w.cap) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ PREVENTIVE MAINTENANCE ═══════════════ */}
        {activeTab === 'preventive' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي جداول PM', value: pmSchedules.length, color: 'text-white' },
                { label: 'مجدولة',           value: pmSchedules.filter(p=>p.status==='مجدول').length, color: 'text-emerald-400' },
                { label: 'قادمة (7 أيام)',   value: pmSchedules.filter(p=>p.status==='قادم').length,  color: 'text-amber-400' },
                { label: 'متأخرة',            value: pmSchedules.filter(p=>p.status==='متأخر').length, color: 'text-red-400' },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs mb-1">{k.label}</div>
                  <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-300">جداول الصيانة الوقائية</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                      <th className="px-3 py-2 text-right font-medium">الرقم</th>
                      <th className="px-3 py-2 text-right font-medium">الأصل</th>
                      <th className="px-3 py-2 text-right font-medium">المحطة</th>
                      <th className="px-3 py-2 text-right font-medium">التكرار</th>
                      <th className="px-3 py-2 text-right font-medium">الموعد القادم</th>
                      <th className="px-3 py-2 text-right font-medium">آخر تنفيذ</th>
                      <th className="px-3 py-2 text-right font-medium">الفريق</th>
                      <th className="px-3 py-2 text-right font-medium">نسبة الالتزام</th>
                      <th className="px-3 py-2 text-right font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmSchedules.map(p => (
                      <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                        <td className="px-3 py-2 font-mono text-slate-400">{p.id}</td>
                        <td className="px-3 py-2 font-medium text-slate-200">{p.asset}</td>
                        <td className="px-3 py-2 text-slate-400">{p.station}</td>
                        <td className="px-3 py-2 text-slate-400">{p.freq}</td>
                        <td className={`px-3 py-2 font-mono text-sm ${p.status==='متأخر'?'text-red-400':p.status==='قادم'?'text-amber-400':'text-slate-300'}`}>{p.nextDue}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{p.lastDone}</td>
                        <td className="px-3 py-2 text-slate-400">{p.team}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden w-16">
                              <div className={`h-full ${p.compliance>=90?'bg-emerald-500':p.compliance>=75?'bg-yellow-500':'bg-red-500'}`}
                                style={{ width: p.compliance+'%' }} />
                            </div>
                            <span className={`text-[10px] ${p.compliance>=90?'text-emerald-400':p.compliance>=75?'text-yellow-400':'text-red-400'}`}>{p.compliance}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            p.status==='متأخر'?'bg-red-500/20 text-red-300':
                            p.status==='قادم'?'bg-amber-500/20 text-amber-300':
                            'bg-emerald-500/20 text-emerald-300'}`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PM compliance chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">نسبة الالتزام بـ PM لكل أصل</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pmSchedules}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="asset" tick={{ fontSize: 8, fill: '#64748b' }} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                  <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'هدف 90%', fill: '#22c55e', fontSize: 9 }} />
                  <Bar dataKey="compliance" name="الالتزام %">
                    {pmSchedules.map(p => <Cell key={p.id} fill={p.compliance>=90?'#22c55e':p.compliance>=75?'#eab308':'#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══════════════ PREDICTIVE MAINTENANCE ═══════════════ */}
        {activeTab === 'predictive' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{predictiveData.filter(p=>p.sev==='critical').length}</div>
                <div className="text-[10px] text-slate-400">خطر حرج</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-400">{predictiveData.filter(p=>p.sev==='high').length}</div>
                <div className="text-[10px] text-slate-400">خطر عالٍ</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{predictiveData.filter(p=>p.sev==='medium').length}</div>
                <div className="text-[10px] text-slate-400">خطر متوسط</div>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">LD {totalCostAvoid.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">توفير محتمل</div>
              </div>
            </div>

            <div className="space-y-3">
              {[...predictiveData].sort((a,b) => b.risk - a.risk).map(p => (
                <div key={p.id} className={`rounded-xl border p-4 ${SEV_BG[p.sev]}`}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-center w-16 shrink-0">
                      <div className={`text-2xl font-bold ${SEV_COLOR[p.sev]}`}>{p.risk}%</div>
                      <div className="text-[10px] text-slate-500">خطر</div>
                    </div>
                    <div className="w-px h-10 bg-slate-700 shrink-0 hidden md:block" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">{p.asset}</span>
                        <span className="text-[10px] text-slate-500">{p.station}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">المحفز: {p.trigger}</div>
                      <div className="text-xs text-emerald-400 mt-0.5">الإجراء: {p.action}</div>
                    </div>
                    <div className="text-center shrink-0">
                      <div className={`text-lg font-bold ${p.days <= 7 ? 'text-red-400' : p.days <= 30 ? 'text-yellow-400' : 'text-slate-300'}`}>{p.days}</div>
                      <div className="text-[10px] text-slate-500">يوم</div>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="text-sm font-semibold text-violet-400">LD {p.costAvoid.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">توفير محتمل</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${p.risk>=80?'bg-red-500':p.risk>=60?'bg-orange-500':p.risk>=40?'bg-yellow-500':'bg-emerald-500'}`}
                      style={{ width: p.risk+'%' }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-300 mb-2">خارطة الطريق التنبؤية — إجراءات مطلوبة</h3>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div>● تفعيل مراقبة اهتزاز آنية على جميع مضخات NEJH(N) (أولوية: عاجل)</div>
                <div>● جدولة فحص حراري دوري لجميع المحولات مرة كل أسبوع</div>
                <div>● تركيب مستشعرات ذكية على خطوط الضغط الحساسة</div>
                <div>● ربط بيانات التشغيل بنظام الإنذار المبكر (SCADA integration)</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ASSET LIFECYCLE ═══════════════ */}
        {activeTab === 'lifecycle' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{lifecycleData.filter(l=>l.risk==='critical').length}</div>
                <div className="text-[10px] text-slate-400">استبدال عاجل</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-400">{lifecycleData.filter(l=>l.risk==='high').length}</div>
                <div className="text-[10px] text-slate-400">تجديد مطلوب</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{lifecycleData.filter(l=>l.risk==='medium').length}</div>
                <div className="text-[10px] text-slate-400">مراقبة نشطة</div>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">LD {totalReplCost.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">تكلفة استبدال مخططة</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {lifecycleData.map(a => {
                const agePct = Math.min(100, Math.round((a.age / a.life) * 100));
                return (
                  <div key={a.id} className={`bg-slate-900 rounded-xl border p-4 space-y-3 ${SEV_BG[a.risk]}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{a.name}</div>
                        <div className="text-[10px] text-slate-500">{a.type}</div>
                      </div>
                      <span className={`text-[10px] font-bold ${SEV_COLOR[a.risk]}`}>{a.status}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-500">العمر الافتراضي</span>
                        <span className={hText(100-agePct)}>{a.age}/{a.life} سنة</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${agePct>=90?'bg-red-500':agePct>=70?'bg-orange-500':agePct>=50?'bg-yellow-500':'bg-emerald-500'}`}
                          style={{ width: agePct+'%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-500">الصحة الحالية</span>
                        <span className={hText(a.health)}>{a.health}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${hColor(a.health)}`} style={{ width: a.health+'%' }} />
                      </div>
                    </div>
                    <div className="text-[10px] text-violet-400 font-semibold">
                      تكلفة الاستبدال: LD {a.replaceCost.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">تحليل العمر الافتراضي</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lifecycleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="age"  name="العمر الحالي (سنة)" fill="#f97316" />
                  <Bar dataKey="life" name="العمر الافتراضي (سنة)" fill="#334155" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══════════════ TEAM SCHEDULING ═══════════════ */}
        {activeTab === 'teams' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{teamsData.filter(t=>t.status==='active').length}</div>
                <div className="text-[10px] text-slate-400">فرق نشطة</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{teamsData.reduce((s,t)=>s+t.members,0)}</div>
                <div className="text-[10px] text-slate-400">إجمالي الأعضاء</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{teamsData.reduce((s,t)=>s+t.assigned,0)}</div>
                <div className="text-[10px] text-slate-400">مهام مسندة</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{teamsData.reduce((s,t)=>s+t.overdue,0)}</div>
                <div className="text-[10px] text-slate-400">مهام متأخرة</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamsData.map(t => {
                const utilPct = t.capacity > 0 ? Math.round((t.assigned / t.capacity) * 100) : 0;
                return (
                  <div key={t.id} className={`bg-slate-900 border rounded-xl p-4 space-y-3 ${
                    t.status === 'active' ? 'border-slate-800' : 'border-slate-700 opacity-70'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{t.name}</div>
                        <div className="text-[10px] text-slate-500">{t.specialty} · قائد: {t.leader}</div>
                      </div>
                      <span className={`text-[10px] font-semibold ${t.status==='active'?'text-emerald-400':'text-amber-400'}`}>
                        {t.status==='active'?'نشط':'استراحة'}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">استغلال الطاقة</span>
                        <span className={utilPct>=90?'text-red-400':utilPct>=70?'text-yellow-400':'text-emerald-400'}>{utilPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${utilPct>=90?'bg-red-500':utilPct>=70?'bg-yellow-500':'bg-emerald-500'}`}
                          style={{ width: Math.min(utilPct,100)+'%' }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-slate-800/50 rounded p-1.5">
                        <div className="text-white font-bold">{t.members}</div>
                        <div className="text-slate-500 text-[10px]">أعضاء</div>
                      </div>
                      <div className="bg-slate-800/50 rounded p-1.5">
                        <div className="text-amber-400 font-bold">{t.assigned}</div>
                        <div className="text-slate-500 text-[10px]">مُسند</div>
                      </div>
                      <div className="bg-slate-800/50 rounded p-1.5">
                        <div className="text-emerald-400 font-bold">{t.completed}</div>
                        <div className="text-slate-500 text-[10px]">مكتمل</div>
                      </div>
                    </div>
                    {t.overdue > 0 && (
                      <div className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {t.overdue} مهام متأخرة
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">الأداء التراكمي للفرق</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={teamsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" name="مكتملة" fill="#10b981" />
                  <Bar dataKey="assigned"  name="مُسندة"  fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══════════════ SPARE PARTS ═══════════════ */}
        {activeTab === 'spareparts' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{sparePartsData.length}</div>
                <div className="text-[10px] text-slate-400">إجمالي الأصناف</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{sparePartsData.filter(p=>p.qty===0).length}</div>
                <div className="text-[10px] text-slate-400">نفذ المخزون</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{sparePartsData.filter(p=>p.qty>0&&p.qty<=p.minStock).length}</div>
                <div className="text-[10px] text-slate-400">مخزون منخفض</div>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">
                  LD {sparePartsData.filter(p=>p.qty<=p.minStock).reduce((s,p)=>(s+p.minStock*2*p.unitPrice),0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">تكلفة إعادة التخزين</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-300">مخزون قطع الغيار</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                      <th className="px-3 py-2 text-right font-medium">الرقم</th>
                      <th className="px-3 py-2 text-right font-medium">القطعة</th>
                      <th className="px-3 py-2 text-right font-medium">الفئة</th>
                      <th className="px-3 py-2 text-right font-medium">المخزون</th>
                      <th className="px-3 py-2 text-right font-medium">الحد الأدنى</th>
                      <th className="px-3 py-2 text-right font-medium">سعر الوحدة</th>
                      <th className="px-3 py-2 text-right font-medium">المورد</th>
                      <th className="px-3 py-2 text-right font-medium">مدة التوريد</th>
                      <th className="px-3 py-2 text-right font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sparePartsData.map(p => {
                      const urgent = p.qty <= p.minStock;
                      return (
                        <tr key={p.id} className={`border-b border-slate-800/40 ${urgent?'bg-red-950/10':''} hover:bg-slate-800/20`}>
                          <td className="px-3 py-2 font-mono text-slate-400">{p.partNum}</td>
                          <td className="px-3 py-2 font-medium text-slate-200">{p.name}</td>
                          <td className="px-3 py-2 text-slate-400">{p.cat}</td>
                          <td className={`px-3 py-2 font-bold ${p.qty===0?'text-red-400':p.qty<=p.minStock?'text-amber-400':'text-slate-200'}`}>{p.qty}</td>
                          <td className="px-3 py-2 text-slate-400">{p.minStock}</td>
                          <td className="px-3 py-2 text-slate-300">LD {p.unitPrice}</td>
                          <td className="px-3 py-2 text-slate-400">{p.supplier}</td>
                          <td className={`px-3 py-2 ${p.leadDays>30?'text-red-400':p.leadDays>14?'text-yellow-400':'text-slate-300'}`}>{p.leadDays} يوم</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              p.qty===0?'bg-red-500/20 text-red-300':
                              p.qty<=p.minStock?'bg-amber-500/20 text-amber-300':
                              'bg-emerald-500/20 text-emerald-300'}`}>
                              {p.qty===0?'نفذ':p.qty<=p.minStock?'منخفض':'جيد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {lowStock.length > 0 && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-300 mb-2">توصيات إعادة الطلب الفوري</h3>
                <div className="space-y-1.5">
                  {lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{p.name} ({p.partNum})</span>
                      <span className="text-amber-400">اطلب {p.minStock * 2} وحدة من {p.supplier} — وقت الاستلام: {p.leadDays} يوم</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ HISTORY ═══════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي الأحداث (12 شهراً)', value: historyData.reduce((s,m)=>s+m.total,0),     color: 'text-white' },
                { label: 'مكتملة',                     value: historyData.reduce((s,m)=>s+m.completed,0),  color: 'text-emerald-400' },
                { label: 'إجمالي التكلفة',             value: 'LD '+fmtCost(historyData.reduce((s,m)=>s+m.cost,0)), color: 'text-violet-400' },
                { label: 'نسبة الإتمام',               value: historyData.reduce((s,m)=>s+m.total,0) > 0 ? Math.round((historyData.reduce((s,m)=>s+m.completed,0)/historyData.reduce((s,m)=>s+m.total,0))*100)+'%' : '—', color: 'text-amber-400' },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs mb-1">{k.label}</div>
                  <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">اتجاه عدد الأحداث الشهرية</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={historyData}>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="completed" name="مكتملة" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                  <Area type="monotone" dataKey="total"     name="الإجمالي" stroke="#f59e0b" fill="#f59e0b10" strokeWidth={1} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-300">السجل الشهري التفصيلي</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                      <th className="px-3 py-2 text-right font-medium">الشهر</th>
                      <th className="px-3 py-2 text-center font-medium">الإجمالي</th>
                      <th className="px-3 py-2 text-center font-medium">مكتمل</th>
                      <th className="px-3 py-2 text-center font-medium">ملغى</th>
                      <th className="px-3 py-2 text-center font-medium">PM</th>
                      <th className="px-3 py-2 text-center font-medium">CM</th>
                      <th className="px-3 py-2 text-center font-medium">التكلفة</th>
                      <th className="px-3 py-2 text-center font-medium">نسبة الإتمام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(m => {
                      const pct = Math.round((m.completed / m.total) * 100);
                      return (
                        <tr key={m.month} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                          <td className="px-3 py-2 font-medium text-slate-200">{m.month}</td>
                          <td className="px-3 py-2 text-center text-slate-300">{m.total}</td>
                          <td className="px-3 py-2 text-center text-emerald-400 font-semibold">{m.completed}</td>
                          <td className="px-3 py-2 text-center text-red-400">{m.cancelled}</td>
                          <td className="px-3 py-2 text-center text-sky-400">{m.pmCount}</td>
                          <td className="px-3 py-2 text-center text-orange-400">{m.cmCount}</td>
                          <td className="px-3 py-2 text-center text-violet-400">LD {m.cost.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[11px] font-semibold ${pct>=90?'text-emerald-400':pct>=75?'text-yellow-400':'text-red-400'}`}>{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ KPIs ═══════════════ */}
        {activeTab === 'kpis' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300">لوحة مؤشرات الأداء الرئيسية</h3>
                <p className="text-xs text-slate-500 mt-0.5">مقارنة القيم الفعلية بالأهداف المستهدفة — {new Date().toLocaleDateString('ar-LY')}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                      <th className="px-4 py-2.5 text-right font-medium">المؤشر</th>
                      <th className="px-4 py-2.5 text-center font-medium">الوحدة</th>
                      <th className="px-4 py-2.5 text-center font-medium">الفعلي</th>
                      <th className="px-4 py-2.5 text-center font-medium">الهدف</th>
                      <th className="px-4 py-2.5 text-center font-medium">الأداء</th>
                      <th className="px-4 py-2.5 text-center font-medium">الفجوة</th>
                      <th className="px-4 py-2.5 text-center font-medium">الأهمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KPI_TARGETS.map(row => {
                      const actual = kpiActuals[row.kpi] ?? 0;
                      const ok     = actual >= row.target;
                      const gap    = row.kpi === 'MTTR'
                        ? Number((row.target - actual).toFixed(1))
                        : Math.round(actual - row.target);
                      const pct    = row.kpi === 'MTBF' || row.kpi === 'MTTR'
                        ? Math.min(100, Math.round((Math.min(actual, row.target) / row.target) * 100))
                        : Math.min(100, Math.round((actual / row.target) * 100));
                      return (
                        <tr key={row.kpi} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                          <td className="px-4 py-3 font-medium text-slate-200">{row.kpi}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{row.unit}</td>
                          <td className={`px-4 py-3 text-center font-bold ${ok?'text-emerald-400':'text-red-400'}`}>{actual}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{row.target}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${ok?'bg-emerald-500':'bg-red-500'}`} style={{ width: pct+'%' }} />
                              </div>
                              <span className={`text-[10px] shrink-0 ${ok?'text-emerald-400':'text-red-400'}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-center font-semibold text-xs ${ok?'text-emerald-400':'text-red-400'}`}>
                            {ok ? '+' + gap : gap}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              row.weight==='عالٍ' ? 'bg-red-500/20 text-red-300' :
                              row.weight==='متوسط'? 'bg-amber-500/20 text-amber-300' :
                              'bg-slate-600/30 text-slate-400'}`}>{row.weight}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gap analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-300 mb-3">فجوات تحتاج تدخلاً</h3>
                <div className="space-y-2">
                  {KPI_TARGETS.filter(k => (kpiActuals[k.kpi] ?? 0) < k.target).map(k => (
                    <div key={k.kpi} className="flex items-start gap-2 text-xs">
                      <span className="text-red-400 mt-0.5">↓</span>
                      <div>
                        <span className="text-slate-200 font-medium">{k.kpi}</span>
                        <span className="text-slate-500 mr-2">({kpiActuals[k.kpi] ?? 0} من {k.target} {k.unit})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-emerald-300 mb-3">مؤشرات تحقق الهدف</h3>
                <div className="space-y-2">
                  {KPI_TARGETS.filter(k => (kpiActuals[k.kpi] ?? 0) >= k.target).map(k => (
                    <div key={k.kpi} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-slate-200">{k.kpi} — <span className="text-emerald-400">{kpiActuals[k.kpi] ?? 0} {k.unit}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Roadmap */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-300 mb-3">خارطة التطوير المستقبلية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                <div className="space-y-1.5">
                  <div className="text-amber-400 font-semibold mb-2">المرحلة 1 — تحسين الأداء (0-3 أشهر)</div>
                  <div>● تفعيل مراقبة اهتزاز آنية لجميع المضخات</div>
                  <div>● رفع نسبة الصيانة الوقائية من 51% إلى 65%</div>
                  <div>● تحسين SLA إلى 85% عبر تقليل وقت الاستجابة</div>
                  <div>● إعادة تخزين القطع الناقصة</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-violet-400 font-semibold mb-2">المرحلة 2 — التكامل الذكي (3-12 شهراً)</div>
                  <div>● ربط SCADA بنظام الإنذار المبكر</div>
                  <div>● دمج ERP لإدارة تكاليف الصيانة تلقائياً</div>
                  <div>● تطوير ذكاء المخزون: توصيات طلب تلقائية</div>
                  <div>● نظام تحسين توزيع الفرق بناءً على الأولوية</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
