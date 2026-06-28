'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import WorkOrderDispatchModal, { type DispatchConfig } from '@/app/dashboard/shared/components/WorkOrderDispatchModal';
import { LinearAsset } from '@/lib/linear-referencing/types';
import { useWorkOrderStore } from '@/store/workOrderStore';
import type { WorkOrder } from '@/store/workOrderStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  assets: LinearAsset[];
  onAssetSelect?: (id: string) => void;
}
type Frequency = 'quarterly' | 'biannual' | 'annual';
interface ScheduledAsset {
  asset: LinearAsset;
  frequency: Frequency;
  months: number[];
  priority: 'critical' | 'warning' | 'routine';
  taskType: string;
}
interface MonthBucket {
  month: number;
  name: string;
  items: ScheduledAsset[];
  criticalCount: number;
}
type Dept = WorkOrder['department'];

function getTenantHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

// ─── Task detail catalog ──────────────────────────────────────────────────────
const TASK_DETAILS: Record<string, { checklist: string[]; hours: number; materials: string[] }> = {
  'فحص حرج + تقييم الإحلال': {
    checklist: [
      'قياس السماكة بالموجات فوق الصوتية (UT) في 4 نقاط',
      'توثيق صور الحالة الظاهرية (صدأ / تسريبات)',
      'التحقق من ضغط التشغيل المحيط',
      'مقارنة القراءات مع السجل التاريخي',
      'رفع تقرير قرار إحلال إذا السماكة < 8mm',
      'تقدير موعد الاستبدال وتحديث CMMS',
    ],
    hours: 4,
    materials: ['جهاز UT لقياس السماكة', 'ورقة توثيق الحالة', 'حاجز أمان ولوحة تحذير'],
  },
  'فحص تفصيلي + قياس السماكة': {
    checklist: [
      'قياس السماكة بالموجات فوق الصوتية في نقطتين',
      'اختبار فتح/غلق الصمام يدوياً',
      'فحص حالة المقاعد والحشيات',
      'التحقق من عدم وجود تسريبات حول الطوق',
      'تسجيل القراءة في سجل الأصل',
    ],
    hours: 2,
    materials: ['جهاز UT', 'مفتاح ربط', 'حشية احتياطية (إن لزم)'],
  },
  'فحص دوري + تشحيم': {
    checklist: [
      'تشحيم ميكانيزم التشغيل (stem & gland)',
      'فحص المسامير والربط الخارجي',
      'تنظيف الجسم الخارجي ورسم الأكسيد',
      'التحقق من عمل مؤشر الوضعية (Open/Close)',
    ],
    hours: 1,
    materials: ['مشحم (Grease NLGI-2)', 'فرشاة تنظيف', 'مفتاح ربط'],
  },
  'صيانة وقائية شاملة': {
    checklist: [
      'قياس الاهتزاز والحرارة على المحرك',
      'تغيير زيت التشحيم (إن تجاوز فترة الاستخدام)',
      'فحص مشابك الكهرباء ودوائر الحماية',
      'اختبار وحدة التحكم (PLC) ومستشعرات الضغط',
      'التحقق من فتحات التهوية وتصريف المكثفات',
      'تنظيف مرشح الشفط',
    ],
    hours: 6,
    materials: ['زيت محرك', 'مفاتيح كهربائية', 'مرشح شفط احتياطي', 'جهاز قياس اهتزاز'],
  },
  'فحص مستوى + جودة المياه': {
    checklist: [
      'قراءة مستوى المياه وتسجيله',
      'أخذ عينة مياه للتحليل (pH / كلور / عكارة)',
      'فحص صمامات الدخول والخروج',
      'فحص الغطاء والعوازل وسلامة الختم',
      'التأكد من عمل مجسات المستوى',
    ],
    hours: 3,
    materials: ['مجموعة تحليل المياه (test kit)', 'أكياس عينات', 'جهاز قياس pH'],
  },
  'فحص بوابة التفتيش': {
    checklist: [
      'التحقق من سلامة الغطاء والأقفال',
      'فحص السلالم الداخلية وأثافي التثبيت',
      'قياس تركيز الغاز (H₂S / O₂) قبل النزول',
      'التحقق من التهوية الطبيعية أو القسرية',
      'قياس مستوى الرواسب في قاع الغرفة',
      'توثيق الحالة بالصور',
    ],
    hours: 2,
    materials: ['جهاز قياس الغازات (multi-gas detector)', 'معدات حماية شخصية (PPE)', 'حبل نجاة'],
  },
};
function getTaskDetails(taskType: string) {
  return TASK_DETAILS[taskType] ?? { checklist: ['فحص عام حسب إرشادات المصنع'], hours: 1, materials: ['أدوات يدوية'] };
}

