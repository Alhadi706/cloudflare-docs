'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, XCircle, Activity,
  Zap, Gauge, Clock, Wrench, Shield, AlertCircle, TrendingDown,
  ChevronRight, Users, Info, Brain, Target, ListChecks, TrendingUp,
  Bell, BellOff, BellRing,
  MapPin, Building2, Droplets, GitBranch, Database, X,
  Calendar, Cpu,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ═══ TYPES ═══════════════════════════════════════════════════════
type Severity    = 'critical' | 'high' | 'medium' | 'low';
type FaultStatus = 'جديد' | 'قيد التنفيذ' | 'مُعلّق' | 'منتهٍ';
type EqStatus    = 'normal' | 'warning' | 'critical' | 'offline';

interface ActiveFault {
  id: string; asset: string; faultType: string;
  severity: Severity; status: FaultStatus; category: string;
  station: string; detectedAt: string; team: string; recurring?: boolean;
}
interface PumpRecord {
  id: string; name: string; status: EqStatus;
  pressure: number; efficiency: number; vibration: number; temp: number;
}
interface Alert { id: string; message: string; level: string; time: string; source: string; }
interface EquipmentHealth {
  id: string; name: string; status: EqStatus;
  health: number; lastMaint: string; nextMaint: string; uptime: number; mtbf: number;
}
interface ElectricalLoad {
  id: string; name: string; load: number; voltage: number;
  current: number; pf: number; status: EqStatus; temp: number;
}
interface RecurringFault {
  id: string; asset: string; faultType: string;
  count: number; lastDate: string; trend: string; team: string;
}

// ── Phase 4 types ──────────────────────────────────────────────
type FaultClass = 'فوري' | 'مخطط' | 'وقائي';
interface RCAResult {
  faultId: string;
  asset: string;
  rootCauses: string[];
  faultClass: FaultClass;
  riskLevel: Severity;
  recommendations: string[];
  priorityScore: number;
  confidence: number;
}
interface DegradationAlert {
  assetId: string;
  assetName: string;
  riskLevel: Severity;
  factor: string;
  reading: string;
  threshold: string;
}

// ── Phase 5 types ──────────────────────────────────────────────
type AlertSeverity = 'critical' | 'high' | 'medium' | 'info';
interface SmartAlert {
  id: string;
  severity: AlertSeverity;
  asset: string;
  category: string;
  description: string;
  action: string;
  timestamp: string;
}

// ── Phase 6 types ──────────────────────────────────────────────
type AssetType   = 'مضخة' | 'بئر' | 'خط أنابيب' | 'محطة' | 'معدة كهربائية';
type AssetStatus = 'active' | 'maintenance' | 'fault' | 'offline';
interface MaintRecord {
  date: string; type: string; description: string;
  team: string; duration: string; cost: string;
}
interface AssetRecord {
  id: string; type: AssetType; name: string; location: string; station: string;
  status: AssetStatus; health: number; relatedFaults: string[];
  lastMaint: string; nextMaint: string;
  mtbf: number; mttr: number; uptime: number;
  specs: Record<string, string>;
  maintenanceHistory: MaintRecord[];
  reliability: string;
}

// ── Phase 7 types ──────────────────────────────────────────────
type MaintPriority = 'فوري' | 'خلال أسبوع' | 'خلال شهر' | 'مخطط';
type TrendDir      = 'تصاعدي' | 'مستقر' | 'تنازلي';
interface PredictionResult {
  assetId:             string;
  assetName:           string;
  failureProbability:  number;    // 0–98 (rule-based)
  rul:                 number;    // Remaining Useful Life in days
  maintenancePriority: MaintPriority;
  riskForecast:        string;
  trend:               TrendDir;
  currentHealth:       number;
  projectedHealth30d:  number;    // estimated health in 30 days
  alertFactors:        string[];
}
interface PredictiveAlert {
  id:             string;
  assetName:      string;
  type:           'failure_imminent' | 'degradation' | 'rul_critical' | 'pattern';
  message:        string;
  recommendation: string;
  severity:       Severity;
}

// ═══ MOCK DATA ════════════════════════════════════════════════════
const ACTIVE_FAULTS: ActiveFault[] = [
  { id:'F001', asset:'مضخة مصراتة-3',      faultType:'احتراق ملفات المحرك الكهربائي',  severity:'critical', status:'قيد التنفيذ', category:'كهربائي',   station:'محطة مصراتة',    detectedAt:'2026-05-21 22:30', team:'فريق الكهرباء أ',    recurring:true  },
  { id:'F002', asset:'محرك مصراتة-3',       faultType:'تلف كلي في ملفات المحرك',        severity:'critical', status:'قيد التنفيذ', category:'كهربائي',   station:'محطة مصراتة',    detectedAt:'2026-05-21 22:30', team:'فريق الكهرباء أ',    recurring:true  },
  { id:'F003', asset:'مضخة مصراتة-1',      faultType:'انخفاض كفاءة + اهتزاز زائد',    severity:'high',     status:'قيد التنفيذ', category:'ميكانيكي',  station:'محطة مصراتة',    detectedAt:'2026-05-15 10:00', team:'فريق الميكانيك أ',   recurring:true  },
  { id:'F004', asset:'مضخة نجع جهمة ش-1', faultType:'انخفاض ضغط الخروج',              severity:'high',     status:'جديد',        category:'هيدروليكي', station:'محطة نجع جهمة',  detectedAt:'2026-05-22 07:14', team:'فريق الميكانيك ب'                  },
  { id:'F005', asset:'لوحة تحكم مصراتة',   faultType:'خلل بطاقة I/O',                  severity:'high',     status:'مُعلّق',      category:'تحكم',      station:'محطة مصراتة',    detectedAt:'2026-05-20 14:30', team:'فريق الأتمتة',       recurring:true  },
  { id:'F006', asset:'مضخة نجع جهمة ش-2', faultType:'تآكل المحامل',                    severity:'medium',   status:'جديد',        category:'ميكانيكي',  station:'محطة نجع جهمة',  detectedAt:'2026-05-18 09:00', team:'فريق الميكانيك ب'                  },
  { id:'F007', asset:'صمام الخط الجنوبي',  faultType:'انزياح موضع ±8°',                severity:'medium',   status:'قيد التنفيذ', category:'تحكم',      station:'الخط الجنوبي',  detectedAt:'2026-05-19 11:00', team:'فريق الأتمتة'                      },
  { id:'F008', asset:'مستشعر ضغط مصراتة', faultType:'انحراف معايرة',                   severity:'low',      status:'منتهٍ',       category:'تحكم',      station:'محطة مصراتة',    detectedAt:'2026-05-17 08:00', team:'فريق الأتمتة'                      },
];

const PUMPS: PumpRecord[] = [
  { id:'P101', name:'مضخة مصراتة-1',      status:'warning',  pressure:95,  efficiency:78, vibration:3.8, temp:72  },
  { id:'P102', name:'مضخة مصراتة-2',      status:'normal',   pressure:82,  efficiency:85, vibration:2.1, temp:58  },
  { id:'P201', name:'مضخة مصراتة-3',      status:'normal',   pressure:78,  efficiency:92, vibration:1.8, temp:54  },
  { id:'P301', name:'مضخة الرقيعة-1',     status:'normal',   pressure:80,  efficiency:90, vibration:2.4, temp:60  },
  { id:'P401', name:'مضخة نجع جهمة ش-1', status:'warning',  pressure:110, efficiency:64, vibration:5.2, temp:88  },
  { id:'P402', name:'مضخة نجع جهمة ش-2', status:'critical', pressure:118, efficiency:52, vibration:7.8, temp:102 },
  { id:'P403', name:'مضخة نجع جهمة ش-3', status:'offline',  pressure:0,   efficiency:0,  vibration:0,   temp:0   },
  { id:'P501', name:'مضخة سوكنة-1',       status:'normal',   pressure:85,  efficiency:88, vibration:2.8, temp:63  },
];

const ALERTS: Alert[] = [
  { id:'A1', message:'درجة حرارة محرك P402 تجاوزت 100°C', level:'critical', time:'منذ 12 د', source:'P402' },
  { id:'A2', message:'اهتزاز P401 تجاوز الحد الأعلى',      level:'high',     time:'منذ 45 د', source:'P401' },
  { id:'A3', message:'انقطاع الاتصال بـ P403',              level:'critical', time:'منذ 2 س',  source:'P403' },
  { id:'A4', message:'كفاءة P101 أقل من 80%',               level:'medium',   time:'منذ 3 س',  source:'P101' },
  { id:'A5', message:'انخفاض ضغط الخروج F004',              level:'high',     time:'منذ 4 س',  source:'F004' },
  { id:'A6', message:'صيانة دورية P102 مستحقة',             level:'info',     time:'منذ 1 ي',  source:'P102' },
  { id:'A7', message:'خلل بطاقة I/O لوحة تحكم مصراتة',     level:'high',     time:'منذ 1 ي',  source:'F005' },
  { id:'A8', message:'مستوى زيت P301 منخفض',                level:'medium',   time:'منذ 2 ي',  source:'P301' },
];

const EQUIPMENT_HEALTH: EquipmentHealth[] = [
  { id:'EQ1',  name:'مضخة مصراتة-1',      status:'warning',  health:62, lastMaint:'2026-03-10', nextMaint:'2026-06-10', uptime:97.2, mtbf:720  },
  { id:'EQ2',  name:'مضخة مصراتة-2',      status:'normal',   health:85, lastMaint:'2026-04-15', nextMaint:'2026-07-15', uptime:99.1, mtbf:1440 },
  { id:'EQ3',  name:'مضخة مصراتة-3',      status:'normal',   health:91, lastMaint:'2026-05-01', nextMaint:'2026-08-01', uptime:99.5, mtbf:2880 },
  { id:'EQ4',  name:'مضخة الرقيعة-1',     status:'normal',   health:88, lastMaint:'2026-04-20', nextMaint:'2026-07-20', uptime:98.8, mtbf:2160 },
  { id:'EQ5',  name:'مضخة نجع جهمة ش-1', status:'warning',  health:51, lastMaint:'2026-02-01', nextMaint:'2026-05-01', uptime:94.3, mtbf:360  },
  { id:'EQ6',  name:'مضخة نجع جهمة ش-2', status:'critical', health:32, lastMaint:'2026-01-15', nextMaint:'2026-04-15', uptime:87.6, mtbf:180  },
  { id:'EQ7',  name:'مضخة نجع جهمة ش-3', status:'offline',  health:0,  lastMaint:'2025-12-01', nextMaint:'N/A',         uptime:0,    mtbf:72   },
  { id:'EQ8',  name:'مضخة سوكنة-1',       status:'normal',   health:87, lastMaint:'2026-04-25', nextMaint:'2026-07-25', uptime:99.0, mtbf:1800 },
  { id:'EQ9',  name:'محرك مصراتة-3',      status:'critical', health:18, lastMaint:'2026-05-20', nextMaint:'N/A',         uptime:72.1, mtbf:48   },
  { id:'EQ10', name:'لوحة تحكم مصراتة',   status:'warning',  health:58, lastMaint:'2026-03-25', nextMaint:'2026-06-25', uptime:95.4, mtbf:240  },
  { id:'EQ11', name:'صمام الخط الجنوبي',  status:'warning',  health:63, lastMaint:'2026-04-05', nextMaint:'2026-07-05', uptime:96.8, mtbf:120  },
  { id:'EQ12', name:'مستشعر ضغط مصراتة', status:'normal',   health:95, lastMaint:'2026-05-10', nextMaint:'2026-08-10', uptime:99.8, mtbf:600  },
];

const ELECTRICAL: ElectricalLoad[] = [
  { id:'E1', name:'لوحة MCC مصراتة-1',   load:78,  voltage:398,   current:112, pf:0.88, status:'normal',   temp:42 },
  { id:'E2', name:'لوحة MCC مصراتة-2',   load:85,  voltage:401,   current:128, pf:0.91, status:'normal',   temp:46 },
  { id:'E3', name:'لوحة MCC مصراتة-3',   load:92,  voltage:395,   current:148, pf:0.87, status:'warning',  temp:58 },
  { id:'E4', name:'محول 11kV مصراتة',    load:71,  voltage:10980, current:62,  pf:0.92, status:'normal',   temp:51 },
  { id:'E5', name:'لوحة MCC نجع جهمة-1', load:103, voltage:388,   current:168, pf:0.85, status:'critical', temp:78 },
  { id:'E6', name:'لوحة MCC نجع جهمة-2', load:96,  voltage:391,   current:158, pf:0.86, status:'warning',  temp:64 },
  { id:'E7', name:'لوحة تحكم سوكنة',     load:65,  voltage:402,   current:98,  pf:0.93, status:'normal',   temp:38 },
];

const RECURRING: RecurringFault[] = [
  { id:'R1', asset:'مضخة مصراتة-3',      faultType:'احتراق ملفات المحرك',   count:3, lastDate:'2026-05-21', trend:'+2', team:'فريق الكهرباء أ'  },
  { id:'R2', asset:'مضخة مصراتة-1',      faultType:'انخفاض كفاءة واهتزاز', count:5, lastDate:'2026-05-15', trend:'+1', team:'فريق الميكانيك أ' },
  { id:'R3', asset:'مضخة نجع جهمة ش-1', faultType:'انخفاض ضغط الخروج',    count:4, lastDate:'2026-05-22', trend:'+3', team:'فريق الميكانيك ب' },
  { id:'R4', asset:'لوحة تحكم مصراتة',   faultType:'خلل بطاقة I/O',        count:2, lastDate:'2026-05-20', trend:'0',  team:'فريق الأتمتة'     },
  { id:'R5', asset:'صمام الخط الجنوبي',  faultType:'انزياح موضع الصمام',   count:3, lastDate:'2026-05-19', trend:'+1', team:'فريق الأتمتة'     },
];

// ═══ CHART DATA ═══════════════════════════════════════════════════
const FAULT_FREQ = [
  { week: 'W1', critical: 0, high: 1, medium: 2, low: 1 },
  { week: 'W2', critical: 1, high: 1, medium: 1, low: 0 },
  { week: 'W3', critical: 0, high: 2, medium: 2, low: 2 },
  { week: 'W4', critical: 1, high: 2, medium: 1, low: 1 },
  { week: 'W5', critical: 1, high: 1, medium: 3, low: 0 },
  { week: 'W6', critical: 2, high: 2, medium: 1, low: 1 },
  { week: 'W7', critical: 1, high: 3, medium: 2, low: 1 },
  { week: 'W8', critical: 2, high: 3, medium: 2, low: 1 },
];
const HEALTH_TREND = [
  { month: 'ديسمبر', p401: 78, p402: 70, p403: 45 },
  { month: 'يناير',  p401: 74, p402: 63, p403: 36 },
  { month: 'فبراير', p401: 70, p402: 58, p403: 28 },
  { month: 'مارس',   p401: 66, p402: 53, p403: 22 },
  { month: 'أبريل',  p401: 62, p402: 49, p403: 16 },
  { month: 'مايو',   p401: 58, p402: 45, p403: 10 },
];
const FAULT_DIST = [
  { cat: 'كهربائي',   count: 5 },
  { cat: 'ميكانيكي',  count: 3 },
  { cat: 'تحكم',      count: 4 },
  { cat: 'هيدروليكي', count: 1 },
];

// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — TECHNICAL ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════