// ─── Department routing — ISO 55000 / NACE / API 570 aligned ─────────────────
// Tasks that involve corrosion assessment are split into TWO work orders:
// one for the Corrosion/Integrity team, one for the O&M team.
const SPLIT_TASKS: Record<string, {
  corrosion:   { checklist: string[]; hours: number; materials: string[] };
  maintenance: { checklist: string[]; hours: number; materials: string[] };
}> = {
  'فحص حرج + تقييم الإحلال': {
    corrosion: {
      checklist: [
        'قياس السماكة بالموجات فوق الصوتية (UT) في 4 نقاط',
        'توثيق صور الحالة الظاهرية (صدأ / تسريبات / تقشر)',
        'مقارنة قراءات السماكة مع السجل التاريخي (Trend Analysis)',
        'رفع تقرير قرار الإحلال إذا السماكة < 8mm',
      ],
      hours: 3,
      materials: ['جهاز UT لقياس السماكة', 'بطاقة توثيق التآكل', 'كاميرا توثيق'],
    },
    maintenance: {
      checklist: [
        'التحقق من ضغط التشغيل المحيط وتسجيله',
        'فحص مسربات الحشيات الخارجية',
        'تحديث سجل الأصل في CMMS',
        'إعداد طلب مشتريات للاستبدال إن لزم',
      ],
      hours: 2,
      materials: ['أدوات ربط', 'استمارة طلب مشتريات', 'حاجز أمان'],
    },
  },
  'فحص تفصيلي + قياس السماكة': {
    corrosion: {
      checklist: [
        'قياس السماكة بالموجات فوق الصوتية في نقطتين (أعلى / جانب)',
        'تقييم معدل التآكل السنوي مقارنةً بالقياس السابق',
        'توثيق حالة الطلاء الواقي وتقييم الحاجة للإعادة',
      ],
      hours: 1.5,
      materials: ['جهاز UT', 'بطاقة قياس التآكل'],
    },
    maintenance: {
      checklist: [
        'اختبار فتح/غلق الصمام يدوياً (3 دورات كاملة)',
        'فحص حالة المقاعد والحشيات واستبدالها إن لزم',
        'التحقق من عدم وجود تسريبات حول الطوق والوصلات',
        'تسجيل حالة الصمام في سجل الأصل',
      ],
      hours: 1.5,
      materials: ['مفتاح ربط', 'حشية احتياطية', 'شريط عزل'],
    },
  },
};

// Single-department tasks
const SINGLE_DEPT: Record<string, Dept> = {
  'فحص دوري + تشحيم':         'maintenance',
  'صيانة وقائية شاملة':        'maintenance',
  'فحص مستوى + جودة المياه':  'operations',
  'فحص بوابة التفتيش':         'operations',
};