// Rule-based RCA knowledge base
const RCA_KB: Record<string, {
  causes: string[];
  recs: string[];
  fClass: FaultClass;
  baseConfidence: number;
}> = {
  'كهربائي': {
    causes: [
      'خلل في حماية الحمل الزائد أو رلي الحراري',
      'اختلال في توازن الطور الثلاثي',
      'تدهور مقاومة عزل الملفات بسبب الحرارة',
      'تقلبات الجهد الكهربائي وضربات الصاعقة',
    ],
    recs: [
      'فحص وقياس توازن الأطوار الثلاثة فوراً',
      'معايرة رلي الحماية الحرارية وفق قيم اللوحة',
      'إجراء اختبار مقاومة العزل بجهاز ميغر',
      'تركيب مثبت جهد أو مصفاة هارمونيك',
    ],
    fClass: 'فوري',
    baseConfidence: 88,
  },
  'ميكانيكي': {
    causes: [
      'تآكل وإجهاد الأجزاء الميكانيكية الدوارة',
      'قصور في جدول التزييت أو جودة الزيت',
      'اختلال في محاور الدوران وعدم المواءمة',
      'تلف مانعات التسرب والحشوات الميكانيكية',
    ],
    recs: [
      'مواءمة دقيقة للمحاور باستخدام ليزر الضبط',
      'تحليل عينة زيت التشغيل (تحليل طيفي)',
      'فحص مانعات التسرب وتبديل الحشوات',
      'إجراء اختبار الاهتزاز الطيفي لتحديد مصدر العطل',
    ],
    fClass: 'مخطط',
    baseConfidence: 82,
  },
  'هيدروليكي': {
    causes: [
      'تآكل الطارة الداخلية وفقدان الرأس الديناميكي',
      'تسرب داخلي عبر صمامات الفصل أو الاسترجاع',
      'انسداد جزئي في مسار السائل أو المرشحات',
      'تلف الحشوات والوصلات تحت الضغط العالي',
    ],
    recs: [
      'فحص الطارة والغلاف الداخلي بكاميرا التفتيش',
      'اختبار ضيق الصمامات وقياس ضغط الاسترجاع',
      'تنظيف المرشحات وفحص الفلتر الخشن والناعم',
      'قياس منحنى الأداء مقابل منحنى التصميم',
    ],
    fClass: 'مخطط',
    baseConfidence: 79,
  },
  'تحكم': {
    causes: [
      'تلف بطاقات الإدخال/الإخراج (I/O Modules)',
      'تداخل كهرومغناطيسي على كابلات الإشارات',
      'خلل في وحدة إمداد الطاقة الداخلية للمتحكم',
      'خطأ برمجي أو تلف في ذاكرة البرنامج',
    ],
    recs: [
      'تشخيص بطاقات I/O عبر برنامج المشغل وتبديل المعطوبة',
      'فحص الأرضي والحجب الكهرومغناطيسي للكابلات',
      'استبدال مزود الطاقة وفحص الجهود الداخلية',
      'رفع نسخة احتياطية للبرنامج وإعادة التحميل',
    ],
    fClass: 'وقائي',
    baseConfidence: 84,
  },
};

// Compute priority score for a fault
function computePriorityScore(f: ActiveFault): number {
  let score = 0;
  // Severity weight
  if      (f.severity === 'critical') score += 40;
  else if (f.severity === 'high')     score += 28;
  else if (f.severity === 'medium')   score += 15;
  else                                score += 5;
  // Recurrence bonus
  if (f.recurring) score += 18;
  const rec = RECURRING.find(r => r.asset === f.asset);
  if (rec) score += Math.min(rec.count * 4, 16);
  // Pending/suspended penalty
  if      (f.status === 'مُعلّق')      score += 14;
  else if (f.status === 'جديد')        score += 10;
  else if (f.status === 'قيد التنفيذ') score += 4;
  // Station criticality
  if (f.station.includes('مصراتة')) score += 6;
  return Math.min(100, score);
}

// Classify fault based on priority and characteristics
function classifyFault(f: ActiveFault, priority: number): FaultClass {
  if (f.severity === 'critical' || priority >= 75) return 'فوري';
  const kb = RCA_KB[f.category];
  return kb ? kb.fClass : 'مخطط';
}

// Build full RCA results from all active faults
function buildRCA(): RCAResult[] {
  return ACTIVE_FAULTS.map(f => {
    const kb      = RCA_KB[f.category] ?? RCA_KB['تحكم'];
    const priority = computePriorityScore(f);
    const fClass  = classifyFault(f, priority);
    // Risk level derived from priority score
    const riskLevel: Severity =
      priority >= 75 ? 'critical' :
      priority >= 52 ? 'high'     :
      priority >= 32 ? 'medium'   : 'low';
    // More causes shown for critical faults
    const causeCount = f.severity === 'critical' ? 4 : f.severity === 'high' ? 3 : 2;
    const recCount   = priority >= 55 ? 4 : priority >= 35 ? 3 : 2;
    // Confidence adjusted by recurrence data
    const rec = RECURRING.find(r => r.asset === f.asset);
    const confidence = Math.min(98, kb.baseConfidence + (rec ? rec.count * 2 : 0) + (f.recurring ? 4 : 0));
    return {
      faultId:         f.id,
      asset:           f.asset,
      rootCauses:      kb.causes.slice(0, causeCount),
      faultClass:      fClass,
      riskLevel,
      recommendations: kb.recs.slice(0, recCount),
      priorityScore:   priority,
      confidence,
    };
  });
}