const DEPT_META: Record<Dept, { label: string; shortLabel: string; color: string; bg: string }> = {
  maintenance: { label: 'إدارة الصيانة',         shortLabel: 'صيانة', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  corrosion:   { label: 'إدارة التآكل والنزاهة', shortLabel: 'تآكل',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  operations:  { label: 'إدارة التشغيل',          shortLabel: 'تشغيل', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: 'مسودة',        color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  dispatched:        { label: 'مُرسَل',        color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  acknowledged:      { label: 'مُستلَم',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  in_progress:       { label: 'قيد التنفيذ',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  results_submitted: { label: 'نتائج مُرسَلة', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  results_received:  { label: 'نتائج واردة',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  closed:            { label: 'مغلق',          color: '#64748b', bg: 'rgba(100,116,139,0.12)'  },
};

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function getThickness(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  if (d.includes('x')) { const t = parseFloat(d.split('x')[1]); return isNaN(t) ? -1 : t; }
  return -1;
}
function getType(code: string): string {
  if (code.startsWith('PUWE')) return 'PUWE';
  if (code.startsWith('SAV'))  return 'SAV';
  if (code.startsWith('DAV'))  return 'DAV';
  if (code.startsWith('M/H') || code.startsWith('MH')) return 'MH';
  if (code.startsWith('PU'))   return 'PU';
  if (code.startsWith('WT'))   return 'WT';
  return 'OTHER';
}
function assignMonths(freq: Frequency, sectorIdx: number): number[] {
  const offset = sectorIdx % 3;
  if (freq === 'quarterly') return [1,4,7,10].map(m => Math.min(12, m + offset));
  if (freq === 'biannual')  return [2,8].map(m => Math.min(12, m + offset));
  return [Math.min(12, 1 + (sectorIdx % 12))];
}
function buildSchedule(assets: LinearAsset[]): ScheduledAsset[] {
  const sectors = Array.from(new Set(assets.map(a => a.technical?.route_sector || 'Unknown'))).sort();
  const schedule: ScheduledAsset[] = [];
  for (const a of assets) {
    const code = a.equipment_code || '', type = getType(code), thickness = getThickness(a);
    const sectorIdx = sectors.indexOf(a.technical?.route_sector || 'Unknown');
    let freq: Frequency = 'annual', priority: ScheduledAsset['priority'] = 'routine', taskType = 'فحص دوري';
    if (type === 'SAV' || type === 'DAV') {
      if (thickness > 0 && thickness < 10)        { freq = 'quarterly'; priority = 'critical'; taskType = 'فحص حرج + تقييم الإحلال'; }
      else if (thickness >= 10 && thickness < 16) { freq = 'biannual';  priority = 'warning';  taskType = 'فحص تفصيلي + قياس السماكة'; }
      else                                         { freq = 'annual';    priority = 'routine';  taskType = 'فحص دوري + تشحيم'; }
    } else if (type === 'PU' || type === 'PUWE')  { freq = 'quarterly'; priority = 'routine'; taskType = 'صيانة وقائية شاملة'; }
    else if (type === 'WT')                        { freq = 'biannual';  priority = 'routine'; taskType = 'فحص مستوى + جودة المياه'; }
    else if (type === 'MH')                        { freq = 'annual';    priority = 'routine'; taskType = 'فحص بوابة التفتيش'; }
    else continue;
    schedule.push({ asset: a, frequency: freq, months: assignMonths(freq, sectorIdx), priority, taskType });
  }
  return schedule;
}

// Returns 1 or 2 work orders per scheduled asset (split by dept for corrosion tasks)
function makeWorkOrders(s: ScheduledAsset, month: number, startSeq: number): WorkOrder[] {
  const year = new Date().getFullYear();
  const mkId = (seq: number) => `WO-${year}-${String(month).padStart(2,'0')}-${String(seq).padStart(3,'0')}`;
  const base = {
    equipment_code: s.asset.equipment_code, asset_id: s.asset.id, task_type: s.taskType,
    priority: s.priority, scheduled_month: month, month_name: MONTH_NAMES_AR[month - 1],
    sector: s.asset.technical?.route_sector || '—', status: 'draft' as const,
    created_at: new Date().toISOString(),
  };
  const split = SPLIT_TASKS[s.taskType];
  if (split) {
    return [
      { ...base, id: mkId(startSeq),   checklist: split.corrosion.checklist,   estimated_hours: split.corrosion.hours,   materials: split.corrosion.materials,   department: 'corrosion'   as Dept },
      { ...base, id: mkId(startSeq+1), checklist: split.maintenance.checklist, estimated_hours: split.maintenance.hours, materials: split.maintenance.materials, department: 'maintenance' as Dept },
    ];
  }
  const det = getTaskDetails(s.taskType);
  return [{ ...base, id: mkId(startSeq), checklist: det.checklist, estimated_hours: det.hours, materials: det.materials, department: (SINGLE_DEPT[s.taskType] ?? 'maintenance') as Dept }];
}

// ─── WO Detail Modal ──────────────────────────────────────────────────────────
function WOModal({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const pc   = wo.priority === 'critical' ? '#f43f5e' : wo.priority === 'warning' ? '#f59e0b' : '#64748b';
  const dept = DEPT_META[wo.department];
  const stat = STATUS_META[wo.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4 sticky top-0 bg-slate-900 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-mono text-slate-500">{wo.id}</span>
              <span className="rounded-full px-2 py-0.5 text-[13px] font-bold" style={{ background: pc+'20', color: pc }}>
                {wo.priority === 'critical' ? 'حرج' : wo.priority === 'warning' ? 'تحذير' : 'روتيني'}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[13px] font-bold" style={{ background: dept.bg, color: dept.color }}>{dept.shortLabel}</span>
              <span className="rounded-full px-2 py-0.5 text-[13px] font-bold" style={{ background: stat.bg, color: stat.color }}>{stat.label}</span>
            </div>
            <p className="text-base font-bold text-white mt-1">{wo.task_type}</p>
            <p className="text-base text-slate-400">{wo.equipment_code} · {wo.sector} · {wo.month_name}</p>
            <p className="text-[13px] mt-0.5" style={{ color: dept.color }}>→ {dept.label}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none mt-1 shrink-0">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'وقت التنفيذ',   value: `${wo.estimated_hours} ساعة` },
              { label: 'الشهر المجدول', value: wo.month_name },
              { label: 'الحالة',        value: stat.label },
            ].map(i => (
              <div key={i.label} className="rounded-xl bg-white/4 border border-white/6 px-3 py-2 text-center">
                <p className="text-[13px] text-slate-500">{i.label}</p>
                <p className="text-base font-bold text-white mt-0.5">{i.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-base font-bold text-slate-300 mb-2">📋 قائمة التدقيق ({wo.checklist.length} بند)</p>
            <div className="space-y-1.5">
              {wo.checklist.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg bg-black/25 px-3 py-2">
                  <span className="mt-0.5 h-4 w-4 rounded border border-white/20 flex-shrink-0" />
                  <span className="text-base text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-base font-bold text-slate-300 mb-2">🔧 المواد والمعدات المطلوبة</p>
            <div className="flex flex-wrap gap-2">
              {wo.materials.map((m, i) => (
                <span key={i} className="rounded-full bg-slate-800 border border-white/8 px-3 py-1 text-[13px] text-slate-300">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dispatch / Approval Modal (ISO 55001 approval workflow) ──────────────────
const DISPATCH_RECIPIENTS = [
  { id: 'maintenance_team', label: 'فريق الصيانة الميداني',   icon: '🔧' },
  { id: 'corrosion_team',   label: 'إدارة التآكل والنزاهة',   icon: '⚗️' },
  { id: 'operations_dept',  label: 'إدارة التشغيل',            icon: '⚙️' },
  { id: 'asset_management', label: 'إدارة الأصول',             icon: '🏗️' },
  { id: 'general_manager',  label: 'المدير العام',              icon: '👔' },
] as const;

const DISPATCH_REPORTS = [
  { id: 'wo_list',          label: 'قائمة أوامر العمل المعتمدة'   },
  { id: 'materials_req',    label: 'طلب المواد والمعدات المطلوبة' },
  { id: 'monthly_plan',     label: 'الخطة الشهرية التفصيلية'      },
  { id: 'alerts_critical',  label: 'إنذارات فورية للأصول الحرجة'  },
  { id: 'corrosion_report', label: 'تقرير قياسات التآكل والسماكة'  },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MaintenanceSchedule({ assets, onAssetSelect }: Props) {
  const [selectedMonth,  setSelectedMonth]  = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<'all' | 'critical' | 'warning'>('all');
  const [filterSector,   setFilterSector]   = useState<string>('all');
  const workOrders         = useWorkOrderStore(s => s.workOrders);
  const storeAddWOs        = useWorkOrderStore(s => s.addWorkOrders);
  const storeDispatch      = useWorkOrderStore(s => s.dispatchWorkOrders);
  const storeClearAll      = useWorkOrderStore(s => s.clearAllWorkOrders);
  const storeReceiveResult = useWorkOrderStore(s => s.receiveResults);
  const storeCloseWO       = useWorkOrderStore(s => s.closeWorkOrder);
  const [previewWO,      setPreviewWO]      = useState<WorkOrder | null>(null);
  const [showWOPanel,    setShowWOPanel]    = useState(false);
  const [showDispatch,   setShowDispatch]   = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [lastDispatch,   setLastDispatch]   = useState<{ recipients: string[]; reports: string[] } | null>(null);
  const woPanelRef = useRef<HTMLDivElement>(null);

  const schedule = useMemo(() => buildSchedule(assets), [assets]);
  const sectors  = useMemo(() => {
    const s = new Set(assets.map(a => a.technical?.route_sector || 'Unknown'));
    return ['all', ...Array.from(s).sort()];
  }, [assets]);
  const monthBuckets: MonthBucket[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      let items = schedule.filter(s => s.months.includes(month));
      if (filterPriority !== 'all') items = items.filter(s => s.priority === filterPriority);
      if (filterSector   !== 'all') items = items.filter(s => s.asset.technical?.route_sector === filterSector);
      return { month, name: MONTH_NAMES_AR[i], items, criticalCount: items.filter(s => s.priority === 'critical').length };
    });
  }, [schedule, filterPriority, filterSector]);

  const selectedBucket  = selectedMonth !== null ? monthBuckets[selectedMonth - 1] : null;
  const draftCount      = workOrders.filter(w => w.status === 'draft').length;
  const dispatchedCount = workOrders.filter(w => w.status === 'dispatched').length;
  const totalTasks      = schedule.length;
  const criticalTasks   = schedule.filter(s => s.priority === 'critical').length;
  const quarterlyTasks  = schedule.filter(s => s.frequency === 'quarterly').length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }
  function scrollToWOPanel() {
    setTimeout(() => woPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
  }

  function addWorkOrder(s: ScheduledAsset, month: number) {
    const alreadyMaint = workOrders.some(w => w.asset_id === s.asset.id && w.scheduled_month === month && w.department === 'maintenance');
    if (alreadyMaint) { showToast('أمر العمل موجود بالفعل لهذا الأصل'); return; }
    const seq    = workOrders.length + 1;
    const newWOs = makeWorkOrders(s, month, seq);
    storeAddWOs(newWOs);
    setShowWOPanel(true);
    showToast(SPLIT_TASKS[s.taskType]
      ? `✅ أمرَا عمل — صيانة + تآكل — (${s.asset.equipment_code})`
      : `✅ أمر عمل لـ ${s.asset.equipment_code}`);
    scrollToWOPanel();
  }

  function addMonthWorkOrders(bucket: MonthBucket) {
    const newWOs: WorkOrder[] = [];
    let seq = workOrders.length + 1;
    for (const s of bucket.items) {
      if (!workOrders.some(w => w.asset_id === s.asset.id && w.scheduled_month === bucket.month && w.department === 'maintenance')) {
        const wos = makeWorkOrders(s, bucket.month, seq);
        seq += wos.length;
        newWOs.push(...wos);
      }
    }
    if (newWOs.length === 0) { showToast('جميع أوامر هذا الشهر موجودة بالفعل'); return; }
    storeAddWOs(newWOs);
    setShowWOPanel(true);
    showToast(`✅ تم إنشاء ${newWOs.length} أمر عمل لشهر ${bucket.name}`);
    scrollToWOPanel();
  }

  function autoGenerateAll() {
    const all: WorkOrder[] = [];
    let seq = workOrders.length + 1;
    for (const s of schedule) {
      for (const month of s.months) {
        if (!workOrders.some(w => w.asset_id === s.asset.id && w.scheduled_month === month && w.department === 'maintenance')) {
          const wos = makeWorkOrders(s, month, seq);
          seq += wos.length;
          all.push(...wos);
        }
      }
    }
    if (all.length === 0) { showToast('جميع الأوامر السنوية موجودة بالفعل'); return; }
    storeAddWOs(all);
    setShowWOPanel(true);
    showToast(`✅ تم توليد ${all.length} أمر عمل — الجدول السنوي كامل`);
    scrollToWOPanel();
  }

  async function handleDispatchConfirm(config: DispatchConfig) {
    const allRecipients = [...config.internalTeams, ...config.externalDepts];
    storeDispatch(allRecipients, config.reports);
    setLastDispatch({ recipients: allRecipients, reports: config.reports });
    setShowDispatch(false);
    showToast(`✅ اعتُمدت الأوامر وأُرسلت لـ ${allRecipients.length} جهة — ${config.reports.length} مستند`);

    const corrosionDraftWOs = workOrders.filter(
      w => w.status === 'draft' && w.department === 'corrosion',
    );
    if (corrosionDraftWOs.length === 0) return;

    const BATCH = 5;

    // ── Path A: Document routing (DeptAdmin inbox) ──────────────────────────
    if (config.channel === 'docs' || config.channel === 'all') {
      for (let i = 0; i < corrosionDraftWOs.length; i += BATCH) {
        await Promise.allSettled(
          corrosionDraftWOs.slice(i, i + BATCH).map(wo =>
            fetch('/api/v1/dept-admin/corrosion/documents', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getTenantHeader(),
              },
              body: JSON.stringify({
                doc_type: 'work_order_doc',
                title: `أمر عمل — ${wo.id}`,
                body_text: wo.checklist.join('\n'),
                dest_dept: 'corrosion',
                priority: wo.priority === 'critical' ? 'urgent' : 'normal',
                metadata: {
                  work_order_number: wo.id,
                  asset_code: wo.equipment_code,
                  sector: wo.sector,
                  from_dept: 'maintenance',
                  scheduled_month: wo.month_name,
                  estimated_hours: String(wo.estimated_hours),
                  task_type: wo.task_type,
                },
                created_by: 'maintenance_dept',
              }),
            }),
          ),
        );
      }
    }

    // ── Path B: CMMS (workspace.work_orders — global standard) ──────────────
    if (config.channel === 'cmms' || config.channel === 'all') {
      for (let i = 0; i < corrosionDraftWOs.length; i += BATCH) {
        await Promise.allSettled(
          corrosionDraftWOs.slice(i, i + BATCH).map(wo => {
            const monthPad = String(wo.scheduled_month).padStart(2, '0');
            const scheduledDate = `2026-${monthPad}-01`;
            const workType = wo.task_type.includes('صيانة') ? 'preventive' : 'inspection';
            const cmsPriority =
              wo.priority === 'critical' ? 'urgent'
              : wo.priority === 'warning' ? 'normal'
              : 'low';
            return fetch('/api/v1/workspace/work-orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `${wo.task_type} — ${wo.equipment_code}`,
                title_ar: `${wo.task_type} — ${wo.equipment_code}`,
                asset_name: wo.equipment_code,
                description: wo.checklist.join('\n'),
                work_type: workType,
                priority: cmsPriority,
                scheduled_date: scheduledDate,
                target_department: 'corrosion',
                target_team: 'corrosion_integrity',
                created_by: 'maintenance_dept',
                notes: `WO: ${wo.id} | القطاع: ${wo.sector} | الشهر: ${wo.month_name} | ساعات: ${wo.estimated_hours}`,
              }),
            });
          }),
        );
      }
    }
  }

  function exportWOcsv() {
    const headers = ['رقم الأمر','الكود','القطاع','المهمة','الإدارة','الأولوية','الشهر','ساعات','الحالة'];
    const rows = workOrders.map(w => [
      w.id, w.equipment_code, w.sector, w.task_type,
      DEPT_META[w.department].label,
      w.priority === 'critical' ? 'حرج' : w.priority === 'warning' ? 'تحذير' : 'روتيني',
      w.month_name, w.estimated_hours, STATUS_META[w.status].label,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `work-orders-${new Date().getFullYear()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (assets.length === 0) return null;
  const PC = { critical: '#f43f5e', warning: '#f59e0b', routine: '#64748b' } as const;

  return (
    <div className="space-y-4 relative">

      {/* ── Toast notification (sticky, visible immediately) ── */}
      {toast && (
        <div className="sticky top-2 z-40 pointer-events-none">
          <div className="mx-auto w-fit rounded-xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-sm px-4 py-2.5 shadow-xl">
            <p className="text-base font-semibold text-emerald-300">{toast}</p>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي المهام السنوية', value: totalTasks,        color: '#0ea5e9', sub: 'عمليات مجدولة' },
          { label: 'مهام حرجة',             value: criticalTasks,     color: '#f43f5e', sub: '×4 مرات/سنة'   },
          { label: 'أصول ربع سنوية',        value: quarterlyTasks,    color: '#f59e0b', sub: 'كل 3 أشهر'     },
          { label: 'أوامر عمل',             value: workOrders.length, color: '#10b981', sub: workOrders.length > 0 ? `${draftCount} مسودة · ${dispatchedCount} مُرسَل` : 'لم تُنشأ بعد' },
        ].map(c => (
          <button key={c.label}
            onClick={() => { if (c.label === 'أوامر عمل' && workOrders.length > 0) { setShowWOPanel(v => !v); scrollToWOPanel(); } }}
            className={`rounded-2xl border border-white/8 bg-slate-950/60 p-4 text-right transition-all ${c.label === 'أوامر عمل' && workOrders.length > 0 ? 'hover:border-emerald-500/30 cursor-pointer' : 'cursor-default'}`}>
            <p className="text-[13px] text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[13px] text-slate-600 mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* ── Auto-generate + Approve action bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={autoGenerateAll}
          className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-base font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all">
          ⚡ توليد تلقائي — سنة كاملة
        </button>
        {draftCount > 0 && (
          <button onClick={() => setShowDispatch(true)}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-1.5 text-base font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all">
            ✅ اعتماد وإرسال ({draftCount} أمر جاهز)
          </button>
        )}
        {lastDispatch && (
          <span className="text-[13px] text-slate-500">
            آخر إرسال: {lastDispatch.recipients.length} جهة · {lastDispatch.reports.length} مستند
          </span>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all','الكل'],['critical','حرجة فقط'],['warning','مراقبة فقط']] as [string,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setFilterPriority(k as typeof filterPriority)}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold border transition-all ${
              filterPriority===k ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'border-white/8 text-slate-500 hover:text-white'
            }`}>{l}</button>
        ))}
        <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
          className="rounded-lg border border-white/8 bg-slate-900 px-3 py-1 text-[13px] text-slate-300">
          {sectors.map(s => <option key={s} value={s}>{s==='all' ? 'كل القطاعات' : s}</option>)}
        </select>
      </div>

      {/* ── Calendar heatmap ── */}
      <div>
        <p className="text-[13px] text-slate-500 mb-2">انقر على الشهر لعرض تفاصيل مهامه وإنشاء أوامر العمل</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {monthBuckets.map(bucket => {
            const maxItems  = Math.max(...monthBuckets.map(m => m.items.length), 1);
            const intensity = bucket.items.length / maxItems;
            const isSelected = selectedMonth === bucket.month;
            const hasCrit    = bucket.criticalCount > 0;
            const woCount    = workOrders.filter(w => w.scheduled_month === bucket.month).length;
            return (
              <button key={bucket.month}
                onClick={() => setSelectedMonth(isSelected ? null : bucket.month)}
                className={`rounded-xl p-3 text-center border transition-all ${
                  isSelected ? 'border-cyan-500/60 bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : hasCrit ? 'border-rose-500/25 hover:border-rose-500/50' : 'border-white/5 hover:border-white/15'
                }`}
                style={{ background: isSelected ? undefined : `rgba(14,165,233,${intensity * 0.25})` }}>
                <p className="text-[12px] text-slate-500 font-mono">{MONTH_NAMES_EN[bucket.month-1]}</p>
                <p className="text-lg font-black font-mono" style={{ color: hasCrit ? '#f43f5e' : intensity > 0.5 ? '#0ea5e9' : '#64748b' }}>
                  {bucket.items.length}
                </p>
                {bucket.criticalCount > 0 && <span className="text-[11px] text-rose-400 font-bold">{bucket.criticalCount}⚠</span>}
                {woCount > 0 && <span className="text-[11px] text-emerald-400 block">✓{woCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Month detail ── */}
      {selectedBucket && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-white">مهام {selectedBucket.name} — {selectedBucket.items.length} عملية</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedBucket.items.length > 0 && (
                <button onClick={() => addMonthWorkOrders(selectedBucket)}
                  className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 text-base font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all">
                  📋 تحويل الشهر كله → أوامر عمل
                </button>
              )}
              <button onClick={() => setSelectedMonth(null)} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
            </div>
          </div>

          {selectedBucket.items.length === 0 && (
            <p className="text-slate-600 text-base text-center py-4">لا توجد مهام مجدولة لهذا الشهر</p>
          )}

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {selectedBucket.items
              .sort((a,b) => (a.priority==='critical'?0:a.priority==='warning'?1:2)-(b.priority==='critical'?0:b.priority==='warning'?1:2))
              .map(s => {
                const pc      = PC[s.priority];
                const det     = getTaskDetails(s.taskType);
                const isWO    = workOrders.some(w => w.asset_id === s.asset.id && w.scheduled_month === selectedBucket.month);
                const isSplit = SPLIT_TASKS[s.taskType] !== undefined;
                return (
                  <div key={s.asset.id} className="rounded-xl bg-black/30 border border-white/4 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pc }} />
                      <button className="font-mono font-bold text-[13px] text-cyan-400 hover:underline w-28 flex-shrink-0 text-right"
                        onClick={() => onAssetSelect?.(s.asset.id)}>
                        {s.asset.equipment_code}
                      </button>
                      <span className="text-[13px] text-slate-300 flex-1 min-w-0 truncate">{s.taskType}</span>
                      {isSplit && (
                        <span className="text-[12px] rounded-full px-1.5 py-0.5 flex-shrink-0 font-bold whitespace-nowrap"
                          style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>÷ صيانة+تآكل</span>
                      )}
                      <span className="text-[13px] text-slate-500 font-mono flex-shrink-0 bg-slate-800/60 rounded px-1.5 py-0.5">
                        {s.asset.technical?.route_sector}
                      </span>
                      <span className="text-[12px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap"
                        style={{ background: pc+'20', color: pc }}>
                        {s.frequency === 'quarterly' ? 'ربع سنوي' : s.frequency === 'biannual' ? 'نصف سنوي' : 'سنوي'}
                      </span>
                      <span className="text-[13px] text-slate-500 flex-shrink-0">⏱{det.hours}س</span>
                      {isWO ? (
                        <span className="text-[13px] text-emerald-400 flex-shrink-0 font-bold whitespace-nowrap">✓ {isSplit ? '2 أمر' : 'أمر'}</span>
                      ) : (
                        <button onClick={() => addWorkOrder(s, selectedBucket.month)}
                          className="flex-shrink-0 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[13px] text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/30 transition-all whitespace-nowrap">
                          + أمر عمل
                        </button>
                      )}
                    </div>
                    {/* Checklist preview — split 2-column for dual-dept tasks */}
                    <div className="border-t border-white/4 px-3 py-2 bg-black/20">
                      {isSplit ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(['corrosion','maintenance'] as const).map(dept => {
                            const sd = SPLIT_TASKS[s.taskType]?.[dept]; if (!sd) return null;
                            const dm = DEPT_META[dept];
                            return (
                              <div key={dept}>
                                <p className="text-[12px] font-bold mb-1.5" style={{ color: dm.color }}>{dm.shortLabel}:</p>
                                <div className="space-y-0.5 mb-1.5">
                                  {sd.checklist.map((item, i) => (
                                    <span key={i} className="text-[12px] text-slate-400 flex items-start gap-1">
                                      <span className="w-1 h-1 rounded-full mt-1 flex-shrink-0" style={{ background: dm.color+'80' }} />
                                      {item}
                                    </span>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {sd.materials.map((m,i) => (
                                    <span key={i} className="text-[11px] rounded px-1.5 py-0.5" style={{ background: dm.bg, color: dm.color }}>🔧 {m}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <p className="text-[12px] text-slate-600 mb-1">قائمة التدقيق:</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {det.checklist.map((item, i) => (
                              <span key={i} className="text-[13px] text-slate-400 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                                {item}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {det.materials.map((m, i) => (
                              <span key={i} className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[12px] text-slate-500">🔧 {m}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Sector breakdown */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-[13px] text-slate-500 mb-2">توزيع المهام حسب القطاع</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(selectedBucket.items.map(s => s.asset.technical?.route_sector||'?'))).map(sec => {
                const count = selectedBucket.items.filter(s => s.asset.technical?.route_sector === sec).length;
                const crit  = selectedBucket.items.filter(s => s.asset.technical?.route_sector === sec && s.priority==='critical').length;
                return (
                  <div key={sec} className="rounded-lg bg-slate-900/60 border border-white/5 px-3 py-2 text-center min-w-[90px]">
                    <p className="text-[12px] font-mono text-slate-500">{sec}</p>
                    <p className="text-base font-black text-white">{count}</p>
                    {crit > 0 && <p className="text-[12px] text-rose-400">{crit} حرجة</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Work Orders Panel ── */}
      {showWOPanel && workOrders.length > 0 && (
        <div ref={woPanelRef} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3 scroll-mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="font-bold text-white">أوامر العمل — {workOrders.length} أمر</h4>
              <div className="flex items-center gap-3 mt-0.5 text-[13px]">
                {(['maintenance','corrosion','operations'] as Dept[]).map(dept => {
                  const cnt = workOrders.filter(w => w.department === dept).length;
                  if (cnt === 0) return null;
                  const m = DEPT_META[dept];
                  return <span key={dept} style={{ color: m.color }}>{cnt} {m.shortLabel}</span>;
                })}
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{workOrders.reduce((s,w) => s + w.estimated_hours, 0)} ساعة</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {draftCount > 0 && (
                <button onClick={() => setShowDispatch(true)}
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-1.5 text-base font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all">
                  ✅ اعتماد وإرسال ({draftCount})
                </button>
              )}
              <button onClick={exportWOcsv}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-base font-bold text-slate-300 hover:bg-white/10 transition-all">
                ⬇ CSV
              </button>
              <button onClick={() => { storeClearAll(); setShowWOPanel(false); }}
                className="rounded-full border border-rose-500/20 bg-rose-500/8 px-4 py-1.5 text-base font-bold text-rose-400 hover:bg-rose-500/15 transition-all">
                مسح الكل
              </button>
              <button onClick={() => setShowWOPanel(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
          </div>

          {lastDispatch && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-[13px] text-cyan-300">
              ✅ آخر إرسال: {lastDispatch.recipients.length} جهة — {lastDispatch.reports.length} مستند
            </div>
          )}

          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {workOrders.map(wo => {
              const pc   = PC[wo.priority];
              const dept = DEPT_META[wo.department];
              const stat = STATUS_META[wo.status];
              return (
                <div key={wo.id} className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/5 px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pc }} />
                  <span className="font-mono text-[13px] text-slate-500 w-32 flex-shrink-0 truncate">{wo.id}</span>
                  <span className="font-mono text-[13px] text-cyan-400 w-24 flex-shrink-0 truncate">{wo.equipment_code}</span>
                  <span className="text-[13px] text-slate-300 flex-1 min-w-0 truncate">{wo.task_type}</span>
                  <span className="text-[12px] rounded-full px-1.5 py-0.5 flex-shrink-0 font-bold whitespace-nowrap" style={{ background: dept.bg, color: dept.color }}>{dept.shortLabel}</span>
                  <span className="text-[12px] rounded-full px-1.5 py-0.5 flex-shrink-0 font-bold whitespace-nowrap" style={{ background: stat.bg, color: stat.color }}>{stat.label}</span>
                  <span className="text-[13px] text-slate-500 flex-shrink-0 whitespace-nowrap">{wo.month_name}</span>
                  <button onClick={() => setPreviewWO(wo)} className="text-[13px] text-slate-400 hover:text-white underline flex-shrink-0 whitespace-nowrap transition-colors">تفاصيل</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {previewWO    && <WOModal wo={previewWO} onClose={() => setPreviewWO(null)} />}
      {showDispatch && (
        <WorkOrderDispatchModal
          workOrders={workOrders.filter(w => w.status === 'draft').map(w => ({
            id: w.id,
            title: w.task_type,
            title_ar: w.task_type,
            work_type: w.task_type.includes('صيانة') ? 'preventive' : 'inspection',
            priority: w.priority === 'critical' ? 'critical' : w.priority === 'warning' ? 'urgent' : 'low',
            status: w.status,
            department: w.department,
            estimated_hours: w.estimated_hours,
          }))}
          context="maintenance"
          onConfirm={handleDispatchConfirm}
          onClose={() => setShowDispatch(false)}
        />
      )}

      {/* ── Incoming results from Corrosion dept ── */}
      {(() => {
        const inbound = workOrders.filter(w => w.status === 'results_submitted');
        if (inbound.length === 0) return null;
        return (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <p className="text-base font-bold text-emerald-300">📥 نتائج واردة من إدارة التآكل ({inbound.length} تقرير)</p>
            </div>
            <div className="space-y-2">
              {inbound.map(wo => {
                const r = wo.result!;
                const findingColor = r.finding === 'passed' ? '#10b981' : r.finding === 'needs_attention' ? '#f59e0b' : '#ef4444';
                const findingLabel = r.finding === 'passed' ? '✅ ناجح' : r.finding === 'needs_attention' ? '⚠️ يحتاج متابعة' : '🚨 حرج';
                return (
                  <div key={wo.id} className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-mono text-slate-400">{wo.id}</p>
                        <p className="text-base font-semibold text-white">{wo.equipment_code} — {wo.task_type}</p>
                      </div>
                      <span className="text-base font-bold rounded-full px-2.5 py-0.5" style={{ color: findingColor, background: `${findingColor}1a` }}>
                        {findingLabel}
                      </span>
                    </div>
                    {r.measurements?.thickness_readings?.length && (
                      <p className="text-base font-mono text-cyan-300">
                        سماكة: {r.measurements.thickness_readings.join(', ')} mm
                        {r.measurements.corrosion_rate ? ` · تآكل: ${r.measurements.corrosion_rate} mm/yr` : ''}
                        {r.measurements.coating_condition ? ` · طلاء: ${r.measurements.coating_condition}` : ''}
                      </p>
                    )}
                    {r.notes && <p className="text-base text-slate-400">{r.notes}</p>}
                    {r.recommended_next_action && (
                      <p className="text-base text-amber-300">📌 التوصية: {r.recommended_next_action}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => { storeReceiveResult(wo.id); showToast(`✅ تم استلام تقرير ${wo.id}`); }}
                        className="rounded-lg bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/30 px-3 py-1.5 text-base font-semibold text-sky-300 transition-colors"
                      >
                        📬 استلام التقرير
                      </button>
                      <button
                        onClick={() => { storeCloseWO(wo.id); showToast(`🔒 تم إغلاق ${wo.id}`); }}
                        className="rounded-lg bg-slate-500/20 hover:bg-slate-500/40 border border-slate-500/30 px-3 py-1.5 text-base font-semibold text-slate-300 transition-colors"
                      >
                        🔒 إغلاق الأمر
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