// Detect equipment degradation from sensor readings
function detectDegradation(): DegradationAlert[] {
  const alerts: DegradationAlert[] = [];

  // Pump-level degradation
  PUMPS.forEach(p => {
    if (p.status === 'offline') return;
    if (p.efficiency < 70) {
      alerts.push({
        assetId:   p.id,
        assetName: p.name,
        riskLevel: p.efficiency < 55 ? 'critical' : 'high',
        factor:    'انخفاض الكفاءة',
        reading:   `${p.efficiency}%`,
        threshold: '70%',
      });
    }
    if (p.vibration > 4.5) {
      alerts.push({
        assetId:   p.id,
        assetName: p.name,
        riskLevel: p.vibration > 7 ? 'critical' : 'high',
        factor:    'ارتفاع مستوى الاهتزاز',
        reading:   `${p.vibration} mm/s`,
        threshold: '4.5 mm/s',
      });
    }
    if (p.temp > 85) {
      alerts.push({
        assetId:   p.id,
        assetName: p.name,
        riskLevel: p.temp > 100 ? 'critical' : 'high',
        factor:    'ارتفاع درجة الحرارة',
        reading:   `${p.temp}°C`,
        threshold: '85°C',
      });
    }
  });

  // Equipment health degradation
  EQUIPMENT_HEALTH.forEach(e => {
    if (e.status === 'offline') return;
    if (e.health < 35) {
      alerts.push({
        assetId:   e.id,
        assetName: e.name,
        riskLevel: e.health < 20 ? 'critical' : 'high',
        factor:    'تدهور مؤشر الصحة الإجمالي',
        reading:   `${e.health}%`,
        threshold: '35%',
      });
    }
    if (e.mtbf < 100) {
      alerts.push({
        assetId:   e.id,
        assetName: e.name,
        riskLevel: 'critical',
        factor:    'MTBF دون الحد الأدنى',
        reading:   `${e.mtbf} س`,
        threshold: '100 س',
      });
    }
  });

  // Electrical overload detection
  ELECTRICAL.forEach(e => {
    if (e.load > 95) {
      alerts.push({
        assetId:   e.id,
        assetName: e.name,
        riskLevel: e.load > 105 ? 'critical' : 'high',
        factor:    'تحميل كهربائي زائد',
        reading:   `${e.load}%`,
        threshold: '95%',
      });
    }
  });

  // Repeated fault detection
  RECURRING.filter(r => r.count >= 3 && r.trend.startsWith('+')).forEach(r => {
    alerts.push({
      assetId:   r.id,
      assetName: r.asset,
      riskLevel: r.count >= 4 ? 'critical' : 'high',
      factor:    'عطل متكرر ومتصاعد',
      reading:   `${r.count} مرات (${r.trend})`,
      threshold: '3 مرات',
    });
  });

  return alerts.sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5 — SMART ALERTING ENGINE
// ═══════════════════════════════════════════════════════════════════

function generateSmartAlerts(): SmartAlert[] {
  const results: SmartAlert[] = [];
  let seq = 1;
  const mkId = () => `SA${String(seq++).padStart(3, '0')}`;

  const TIMES = [
    '09:37 · 22/05/2026', '09:32 · 22/05/2026', '09:28 · 22/05/2026',
    '09:23 · 22/05/2026', '09:18 · 22/05/2026', '09:14 · 22/05/2026',
    '09:10 · 22/05/2026', '09:05 · 22/05/2026', '09:00 · 22/05/2026',
    '08:52 · 22/05/2026', '08:45 · 22/05/2026', '08:30 · 22/05/2026',
    '08:15 · 22/05/2026', '08:00 · 22/05/2026',
  ];
  let ti = 0;
  const ts = () => TIMES[ti++ % TIMES.length];

  // 1. Recurring faults (count ≥ 3 + ascending trend)
  RECURRING.filter(r => r.count >= 3 && r.trend.startsWith('+')).forEach(r => {
    results.push({
      id: mkId(),
      severity: r.count >= 4 ? 'critical' : 'high',
      asset: r.asset,
      category: 'تكرار أعطال',
      description: `تكرار عطل "${r.faultType}" للمرة ${r.count} مع اتجاه متصاعد (${r.trend})`,
      action: 'مراجعة جذرية وتحليل السبب الحقيقي — وقف التدخلات المؤقتة',
      timestamp: ts(),
    });
  });

  // 2. Pump efficiency drop (< 75%, not offline)
  PUMPS.filter(p => p.status !== 'offline' && p.efficiency < 75).forEach(p => {
    results.push({
      id: mkId(),
      severity: p.efficiency < 55 ? 'critical' : p.efficiency < 65 ? 'high' : 'medium',
      asset: p.name,
      category: 'انخفاض كفاءة',
      description: `كفاءة المضخة ${p.efficiency}% تحت الحد المقبول (75%)`,
      action: 'جدولة فحص شامل — مراجعة حالة الطارة الداخلية والمحاور',
      timestamp: ts(),
    });
  });

  // 3. Electrical overload (> 95%)
  ELECTRICAL.filter(e => e.load > 95).forEach(e => {
    results.push({
      id: mkId(),
      severity: e.load > 105 ? 'critical' : 'high',
      asset: e.name,
      category: 'حمل كهربائي زائد',
      description: `حمل ${e.load}% يتجاوز الحد الآمن (95%) — درجة حرارة ${e.temp}°C`,
      action: 'تقليل الحمل فوراً أو تحويل جزء منه — فحص نظام التبريد',
      timestamp: ts(),
    });
  });

  // 4. Critical equipment health (< 25%, not offline)
  EQUIPMENT_HEALTH.filter(e => e.status !== 'offline' && e.health < 25).forEach(e => {
    results.push({
      id: mkId(),
      severity: e.health < 20 ? 'critical' : 'high',
      asset: e.name,
      category: 'صحة حرجة',
      description: `مؤشر صحة الأصل ${e.health}% — خطر توقف وشيك`,
      action: 'إيقاف مجدول فوري وصيانة شاملة — لا تأجيل',
      timestamp: ts(),
    });
  });

  // 5. Pump vibration (> 5 mm/s, not offline)
  PUMPS.filter(p => p.status !== 'offline' && p.vibration > 5).forEach(p => {
    results.push({
      id: mkId(),
      severity: p.vibration > 7 ? 'critical' : 'high',
      asset: p.name,
      category: 'اهتزاز مرتفع',
      description: `اهتزاز ${p.vibration} mm/s يتجاوز حد الخطر (5 mm/s)`,
      action: 'تحليل طيف الاهتزاز — فحص محامل + مواءمة المحاور بالليزر',
      timestamp: ts(),
    });
  });

  // 6. Rising failure probability (MTBF < 200 AND health < 55, not offline)
  EQUIPMENT_HEALTH.filter(e => e.status !== 'offline' && e.mtbf < 200 && e.health < 55).forEach(e => {
    results.push({
      id: mkId(),
      severity: e.mtbf < 100 ? 'critical' : 'medium',
      asset: e.name,
      category: 'احتمالية عطل مرتفعة',
      description: `MTBF ${e.mtbf}س مع صحة ${e.health}% — احتمالية عطل قريب مرتفعة`,
      action: 'تقديم موعد الصيانة الوقائية — رصد مستمر للقراءات',
      timestamp: ts(),
    });
  });

  const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };
  return results.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Compute module-level results (called once from static data)
const RCA_RESULTS: RCAResult[]               = buildRCA();
const DEGRADATION_ALERTS: DegradationAlert[] = detectDegradation();
const SMART_ALERTS: SmartAlert[]             = generateSmartAlerts();

// ═══════════════════════════════════════════════════════════════════
// PHASE 6 — ASSET REGISTRY
// ═══════════════════════════════════════════════════════════════════
const ASSET_REGISTRY: AssetRecord[] = [
  // ── Stations ────────────────────────────────────────────────────────────
  {
    id:'AS01', type:'محطة', name:'محطة مصراتة الرئيسية', location:'مصراتة', station:'محطة مصراتة',
    status:'fault', health:68, relatedFaults:['F001','F002','F003','F005','F008'],
    lastMaint:'2026-04-01', nextMaint:'2026-07-01', mtbf:480, mttr:8.2, uptime:96.5,
    specs:{ 'الطاقة الإنتاجية':'25,000 م³/يوم', 'عدد المضخات':'3', 'الضغط الاسمي':'120 bar', 'سنة الإنشاء':'2012' },
    maintenanceHistory:[
      { date:'2026-04-01', type:'دورية',  description:'فحص شامل لجميع المضخات والصمامات',         team:'فريق الميكانيك أ', duration:'12 ساعة', cost:'8,500 د.ل' },
      { date:'2026-02-15', type:'طارئة', description:'استبدال صمام رئيسي للخط الجنوبي',       team:'فريق الميكانيك أ', duration:'6 ساعات', cost:'4,200 د.ل' },
      { date:'2025-12-10', type:'دورية',  description:'معايرة أجهزة الضغط والتدفق',                    team:'فريق الأتمتة',     duration:'8 ساعات', cost:'2,100 د.ل' },
    ],
    reliability:'متوسطة',
  },
  {
    id:'AS02', type:'محطة', name:'محطة نجع جهمة الشمالية', location:'نجع جهمة', station:'محطة نجع جهمة',
    status:'fault', health:38, relatedFaults:['F004','F006'],
    lastMaint:'2026-01-20', nextMaint:'2026-04-20', mtbf:180, mttr:14.5, uptime:88.2,
    specs:{ 'الطاقة الإنتاجية':'18,000 م³/يوم', 'عدد المضخات':'3', 'الضغط الاسمي':'130 bar', 'سنة الإنشاء':'2015' },
    maintenanceHistory:[
      { date:'2026-01-20', type:'دورية',  description:'فحص المضخات وتغيير الزيوت',                  team:'فريق الميكانيك ب', duration:'10 ساعات', cost:'6,800 د.ل' },
      { date:'2025-11-05', type:'طارئة', description:'إصلاح تسرب في خط الدفع',                         team:'فريق الميكانيك ب', duration:'4 ساعات',  cost:'1,900 د.ل' },
    ],
    reliability:'منخفضة',
  },
  // ── Pumps ─────────────────────────────────────────────────────────────
  {
    id:'AS03', type:'مضخة', name:'مضخة مصراتة-1', location:'محطة مصراتة', station:'محطة مصراتة',
    status:'maintenance', health:62, relatedFaults:['F003'],
    lastMaint:'2026-03-10', nextMaint:'2026-06-10', mtbf:720, mttr:6.0, uptime:97.2,
    specs:{ 'النوع':'طاردة مركزية رأسية', 'التدفق الاسمي':'1,200 م³/س', 'الرأس الاسمي':'85 م', 'القدرة':'185 كيلوواط', 'المصنع':'KSB' },
    maintenanceHistory:[
      { date:'2026-03-10', type:'دورية',  description:'فحص المحامل وتغيير الزيت', team:'فريق الميكانيك أ', duration:'4 ساعات', cost:'1,200 د.ل' },
      { date:'2025-12-05', type:'طارئة', description:'استبدال حشوة المانع',              team:'فريق الميكانيك أ', duration:'3 ساعات', cost:'800 د.ل'   },
    ],
    reliability:'متوسطة',
  },
  {
    id:'AS04', type:'مضخة', name:'مضخة مصراتة-2', location:'محطة مصراتة', station:'محطة مصراتة',
    status:'active', health:85, relatedFaults:[],
    lastMaint:'2026-04-15', nextMaint:'2026-07-15', mtbf:1440, mttr:4.5, uptime:99.1,
    specs:{ 'النوع':'طاردة مركزية رأسية', 'التدفق الاسمي':'1,200 م³/س', 'الرأس الاسمي':'85 م', 'القدرة':'185 كيلوواط', 'المصنع':'KSB' },
    maintenanceHistory:[
      { date:'2026-04-15', type:'دورية', description:'فحص شامل — حالة ممتازة', team:'فريق الميكانيك أ', duration:'4 ساعات', cost:'1,100 د.ل' },
    ],
    reliability:'عالية',
  },
  {
    id:'AS05', type:'مضخة', name:'مضخة مصراتة-3', location:'محطة مصراتة', station:'محطة مصراتة',
    status:'active', health:91, relatedFaults:['F001','F002'],
    lastMaint:'2026-05-01', nextMaint:'2026-08-01', mtbf:2880, mttr:3.2, uptime:99.5,
    specs:{ 'النوع':'طاردة مركزية رأسية', 'التدفق الاسمي':'1,400 م³/س', 'الرأس الاسمي':'90 م', 'القدرة':'220 كيلوواط', 'المصنع':'Grundfos' },
    maintenanceHistory:[
      { date:'2026-05-01', type:'دورية', description:'فحص ما بعد الإصلاح الكهربائي', team:'فريق الكهرباء أ', duration:'6 ساعات', cost:'2,400 د.ل' },
    ],
    reliability:'عالية',
  },
  {
    id:'AS06', type:'مضخة', name:'مضخة نجع جهمة ش-1', location:'نجع جهمة', station:'محطة نجع جهمة',
    status:'maintenance', health:51, relatedFaults:['F004'],
    lastMaint:'2026-02-01', nextMaint:'2026-05-01', mtbf:360, mttr:12.0, uptime:94.3,
    specs:{ 'النوع':'طاردة مركزية أفقية', 'التدفق الاسمي':'900 م³/س', 'الرأس الاسمي':'110 م', 'القدرة':'160 كيلوواط', 'المصنع':'Sulzer' },
    maintenanceHistory:[
      { date:'2026-02-01', type:'دورية',  description:'استبدال محامل وإعادة المواءمة', team:'فريق الميكانيك ب', duration:'8 ساعات',  cost:'3,200 د.ل' },
      { date:'2025-10-20', type:'طارئة', description:'إصلاح تسرب مانع',                        team:'فريق الميكانيك ب', duration:'3 ساعات', cost:'700 د.ل'   },
    ],
    reliability:'متوسطة',
  },
  {
    id:'AS07', type:'مضخة', name:'مضخة نجع جهمة ش-2', location:'نجع جهمة', station:'محطة نجع جهمة',
    status:'fault', health:32, relatedFaults:['F006'],
    lastMaint:'2026-01-15', nextMaint:'2026-04-15', mtbf:180, mttr:18.0, uptime:87.6,
    specs:{ 'النوع':'طاردة مركزية أفقية', 'التدفق الاسمي':'900 م³/س', 'الرأس الاسمي':'110 م', 'القدرة':'160 كيلوواط', 'المصنع':'Sulzer' },
    maintenanceHistory:[
      { date:'2026-01-15', type:'طارئة',  description:'استبدال طارة تالفة',              team:'فريق الميكانيك ب', duration:'16 ساعة',  cost:'8,500 د.ل' },
      { date:'2025-09-08', type:'دورية',  description:'فحص شامل وتغيير زيت',          team:'فريق الميكانيك ب', duration:'6 ساعات', cost:'2,100 د.ل' },
    ],
    reliability:'منخفضة',
  },
  {
    id:'AS08', type:'مضخة', name:'مضخة نجع جهمة ش-3', location:'نجع جهمة', station:'محطة نجع جهمة',
    status:'offline', health:0, relatedFaults:[],
    lastMaint:'2025-12-01', nextMaint:'جارية', mtbf:72, mttr:0, uptime:0,
    specs:{ 'النوع':'طاردة مركزية أفقية', 'التدفق الاسمي':'900 م³/س', 'الرأس الاسمي':'110 م', 'القدرة':'160 كيلوواط', 'المصنع':'Sulzer' },
    maintenanceHistory:[
      { date:'2025-12-01', type:'رئيسية', description:'فصل للصيانة الشاملة — انتظار قطع غيار', team:'فريق الميكانيك ب', duration:'جارية', cost:'TBD' },
    ],
    reliability:'خارج الخدمة',
  },
  // ── Wells ─────────────────────────────────────────────────────────────
  {
    id:'AS09', type:'بئر', name:'بئر مصراتة A-7', location:'حقل مصراتة', station:'محطة مصراتة',
    status:'active', health:88, relatedFaults:[],
    lastMaint:'2026-04-10', nextMaint:'2026-07-10', mtbf:2160, mttr:5.5, uptime:98.5,
    specs:{ 'العمق':'2,800 م', 'قطر البئر':'9.625 بوصة', 'ضغط الرأس':'45 bar', 'معدل الإنتاج':'850 م³/يوم', 'سنة الحفر':'2018' },
    maintenanceHistory:[
      { date:'2026-04-10', type:'دورية', description:'تنظيف وفحص معدات رأس البئر',        team:'فريق الآبار', duration:'6 ساعات',  cost:'3,100 د.ل' },
      { date:'2026-01-18', type:'دورية', description:'فحص صمامات التحكم وضبط الإنتاج', team:'فريق الآبار', duration:'4 ساعات',  cost:'1,600 د.ل' },
    ],
    reliability:'عالية',
  },
  {
    id:'AS10', type:'بئر', name:'بئر نجع جهمة B-3', location:'حقل نجع جهمة', station:'محطة نجع جهمة',
    status:'active', health:74, relatedFaults:[],
    lastMaint:'2026-03-05', nextMaint:'2026-06-05', mtbf:1200, mttr:7.0, uptime:95.8,
    specs:{ 'العمق':'3,100 م', 'قطر البئر':'9.625 بوصة', 'ضغط الرأس':'52 bar', 'معدل الإنتاج':'620 م³/يوم', 'سنة الحفر':'2020' },
    maintenanceHistory:[
      { date:'2026-03-05', type:'دورية', description:'فحص شامل للمكثفات وتنظيف الفلاتر', team:'فريق الآبار', duration:'8 ساعات', cost:'3,800 د.ل' },
    ],
    reliability:'متوسطة',
  },
  // ── Pipelines ─────────────────────────────────────────────────────────
  {
    id:'AS11', type:'خط أنابيب', name:'الخط الجنوبي الرئيسي', location:'جنوب مصراتة', station:'الخط الجنوبي',
    status:'maintenance', health:63, relatedFaults:['F007'],
    lastMaint:'2026-04-05', nextMaint:'2026-07-05', mtbf:960, mttr:10.0, uptime:96.8,
    specs:{ 'القطر':'16 بوصة', 'الطول':'42 كم', 'الضغط الاسمي':'80 bar', 'المادة':'فولاذ كربوني', 'سنة الإنشاء':'2014' },
    maintenanceHistory:[
      { date:'2026-04-05', type:'دورية',  description:'فحص السلامة وكشف التآكل بالموجات فوق الصوتية', team:'فريق الأنابيب', duration:'24 ساعة',   cost:'12,000 د.ل' },
      { date:'2025-08-14', type:'طارئة', description:'إصلاح تسرب عند الوصلة KM-18',                            team:'فريق الأنابيب', duration:'10 ساعات',  cost:'5,500 د.ل'  },
    ],
    reliability:'متوسطة',
  },
  {
    id:'AS12', type:'خط أنابيب', name:'خط التصدير الشمالي', location:'شمال مصراتة', station:'محطة مصراتة',
    status:'active', health:82, relatedFaults:[],
    lastMaint:'2026-03-20', nextMaint:'2026-09-20', mtbf:1800, mttr:6.5, uptime:98.2,
    specs:{ 'القطر':'20 بوصة', 'الطول':'28 كم', 'الضغط الاسمي':'100 bar', 'المادة':'فولاذ عالي الكثافة', 'سنة الإنشاء':'2016' },
    maintenanceHistory:[
      { date:'2026-03-20', type:'دورية', description:'مسح كامل بالبيغ الذكي (Smart Pig)', team:'فريق الأنابيب', duration:'48 ساعة',  cost:'28,000 د.ل' },
    ],
    reliability:'عالية',
  },
  // ── Electrical Equipment ───────────────────────────────────────────
  {
    id:'AS13', type:'معدة كهربائية', name:'محرك مصراتة-3', location:'محطة مصراتة', station:'محطة مصراتة',
    status:'fault', health:18, relatedFaults:['F001','F002'],
    lastMaint:'2026-05-20', nextMaint:'لا ينطبق', mtbf:48, mttr:24.0, uptime:72.1,
    specs:{ 'القدرة':'220 كيلوواط', 'الجهد':'6.6 كيلوفولت', 'معامل القدرة':'0.87', 'درجة الحماية':'IP55', 'المصنع':'ABB' },
    maintenanceHistory:[
      { date:'2026-05-20', type:'طارئة', description:'احتراق ملفات الاستاتور — جارِ الإصلاح', team:'فريق الكهرباء أ', duration:'جارية',  cost:'TBD' },
      { date:'2026-02-10', type:'دورية', description:'فحص المقاومة العازلة وتنظيف الفلاتر',  team:'فريق الكهرباء أ', duration:'5 ساعات', cost:'1,800 د.ل' },
    ],
    reliability:'منخفضة',
  },
  {
    id:'AS14', type:'معدة كهربائية', name:'لوحة MCC نجع جهمة-1', location:'نجع جهمة', station:'محطة نجع جهمة',
    status:'fault', health:45, relatedFaults:['F004','F006'],
    lastMaint:'2026-03-15', nextMaint:'2026-06-15', mtbf:240, mttr:9.0, uptime:91.5,
    specs:{ 'الجهد':'400/230 فولت', 'التيار المقنن':'1,200 أمبير', 'درجة الحماية':'IP42', 'عدد الخلايا':'12 خلية', 'المصنع':'Schneider' },
    maintenanceHistory:[
      { date:'2026-03-15', type:'دورية',  description:'فحص وصلات الباسبار وتشديد البراغي', team:'فريق الكهرباء ب', duration:'6 ساعات', cost:'2,200 د.ل' },
      { date:'2025-11-20', type:'طارئة', description:'استبدال مفتاح قاطع تالف 160A',          team:'فريق الكهرباء ب', duration:'3 ساعات', cost:'1,500 د.ل' },
    ],
    reliability:'متوسطة',
  },
  {
    id:'AS15', type:'معدة كهربائية', name:'لوحة تحكم مصراتة', location:'محطة مصراتة', station:'محطة مصراتة',
    status:'maintenance', health:58, relatedFaults:['F005'],
    lastMaint:'2026-03-25', nextMaint:'2026-06-25', mtbf:240, mttr:7.5, uptime:95.4,
    specs:{ 'النوع':'PLC Siemens S7-400', 'الجهد':'24 فولت DC', 'عدد بطاقات I/O':'48 بطاقة', 'البروتوكول':'PROFIBUS DP', 'المصنع':'Siemens' },
    maintenanceHistory:[
      { date:'2026-03-25', type:'دورية', description:'نسخ احتياطي للبرنامج وفحص البطاقات', team:'فريق الأتمتة', duration:'4 ساعات', cost:'900 د.ل' },
      { date:'2026-01-12', type:'طارئة', description:'استبدال بطاقة I/O معطوبة وحدة DI32',          team:'فريق الأتمتة', duration:'2 ساعة',  cost:'3,200 د.ل' },
    ],
    reliability:'متوسطة',
  },
];

// ═══════════════════════════════════════════════════════════════════
// PHASE 7 — PREDICTIVE MAINTENANCE ENGINE
// ═══════════════════════════════════════════════════════════════════

// Rule-based failure probability estimator (0–98)
function computeFailureProbability(eq: EquipmentHealth): number {
  if (eq.status === 'offline') return 92;
  let p = 0;
  // Health contribution (0–58 pts)
  if      (eq.health === 0)  p += 58;
  else if (eq.health < 20)   p += 48;
  else if (eq.health < 35)   p += 36;
  else if (eq.health < 55)   p += 22;
  else if (eq.health < 75)   p += 10;
  // MTBF contribution (0–25 pts)
  if      (eq.mtbf <= 72)    p += 25;
  else if (eq.mtbf < 200)    p += 18;
  else if (eq.mtbf < 500)    p += 10;
  else if (eq.mtbf < 1000)   p += 4;
  // Status contribution (0–15 pts)
  if      (eq.status === 'critical') p += 15;
  else if (eq.status === 'warning')  p += 8;
  // Uptime contribution (0–10 pts)
  if      (eq.uptime < 85) p += 10;
  else if (eq.uptime < 92) p += 5;
  // Active fault match (+5)
  if (ACTIVE_FAULTS.some(f => f.asset === eq.name)) p += 5;
  // Recurring fault with count ≥ 3 (+8)
  const rec = RECURRING.find(r => r.asset === eq.name);
  if (rec && rec.count >= 3) p += 8;
  return Math.min(98, p);
}

// Remaining Useful Life estimator (days)
function estimateRUL(eq: EquipmentHealth): number {
  if (eq.status === 'offline' || eq.health === 0) return 0;
  // Decay rate factor based on MTBF range
  let factor: number;
  if      (eq.mtbf <= 72)  factor = 0.20;
  else if (eq.mtbf < 200)  factor = 0.40;
  else if (eq.mtbf < 500)  factor = 0.80;
  else if (eq.mtbf < 1000) factor = 1.20;
  else                      factor = 1.80;
  let rul = eq.health * factor;
  if      (eq.status === 'critical') rul *= 0.50;
  else if (eq.status === 'warning')  rul *= 0.70;
  const rec = RECURRING.find(r => r.asset === eq.name);
  if (rec && rec.trend.startsWith('+')) rul *= 0.80;
  return Math.max(0, Math.round(rul));
}

// Maintenance priority ranking from probability + RUL
function rankMaintPriority(prob: number, rul: number): MaintPriority {
  if (prob >= 75 || rul <= 3)  return 'فوري';
  if (prob >= 50 || rul <= 14) return 'خلال أسبوع';
  if (prob >= 30 || rul <= 30) return 'خلال شهر';
  return 'مخطط';
}

// Build full prediction results for all equipment
function buildPredictions(): PredictionResult[] {
  return EQUIPMENT_HEALTH.map(eq => {
    const prob = computeFailureProbability(eq);
    const rul  = estimateRUL(eq);
    const prio = rankMaintPriority(prob, rul);
    const rec  = RECURRING.find(r => r.asset === eq.name);
    const trend: TrendDir =
      eq.status === 'offline'            ? 'تنازلي'  :
      (rec && rec.trend.startsWith('+')) ? 'تصاعدي' :
      eq.health < 60                     ? 'تصاعدي' :
      eq.health >= 80                    ? 'مستقر'   : 'تنازلي';
    const decayPerDay        = rul > 0 ? eq.health / rul : 0;
    const projectedHealth30d = Math.max(0, Math.round(eq.health - decayPerDay * 30));
    const riskForecast: string =
      prio === 'فوري'        ? `خطر توقف خلال ${rul <= 3 ? 'أيام قليلة' : 'أسبوع'} — تدخل فوري مطلوب` :
      prio === 'خلال أسبوع' ? `تراجع متوقع إلى ${projectedHealth30d}% خلال 30 يوماً — جدولة عاجلة` :
      prio === 'خلال شهر'   ? 'صيانة ضرورية قبل نهاية الشهر — مراقبة مستمرة' :
                               'حالة مستقرة — التزام بالجدول الدوري الموصى به';
    const factors: string[] = [];
    if (eq.health < 35)                               factors.push(`صحة حرجة ${eq.health}%`);
    if (eq.mtbf < 200)                                factors.push(`MTBF منخفض ${eq.mtbf}س`);
    if (eq.status === 'critical')                     factors.push('حالة تشغيلية حرجة');
    if (eq.uptime < 90)                               factors.push(`وقت تشغيل ${eq.uptime}%`);
    if (rec && rec.count >= 3)                        factors.push(`عطل متكرر × ${rec.count}`);
    if (ACTIVE_FAULTS.some(f => f.asset === eq.name)) factors.push('عطل نشط مسجل');
    if (factors.length === 0)                         factors.push('لا مؤشرات خطر إضافية');
    return {
      assetId: eq.id, assetName: eq.name,
      failureProbability: prob, rul, maintenancePriority: prio,
      riskForecast, trend, currentHealth: eq.health,
      projectedHealth30d, alertFactors: factors,
    };
  }).sort((a, b) => b.failureProbability - a.failureProbability);
}

// Generate predictive alerts from PREDICTIONS
function generatePredictiveAlerts(): PredictiveAlert[] {
  const results: PredictiveAlert[] = [];
  let seq = 1;
  const mkId = () => `PA${String(seq++).padStart(3, '0')}`;
  PREDICTIONS.forEach(p => {
    if (p.failureProbability >= 80) {
      results.push({
        id: mkId(), assetName: p.assetName, type: 'failure_imminent',
        message: `احتمالية عطل ${p.failureProbability}% — متوقع خلال ${p.rul} يوم`,
        recommendation: 'إيقاف مجدول فوري وتجهيز قطع الغيار اللازمة',
        severity: 'critical',
      });
    } else if (p.rul <= 14 && p.maintenancePriority !== 'مخطط') {
      results.push({
        id: mkId(), assetName: p.assetName, type: 'rul_critical',
        message: `العمر الافتراضي المتبقي ${p.rul} يوماً فقط`,
        recommendation: 'جدولة الصيانة خلال الأسبوع الحالي دون تأخير',
        severity: p.rul <= 7 ? 'critical' : 'high',
      });
    } else if (p.trend === 'تصاعدي' && p.failureProbability >= 35) {
      results.push({
        id: mkId(), assetName: p.assetName, type: 'degradation',
        message: `تدهور متسارع — الصحة متوقعة ${p.projectedHealth30d}% خلال 30 يوماً`,
        recommendation: 'تقديم موعد الصيانة الوقائية وزيادة تكرار المراقبة',
        severity: 'high',
      });
    }
  });
  RECURRING.filter(r => r.count >= 3 && r.trend.startsWith('+')).forEach(r => {
    const pred = PREDICTIONS.find(p => p.assetName === r.asset);
    if (pred && pred.failureProbability < 80) {
      results.push({
        id: mkId(), assetName: r.asset, type: 'pattern',
        message: `نمط عطل متكرر محدد: "${r.faultType}" تكرر ${r.count} مرات (${r.trend})`,
        recommendation: 'تحليل السبب الجذري وإيقاف التدخلات المؤقتة',
        severity: 'high',
      });
    }
  });
  return results;
}

const PREDICTIONS: PredictionResult[]     = buildPredictions();
const PREDICTIVE_ALERTS: PredictiveAlert[] = generatePredictiveAlerts();

// ── Phase 8 — Work Order Engine ──────────────────────────────────
type WorkOrderStatus = 'جديد' | 'معتمد' | 'قيد التنفيذ' | 'مكتمل';
interface WorkOrder {
  id: string; asset: string; faultDesc: string;
  priority: Severity; repair: string; team: string;
  duration: string; status: WorkOrderStatus;
  generatedAt: string; faultRef: string;
  trigger: 'critical_risk' | 'recurring_fault' | 'efficiency_drop' | 'high_probability';
}
const REPAIR_KB: Record<string, { repair: string; team: string; duration: string }> = {
  'كهربائي':   { repair: 'استبدال الملفات المحترقة وفحص رلي الحماية وتوازن الأطوار', team: 'فريق الكهرباء أ',  duration: '16–24 ساعة' },
  'ميكانيكي':  { repair: 'مواءمة المحاور باللييزر واستبدال المحامل وتحليل الزيت',     team: 'فريق الميكانيك أ', duration: '8–16 ساعة'  },
  'هيدروليكي': { repair: 'فحص الطارة وإصلاح الصمامات وقياس منحنى أداء المضخة',        team: 'فريق الميكانيك ب', duration: '6–12 ساعة'  },
  'تحكم':      { repair: 'استبدال بطاقات I/O وتحديث البرنامج والتحقق من الاتصالات',   team: 'فريق الأتمتة',     duration: '4–8 ساعات'  },
};
function generateWorkOrders(): WorkOrder[] {
  const items: WorkOrder[] = [];
  let seq = 1;
  const mkId = () => `WO-${String(seq++).padStart(4, '0')}`;
  const DATES = ['22/05/2026 09:00','22/05/2026 08:30','21/05/2026 22:45','21/05/2026 14:15','20/05/2026 11:30','20/05/2026 09:00','19/05/2026 16:00','19/05/2026 10:30'];
  let di = 0;
  const dt = () => DATES[di++ % DATES.length];
  // Trigger 1: RCA results with priorityScore >= 60 or critical risk
  RCA_RESULTS.filter(r => r.priorityScore >= 60 || r.riskLevel === 'critical').forEach(r => {
    const af = ACTIVE_FAULTS.find(f => f.id === r.faultId);
    if (!af) return;
    const kb = REPAIR_KB[af.category] ?? REPAIR_KB['تحكم'];
    items.push({
      id: mkId(), asset: r.asset, faultDesc: af.faultType,
      priority: r.riskLevel, repair: kb.repair, team: kb.team, duration: kb.duration,
      status: af.status === 'قيد التنفيذ' ? 'قيد التنفيذ' : af.status === 'منتهٍ' ? 'مكتمل' : 'معتمد',
      generatedAt: dt(), faultRef: r.faultId, trigger: 'critical_risk',
    });
  });
  // Trigger 2: Recurring faults count >= 3
  RECURRING.filter(r => r.count >= 3 && !items.some(w => w.asset === r.asset)).forEach(r => {
    const af = ACTIVE_FAULTS.find(f => f.asset === r.asset);
    const kb = REPAIR_KB[af?.category ?? 'ميكانيكي'] ?? REPAIR_KB['ميكانيكي'];
    items.push({
      id: mkId(), asset: r.asset, faultDesc: `${r.faultType} (متكرر ${r.count} مرات)`,
      priority: r.count >= 4 ? 'critical' : 'high', repair: kb.repair, team: kb.team, duration: kb.duration,
      status: 'جديد', generatedAt: dt(), faultRef: af?.id ?? `R-${r.id}`, trigger: 'recurring_fault',
    });
  });
  // Trigger 3: Pump efficiency < 65%
  PUMPS.filter(p => p.status !== 'offline' && p.efficiency < 65 && !items.some(w => w.asset === p.name)).forEach(p => {
    items.push({
      id: mkId(), asset: p.name, faultDesc: `انخفاض كفاءة المضخة إلى ${p.efficiency}% (الحد الأدنى 65%)`,
      priority: p.efficiency < 55 ? 'critical' : 'high',
      repair: 'فحص الطارة الداخلية والمحاور — إعادة معايرة منحنى الأداء', team: 'فريق الميكانيك أ', duration: '8–12 ساعة',
      status: 'معتمد', generatedAt: dt(), faultRef: `P-${p.id}`, trigger: 'efficiency_drop',
    });
  });
  // Trigger 4: Failure probability >= 70%
  PREDICTIONS.filter(p => p.failureProbability >= 70 && !items.some(w => w.asset === p.assetName)).forEach(p => {
    const kb = REPAIR_KB['ميكانيكي'];
    items.push({
      id: mkId(), asset: p.assetName, faultDesc: `احتمالية عطل ${p.failureProbability}% — عمر متبقي ${p.rul} يوم`,
      priority: p.failureProbability >= 85 ? 'critical' : 'high',
      repair: 'فحص شامل وقائي: المحامل والزيت والاهتزاز والحرارة والضغط', team: 'فريق الصيانة', duration: '6–10 ساعات',
      status: 'جديد', generatedAt: dt(), faultRef: `PR-${p.assetId}`, trigger: 'high_probability',
    });
  });
  return items.sort((a, b) => ({ critical:0, high:1, medium:2, low:3 } as Record<Severity,number>)[a.priority] - ({ critical:0, high:1, medium:2, low:3 } as Record<Severity,number>)[b.priority]);
}
const WORK_ORDERS: WorkOrder[] = generateWorkOrders();

// ═══ BADGE COMPONENTS ════════════════════════════════════════════
const SEV_STYLE: Record<Severity, string> = {
  critical: 'bg-red-900/60 text-red-300 border border-red-700',
  high:     'bg-orange-900/60 text-orange-300 border border-orange-700',
  medium:   'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  low:      'bg-blue-900/60 text-blue-300 border border-blue-700',
};
const SEV_LABEL: Record<Severity, string> = { critical:'حرج', high:'عالي', medium:'متوسط', low:'منخفض' };

function SeverityBadge({ s }: { s: Severity }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${SEV_STYLE[s]}`}>{SEV_LABEL[s]}</span>;
}

const FS_STYLE: Record<FaultStatus, string> = {
  'جديد':        'bg-sky-900/60 text-sky-300 border border-sky-700',
  'قيد التنفيذ': 'bg-amber-900/60 text-amber-300 border border-amber-700',
  'مُعلّق':      'bg-slate-700/60 text-slate-300 border border-slate-600',
  'منتهٍ':       'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
};

function FaultStatusBadge({ s }: { s: FaultStatus }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${FS_STYLE[s]}`}>{s}</span>;
}

const CAT_STYLE: Record<string, string> = {
  'كهربائي':   'text-yellow-400',
  'ميكانيكي':  'text-blue-400',
  'تحكم':      'text-purple-400',
  'هيدروليكي': 'text-cyan-400',
};

function CategoryBadge({ c }: { c: string }) {
  return <span className={`text-[11px] font-medium ${CAT_STYLE[c] ?? 'text-gray-400'}`}>{c}</span>;
}

const EQ_DOT: Record<EqStatus, string> = {
  normal: 'bg-emerald-400', warning: 'bg-amber-400', critical: 'bg-red-400', offline: 'bg-gray-500',
};

function EqStatusBadge({ s }: { s: EqStatus }) {
  const labels: Record<EqStatus, string> = { normal:'طبيعي', warning:'تحذير', critical:'حرج', offline:'خارج الخدمة' };
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${EQ_DOT[s]}`} />
      <span className="text-[10px] text-gray-300">{labels[s]}</span>
    </span>
  );
}

function MiniBar({ val, max = 100, color = 'bg-emerald-500' }: { val: number; max?: number; color?: string }) {
  return (
    <div className="w-full bg-slate-700 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min((val / max) * 100, 100)}%` }} />
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-right text-[11px] text-gray-400 font-medium border-b border-slate-800 whitespace-nowrap">{children}</th>;
}

// Phase 4 specific badges
const FC_STYLE: Record<FaultClass, string> = {
  'فوري':  'bg-red-900/50 text-red-300 border border-red-800',
  'مخطط': 'bg-amber-900/50 text-amber-300 border border-amber-800',
  'وقائي': 'bg-blue-900/50 text-blue-300 border border-blue-800',
};
function FaultClassBadge({ c }: { c: FaultClass }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${FC_STYLE[c]}`}>{c}</span>;
}

function PriorityBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-red-500' : score >= 52 ? 'bg-orange-500' : score >= 32 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold text-gray-300 w-6 shrink-0">{score}</span>
    </div>
  );
}

// Phase 7 specific badges
const PRIO_BADGE: Record<MaintPriority, string> = {
  'فوري':        'bg-red-900/60 text-red-300 border border-red-700',
  'خلال أسبوع': 'bg-orange-900/60 text-orange-300 border border-orange-700',
  'خلال شهر':   'bg-amber-900/60 text-amber-300 border border-amber-700',
  'مخطط':        'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
};
function MaintPrioBadge({ p }: { p: MaintPriority }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIO_BADGE[p]}`}>{p}</span>;
}
function TrendBadge({ t }: { t: TrendDir }) {
  if (t === 'تصاعدي') return <span className="flex items-center gap-1 text-[11px] font-medium text-red-400"><TrendingUp className="w-3 h-3" />تصاعدي</span>;
  if (t === 'مستقر')  return <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400"><Activity className="w-3 h-3" />مستقر</span>;
  return <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400"><TrendingDown className="w-3 h-3" />تنازلي</span>;
}
// SVG semicircle probability gauge (sweep=0 = counter-clockwise in SVG → arc through top)
function ProbGauge({ value }: { value: number }) {
  const pct   = Math.min(98, Math.max(0, value));
  const angle = (1 - pct / 100) * Math.PI;
  const px    = (50 + 40 * Math.cos(angle)).toFixed(1);
  const py    = (50 - 40 * Math.sin(angle)).toFixed(1);
  const nx    = (50 + 28 * Math.cos(angle)).toFixed(1);
  const ny    = (50 - 28 * Math.sin(angle)).toFixed(1);
  const color = pct >= 75 ? '#ef4444' : pct >= 50 ? '#f97316' : pct >= 30 ? '#eab308' : '#22c55e';
  return (
    <svg viewBox="0 0 100 58" className="w-full max-w-[130px] mx-auto">
      <path d="M 10 50 A 40 40 0 0 0 90 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
      {pct > 0 && (
        <path d={`M 10 50 A 40 40 0 0 0 ${px} ${py}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      )}
      <line x1="50" y1="50" x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="3.5" fill={color} />
      <text x="50" y="43" textAnchor="middle" fill={color} fontSize="13" fontWeight="bold" fontFamily="monospace">{pct}%</text>
      <text x="10" y="57" textAnchor="middle" fill="#475569" fontSize="7">0%</text>
      <text x="90" y="57" textAnchor="middle" fill="#475569" fontSize="7">100%</text>
    </svg>
  );
}
const WO_STATUS_STYLE: Record<WorkOrderStatus, string> = {
  'جديد':        'bg-sky-900/60 text-sky-300 border border-sky-700',
  'معتمد':       'bg-indigo-900/60 text-indigo-300 border border-indigo-700',
  'قيد التنفيذ': 'bg-amber-900/60 text-amber-300 border border-amber-700',
  'مكتمل':       'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
};
function WOStatusBadge({ s }: { s: WorkOrderStatus }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WO_STATUS_STYLE[s]}`}>{s}</span>;
}
const WO_TRIGGER: Record<WorkOrder['trigger'], { label: string; color: string }> = {
  critical_risk:    { label: 'خطر حرج',            color: 'text-red-400'    },
  recurring_fault:  { label: 'عطل متكرر',           color: 'text-orange-400' },
  efficiency_drop:  { label: 'انخفاض كفاءة',        color: 'text-amber-400'  },
  high_probability: { label: 'احتمالية مرتفعة',     color: 'text-violet-400' },
};
function WOTriggerBadge({ t }: { t: WorkOrder['trigger'] }) {
  const s = WO_TRIGGER[t];
  return <span className={`text-[10px] font-medium ${s.color}`}>{s.label}</span>;
}

// ═══ CHART COMPONENTS ════════════════════════════════════════════
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}

const TT = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 },
  labelStyle:   { color: '#94a3b8', fontSize: 10 },
  itemStyle:    { fontSize: 10 },
  cursor:       { fill: 'rgba(30,41,59,0.3)' },
};

function FaultFreqChart() {
  return (
    <ChartCard title="تكرار الأعطال الأسبوعي">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={FAULT_FREQ} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
          <Tooltip {...TT} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="critical" stackId="a" fill="#ef4444" name="حرج" />
          <Bar dataKey="high"     stackId="a" fill="#f97316" name="عالي" />
          <Bar dataKey="medium"   stackId="a" fill="#eab308" name="متوسط" />
          <Bar dataKey="low"      stackId="a" fill="#3b82f6" name="منخفض" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function HealthTrendChart() {
  return (
    <ChartCard title="اتجاه صحة المضخات (آخر 6 أشهر)">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={HEALTH_TREND}>
          <defs>
            <linearGradient id="gP401" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gP402" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gP403" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6b7280" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} />
          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
          <Tooltip {...TT} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="p401" stroke="#f97316" fill="url(#gP401)" name="نجع جهمة ش-1" strokeWidth={2} />
          <Area type="monotone" dataKey="p402" stroke="#ef4444" fill="url(#gP402)" name="نجع جهمة ش-2" strokeWidth={2} />
          <Area type="monotone" dataKey="p403" stroke="#6b7280" fill="url(#gP403)" name="نجع جهمة ش-3" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function FaultDistChart() {
  const COLORS = ['#eab308', '#3b82f6', '#a855f7', '#06b6d4'];
  return (
    <ChartCard title="توزيع الأعطال حسب الفئة">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={FAULT_DIST} layout="vertical" barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
          <YAxis dataKey="cat" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={65} />
          <Tooltip {...TT} />
          <Bar dataKey="count" name="عدد الأعطال" radius={[0, 4, 4, 0]}>
            {FAULT_DIST.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PumpEffChart() {
  const data = PUMPS.filter(p => p.status !== 'offline').map(p => ({ name: p.id, eff: p.efficiency }));
  return (
    <ChartCard title="كفاءة المضخات (%)">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={20}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
          <YAxis domain={[0, 110]} tick={{ fill: '#64748b', fontSize: 10 }} />
          <Tooltip {...TT} />
          <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'هدف 90%', fill: '#10b981', fontSize: 9 }} />
          <Bar dataKey="eff" name="الكفاءة %" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.eff >= 90 ? '#10b981' : d.eff >= 70 ? '#f97316' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ═══ SHARED UI COMPONENTS ════════════════════════════════════════
function HealthBar({ val }: { val: number }) {
  const color = val >= 80 ? 'bg-emerald-500' : val >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-7 text-left">{val}%</span>
    </div>
  );
}

function SectionCard({ title, accent = 'blue', icon, children }: {
  title: string; accent?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  const border: Record<string, string> = {
    red:     'border-t-red-500',    orange:  'border-t-orange-500',
    amber:   'border-t-amber-500',  blue:    'border-t-blue-500',
    emerald: 'border-t-emerald-500',cyan:    'border-t-cyan-500',
    purple:  'border-t-purple-500', gray:    'border-t-slate-600',
    yellow:  'border-t-yellow-500', indigo:  'border-t-indigo-500',
    teal:    'border-t-teal-500',   pink:    'border-t-pink-500',
  };
  return (
    <div className={`bg-slate-900 border border-slate-800 border-t-2 ${border[accent] ?? border.blue} rounded-2xl p-4 flex flex-col gap-3`}>
      {(title || icon) && (
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

// ═══ MAIN PAGE ════════════════════════════════════════════════════
export default function FaultAnalysisPage() {
  const [activeTab, setActiveTab]     = useState<'all' | Severity>('all');
  const [expandedRCA, setExpandedRCA] = useState<string | null>(null);
  const [alertFilter, setAlertFilter]   = useState<AlertSeverity | 'all'>('all');
  const [ackSet, setAckSet]             = useState<Set<string>>(new Set());
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetType | 'all'>('all');
  const [assetTab, setAssetTab]         = useState<'overview' | 'history' | 'faults'>('overview');
  const [activeSection, setActiveSection] = useState<'monitoring' | 'planning' | 'support' | 'operations'>('monitoring');
  const [woFilter, setWoFilter]           = useState<WorkOrderStatus | 'all'>('all');
  const [selectedWO, setSelectedWO]       = useState<WorkOrder | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [opsSummary, setOpsSummary] = useState<Record<string,any> | null>(null);

  useEffect(() => {
    fetch('/api/v1/ops-summary')
      .then(r => r.json())
      .then(d => setOpsSummary(d))
      .catch(() => {});
  }, []);

  const critCount    = ACTIVE_FAULTS.filter(f => f.severity === 'critical').length;
  const highCount    = ACTIVE_FAULTS.filter(f => f.severity === 'high').length;
  const medCount     = ACTIVE_FAULTS.filter(f => f.severity === 'medium').length;
  const lowCount     = ACTIVE_FAULTS.filter(f => f.severity === 'low').length;
  const critPumps    = PUMPS.filter(p => p.status === 'critical').length;
  const offlinePumps = PUMPS.filter(p => p.status === 'offline').length;
  const avgMTBF      = Math.round(EQUIPMENT_HEALTH.reduce((s, e) => s + e.mtbf, 0) / EQUIPMENT_HEALTH.length);
  const critAssets   = EQUIPMENT_HEALTH.filter(e => e.status === 'critical' || e.status === 'offline').length;
  const filtered     = activeTab === 'all' ? ACTIVE_FAULTS : ACTIVE_FAULTS.filter(f => f.severity === activeTab);

  // Phase 4 computed metrics
  const avgPriority  = Math.round(RCA_RESULTS.reduce((s, r) => s + r.priorityScore, 0) / RCA_RESULTS.length);
  const critRCA      = RCA_RESULTS.filter(r => r.riskLevel === 'critical').length;
  const totalDeg     = DEGRADATION_ALERTS.length;
  const critDeg      = DEGRADATION_ALERTS.filter(d => d.riskLevel === 'critical').length;

  const KPI = [
    { label: 'أعطال حرجة',   value: critCount,    color: 'text-red-400',    icon: <XCircle       className="w-4 h-4 text-red-400"    /> },
    { label: 'أعطال عالية',   value: highCount,    color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4 text-orange-400" /> },
    { label: 'أعطال متوسطة',  value: medCount,     color: 'text-yellow-400', icon: <AlertCircle   className="w-4 h-4 text-yellow-400" /> },
    { label: 'أعطال منخفضة',  value: lowCount,     color: 'text-blue-400',   icon: <Info          className="w-4 h-4 text-blue-400"   /> },
    { label: 'مضخات حرجة',    value: critPumps,    color: 'text-red-400',    icon: <Gauge         className="w-4 h-4 text-red-400"    /> },
    { label: 'خارج الخدمة',   value: offlinePumps, color: 'text-gray-400',   icon: <XCircle       className="w-4 h-4 text-gray-400"   /> },
  ];

  const RELIABILITY = [
    { label: 'متوسط MTBF',     value: `${avgMTBF} س`,  icon: <Clock         className="w-5 h-5 text-sky-400"     />, color: 'text-sky-400'     },
    { label: 'متوسط MTTR',     value: '8.5 س',          icon: <Wrench        className="w-5 h-5 text-amber-400"   />, color: 'text-amber-400'   },
    { label: 'موثوقية النظام', value: '72%',             icon: <Shield        className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400' },
    { label: 'أصول حرجة',      value: `${critAssets}`,  icon: <AlertTriangle className="w-5 h-5 text-red-400"     />, color: 'text-red-400'     },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6 space-y-6 font-sans" dir="rtl">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-300 transition-colors">لوحة التحكم</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <Link href="/dashboard/admin-gateway/maintenance" className="hover:text-gray-300 transition-colors">الصيانة</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span className="text-gray-300">منصة التحليل الفني</span>
      </nav>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">منصة التحليل الفني</h1>
            <p className="text-sm text-gray-400 mt-0.5">تحليل الأعطال والأداء التشغيلي · مصراتة ونجع جهمة</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-red-900/30 text-red-300 border border-red-800 px-3 py-1 rounded-full text-xs font-medium">
            {critCount} عطل حرج نشط
          </span>
          <span className="bg-slate-800 text-gray-400 px-3 py-1 rounded-full text-xs">
            آخر تحديث: 09:45 ص
          </span>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI.map((k, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              {k.icon}
              <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
            </div>
            <span className="text-[11px] text-gray-500 mt-1">{k.label}</span>
          </div>
        ))}
      </div>

      {/* ══ Real Work Orders & Quality Alerts ══ */}
      {opsSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {opsSummary.workOrders && (
            <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white">أوامر العمل المفتوحة — بيانات حقيقية</h3>
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">{opsSummary.workOrders.open_count} مفتوحة</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {opsSummary.workOrders.critical_count > 0 && (
                  <span className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-xs">
                    حرج: {opsSummary.workOrders.critical_count}
                  </span>
                )}
                {opsSummary.workOrders.urgent_count > 0 && (
                  <span className="flex items-center gap-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-lg text-xs">
                    عاجل: {opsSummary.workOrders.urgent_count}
                  </span>
                )}
                {opsSummary.workOrders.high_count > 0 && (
                  <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-lg text-xs">
                    عالي: {opsSummary.workOrders.high_count}
                  </span>
                )}
                <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-lg text-xs">
                  جارية: {opsSummary.workOrders.in_progress_count}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {(opsSummary.workOrders.recent || []).map((wo: Record<string,unknown>, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-800 rounded-lg px-2.5 py-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                      wo.priority === 'critical' ? 'bg-red-500/30 text-red-400' :
                      wo.priority === 'urgent'   ? 'bg-orange-500/30 text-orange-400' : 'bg-amber-500/30 text-amber-400'
                    }`}>{String(wo.priority).toUpperCase()}</span>
                    <span className="text-xs text-slate-200 leading-tight">{String(wo.title)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {opsSummary.quality && (
            <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">تنبيهات جودة المياه — نتائج حقيقية</h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">{opsSummary.quality.locationCount} موقع</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-xs">
                  فشل: {opsSummary.quality.failCount}
                </span>
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-lg text-xs">
                  تحذير: {opsSummary.quality.warnCount}
                </span>
                <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-lg text-xs">
                  ممتاز: {opsSummary.quality.locationCount - opsSummary.quality.failCount - opsSummary.quality.warnCount}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {(opsSummary.quality.locations || []).filter((l: Record<string,unknown>) => l.status !== 'pass').map((loc: Record<string,unknown>, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-2.5 py-2">
                    <span className="text-xs text-slate-200">{String(loc.location_name)}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-400">TDS: <span className="text-white">{String(loc.avg_tds)}</span></span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${loc.status === 'fail' ? 'bg-red-500/30 text-red-400' : 'bg-amber-500/30 text-amber-400'}`}>{String(loc.status).toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section Navigation ── */}
      <div className="flex flex-wrap gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1">
        {[
          { id: 'monitoring'  as const, label: 'قيم مراقبة الآبار',  icon: <Gauge    className="w-3.5 h-3.5" /> },
          { id: 'planning'    as const, label: 'تخطيط الصيانة',      icon: <Calendar className="w-3.5 h-3.5" /> },
          { id: 'support'     as const, label: 'الدعم الفني',         icon: <Wrench   className="w-3.5 h-3.5" /> },
          { id: 'operations'  as const, label: 'مراقبة التشغيل',     icon: <Activity className="w-3.5 h-3.5" /> },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all flex-1 sm:flex-none justify-center ${
              activeSection === s.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'text-gray-400 hover:bg-slate-800 hover:text-gray-200'
            }`}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {/* ════ TAB 1: قيم مراقبة الآبار ════ */}
      {activeSection === 'monitoring' && (
        <div className="space-y-6">

          {/* Pump Cards Grid */}
          <SectionCard title="حالة المضخات" accent="cyan" icon={<Gauge className="w-4 h-4 text-cyan-400" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {PUMPS.map(p => {
                const sc = p.status === 'normal' ? 'border-emerald-800/50' : p.status === 'warning' ? 'border-amber-800/50' : p.status === 'critical' ? 'border-red-800/50' : 'border-gray-700/50';
                const tc = p.temp > 90 ? 'text-red-400' : p.temp > 70 ? 'text-amber-400' : 'text-emerald-400';
                return (
                  <div key={p.id} className={`bg-slate-800/50 border ${sc} rounded-xl p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[12px] font-medium text-gray-200">{p.name}</span>
                        <span className="text-[10px] text-gray-500 mr-2 font-mono">{p.id}</span>
                      </div>
                      <EqStatusBadge s={p.status} />
                    </div>
                    {p.status !== 'offline' ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                          <div><div className="text-[10px] text-gray-500">ضغط</div><div className="text-[13px] font-bold text-gray-200">{p.pressure}<span className="text-[9px] text-gray-500"> bar</span></div></div>
                          <div><div className="text-[10px] text-gray-500">اهتزاز</div><div className="text-[13px] font-bold text-gray-200">{p.vibration}<span className="text-[9px] text-gray-500"> mm/s</span></div></div>
                          <div><div className="text-[10px] text-gray-500">حرارة</div><div className={`text-[13px] font-bold ${tc}`}>{p.temp}<span className="text-[9px]">°C</span></div></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 shrink-0">كفاءة</span>
                          <MiniBar val={p.efficiency} color={p.efficiency >= 85 ? 'bg-emerald-500' : p.efficiency >= 65 ? 'bg-amber-500' : 'bg-red-500'} />
                          <span className="text-[10px] text-gray-400 shrink-0">{p.efficiency}%</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-2 text-[11px] text-gray-500">خارج الخدمة</div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Equipment Health + Electrical */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SectionCard title="صحة المعدات" accent="emerald" icon={<Activity className="w-4 h-4 text-emerald-400" />}>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr><TH>المعدة</TH><TH>الحالة</TH><TH>الصحة</TH><TH>MTBF</TH></tr>
                  </thead>
                  <tbody>
                    {EQUIPMENT_HEALTH.map(e => (
                      <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-[11px] text-gray-300 whitespace-nowrap">{e.name}</td>
                        <td className="px-3 py-1.5"><EqStatusBadge s={e.status} /></td>
                        <td className="px-3 py-1.5 w-24"><HealthBar val={e.health} /></td>
                        <td className="px-3 py-1.5 text-[10px] text-gray-500 whitespace-nowrap">{e.mtbf}س</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="الأحمال الكهربائية" accent="yellow" icon={<Zap className="w-4 h-4 text-yellow-400" />}>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr><TH>اللوحة</TH><TH>الحمل%</TH><TH>P.F</TH><TH>°C</TH><TH>الحالة</TH></tr>
                  </thead>
                  <tbody>
                    {ELECTRICAL.map(e => (
                      <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-[11px] text-gray-300">{e.name}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <MiniBar val={e.load} color={e.load > 95 ? 'bg-red-500' : e.load > 80 ? 'bg-amber-500' : 'bg-emerald-500'} />
                            <span className="text-[10px] text-gray-400 w-8 shrink-0">{e.load}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-400">{e.pf}</td>
                        <td className={`px-3 py-1.5 text-[11px] font-medium ${e.temp > 70 ? 'text-red-400' : e.temp > 55 ? 'text-amber-400' : 'text-gray-300'}`}>{e.temp}°</td>
                        <td className="px-3 py-1.5"><EqStatusBadge s={e.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Pump Efficiency Chart */}
          <SectionCard title="منحنى كفاءة المضخات" accent="cyan" icon={<Activity className="w-4 h-4 text-cyan-400" />}>
            <PumpEffChart />
          </SectionCard>

        </div>
      )}

      {/* ════ TAB 2: تخطيط الصيانة ════ */}
      {activeSection === 'planning' && (
        <div className="space-y-6">

          {/* Reliability KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RELIABILITY.map((r, i) => (
              <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3 hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">{r.icon}</div>
                <div>
                  <div className={`text-lg font-bold ${r.color}`}>{r.value}</div>
                  <div className="text-[11px] text-gray-500">{r.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recurring Faults */}
          <SectionCard title="الأعطال المتكررة" accent="purple" icon={<TrendingDown className="w-4 h-4 text-purple-400" />}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr><TH>الأصل</TH><TH>نوع العطل</TH><TH>عدد التكرار</TH><TH>آخر حدوث</TH><TH>الاتجاه</TH><TH>الفريق المسؤول</TH></tr>
                </thead>
                <tbody>
                  {RECURRING.map(r => (
                    <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-[12px] text-gray-200 font-medium">{r.asset}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-400">{r.faultType}</td>
                      <td className="px-3 py-2">
                        <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded text-[11px] font-bold">{r.count}×</span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">{r.lastDate}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[12px] font-bold ${r.trend.startsWith('+') ? 'text-red-400' : r.trend === '0' ? 'text-gray-400' : 'text-emerald-400'}`}>
                          {r.trend.startsWith('+') ? '▲' : r.trend === '0' ? '─' : '▼'} {r.trend}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-600" />{r.team}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Phase 7: Predictive Maintenance */}
          <div className="rounded-2xl border border-violet-800/50 bg-gradient-to-br from-violet-950/30 to-slate-950 p-1 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 px-4 pt-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-900/60 border border-violet-700 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-violet-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-violet-200">الصيانة التنبؤية</h2>
                  <p className="text-[11px] text-violet-400/70">خوارزميات تقدير احتمالية الأعطال والعمر الافتراضي المتبقي</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-violet-500" />
                <span className="text-[11px] text-violet-400 bg-violet-900/30 border border-violet-800 px-2.5 py-1 rounded-lg">
                  محرك قواعد التنبؤ · {PREDICTIONS.length} أصل محلّل
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4">
              {[
                { label: 'أصول بخطر حرج', value: PREDICTIONS.filter(p => p.failureProbability >= 75).length.toString(), sub: 'احتمالية ≥ 75%', color: 'text-red-400', border: 'border-red-900/50', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
                { label: 'متوسط احتمالية العطل', value: `${Math.round(PREDICTIONS.reduce((s,p)=>s+p.failureProbability,0)/PREDICTIONS.length)}%`, sub: 'كامل الأسطول', color: 'text-orange-400', border: 'border-orange-900/50', icon: <Target className="w-4 h-4 text-orange-500" /> },
                { label: 'أدنى عمر متبقي', value: `${Math.min(...PREDICTIONS.filter(p=>p.rul>0).map(p=>p.rul))} يوم`, sub: 'أخطر أصل نشط', color: 'text-amber-400', border: 'border-amber-900/50', icon: <Clock className="w-4 h-4 text-amber-500" /> },
                { label: 'تدخل فوري مطلوب', value: PREDICTIONS.filter(p=>p.maintenancePriority==='فوري').length.toString(), sub: 'أولوية قصوى', color: 'text-violet-400', border: 'border-violet-900/50', icon: <Wrench className="w-4 h-4 text-violet-500" /> },
              ].map((k, i) => (
                <div key={i} className={`bg-slate-900/70 border ${k.border} rounded-xl p-3 flex flex-col gap-1`}>
                  <div className="flex items-center justify-between"><span className="text-[10px] text-gray-500">{k.label}</span>{k.icon}</div>
                  <div className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</div>
                  <div className="text-[10px] text-gray-600">{k.sub}</div>
                </div>
              ))}
            </div>
            {(() => {
              const top3 = PREDICTIONS.slice(0, 3);
              return (
                <div className="px-4">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-red-500" />أعلى 3 أصول في خطر</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {top3.map((p, idx) => {
                      const borderClr = p.failureProbability >= 75 ? 'border-red-800/60' : p.failureProbability >= 50 ? 'border-orange-800/60' : 'border-amber-800/60';
                      const bgClr     = p.failureProbability >= 75 ? 'from-red-950/30' : p.failureProbability >= 50 ? 'from-orange-950/30' : 'from-amber-950/30';
                      return (
                        <div key={p.assetId} className={`bg-gradient-to-br ${bgClr} to-slate-900 border ${borderClr} rounded-2xl p-4 space-y-3`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] text-gray-500 font-mono">#{idx + 1} أعلى خطر</div>
                              <div className="text-sm font-bold text-gray-100 mt-0.5">{p.assetName}</div>
                            </div>
                            <MaintPrioBadge p={p.maintenancePriority} />
                          </div>
                          <ProbGauge value={p.failureProbability} />
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500"><span>العمر الافتراضي المتبقي</span><span className="font-mono text-amber-400 font-bold">{p.rul} يوم</span></div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.rul <= 7 ? 'bg-red-500' : p.rul <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (p.rul / 90) * 100)}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <TrendBadge t={p.trend} />
                            <span className="text-[10px] text-gray-500">صحة 30 يوم: <span className="text-amber-400 font-mono font-bold">{p.projectedHealth30d}%</span></span>
                          </div>
                          <div className="space-y-1 pt-1 border-t border-slate-800">
                            {p.alertFactors.map((f, fi) => (
                              <div key={fi} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />{f}
                              </div>
                            ))}
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-2 text-[10px] text-gray-400 italic leading-relaxed">{p.riskForecast}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <div className="px-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2"><ListChecks className="w-3.5 h-3.5 text-violet-500" />جدول التنبؤات الكاملة — جميع المعدات</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-900/80"><tr><TH>المعدة</TH><TH>احتمالية العطل</TH><TH>العمر المتبقي</TH><TH>الصحة الحالية</TH><TH>الصحة (30 يوم)</TH><TH>الاتجاه</TH><TH>الأولوية</TH></tr></thead>
                  <tbody>
                    {PREDICTIONS.map((p, i) => (
                      <tr key={p.assetId} className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}>
                        <td className="px-3 py-2 font-medium text-gray-200 whitespace-nowrap">{p.assetName}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.failureProbability >= 75 ? 'bg-red-500' : p.failureProbability >= 50 ? 'bg-orange-500' : p.failureProbability >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${p.failureProbability}%` }} />
                            </div>
                            <span className="font-mono font-bold text-gray-200">{p.failureProbability}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-300">{p.rul === 0 ? <span className="text-gray-600">—</span> : `${p.rul} يوم`}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.currentHealth >= 70 ? 'bg-emerald-500' : p.currentHealth >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${p.currentHealth}%` }} />
                            </div>
                            <span className="font-mono text-gray-300">{p.currentHealth}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-400">{p.projectedHealth30d}%</td>
                        <td className="px-3 py-2"><TrendBadge t={p.trend} /></td>
                        <td className="px-3 py-2"><MaintPrioBadge p={p.maintenancePriority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-2 mb-3">
                  <BellRing className="w-3.5 h-3.5 text-violet-400" />تنبيهات التنبؤ النشطة
                  <span className="ml-auto bg-violet-900/50 text-violet-300 text-[9px] px-1.5 py-0.5 rounded-full border border-violet-800">{PREDICTIVE_ALERTS.length}</span>
                </h3>
                {PREDICTIVE_ALERTS.map(a => {
                  const typeIcon = a.type === 'failure_imminent' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : a.type === 'rul_critical' ? <Clock className="w-3.5 h-3.5 shrink-0" /> : a.type === 'degradation' ? <TrendingDown className="w-3.5 h-3.5 shrink-0" /> : <Brain className="w-3.5 h-3.5 shrink-0" />;
                  const clr = a.severity === 'critical' ? 'text-red-400 bg-red-900/20 border-red-900/40' : a.severity === 'high' ? 'text-orange-400 bg-orange-900/20 border-orange-900/40' : 'text-amber-400 bg-amber-900/20 border-amber-900/40';
                  const iconClr = a.severity === 'critical' ? 'text-red-400' : a.severity === 'high' ? 'text-orange-400' : 'text-amber-400';
                  return (
                    <div key={a.id} className={`border rounded-lg p-2.5 ${clr}`}>
                      <div className="flex items-start gap-2">
                        <span className={iconClr}>{typeIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold text-[11px]">{a.assetName}</span>
                            <span className="text-[9px] font-mono bg-slate-800/60 px-1 py-0.5 rounded text-gray-500">{a.id}</span>
                          </div>
                          <p className="text-[10px] opacity-90 leading-relaxed">{a.message}</p>
                          <p className="text-[10px] opacity-60 mt-1 flex items-center gap-1"><Wrench className="w-2.5 h-2.5 shrink-0" />{a.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-2 mb-4"><Calendar className="w-3.5 h-3.5 text-violet-400" />جدول الأولويات التنبؤية</h3>
                <div className="space-y-0">
                  {(['فوري', 'خلال أسبوع', 'خلال شهر', 'مخطط'] as MaintPriority[]).map((prio, pi, arr) => {
                    const assets  = PREDICTIONS.filter(p => p.maintenancePriority === prio);
                    const dotClr  = prio === 'فوري' ? 'bg-red-500' : prio === 'خلال أسبوع' ? 'bg-orange-500' : prio === 'خلال شهر' ? 'bg-amber-500' : 'bg-emerald-500';
                    const lineClr = prio === 'فوري' ? 'border-red-900/40' : prio === 'خلال أسبوع' ? 'border-orange-900/40' : prio === 'خلال شهر' ? 'border-amber-900/40' : 'border-emerald-900/40';
                    const textClr = prio === 'فوري' ? 'text-red-300' : prio === 'خلال أسبوع' ? 'text-orange-300' : prio === 'خلال شهر' ? 'text-amber-300' : 'text-emerald-300';
                    return (
                      <div key={prio} className={`relative pr-4 pb-5 border-l-2 ${lineClr} mr-1 ${pi === arr.length - 1 ? 'pb-0' : ''}`}>
                        <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${dotClr} ring-2 ring-slate-900`} />
                        <div className="pl-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MaintPrioBadge p={prio} />
                            <span className={`text-[11px] font-bold ${textClr}`}>{assets.length} أصل</span>
                          </div>
                          {assets.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic">لا أصول في هذه الأولوية</p>
                          ) : (
                            <div className="space-y-1">
                              {assets.map(a => (
                                <div key={a.assetId} className="flex items-center justify-between gap-2 bg-slate-800/40 rounded-lg px-2 py-1.5">
                                  <span className="text-[10px] text-gray-300 truncate">{a.assetName}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] font-mono font-bold ${a.failureProbability >= 75 ? 'text-red-400' : a.failureProbability >= 50 ? 'text-orange-400' : 'text-amber-400'}`}>{a.failureProbability}%</span>
                                    {a.rul > 0 && <span className="text-[9px] font-mono text-gray-600">{a.rul}ي</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Phase 8: Work Orders */}
          <div className="rounded-2xl border border-teal-800/50 bg-gradient-to-br from-teal-950/30 to-slate-950 p-1 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 px-4 pt-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-900/60 border border-teal-700 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-teal-200">أوامر التشغيل والصيانة — المرحلة 8</h2>
                  <p className="text-[11px] text-teal-400/70">إنشاء تلقائي بناءً على الأعطال والتنبؤات والمخاطر والكفاءة</p>
                </div>
              </div>
              <span className="text-[11px] text-teal-400 bg-teal-900/30 border border-teal-800 px-2.5 py-1 rounded-lg">
                {WORK_ORDERS.length} أمر عمل مُنشأ
              </span>
            </div>
            {/* WO KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4">
              {[
                { label: 'إجمالي أوامر العمل',  value: WORK_ORDERS.length,                                             color: 'text-teal-400',    border: 'border-teal-900/50',   icon: <ListChecks className="w-4 h-4 text-teal-500"   /> },
                { label: 'أوامر حرجة',           value: WORK_ORDERS.filter(w => w.priority === 'critical').length,     color: 'text-red-400',     border: 'border-red-900/50',    icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
                { label: 'قيد التنفيذ',          value: WORK_ORDERS.filter(w => w.status === 'قيد التنفيذ').length,    color: 'text-amber-400',   border: 'border-amber-900/50',  icon: <Wrench className="w-4 h-4 text-amber-500"     /> },
                { label: 'جديدة تنتظر الاعتماد', value: WORK_ORDERS.filter(w => w.status === 'جديد').length,           color: 'text-sky-400',     border: 'border-sky-900/50',    icon: <Clock className="w-4 h-4 text-sky-500"        /> },
              ].map((k, i) => (
                <div key={i} className={`bg-slate-900/70 border ${k.border} rounded-xl p-3 flex flex-col gap-1`}>
                  <div className="flex items-center justify-between"><span className="text-[10px] text-gray-500">{k.label}</span>{k.icon}</div>
                  <div className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</div>
                </div>
              ))}
            </div>
            {/* WO Filter Tabs */}
            <div className="flex gap-2 flex-wrap px-4">
              {(['all', 'جديد', 'معتمد', 'قيد التنفيذ', 'مكتمل'] as const).map(f => (
                <button key={f} onClick={() => setWoFilter(f)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    woFilter === f ? 'bg-teal-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}>
                  {f === 'all' ? 'الكل' : f}
                  <span className="mr-1 opacity-60">({f === 'all' ? WORK_ORDERS.length : WORK_ORDERS.filter(w => w.status === f).length})</span>
                </button>
              ))}
            </div>
            {/* WO Table */}
            <div className="px-4 pb-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-900/80">
                    <tr><TH>رقم الأمر</TH><TH>الأصل</TH><TH>وصف العطل</TH><TH>الأولوية</TH><TH>الإجراء المقترح</TH><TH>الفريق</TH><TH>المدة</TH><TH>المصدر</TH><TH>الحالة</TH></tr>
                  </thead>
                  <tbody>
                    {(woFilter === 'all' ? WORK_ORDERS : WORK_ORDERS.filter(w => w.status === woFilter)).map((w, i) => (
                      <tr key={w.id} onClick={() => setSelectedWO(w)}
                        className={`border-t border-slate-800 cursor-pointer hover:bg-teal-900/10 transition-colors ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}>
                        <td className="px-3 py-2 font-mono text-teal-400 whitespace-nowrap">{w.id}</td>
                        <td className="px-3 py-2 text-gray-200 font-medium whitespace-nowrap">{w.asset}</td>
                        <td className="px-3 py-2 text-gray-400 max-w-[160px] truncate" title={w.faultDesc}>{w.faultDesc}</td>
                        <td className="px-3 py-2"><SeverityBadge s={w.priority} /></td>
                        <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate" title={w.repair}>{w.repair}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{w.team}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{w.duration}</td>
                        <td className="px-3 py-2"><WOTriggerBadge t={w.trigger} /></td>
                        <td className="px-3 py-2"><WOStatusBadge s={w.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ════ TAB 3: الدعم الفني ════ */}
      {activeSection === 'support' && (
        <div className="space-y-6">

          {/* Active Faults Table */}
          <SectionCard title="سجل الأعطال النشطة" accent="red" icon={<AlertTriangle className="w-4 h-4 text-red-400" />}>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    activeTab === tab ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}>
                  {tab === 'all' ? 'الكل' : SEV_LABEL[tab]}
                  <span className="mr-1 opacity-70">({tab === 'all' ? ACTIVE_FAULTS.length : ACTIVE_FAULTS.filter(f => f.severity === tab).length})</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr><TH>المعرف</TH><TH>الأصل</TH><TH>نوع العطل</TH><TH>الخطورة</TH><TH>الحالة</TH><TH>الفئة</TH><TH>الفريق</TH><TH>وقت الرصد</TH></tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-[11px] font-mono text-gray-400">
                        {f.id}{f.recurring && <span className="mr-1 text-orange-400">↻</span>}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-200 font-medium whitespace-nowrap">{f.asset}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-400 max-w-[160px]">{f.faultType}</td>
                      <td className="px-3 py-2"><SeverityBadge s={f.severity} /></td>
                      <td className="px-3 py-2"><FaultStatusBadge s={f.status} /></td>
                      <td className="px-3 py-2"><CategoryBadge c={f.category} /></td>
                      <td className="px-3 py-2 text-[11px] text-gray-400 whitespace-nowrap">{f.team}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{f.detectedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Active Alerts */}
          <SectionCard title="التنبيهات النشطة" accent="orange" icon={<AlertCircle className="w-4 h-4 text-orange-400" />}>
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {ALERTS.map(a => {
                const lvl = a.level === 'critical' ? { bg:'bg-red-900/30',    border:'border-red-800/50',    dot:'bg-red-400',    txt:'text-red-300'    }
                          : a.level === 'high'     ? { bg:'bg-orange-900/30', border:'border-orange-800/50', dot:'bg-orange-400', txt:'text-orange-300' }
                          : a.level === 'medium'   ? { bg:'bg-yellow-900/30', border:'border-yellow-800/50', dot:'bg-yellow-400', txt:'text-yellow-300' }
                          :                          { bg:'bg-blue-900/20',   border:'border-blue-800/50',   dot:'bg-blue-400',   txt:'text-blue-300'   };
                return (
                  <div key={a.id} className={`${lvl.bg} border ${lvl.border} rounded-lg p-2.5 flex gap-2`}>
                    <span className={`w-2 h-2 rounded-full ${lvl.dot} mt-1 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-medium ${lvl.txt} leading-snug`}>{a.message}</p>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">{a.source}</span>
                        <span className="text-[10px] text-gray-600">{a.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Phase 4: Technical Analysis */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Brain className="w-4 h-4 text-indigo-400" /></div>
            <div>
              <h2 className="text-base font-bold text-white">التحليل الفني الآلي — المرحلة 4</h2>
              <p className="text-xs text-gray-500">تحليل السبب الجذري · تصنيف الأعطال · كشف التدهور · أولويات الإصلاح</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:'إجمالي التحاليل',  value: RCA_RESULTS.length,  color:'text-indigo-400', icon:<Brain         className="w-4 h-4 text-indigo-400"  /> },
              { label:'حرجة المخاطر',     value: critRCA,             color:'text-red-400',    icon:<Target        className="w-4 h-4 text-red-400"     /> },
              { label:'متوسط الأولوية',   value: avgPriority,         color:'text-amber-400',  icon:<TrendingUp    className="w-4 h-4 text-amber-400"   /> },
              { label:'تنبيهات التدهور',  value: totalDeg,            color:'text-orange-400', icon:<AlertTriangle className="w-4 h-4 text-orange-400"  /> },
            ].map((k, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">{k.icon}</div>
                <div><div className={`text-xl font-bold ${k.color}`}>{k.value}</div><div className="text-[11px] text-gray-500">{k.label}</div></div>
              </div>
            ))}
          </div>
          <SectionCard title="نتائج تحليل السبب الجذري (RCA)" accent="indigo" icon={<Brain className="w-4 h-4 text-indigo-400" />}>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr><TH>العطل</TH><TH>الأصل</TH><TH>نوع التدخل</TH><TH>مستوى الخطر</TH><TH>درجة الأولوية</TH><TH>الثقة</TH><TH>التفاصيل</TH></tr>
                </thead>
                <tbody>
                  {RCA_RESULTS.map(r => {
                    const fault = ACTIVE_FAULTS.find(f => f.id === r.faultId);
                    const isExp = expandedRCA === r.faultId;
                    return (
                      <React.Fragment key={r.faultId}>
                        <tr className={`border-b border-slate-800 transition-colors ${isExp ? 'bg-slate-800/50' : 'hover:bg-slate-800/20'}`}>
                          <td className="px-3 py-2 text-[11px] font-mono text-gray-400">{r.faultId}</td>
                          <td className="px-3 py-2 text-[12px] text-gray-200 font-medium whitespace-nowrap">{r.asset}</td>
                          <td className="px-3 py-2"><FaultClassBadge c={r.faultClass} /></td>
                          <td className="px-3 py-2"><SeverityBadge s={r.riskLevel} /></td>
                          <td className="px-3 py-2 min-w-[110px]"><PriorityBar score={r.priorityScore} /></td>
                          <td className="px-3 py-2"><span className="text-[11px] font-semibold text-emerald-400">{r.confidence}%</span></td>
                          <td className="px-3 py-2">
                            <button onClick={() => setExpandedRCA(isExp ? null : r.faultId)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                              <ListChecks className="w-3 h-3" />{isExp ? 'إخفاء' : 'عرض'}
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="border-b border-slate-700 bg-slate-800/30">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[11px] font-semibold text-red-400 mb-2 flex items-center gap-1"><Target className="w-3 h-3" /> الأسباب الجذرية المحتملة</p>
                                  <ul className="space-y-1">{r.rootCauses.map((c, ci) => (<li key={ci} className="flex items-start gap-2 text-[11px] text-gray-300"><span className="text-red-500 mt-0.5 shrink-0">▸</span>{c}</li>))}</ul>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> التوصيات الفنية</p>
                                  <ul className="space-y-1">{r.recommendations.map((rec, ri) => (<li key={ri} className="flex items-start gap-2 text-[11px] text-gray-300"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{rec}</li>))}</ul>
                                </div>
                              </div>
                              {fault && (
                                <div className="mt-2 pt-2 border-t border-slate-700 flex gap-4 flex-wrap">
                                  <span className="text-[10px] text-gray-500">المحطة: <span className="text-gray-400">{fault.station}</span></span>
                                  <span className="text-[10px] text-gray-500">الفريق: <span className="text-gray-400">{fault.team}</span></span>
                                  <span className="text-[10px] text-gray-500">وقت الرصد: <span className="text-gray-400">{fault.detectedAt}</span></span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SectionCard title="كشف تدهور الأصول" accent="orange" icon={<TrendingDown className="w-4 h-4 text-orange-400" />}>
              <div className="text-[11px] text-gray-500 -mt-1">{critDeg} حرج · {totalDeg - critDeg} عالي</div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {DEGRADATION_ALERTS.map((d, i) => {
                  const isCrit = d.riskLevel === 'critical';
                  return (
                    <div key={i} className={`rounded-xl p-3 border flex items-start gap-3 ${isCrit ? 'bg-red-900/20 border-red-800/50' : 'bg-orange-900/20 border-orange-800/50'}`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isCrit ? 'text-red-400' : 'text-orange-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-[12px] font-semibold text-gray-200">{d.assetName}</span>
                          <SeverityBadge s={d.riskLevel} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{d.factor}</p>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[10px] text-gray-500">القراءة: <span className={`font-semibold ${isCrit ? 'text-red-300' : 'text-orange-300'}`}>{d.reading}</span></span>
                          <span className="text-[10px] text-gray-500">الحد: <span className="text-gray-400">{d.threshold}</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
            <SectionCard title="ملخص تصنيف الأعطال" accent="indigo" icon={<Target className="w-4 h-4 text-indigo-400" />}>
              {(['فوري', 'مخطط', 'وقائي'] as FaultClass[]).map(fc => {
                const count = RCA_RESULTS.filter(r => r.faultClass === fc).length;
                const pct   = Math.round((count / RCA_RESULTS.length) * 100);
                const color = fc === 'فوري' ? 'bg-red-500' : fc === 'مخطط' ? 'bg-amber-500' : 'bg-blue-500';
                const tcolor = fc === 'فوري' ? 'text-red-400' : fc === 'مخطط' ? 'text-amber-400' : 'text-blue-400';
                return (
                  <div key={fc} className="space-y-1">
                    <div className="flex justify-between text-[12px]"><span className={`font-semibold ${tcolor}`}>{fc}</span><span className="text-gray-400">{count} عطل ({pct}%)</span></div>
                    <div className="w-full bg-slate-700 rounded-full h-2"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-800 mt-1">
                <p className="text-[11px] text-gray-500 mb-2">توزيع درجات الأولوية</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sv => {
                    const count = RCA_RESULTS.filter(r => r.riskLevel === sv).length;
                    return (
                      <div key={sv} className="text-center">
                        <div className={`text-lg font-bold ${sv === 'critical' ? 'text-red-400' : sv === 'high' ? 'text-orange-400' : sv === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>{count}</div>
                        <div className="text-[10px] text-gray-500">{SEV_LABEL[sv]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {(() => {
                const top = [...RCA_RESULTS].sort((a, b) => b.priorityScore - a.priorityScore)[0];
                return (
                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700 mt-1">
                    <p className="text-[10px] text-gray-500 mb-1">أعلى أولوية للإصلاح</p>
                    <p className="text-[12px] font-semibold text-red-300">{top.asset}</p>
                    <div className="flex items-center gap-2 mt-1"><PriorityBar score={top.priorityScore} /><FaultClassBadge c={top.faultClass} /></div>
                  </div>
                );
              })()}
            </SectionCard>
          </div>

          {/* Phase 5: Smart Alerting */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center"><Bell className="w-4 h-4 text-pink-400" /></div>
            <div>
              <h2 className="text-base font-bold text-white">مركز التنبيهات الذكية — المرحلة 5</h2>
              <p className="text-xs text-gray-500">تنبيهات آلية · فلترة حسب الخطورة · إقرار التنبيهات · تتبع الحالة</p>
            </div>
          </div>
          {(() => {
            const total = SMART_ALERTS.length, crit = SMART_ALERTS.filter(a => a.severity === 'critical').length, acked = ackSet.size, unAcked = total - acked;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي التنبيهات', value: total,   color: 'text-gray-200',    bg: 'bg-slate-900',      icon: <Bell         className="w-4 h-4 text-gray-400"    /> },
                  { label: 'تنبيهات حرجة',     value: crit,    color: 'text-red-400',     bg: 'bg-red-900/20',     icon: <BellRing     className="w-4 h-4 text-red-400"     /> },
                  { label: 'تنبيهات نشطة',     value: unAcked, color: 'text-amber-400',   bg: 'bg-amber-900/20',   icon: <AlertTriangle className="w-4 h-4 text-amber-400"  /> },
                  { label: 'تم الإقرار',        value: acked,   color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: <BellOff      className="w-4 h-4 text-emerald-400" /> },
                ].map((k, i) => (
                  <div key={i} className={`${k.bg} border border-slate-800 rounded-xl p-3 flex items-center gap-3`}>
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">{k.icon}</div>
                    <div><div className={`text-xl font-bold ${k.color}`}>{k.value}</div><div className="text-[11px] text-gray-500">{k.label}</div></div>
                  </div>
                ))}
              </div>
            );
          })()}
          {SMART_ALERTS.filter(a => a.severity === 'critical' && !ackSet.has(a.id)).length > 0 && (
            <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BellRing className="w-4 h-4 text-red-400 animate-pulse" />
                <h3 className="text-sm font-bold text-red-300">تنبيهات حرجة — تستوجب التدخل الفوري</h3>
                <span className="text-[10px] bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded-full mr-auto">
                  {SMART_ALERTS.filter(a => a.severity === 'critical' && !ackSet.has(a.id)).length} غير مُقَرّ
                </span>
              </div>
              <div className="space-y-2">
                {SMART_ALERTS.filter(a => a.severity === 'critical' && !ackSet.has(a.id)).map(a => (
                  <div key={a.id} className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[12px] font-semibold text-red-200">{a.asset}</span>
                        <span className="text-[10px] text-red-700 font-mono">{a.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-0.5">{a.description}</p>
                      <p className="text-[11px] text-red-300 mt-1 flex items-start gap-1"><span className="text-red-500 shrink-0 mt-0.5">→</span>{a.action}</p>
                    </div>
                    <button onClick={() => setAckSet(prev => new Set([...prev, a.id]))}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-red-900/50 border border-red-700 text-[11px] text-red-300 hover:bg-red-800/60 transition-colors whitespace-nowrap">
                      إقرار
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <SectionCard title="مركز التنبيهات" accent="pink" icon={<Bell className="w-4 h-4 text-pink-400" />}>
            <div className="flex gap-2 flex-wrap items-center">
              {(['all', 'critical', 'high', 'medium', 'info'] as const).map(f => {
                const cnt    = f === 'all' ? SMART_ALERTS.length : SMART_ALERTS.filter(a => a.severity === f).length;
                const active = alertFilter === f;
                const tabCls = f === 'critical' ? (active ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-red-900/40') : f === 'high' ? (active ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-orange-900/40') : f === 'medium' ? (active ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-yellow-900/40') : f === 'info' ? (active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-blue-900/40') : (active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700');
                const lbl = f === 'all' ? 'الكل' : f === 'critical' ? 'حرج' : f === 'high' ? 'عالي' : f === 'medium' ? 'متوسط' : 'معلومات';
                return (
                  <button key={f} onClick={() => setAlertFilter(f)} className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${tabCls}`}>
                    {lbl} <span className="opacity-60 mr-1">({cnt})</span>
                  </button>
                );
              })}
              {ackSet.size > 0 && (
                <button onClick={() => setAckSet(new Set())} className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-700 text-gray-400 hover:bg-slate-600 transition-colors mr-auto">
                  إلغاء جميع الإقرارات ({ackSet.size})
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {SMART_ALERTS.filter(a => alertFilter === 'all' || a.severity === alertFilter).map(a => {
                const isAcked = ackSet.has(a.id);
                const sc = a.severity === 'critical' ? { bg:'bg-red-900/20',    bd:'border-red-800/40',    dot:'bg-red-400',    txt:'text-red-300',    badge:'bg-red-900/50 text-red-300 border border-red-800'       }
                  : a.severity === 'high'   ? { bg:'bg-orange-900/20', bd:'border-orange-800/40', dot:'bg-orange-400', txt:'text-orange-300', badge:'bg-orange-900/50 text-orange-300 border border-orange-800' }
                  : a.severity === 'medium' ? { bg:'bg-yellow-900/20', bd:'border-yellow-800/40', dot:'bg-yellow-400', txt:'text-yellow-300', badge:'bg-yellow-900/50 text-yellow-300 border border-yellow-800' }
                  :                           { bg:'bg-blue-900/20',   bd:'border-blue-800/40',   dot:'bg-blue-400',   txt:'text-blue-300',   badge:'bg-blue-900/50 text-blue-300 border border-blue-800'     };
                return (
                  <div key={a.id} className={`${isAcked ? 'opacity-40' : sc.bg} border ${sc.bd} rounded-xl p-3 flex items-start gap-3 transition-all duration-200`}>
                    <span className={`w-2 h-2 rounded-full ${sc.dot} mt-1.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[12px] font-semibold ${isAcked ? 'line-through text-gray-500' : 'text-gray-200'}`}>{a.asset}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${sc.badge}`}>{a.category}</span>
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono shrink-0">{a.timestamp}</span>
                      </div>
                      <p className={`text-[11px] mt-1 leading-relaxed ${isAcked ? 'line-through text-gray-600' : 'text-gray-400'}`}>{a.description}</p>
                      {!isAcked ? (
                        <p className="text-[11px] text-emerald-400 mt-1.5 flex items-start gap-1"><span className="text-emerald-600 shrink-0 mt-0.5">→</span>{a.action}</p>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-700"><CheckCircle2 className="w-3 h-3" /> تم الإقرار</span>
                      )}
                    </div>
                    {!isAcked ? (
                      <button onClick={() => setAckSet(prev => new Set([...prev, a.id]))} className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors hover:opacity-80 whitespace-nowrap ${sc.badge}`}>إقرار</button>
                    ) : (
                      <button onClick={() => setAckSet(prev => { const n = new Set(prev); n.delete(a.id); return n; })} className="shrink-0 px-2 py-1 rounded-lg text-[10px] border border-slate-700 text-gray-600 hover:text-gray-400 transition-colors whitespace-nowrap">تراجع</button>
                    )}
                  </div>
                );
              })}
              {SMART_ALERTS.filter(a => alertFilter === 'all' || a.severity === alertFilter).length === 0 && (
                <div className="text-center py-10 text-gray-600 text-sm">لا توجد تنبيهات في هذه الفئة</div>
              )}
            </div>
          </SectionCard>

        </div>
      )}

      {/* ════ TAB 4: مراقبة التشغيل ════ */}
      {activeSection === 'operations' && (
        <div className="space-y-6">

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FaultFreqChart />
            <HealthTrendChart />
            <FaultDistChart />
            <PumpEffChart />
          </div>

          {/* Phase 6: Asset Registry */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center"><Database className="w-4 h-4 text-teal-400" /></div>
            <div>
              <h2 className="text-base font-bold text-white">سجل الأصول الفني — المرحلة 6</h2>
              <p className="text-xs text-gray-500">15 أصل · مضخات · آبار · خطوط أنابيب · محطات · معدات كهربائية · نقر للتفاصيل</p>
            </div>
          </div>
          {(() => {
            const counts: Record<AssetType | 'all', number> = {
              'all': ASSET_REGISTRY.length, 'محطة': ASSET_REGISTRY.filter(a => a.type === 'محطة').length,
              'مضخة': ASSET_REGISTRY.filter(a => a.type === 'مضخة').length, 'بئر': ASSET_REGISTRY.filter(a => a.type === 'بئر').length,
              'خط أنابيب': ASSET_REGISTRY.filter(a => a.type === 'خط أنابيب').length, 'معدة كهربائية': ASSET_REGISTRY.filter(a => a.type === 'معدة كهربائية').length,
            };
            const items = [
              { type: 'all' as const,            label: 'إجمالي الأصول',  icon: <Database  className="w-4 h-4 text-teal-400"   />, color: 'text-teal-400'   },
              { type: 'محطة' as const,           label: 'محطات',          icon: <Building2 className="w-4 h-4 text-indigo-400" />, color: 'text-indigo-400' },
              { type: 'مضخة' as const,           label: 'مضخات',          icon: <Gauge     className="w-4 h-4 text-cyan-400"   />, color: 'text-cyan-400'   },
              { type: 'بئر' as const,            label: 'آبار',           icon: <Droplets  className="w-4 h-4 text-blue-400"   />, color: 'text-blue-400'   },
              { type: 'خط أنابيب' as const,     label: 'خطوط أنابيب',   icon: <GitBranch className="w-4 h-4 text-emerald-400"/>, color: 'text-emerald-400'},
              { type: 'معدة كهربائية' as const,  label: 'معدات كهربائية', icon: <Zap       className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' },
            ];
            return (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {items.map((k, i) => (
                  <button key={i} onClick={() => setAssetTypeFilter(k.type)}
                    className={`bg-slate-900 border rounded-xl p-3 flex flex-col items-center gap-1 transition-colors hover:border-slate-600 ${assetTypeFilter === k.type ? 'border-teal-700 ring-1 ring-teal-700/50' : 'border-slate-800'}`}>
                    {k.icon}
                    <div className={`text-lg font-bold ${k.color}`}>{counts[k.type]}</div>
                    <div className="text-[10px] text-gray-500">{k.label}</div>
                  </button>
                ))}
              </div>
            );
          })()}
          {(() => {
            const filteredAssets = assetTypeFilter === 'all' ? ASSET_REGISTRY : ASSET_REGISTRY.filter(a => a.type === assetTypeFilter);
            const statusStyle: Record<AssetStatus, { bg: string; border: string; dot: string; label: string }> = {
              active:      { bg: 'bg-emerald-900/20', border: 'border-emerald-800/50', dot: 'bg-emerald-400', label: 'نشط'   },
              maintenance: { bg: 'bg-amber-900/20',   border: 'border-amber-800/50',   dot: 'bg-amber-400',   label: 'صيانة' },
              fault:       { bg: 'bg-red-900/20',     border: 'border-red-800/50',     dot: 'bg-red-400',     label: 'خارج'  },
              offline:     { bg: 'bg-gray-900/30',    border: 'border-gray-700/50',    dot: 'bg-gray-500',    label: 'متوقف' },
            };
            const typeIcon: Record<AssetType, React.ReactNode> = {
              'محطة': <Building2 className="w-3.5 h-3.5" />, 'مضخة': <Gauge className="w-3.5 h-3.5" />, 'بئر': <Droplets className="w-3.5 h-3.5" />,
              'خط أنابيب': <GitBranch className="w-3.5 h-3.5" />, 'معدة كهربائية': <Zap className="w-3.5 h-3.5" />,
            };
            const typeColor: Record<AssetType, string> = { 'محطة':'text-indigo-400','مضخة':'text-cyan-400','بئر':'text-blue-400','خط أنابيب':'text-emerald-400','معدة كهربائية':'text-yellow-400' };
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredAssets.map(a => {
                  const ss = statusStyle[a.status];
                  const hColor = a.health >= 80 ? 'bg-emerald-500' : a.health >= 50 ? 'bg-amber-500' : a.health > 0 ? 'bg-red-500' : 'bg-gray-600';
                  return (
                    <button key={a.id} onClick={() => { setSelectedAsset(a); setAssetTab('overview'); }}
                      className={`text-right ${ss.bg} border ${ss.border} rounded-xl p-4 hover:border-teal-700/60 hover:ring-1 hover:ring-teal-700/30 transition-all duration-150 group`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-gray-200 group-hover:text-teal-300 transition-colors leading-tight">{a.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={typeColor[a.type]}>{typeIcon[a.type]}</span>
                            <span className={`text-[10px] font-medium ${typeColor[a.type]}`}>{a.type}</span>
                            <span className="text-gray-700">·</span>
                            <MapPin className="w-3 h-3 text-gray-600" />
                            <span className="text-[10px] text-gray-500 truncate">{a.location}</span>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 shrink-0 text-[10px] text-gray-300"><span className={`w-2 h-2 rounded-full ${ss.dot}`} />{ss.label}</span>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>صحة الأصل</span><span className={a.health >= 80 ? 'text-emerald-400' : a.health >= 50 ? 'text-amber-400' : a.health > 0 ? 'text-red-400' : 'text-gray-500'}>{a.health}%</span></div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${hColor}`} style={{ width: `${a.health}%` }} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-700/50 pt-3">
                        <div><div className="text-[11px] font-semibold text-sky-400">{a.mtbf}س</div><div className="text-[9px] text-gray-600">MTBF</div></div>
                        <div><div className="text-[11px] font-semibold text-amber-400">{a.uptime}%</div><div className="text-[9px] text-gray-600">وقت تشغيل</div></div>
                        <div><div className={`text-[11px] font-semibold ${a.relatedFaults.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{a.relatedFaults.length}</div><div className="text-[9px] text-gray-600">أعطال</div></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Summary Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{ACTIVE_FAULTS.filter(f => f.recurring).length}</div>
              <div className="text-[11px] text-gray-500 mt-1">أعطال متكررة تستوجب المراجعة الجذرية</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {Math.round(PUMPS.filter(p => p.status !== 'offline').reduce((s, p) => s + p.efficiency, 0) / PUMPS.filter(p => p.status !== 'offline').length)}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">متوسط كفاءة المضخات النشطة</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {Math.round(EQUIPMENT_HEALTH.reduce((s, e) => s + e.uptime, 0) / EQUIPMENT_HEALTH.length)}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">متوسط وقت التشغيل الفعلي</div>
            </div>
          </div>

        </div>
      )}

      {/* ═════ Asset Details Modal (always rendered) ═════ */}
      {selectedAsset && (() => {
        const a = selectedAsset;
        const statusLabel: Record<AssetStatus, string> = { active:'نشط', maintenance:'صيانة جارية', fault:'عطل نشط', offline:'خارج الخدمة' };
        const statusCls:   Record<AssetStatus, string> = {
          active:      'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
          maintenance: 'bg-amber-900/50 text-amber-300 border border-amber-700',
          fault:       'bg-red-900/50 text-red-300 border border-red-700',
          offline:     'bg-gray-800 text-gray-400 border border-gray-700',
        };
        const relFaults = ACTIVE_FAULTS.filter(f => a.relatedFaults.includes(f.id));
        const reliColor = a.reliability === 'عالية' ? 'text-emerald-400' : a.reliability === 'متوسطة' ? 'text-amber-400' : a.reliability === 'منخفضة' ? 'text-red-400' : 'text-gray-500';
        const typeColor2: Record<AssetType, string> = { 'محطة':'text-indigo-400','مضخة':'text-cyan-400','بئر':'text-blue-400','خط أنابيب':'text-emerald-400','معدة كهربائية':'text-yellow-400' };
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-12 px-4 pb-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSelectedAsset(null); }}>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-slate-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[10px] font-mono text-gray-600 bg-slate-800 px-2 py-0.5 rounded">{a.id}</span>
                    <span className={`text-[10px] font-medium ${typeColor2[a.type]}`}>{a.type}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusCls[a.status]}`}>{statusLabel[a.status]}</span>
                  </div>
                  <h2 className="text-lg font-bold text-white">{a.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500"><MapPin className="w-3 h-3" />{a.location} · {a.station}</div>
                </div>
                <button onClick={() => setSelectedAsset(null)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-gray-200 transition-colors shrink-0 mr-3"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex border-b border-slate-800 px-5">
                {([['overview','نظرة عامة'], ['history','سجل الصيانة'], ['faults','الأعطال المرتبطة']] as const).map(([id, lbl]) => (
                  <button key={id} onClick={() => setAssetTab(id)}
                    className={`px-4 py-3 text-[12px] font-medium transition-colors border-b-2 -mb-px ${assetTab === id ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    {lbl}
                    {id === 'faults' && a.relatedFaults.length > 0 && (<span className="mr-1.5 bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded-full text-[9px]">{a.relatedFaults.length}</span>)}
                  </button>
                ))}
              </div>
              {assetTab === 'overview' && (
                <div className="p-5 space-y-5">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <p className="text-[11px] text-gray-500 mb-3 font-medium">لوحة صحة الأصل</p>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative w-20 h-20 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none"
                            stroke={a.health >= 80 ? '#10b981' : a.health >= 50 ? '#f59e0b' : a.health > 0 ? '#ef4444' : '#4b5563'}
                            strokeWidth="3" strokeDasharray={`${a.health} ${100 - a.health}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-base font-bold ${a.health >= 80 ? 'text-emerald-400' : a.health >= 50 ? 'text-amber-400' : a.health > 0 ? 'text-red-400' : 'text-gray-500'}`}>{a.health}%</span>
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        {[
                          { label:'MTBF', value:`${a.mtbf} س`, color:'text-sky-400' },
                          { label:'MTTR', value:`${a.mttr} س`, color:'text-amber-400' },
                          { label:'وقت التشغيل', value:`${a.uptime}%`, color:'text-emerald-400' },
                          { label:'الموثوقية', value: a.reliability, color: reliColor },
                        ].map((k, i) => (
                          <div key={i} className="bg-slate-800/60 rounded-lg p-2.5 text-center">
                            <div className={`text-[14px] font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{k.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-500 border-t border-slate-800 pt-3">
                      <div>آخر صيانة: <span className="text-gray-300">{a.lastMaint}</span></div>
                      <div>الصيانة القادمة: <span className="text-gray-300">{a.nextMaint}</span></div>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <p className="text-[11px] text-gray-500 mb-3 font-medium flex items-center gap-1.5"><Info className="w-3 h-3" /> المواصفات الفنية</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(a.specs).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center bg-slate-800/40 rounded-lg px-3 py-2">
                          <span className="text-[11px] text-gray-500">{k}</span>
                          <span className="text-[11px] font-semibold text-gray-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {assetTab === 'history' && (
                <div className="p-5">
                  <div className="relative pr-5 space-y-0">
                    {a.maintenanceHistory.map((m, mi) => {
                      const typeStyle = m.type === 'طارئة' ? { dot:'bg-red-500', label:'bg-red-900/50 text-red-300 border border-red-800' } : m.type === 'رئيسية' ? { dot:'bg-purple-500', label:'bg-purple-900/50 text-purple-300 border border-purple-800' } : { dot:'bg-emerald-500', label:'bg-emerald-900/50 text-emerald-300 border border-emerald-800' };
                      return (
                        <div key={mi} className="relative flex gap-4">
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`w-3 h-3 rounded-full ${typeStyle.dot} mt-4 z-10 ring-2 ring-slate-950`} />
                            {mi < a.maintenanceHistory.length - 1 && <div className="w-0.5 flex-1 bg-slate-700 mt-1" />}
                          </div>
                          <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-1 ${mi < a.maintenanceHistory.length - 1 ? 'mb-3' : ''}`}>
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                              <span className="text-[11px] font-mono text-gray-500">{m.date}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${typeStyle.label}`}>{m.type}</span>
                            </div>
                            <p className="text-[12px] text-gray-200 font-medium leading-snug mb-2">{m.description}</p>
                            <div className="flex gap-4 flex-wrap text-[10px] text-gray-500">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.team}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.duration}</span>
                              <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />التكلفة: {m.cost}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {assetTab === 'faults' && (
                <div className="p-5">
                  {relFaults.length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center gap-2"><CheckCircle2 className="w-8 h-8 text-emerald-600" /><p className="text-sm text-gray-500">لا توجد أعطال مرتبطة بهذا الأصل</p></div>
                  ) : (
                    <div className="space-y-2">
                      {relFaults.map(f => (
                        <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-gray-500 bg-slate-800 px-1.5 py-0.5 rounded">{f.id}</span>
                              <SeverityBadge s={f.severity} />
                              <FaultStatusBadge s={f.status} />
                            </div>
                            <span className="text-[10px] text-gray-600">{f.detectedAt}</span>
                          </div>
                          <p className="text-[12px] text-gray-200 font-medium mb-1">{f.faultType}</p>
                          <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1"><CategoryBadge c={f.category} /></span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{f.team}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═════ Work Order Details Modal (always rendered) ═════ */}
      {selectedWO && (() => {
        const w = selectedWO;
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSelectedWO(null); }}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[11px] font-mono text-teal-400 bg-slate-800 px-2 py-0.5 rounded">{w.id}</span>
                    <SeverityBadge s={w.priority} />
                    <WOStatusBadge s={w.status} />
                  </div>
                  <h2 className="text-base font-bold text-white">{w.asset}</h2>
                </div>
                <button onClick={() => setSelectedWO(null)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-gray-200 transition-colors shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 mb-1">وصف العطل / سبب الأمر</div>
                  <p className="text-sm text-gray-200 leading-relaxed">{w.faultDesc}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-gray-500 mb-1">الإجراء الفني المقترح</div>
                    <p className="text-[12px] text-gray-200 leading-relaxed">{w.repair}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" />الفريق المكلف</div>
                    <p className="text-[13px] text-gray-200 font-semibold">{w.team}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />المدة المقدرة</div>
                    <p className="text-[13px] text-gray-200 font-semibold">{w.duration}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="text-[10px] text-gray-500 mb-1">تاريخ الإنشاء</div>
                    <p className="text-[12px] text-gray-200 font-mono">{w.generatedAt}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="text-[10px] text-gray-500 mb-1">مرجع العطل</div>
                    <p className="text-[12px] text-gray-200 font-mono">{w.faultRef}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 bg-slate-800/30 rounded-lg p-3">
                  <span>سبب الإنشاء:</span>
                  <WOTriggerBadge t={w.trigger} />
                </div>
                {/* Status Timeline */}
                <div>
                  <p className="text-[11px] text-gray-500 mb-3">مسار الحالة</p>
                  <div className="flex items-center gap-0">
                    {(['جديد', 'معتمد', 'قيد التنفيذ', 'مكتمل'] as WorkOrderStatus[]).map((step, si, arr) => {
                      const statOrder: Record<WorkOrderStatus, number> = { 'جديد':0,'معتمد':1,'قيد التنفيذ':2,'مكتمل':3 };
                      const curIdx = statOrder[w.status];
                      const isActive = si === curIdx, isPast = si < curIdx;
                      return (
                        <React.Fragment key={step}>
                          <div className={`flex flex-col items-center gap-1 ${si < arr.length - 1 ? 'flex-1' : ''}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-blue-600 border-blue-500 text-white' : isPast ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-slate-800 border-slate-700 text-gray-600'}`}>
                              {isPast ? '✓' : si + 1}
                            </div>
                            <span className={`text-[9px] text-center ${isActive ? 'text-blue-400 font-bold' : isPast ? 'text-emerald-500' : 'text-gray-600'}`}>{step}</span>
                          </div>
                          {si < arr.length - 1 && <div className={`flex-1 h-0.5 mb-4 ${isPast ? 'bg-emerald-700' : 'bg-slate-700'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
