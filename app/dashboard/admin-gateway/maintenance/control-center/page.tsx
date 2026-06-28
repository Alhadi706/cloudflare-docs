'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ComposedChart,
} from 'recharts';
import {
  ArrowRight, Activity, AlertTriangle, CheckCircle2, XCircle, Droplets,
  Gauge, Zap, TrendingDown, TrendingUp, AlertCircle, Clock, Waves,
  BarChart2, MapPin, Building2, RefreshCw, Radio, Settings, Target,
  Shield, Filter, Bell, BellOff,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
interface PumpStation {
  id: string; name: string; nameEn: string; zone: string;
  flowActual: number; flowDesign: number;
  pressureOut: number; pressureDesign: number;
  pumpsRunning: number; pumpsTotal: number;
  powerKW: number; powerDesign: number;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  efficiency: number; uptime: number;
  lastEvent?: string;
  trend: number[];
}

interface Tank {
  id: string; name: string; zone: string;
  capacity: number; level: number;
  inflow: number; outflow: number;
  minPct: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'rising' | 'stable' | 'falling';
}

interface CityNode {
  name: string; zone: string;
  consumption: number; demand: number;
  pressureBar: number; pressureDesign: number;
  coverage: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'rising' | 'stable' | 'falling';
  svgX: number; svgY: number;
}

interface PipelineSegment {
  id: string; name: string; from: string; to: string;
  diameter: number; lengthKm: number;
  flowActual: number; flowCapacity: number;
  pressureStart: number; pressureEnd: number;
  status: 'normal' | 'warning' | 'critical';
  leakSuspicion: boolean;
}

interface Alert {
  id: string; timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'ضغط' | 'تدفق' | 'جودة' | 'طاقة' | 'بنية';
  location: string; message: string;
  acknowledged: boolean;
  correlatedWith?: string[];
}

interface Incident {
  id: string; title: string;
  severity: 'critical' | 'high' | 'medium';
  alertIds: string[];
  rootCause: string; impact: string;
  actions: string[];
  affectedZone: string;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════
const STATIONS: PumpStation[] = [
  {
    id: 'NEJH_N', name: 'نجع جهمة شمالية', nameEn: 'NEJH(n)', zone: 'جنوب-غرب',
    flowActual: 8200, flowDesign: 9100,
    pressureOut: 5.8, pressureDesign: 6.5,
    pumpsRunning: 3, pumpsTotal: 4,
    powerKW: 4800, powerDesign: 4200,
    status: 'warning', efficiency: 82, uptime: 94,
    lastEvent: 'انخفاض ضغط الخط الرئيسي — 2026-05-22 07:14',
    trend: [100, 98, 96, 94, 92, 91, 90, 89, 90, 90, 90, 90],
  },
  {
    id: 'NEJH_S', name: 'نجع جهمة جنوبية', nameEn: 'NEJH(s)', zone: 'جنوب-وسط',
    flowActual: 6900, flowDesign: 6900,
    pressureOut: 6.4, pressureDesign: 6.5,
    pumpsRunning: 2, pumpsTotal: 2,
    powerKW: 3800, powerDesign: 3900,
    status: 'normal', efficiency: 100, uptime: 99,
    trend: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  },
  {
    id: 'EJH', name: 'محطة العجيلات', nameEn: 'EJH', zone: 'غرب',
    flowActual: 6900, flowDesign: 6900,
    pressureOut: 6.5, pressureDesign: 6.5,
    pumpsRunning: 4, pumpsTotal: 4,
    powerKW: 3900, powerDesign: 3900,
    status: 'normal', efficiency: 100, uptime: 100,
    trend: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  },
  {
    id: 'MISRATA', name: 'محطة مصراتة', nameEn: 'Misrata PS', zone: 'شمال-شرق',
    flowActual: 3800, flowDesign: 5000,
    pressureOut: 3.2, pressureDesign: 5.0,
    pumpsRunning: 2, pumpsTotal: 4,
    powerKW: 2200, powerDesign: 2800,
    status: 'critical', efficiency: 64, uptime: 71,
    lastEvent: 'عطل في المضخة رقم 3 — 2026-05-21 22:30',
    trend: [100, 95, 88, 80, 75, 70, 68, 66, 65, 65, 64, 64],
  },
  {
    id: 'GHARIAN', name: 'محطة غريان', nameEn: 'Gharian PS', zone: 'جبل-غرب',
    flowActual: 4400, flowDesign: 4800,
    pressureOut: 5.5, pressureDesign: 5.8,
    pumpsRunning: 3, pumpsTotal: 4,
    powerKW: 2600, powerDesign: 2700,
    status: 'normal', efficiency: 92, uptime: 97,
    trend: [98, 97, 97, 96, 96, 95, 94, 94, 93, 92, 92, 92],
  },
];

const TANKS: Tank[] = [
  { id: 'T1', name: 'خزان الجنوب الرئيسي',    zone: 'جنوب',    capacity: 50000, level: 38000, inflow: 8200,  outflow: 7500,  minPct: 25, status: 'normal',   trend: 'rising' },
  { id: 'T2', name: 'خزان طرابلس الشرقي',       zone: 'طرابلس',  capacity: 80000, level: 28000, inflow: 14000, outflow: 15800, minPct: 25, status: 'warning',  trend: 'falling' },
  { id: 'T3', name: 'خزان مصراتة',              zone: 'مصراتة',  capacity: 30000, level: 7500,  inflow: 3800,  outflow: 4500,  minPct: 20, status: 'critical', trend: 'falling' },
  { id: 'T4', name: 'خزان غريان الجبلي',        zone: 'غريان',   capacity: 40000, level: 34000, inflow: 4400,  outflow: 3900,  minPct: 30, status: 'normal',   trend: 'rising' },
  { id: 'T5', name: 'خزان زليتن',               zone: 'زليتن',   capacity: 20000, level: 14000, inflow: 1800,  outflow: 1700,  minPct: 20, status: 'normal',   trend: 'stable' },
  { id: 'T6', name: 'خزان الخمس',               zone: 'الخمس',   capacity: 15000, level: 9000,  inflow: 1100,  outflow: 900,   minPct: 20, status: 'normal',   trend: 'rising' },
];

const CITIES: CityNode[] = [
  { name: 'طرابلس',      zone: 'شمال', consumption: 415000, demand: 430000, pressureBar: 2.8, pressureDesign: 3.5, coverage: 96.5, status: 'warning',  trend: 'stable',  svgX: 260, svgY: 55 },
  { name: 'مصراتة',      zone: 'شرق',  consumption: 88000,  demand: 120000, pressureBar: 1.8, pressureDesign: 3.5, coverage: 73.3, status: 'critical', trend: 'falling', svgX: 540, svgY: 70 },
  { name: 'زليتن',       zone: 'شرق',  consumption: 28000,  demand: 30000,  pressureBar: 3.2, pressureDesign: 3.5, coverage: 93.3, status: 'normal',   trend: 'stable',  svgX: 620, svgY: 120 },
  { name: 'الخمس',       zone: 'شرق',  consumption: 19500,  demand: 20000,  pressureBar: 3.4, pressureDesign: 3.5, coverage: 97.5, status: 'normal',   trend: 'stable',  svgX: 690, svgY: 165 },
  { name: 'غريان',       zone: 'جبل',  consumption: 108000, demand: 115200, pressureBar: 3.3, pressureDesign: 3.5, coverage: 93.8, status: 'normal',   trend: 'rising',  svgX: 110, svgY: 90 },
  { name: 'ترهونة',      zone: 'جبل',  consumption: 18500,  demand: 20000,  pressureBar: 2.9, pressureDesign: 3.5, coverage: 92.5, status: 'normal',   trend: 'stable',  svgX: 200, svgY: 150 },
  { name: 'بني وليد',    zone: 'جنوب', consumption: 37000,  demand: 40000,  pressureBar: 3.1, pressureDesign: 3.5, coverage: 92.5, status: 'normal',   trend: 'stable',  svgX: 370, svgY: 165 },
  { name: 'الشروق',      zone: 'غرب',  consumption: 19000,  demand: 20000,  pressureBar: 3.5, pressureDesign: 3.5, coverage: 95.0, status: 'normal',   trend: 'stable',  svgX: 65,  svgY: 165 },
  { name: 'القروبولي',   zone: 'شرق',  consumption: 19500,  demand: 20000,  pressureBar: 3.2, pressureDesign: 3.5, coverage: 97.5, status: 'normal',   trend: 'stable',  svgX: 480, svgY: 180 },
  { name: 'سوق الخميس',  zone: 'جبل',  consumption: 18000,  demand: 20000,  pressureBar: 3.0, pressureDesign: 3.5, coverage: 90.0, status: 'warning',  trend: 'falling', svgX: 155, svgY: 225 },
  { name: 'الرابطة',     zone: 'شرق',  consumption: 4800,   demand: 5000,   pressureBar: 3.3, pressureDesign: 3.5, coverage: 96.0, status: 'normal',   trend: 'stable',  svgX: 730, svgY: 205 },
];

const PIPELINES: PipelineSegment[] = [
  { id: 'P1', name: 'الخط الرئيسي الجنوبي',    from: 'NEJH_N/S', to: 'Hub',     diameter: 1400, lengthKm: 580, flowActual: 15100, flowCapacity: 18000, pressureStart: 6.1, pressureEnd: 4.8, status: 'warning',  leakSuspicion: false },
  { id: 'P2', name: 'خط العجيلات-طرابلس',      from: 'EJH',      to: 'طرابلس',  diameter: 1200, lengthKm: 45,  flowActual: 6900,  flowCapacity: 8000,  pressureStart: 6.5, pressureEnd: 4.5, status: 'normal',   leakSuspicion: false },
  { id: 'P3', name: 'خط مصراتة الرئيسي',       from: 'Hub',      to: 'مصراتة',  diameter: 1200, lengthKm: 185, flowActual: 3800,  flowCapacity: 6000,  pressureStart: 4.8, pressureEnd: 1.8, status: 'critical', leakSuspicion: true },
  { id: 'P4', name: 'خط زليتن-الخمس',          from: 'مصراتة',  to: 'زليتن',   diameter: 800,  lengthKm: 90,  flowActual: 1800,  flowCapacity: 2200,  pressureStart: 3.2, pressureEnd: 3.0, status: 'normal',   leakSuspicion: false },
  { id: 'P5', name: 'خط غريان',                from: 'Hub',      to: 'غريان',   diameter: 1000, lengthKm: 125, flowActual: 4400,  flowCapacity: 5000,  pressureStart: 5.0, pressureEnd: 4.0, status: 'normal',   leakSuspicion: false },
  { id: 'P6', name: 'خط بني وليد',             from: 'Hub',      to: 'بني وليد', diameter: 700, lengthKm: 210, flowActual: 1850,  flowCapacity: 2500,  pressureStart: 4.5, pressureEnd: 3.1, status: 'normal',   leakSuspicion: false },
  { id: 'P7', name: 'خط طرابلس الشمالي',       from: 'Hub',      to: 'طرابلس',  diameter: 1400, lengthKm: 38,  flowActual: 22000, flowCapacity: 24000, pressureStart: 5.5, pressureEnd: 3.8, status: 'warning',  leakSuspicion: false },
  { id: 'P8', name: 'خط ترهونة',               from: 'غريان',   to: 'ترهونة',  diameter: 500,  lengthKm: 75,  flowActual: 925,   flowCapacity: 1200,  pressureStart: 3.8, pressureEnd: 2.9, status: 'normal',   leakSuspicion: false },
];

const ALERTS: Alert[] = [
  { id: 'A1', timestamp: '2026-05-22 07:14', severity: 'critical', category: 'ضغط', location: 'محطة نجع جهمة شمالية', message: 'انخفاض ضغط الخط الرئيسي من 6.5 إلى 5.8 بار — نقص في الطاقة المائية', acknowledged: false, correlatedWith: ['A2', 'A5'] },
  { id: 'A2', timestamp: '2026-05-22 07:22', severity: 'critical', category: 'تدفق', location: 'خط مصراتة الرئيسي', message: 'انخفاض التدفق إلى 63% من التصميمي — احتمال تسرب أو انسداد', acknowledged: false, correlatedWith: ['A1', 'A3'] },
  { id: 'A3', timestamp: '2026-05-22 07:30', severity: 'critical', category: 'بنية', location: 'محطة مصراتة', message: 'توقف المضخة رقم 3 — خطأ في لوحة التحكم الكهربائي', acknowledged: false, correlatedWith: ['A2'] },
  { id: 'A4', timestamp: '2026-05-22 08:10', severity: 'warning',  category: 'ضغط', location: 'شبكة طرابلس', message: 'انخفاض ضغط التوزيع في المنطقة الجنوبية من 3.5 إلى 2.8 بار', acknowledged: false, correlatedWith: ['A1'] },
  { id: 'A5', timestamp: '2026-05-22 08:15', severity: 'warning',  category: 'تدفق', location: 'خزان طرابلس الشرقي', message: 'معدل امتلاء الخزان في تراجع — مستوى 35% وهبوط بمعدل 1.5%/ساعة', acknowledged: false, correlatedWith: ['A1'] },
  { id: 'A6', timestamp: '2026-05-22 08:45', severity: 'critical', category: 'تدفق', location: 'خزان مصراتة', message: 'منسوب الخزان 25% وفي هبوط مستمر — خطر انقطاع الخدمة خلال ساعتين', acknowledged: false },
  { id: 'A7', timestamp: '2026-05-22 09:00', severity: 'warning',  category: 'طاقة', location: 'محطة نجع جهمة شمالية', message: 'ارتفاع استهلاك الطاقة +14% مع انخفاض الكفاءة إلى 82%', acknowledged: false },
  { id: 'A8', timestamp: '2026-05-22 09:20', severity: 'warning',  category: 'ضغط', location: 'سوق الخميس', message: 'انخفاض ضغط التوزيع من 3.5 إلى 3.0 بار — قد يؤثر على ساعات الإمداد', acknowledged: true },
  { id: 'A9', timestamp: '2026-05-22 09:45', severity: 'info',     category: 'جودة', location: 'محطة مصراتة', message: 'ارتفاع طفيف في العكارة (2.1 NTU) — مراقبة مطلوبة', acknowledged: true },
  { id: 'A10', timestamp: '2026-05-22 10:00', severity: 'info',    category: 'تدفق', location: 'محطة العجيلات', message: 'جميع مؤشرات الأداء ضمن النطاق المقبول', acknowledged: true },
];

const HOURLY_TREND = [
  { t: '00:00', إنتاج: 21800, استهلاك: 19200, ضغط: 6.2 },
  { t: '02:00', إنتاج: 21500, استهلاك: 18000, ضغط: 6.3 },
  { t: '04:00', إنتاج: 21800, استهلاك: 17500, ضغط: 6.4 },
  { t: '06:00', إنتاج: 22000, استهلاك: 20000, ضغط: 6.4 },
  { t: '08:00', إنتاج: 21000, استهلاك: 22000, ضغط: 5.9 },
  { t: '10:00', إنتاج: 20600, استهلاك: 22500, ضغط: 5.7 },
  { t: '12:00', إنتاج: 20600, استهلاك: 22800, ضغط: 5.6 },
];

// ═══════════════════════════════════════════════════════════════════
// ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════
function buildIncidents(alerts: Alert[]): Incident[] {
  const unack = alerts.filter(a => !a.acknowledged);
  const incidents: Incident[] = [];

  const misrataAlerts = unack.filter(a => a.correlatedWith?.includes('A2') || a.id === 'A2' || a.id === 'A3');
  if (misrataAlerts.length > 0) {
    incidents.push({
      id: 'I1',
      title: 'انقطاع جزئي في إمداد مصراتة',
      severity: 'critical',
      alertIds: ['A2', 'A3', 'A6'],
      rootCause: 'توقف المضخة رقم 3 في محطة مصراتة تسبب في انخفاض التدفق بنسبة 37% وهبوط مستمر في مستوى الخزان',
      impact: 'انخفاض مستوى خزان مصراتة إلى 25% — خطر انقطاع الخدمة عن ~88,000 مواطن خلال ساعتين',
      actions: [
        'تشغيل المضخة الاحتياطية رقم 4 فوراً',
        'فتح صمام التغذية من خط مصراتة إلى أقصى طاقة',
        'إرسال فريق طوارئ لمحطة مصراتة',
        'إشعار مركز إدارة الشبكة بتشغيل التغذية الاحتياطية',
        'تحديد خطوط الطوارئ للأحياء ذات الأولوية',
      ],
      affectedZone: 'مصراتة',
      confidence: 96,
    });
  }

  const pressureAlerts = unack.filter(a => a.id === 'A1' || a.id === 'A4' || a.id === 'A5');
  if (pressureAlerts.length > 0) {
    incidents.push({
      id: 'I2',
      title: 'اضطراب في ضغط الشبكة الرئيسية',
      severity: 'high',
      alertIds: ['A1', 'A4', 'A5'],
      rootCause: 'انخفاض أداء محطة NEJH(n) بسبب تشغيل 3 مضخات فقط من أصل 4 مما قلّل الطاقة المائية في الخط الرئيسي',
      impact: 'انخفاض ضغط طرابلس الجنوبية بنسبة 20% — احتمال تأثر ساعات الإمداد في بعض المناطق',
      actions: [
        'التحقق من حالة المضخة الرابعة في NEJH(n)',
        'رفع معدل تشغيل NEJH(s) لتعويض النقص',
        'فتح صمامات الخط الاحتياطي من EJH إلى طرابلس',
        'مراقبة مستوى خزان طرابلس الشرقي كل 30 دقيقة',
      ],
      affectedZone: 'طرابلس والشبكة الرئيسية',
      confidence: 88,
    });
  }

  return incidents;
}

function predictCriticalEvents(tanks: Tank[]) {
  return tanks.map(t => {
    const fillPct = Math.round((t.level / t.capacity) * 100);
    const netFlow = t.inflow - t.outflow; // m³/h
    if (netFlow < -50 && fillPct < 40) {
      const hoursToMin = Math.round(((fillPct - t.minPct) / 100 * t.capacity) / Math.abs(netFlow));
      return { tank: t, fillPct, prediction: `هبوط للمستوى الحرج خلال ${hoursToMin} ساعة`, severity: hoursToMin < 3 ? 'critical' : 'warning' as const };
    }
    return { tank: t, fillPct, prediction: null, severity: 'info' as const };
  });
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════
function StatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'xs' }) {
  const c = {
    normal:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20  text-amber-300  border-amber-500/30',
    critical:'bg-red-500/20    text-red-300    border-red-500/30',
    offline: 'bg-slate-700     text-slate-400  border-slate-600',
  }[status] || 'bg-slate-700 text-slate-400 border-slate-600';
  const lbl = { normal: 'طبيعي', warning: 'تحذير', critical: 'حرج', offline: 'معطل' }[status] || status;
  return <span className={`border rounded-full font-medium ${size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} ${c}`}>{lbl}</span>;
}

function TankGauge({ tank }: { tank: Tank }) {
  const fillPct = Math.round((tank.level / tank.capacity) * 100);
  const netFlow = tank.inflow - tank.outflow;
  const statusColor = tank.status === 'critical' ? '#ef4444' : tank.status === 'warning' ? '#f59e0b' : '#10b981';
  const barColor   = fillPct < 25 ? 'bg-red-500' : fillPct < 50 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{tank.name}</div>
          <div className="text-xs text-slate-500">{tank.zone}</div>
        </div>
        <StatusPill status={tank.status} size="xs" />
      </div>
      <div className="flex items-end gap-3 mb-2">
        <div className="relative w-10 h-20 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden shrink-0">
          <div
            className={`absolute bottom-0 w-full transition-all ${barColor}`}
            style={{ height: `${fillPct}%`, opacity: 0.8 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white drop-shadow">{fillPct}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">السعة</span>
            <span className="text-slate-300 font-mono">{(tank.capacity / 1000).toFixed(0)}k م³</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">المستوى</span>
            <span className="text-slate-200 font-mono">{(tank.level / 1000).toFixed(1)}k م³</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">التدفق الصافي</span>
            <span className={`font-mono font-bold ${netFlow > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netFlow > 0 ? '+' : ''}{netFlow} م³/س
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {tank.trend === 'rising'  ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />  :
             tank.trend === 'falling' ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />    :
             <Activity className="w-3.5 h-3.5 text-slate-400" />}
            <span className="text-slate-400">
              {tank.trend === 'rising' ? 'في ارتفاع' : tank.trend === 'falling' ? 'في هبوط' : 'مستقر'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SVG NETWORK DIAGRAM
// ═══════════════════════════════════════════════════════════════════
function NetworkDiagram({ cities, pipelines, stations }: {
  cities: CityNode[]; pipelines: PipelineSegment[]; stations: PumpStation[];
}) {
  const W = 800, H = 480;
  // Hub position
  const HUB = { x: 380, y: 270 };
  // Stations
  const stPos: Record<string, { x: number; y: number }> = {
    NEJH_N:  { x: 160, y: 410 },
    NEJH_S:  { x: 340, y: 430 },
    EJH:     { x: 120, y: 340 },
    MISRATA: { x: 580, y: 370 },
    GHARIAN: { x: 220, y: 360 },
  };

  const lineColor = (s: PipelineSegment) =>
    s.status === 'critical' ? '#ef4444' : s.status === 'warning' ? '#f59e0b' : '#10b981';
  const cityColor = (c: CityNode) =>
    c.status === 'critical' ? '#ef4444' : c.status === 'warning' ? '#f59e0b' : '#10b981';
  const stColor = (s: PumpStation) =>
    s.status === 'critical' ? '#ef4444' : s.status === 'warning' ? '#f59e0b' : s.status === 'offline' ? '#6b7280' : '#10b981';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ maxHeight: 380 }}>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" fillOpacity="0.6" />
        </marker>
        <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
        </marker>
        <marker id="arrowAmber" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background grid */}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`hg${i}`} x1="0" y1={i * 48} x2={W} y2={i * 48} stroke="#1e293b" strokeWidth="1" />
      ))}
      {Array.from({ length: 17 }, (_, i) => (
        <line key={`vg${i}`} x1={i * 50} y1="0" x2={i * 50} y2={H} stroke="#1e293b" strokeWidth="1" />
      ))}

      {/* Zone labels */}
      <text x="15" y="25" fill="#334155" fontSize="11" fontFamily="monospace">شمال</text>
      <text x="15" y="200" fill="#334155" fontSize="11" fontFamily="monospace">وسط</text>
      <text x="15" y="380" fill="#334155" fontSize="11" fontFamily="monospace">جنوب</text>

      {/* ── Pipelines ── */}
      {/* NEJH_N → Hub */}
      <line x1={stPos.NEJH_N.x} y1={stPos.NEJH_N.y} x2={HUB.x} y2={HUB.y}
        stroke="#f59e0b" strokeWidth="3" strokeDasharray="8 3" markerEnd="url(#arrowAmber)" opacity="0.8" />
      {/* NEJH_S → Hub */}
      <line x1={stPos.NEJH_S.x} y1={stPos.NEJH_S.y} x2={HUB.x} y2={HUB.y}
        stroke="#10b981" strokeWidth="3" strokeDasharray="8 3" markerEnd="url(#arrow)" opacity="0.8" />
      {/* EJH → Hub */}
      <line x1={stPos.EJH.x} y1={stPos.EJH.y} x2={HUB.x} y2={HUB.y}
        stroke="#10b981" strokeWidth="3" strokeDasharray="8 3" markerEnd="url(#arrow)" opacity="0.8" />
      {/* GHARIAN → Hub */}
      <line x1={stPos.GHARIAN.x} y1={stPos.GHARIAN.y} x2={HUB.x} y2={HUB.y}
        stroke="#10b981" strokeWidth="2.5" strokeDasharray="6 3" markerEnd="url(#arrow)" opacity="0.8" />
      {/* Hub → طرابلس */}
      <line x1={HUB.x} y1={HUB.y} x2={260} y2={55}
        stroke="#f59e0b" strokeWidth="4" markerEnd="url(#arrowAmber)" opacity="0.9" />
      {/* Hub → مصراتة (critical) */}
      <line x1={HUB.x} y1={HUB.y} x2={540} y2={70}
        stroke="#ef4444" strokeWidth="3.5" markerEnd="url(#arrowRed)" opacity="0.9" />
      {/* Hub → غريان */}
      <line x1={HUB.x} y1={HUB.y} x2={110} y2={90}
        stroke="#10b981" strokeWidth="2.5" markerEnd="url(#arrow)" opacity="0.8" />
      {/* Hub → بني وليد */}
      <line x1={HUB.x} y1={HUB.y} x2={370} y2={165}
        stroke="#10b981" strokeWidth="2.5" markerEnd="url(#arrow)" opacity="0.8" />
      {/* مصراتة → زليتن */}
      <line x1={540} y1={70} x2={620} y2={120}
        stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)" opacity="0.7" />
      {/* زليتن → الخمس */}
      <line x1={620} y1={120} x2={690} y2={165}
        stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)" opacity="0.7" />
      {/* غريان → ترهونة */}
      <line x1={110} y1={90} x2={200} y2={150}
        stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)" opacity="0.7" />
      {/* EJH → الشروق */}
      <line x1={stPos.EJH.x} y1={stPos.EJH.y} x2={65} y2={165}
        stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)" opacity="0.7" />
      {/* Hub → سوق الخميس (warning) */}
      <line x1={HUB.x} y1={HUB.y} x2={155} y2={225}
        stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 3" markerEnd="url(#arrowAmber)" opacity="0.7" />
      {/* Hub → القروبولي */}
      <line x1={HUB.x} y1={HUB.y} x2={480} y2={180}
        stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)" opacity="0.7" />
      {/* الخمس → الرابطة */}
      <line x1={690} y1={165} x2={730} y2={205}
        stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.7" />

      {/* ── Distribution Hub ── */}
      <circle cx={HUB.x} cy={HUB.y} r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" filter="url(#glow)" />
      <circle cx={HUB.x} cy={HUB.y} r="15" fill="#0ea5e9" fillOpacity="0.2" />
      <text x={HUB.x} y={HUB.y + 4} textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">HUB</text>
      <text x={HUB.x} y={HUB.y + 36} textAnchor="middle" fill="#64748b" fontSize="9">محطة التوزيع</text>

      {/* ── Pump Stations ── */}
      {Object.entries(stPos).map(([id, pos]) => {
        const st = stations.find(s => s.id === id);
        if (!st) return null;
        const col = stColor(st);
        return (
          <g key={id}>
            <rect x={pos.x - 20} y={pos.y - 13} width="40" height="26" rx="5"
              fill="#0f172a" stroke={col} strokeWidth="2" />
            <circle cx={pos.x - 8} cy={pos.y} r="4" fill={col} opacity="0.8" />
            <circle cx={pos.x + 4} cy={pos.y} r="4" fill={st.pumpsRunning >= st.pumpsTotal ? col : '#374151'} opacity="0.8" />
            <circle cx={pos.x + 14} cy={pos.y} r="3.5" fill={st.pumpsRunning > st.pumpsTotal * 0.5 ? col : '#374151'} opacity="0.7" />
            <text x={pos.x} y={pos.y + 22} textAnchor="middle" fill="#94a3b8" fontSize="9">{st.nameEn}</text>
          </g>
        );
      })}

      {/* ── MISRATA station ── */}
      {(() => {
        const pos = stPos.MISRATA;
        const st = stations.find(s => s.id === 'MISRATA')!;
        const col = stColor(st);
        return (
          <g>
            <rect x={pos.x - 20} y={pos.y - 13} width="40" height="26" rx="5"
              fill="#0f172a" stroke={col} strokeWidth="2" />
            <line x1={pos.x} y1={pos.y - 13} x2={pos.x} y2={pos.y + 13} stroke={col} strokeWidth="1" opacity="0.5" />
            <text x={pos.x} y={pos.y + 22} textAnchor="middle" fill="#94a3b8" fontSize="9">Misrata PS</text>
            {/* Link to hub */}
            <line x1={pos.x} y1={pos.y} x2={540} y2={70}
              stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" opacity="0.6" />
            {/* Misrata → مصراتة city */}
            <line x1={pos.x} y1={pos.y} x2={HUB.x} y2={HUB.y}
              stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" opacity="0.4" />
          </g>
        );
      })()}

      {/* ── Cities ── */}
      {cities.map(c => {
        const col = cityColor(c);
        const r = c.name === 'طرابلس' ? 14 : c.name === 'مصراتة' || c.name === 'غريان' ? 11 : 8;
        return (
          <g key={c.name}>
            <circle cx={c.svgX} cy={c.svgY} r={r + 4} fill={col} fillOpacity="0.1" />
            <circle cx={c.svgX} cy={c.svgY} r={r} fill="#0f172a" stroke={col} strokeWidth="2" />
            <text x={c.svgX} y={c.svgY + 4} textAnchor="middle" fill={col} fontSize={c.name === 'طرابلس' ? '9' : '8'} fontWeight="bold">
              {c.name === 'طرابلس' ? 'طرابلس' : c.name === 'مصراتة' ? 'مصراتة' : c.name.length > 4 ? c.name.slice(0, 4) : c.name}
            </text>
            <text x={c.svgX} y={c.svgY + r + 12} textAnchor="middle" fill="#64748b" fontSize="8">
              {Math.round(c.coverage)}%
            </text>
          </g>
        );
      })}

      {/* ── Legend ── */}
      <g transform="translate(620, 420)">
        <rect x="0" y="0" width="165" height="52" rx="6" fill="#0f172a" fillOpacity="0.9" stroke="#1e293b" />
        <line x1="10" y1="14" x2="30" y2="14" stroke="#10b981" strokeWidth="2" />
        <text x="35" y="17" fill="#94a3b8" fontSize="9">تشغيل طبيعي</text>
        <line x1="10" y1="28" x2="30" y2="28" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 3" />
        <text x="35" y="31" fill="#94a3b8" fontSize="9">تحذير / انخفاض</text>
        <line x1="10" y1="42" x2="30" y2="42" stroke="#ef4444" strokeWidth="2" />
        <text x="35" y="45" fill="#94a3b8" fontSize="9">حرج / عطل</text>
        <circle cx="95" cy="14" r="5" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
        <text x="105" y="17" fill="#94a3b8" fontSize="9">مدينة</text>
        <rect x="88" y="22" width="14" height="10" rx="2" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
        <text x="105" y="31" fill="#94a3b8" fontSize="9">محطة</text>
        <circle cx="95" cy="43" r="6" fill="#0ea5e9" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="105" y="46" fill="#94a3b8" fontSize="9">توزيع</text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function ControlCenterPage() {
  const [tab, setTab] = useState<'dashboard' | 'stations' | 'network' | 'analysis' | 'alerts'>('dashboard');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'unack'>('all');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [opsSummary, setOpsSummary] = useState<Record<string,any> | null>(null);

  useEffect(() => {
    fetch('/api/v1/ops-summary')
      .then(r => r.json())
      .then(d => setOpsSummary(d))
      .catch(() => {});
  }, []);

  const incidents = useMemo(() => buildIncidents(ALERTS), []);
  const tankPredictions = useMemo(() => predictCriticalEvents(TANKS), []);

  const totalFlow       = STATIONS.reduce((s, st) => s + st.flowActual, 0);
  const totalDesignFlow = STATIONS.reduce((s, st) => s + st.flowDesign, 0);
  const totalConsumption = CITIES.reduce((s, c) => s + c.consumption, 0);
  const nrwPct = Math.round(((totalFlow * 24 - totalConsumption) / (totalFlow * 24)) * 100);
  const avgPressure = +(CITIES.reduce((s, c) => s + c.pressureBar, 0) / CITIES.length).toFixed(1);
  const critAlerts  = ALERTS.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const activeStations = STATIONS.filter(s => s.status !== 'offline').length;

  const filteredAlerts = ALERTS.filter(a => {
    if (alertFilter === 'unack') return !a.acknowledged;
    if (alertFilter === 'all') return true;
    return a.severity === alertFilter;
  });

  const distributionData = CITIES.map(c => ({
    name: c.name, فعلي: c.consumption, طلب: c.demand, تغطية: c.coverage,
  })).sort((a, b) => b.طلب - a.طلب);

  const pressureData = CITIES.map(c => ({
    name: c.name, ضغط: c.pressureBar, تصميمي: c.pressureDesign,
  }));

  const TABS = [
    { key: 'dashboard',  label: 'لوحة التحكم',       icon: <Radio className="w-4 h-4" /> },
    { key: 'stations',   label: 'المحطات والخزانات', icon: <Settings className="w-4 h-4" /> },
    { key: 'network',    label: 'شبكة التوزيع',      icon: <Waves className="w-4 h-4" /> },
    { key: 'analysis',   label: 'الذكاء التشغيلي',   icon: <Target className="w-4 h-4" /> },
    { key: 'alerts',     label: 'التنبيهات',          icon: <Bell className="w-4 h-4" /> },
  ] as const;

  const sevColor  = (s: Alert['severity']) => s === 'critical' ? 'border-red-500/40 bg-red-500/10' : s === 'warning' ? 'border-amber-500/40 bg-amber-500/10' : 'border-blue-500/40 bg-blue-500/10';
  const sevText   = (s: Alert['severity']) => s === 'critical' ? 'text-red-400' : s === 'warning' ? 'text-amber-400' : 'text-blue-400';
  const catColor  = (c: Alert['category']) => ({
    'ضغط': 'bg-violet-500/20 text-violet-300', 'تدفق': 'bg-cyan-500/20 text-cyan-300',
    'جودة': 'bg-green-500/20 text-green-300', 'طاقة': 'bg-yellow-500/20 text-yellow-300', 'بنية': 'bg-orange-500/20 text-orange-300',
  }[c]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div>
          <Link href="/dashboard/admin-gateway/maintenance"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-3">
            <ArrowRight className="w-4 h-4" />إدارة الهندسة والدعم الفني
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <div className="relative">
                  <Radio className="w-7 h-7 text-cyan-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                </div>
                مركز التحكم التشغيلي
              </h1>
              <p className="text-slate-400 text-sm mt-1">مراقبة لحظية لمنظومة المياه — {STATIONS.length} محطات · {TANKS.length} خزانات · {CITIES.length} مدينة</p>
            </div>
            <div className="flex items-center gap-3">
              {critAlerts > 0 && (
                <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-3 py-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-red-300 text-sm font-bold">{critAlerts} تنبيه حرج</span>
                </div>
              )}
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                {new Date().toLocaleTimeString('ar-LY')}
              </div>
            </div>
          </div>
        </div>

        <InternalMailTab
          department="control"
          title="المراسلات الداخلية - مدير مركز التحكم"
        />

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'إجمالي التدفق',    val: `${(totalFlow / 1000).toFixed(1)}k`,  unit: 'م³/س',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',     icon: <Droplets className="w-5 h-5 text-cyan-400" /> },
            { label: 'تغطية التصميمي',   val: `${Math.round((totalFlow / totalDesignFlow) * 100)}`, unit: '%', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: <Target className="w-5 h-5 text-blue-400" /> },
            { label: 'متوسط الضغط',      val: avgPressure, unit: 'بار',  color: avgPressure < 3.0 ? 'text-amber-400' : 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <Gauge className="w-5 h-5 text-emerald-400" /> },
            { label: 'الفاقد المائي',     val: nrwPct > 0 ? nrwPct : 0, unit: '%',   color: nrwPct > 25 ? 'text-red-400' : nrwPct > 15 ? 'text-amber-400' : 'text-emerald-400', bg: 'bg-slate-800 border-slate-700', icon: <TrendingDown className="w-5 h-5 text-slate-400" /> },
            { label: 'محطات نشطة',       val: activeStations, unit: `/ ${STATIONS.length}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
            { label: 'تنبيهات نشطة',     val: ALERTS.filter(a => !a.acknowledged).length, unit: 'تنبيه', color: critAlerts > 0 ? 'text-red-400' : 'text-amber-400', bg: critAlerts > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20', icon: <AlertCircle className="w-5 h-5 text-red-400" /> },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
              <div className="flex items-center justify-between mb-2">{k.icon}<span className="text-xs text-slate-500">{k.label}</span></div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.val}<span className="text-sm font-normal text-slate-400 mr-1">{k.unit}</span></div>
            </div>
          ))}
        </div>

        {/* ══ Live Engine Network Data (Real DB) ══ */}
        {opsSummary && (
          <div className="bg-slate-900 border border-cyan-900/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">بيانات الشبكة الحية — تقارير آخر تحديث</h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">بيانات حقيقية</span>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {opsSummary.wells && (
                <div className="bg-slate-800 rounded-xl p-3 border border-cyan-800/40">
                  <div className="text-[10px] text-cyan-400 font-bold mb-2 flex items-center gap-1">
                    <Droplets className="w-3 h-3" /> محرك 1 — حقل الآبار والمضخات
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">إجمالي التدفق</span><span className="text-cyan-300 font-mono">{Number(opsSummary.wells.total_avg_flow).toLocaleString()} م³/يوم</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">EJH</span><span className="text-cyan-400 font-mono">{Number(opsSummary.wells.ejh_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">NEJH-S</span><span className="text-violet-400 font-mono">{Number(opsSummary.wells.nejhs_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">NEJH-N</span><span className="text-emerald-400 font-mono">{Number(opsSummary.wells.nejhn_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">الآبار العاملة</span><span className="text-white font-mono">{opsSummary.wells.avg_total_wells}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">خزان فزان</span><span className="text-amber-400 font-mono">{opsSummary.wells.fezzan_avg_level} م</span></div>
                  </div>
                </div>
              )}
              {opsSummary.eastern && (
                <div className="bg-slate-800 rounded-xl p-3 border border-blue-800/40">
                  <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> محرك 2 — الفرع الشرقي
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">سيدي سايح</span><span className="text-blue-300 font-mono">{Number(opsSummary.eastern.sidi_saiah_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">المطار</span><span className="text-blue-400 font-mono">{Number(opsSummary.eastern.airport_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">وادي تميلاح</span><span className="text-blue-400 font-mono">{Number(opsSummary.eastern.wadi_tumallah_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">الشويرف</span><span className="text-blue-400 font-mono">{Number(opsSummary.eastern.ash_shwayrif_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">منسوب سيدي سايح</span><span className="text-amber-400 font-mono">{opsSummary.eastern.sidi_saiah_avg_level} م</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ضغط عين زارة</span><span className="text-slate-300 font-mono">{opsSummary.eastern.aen_zara_avg_pressure} bar</span></div>
                  </div>
                </div>
              )}
              {opsSummary.central && (
                <div className="bg-slate-800 rounded-xl p-3 border border-emerald-800/40">
                  <div className="text-[10px] text-emerald-400 font-bold mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> محرك 3 — الفرع الوسطي
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">التوصيلات المتقاطعة</span><span className="text-emerald-300 font-mono">{Number(opsSummary.central.cross_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">سيدي سليم</span><span className="text-emerald-400 font-mono">{Number(opsSummary.central.sidi_sied_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ترهونة</span><span className="text-emerald-400 font-mono">{Number(opsSummary.central.tarhunah_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">الشويرف (وسط)</span><span className="text-emerald-400 font-mono">{Number(opsSummary.central.ash_shwayrif_avg_flow).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">منسوب سيدي سليم</span><span className="text-amber-400 font-mono">{opsSummary.central.sidi_sied_avg_level} م</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">منسوب ترهونة</span><span className="text-amber-400 font-mono">{opsSummary.central.tarhunah_avg_level} م</span></div>
                  </div>
                </div>
              )}
              {opsSummary.taz && (
                <div className="bg-slate-800 rounded-xl p-3 border border-amber-800/40">
                  <div className="text-[10px] text-amber-400 font-bold mb-2 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> محرك 4 — TAZ (غريان)
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">محطة PS1</span><span className="text-amber-300 font-mono">{Number(opsSummary.taz.ps1_avg_pumping).toLocaleString()} م³</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">محطة PS2</span><span className="text-amber-300 font-mono">{Number(opsSummary.taz.ps2_avg_pumping).toLocaleString()} م³</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ضغط PS1/PS2</span><span className="text-blue-400 font-mono">{opsSummary.taz.ps1_avg_pressure}/{opsSummary.taz.ps2_avg_pressure} bar</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">استهلاك غريان</span><span className="text-slate-300 font-mono">{Number(opsSummary.taz.gharyan_avg_consumption).toLocaleString()} م³</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">خزان A/B/C</span><span className="text-slate-400 font-mono">{opsSummary.taz.tank_a_avg}/{opsSummary.taz.tank_b_avg}/{opsSummary.taz.tank_c_avg} م</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">خزان D/E</span><span className="text-slate-400 font-mono">{opsSummary.taz.tank_d_avg}/{opsSummary.taz.tank_e_avg} م</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              {t.icon}{t.label}
              {t.key === 'alerts' && critAlerts > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 font-bold">{critAlerts}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════ DASHBOARD TAB ══════════════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Network diagram */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">خريطة شبكة التوزيع — حالة لحظية</h3>
                  <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>طبيعي</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>تحذير</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>حرج</span>
                  </div>
                </div>
                <NetworkDiagram cities={CITIES} pipelines={PIPELINES} stations={STATIONS} />
              </div>

              {/* Live alerts */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  التنبيهات النشطة
                </h3>
                <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: 360 }}>
                  {ALERTS.filter(a => !a.acknowledged).map(a => (
                    <div key={a.id} className={`rounded-lg p-2.5 border ${sevColor(a.severity)}`}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${sevText(a.severity)}`} />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${catColor(a.category)}`}>{a.category}</span>
                            <span className="text-xs text-slate-400 font-mono">{a.timestamp.split(' ')[1]}</span>
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5 font-medium">{a.location}</div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{a.message}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hourly trend */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">التدفق الساعي — آخر 12 ساعة (م³/ساعة)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={HOURLY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis yAxisId="flow" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="pressure" orientation="left" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[4, 7]} hide />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="flow" type="monotone" dataKey="إنتاج"   stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} strokeWidth={2} />
                  <Area yAxisId="flow" type="monotone" dataKey="استهلاك" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                  <ReferenceLine yAxisId="flow" y={totalDesignFlow} stroke="#f59e0b" strokeDasharray="4 4"
                    label={{ value: 'الطاقة التصميمية', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* City coverage cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {CITIES.sort((a, b) => b.demand - a.demand).map(c => (
                <div key={c.name} className={`rounded-lg border p-2.5 text-center ${c.status === 'critical' ? 'border-red-500/30 bg-red-500/5' : c.status === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-900'}`}>
                  <div className="text-sm font-bold text-white mb-1">{c.name}</div>
                  <div className={`text-lg font-bold ${c.coverage < 80 ? 'text-red-400' : c.coverage < 90 ? 'text-amber-400' : 'text-emerald-400'}`}>{c.coverage}%</div>
                  <div className="text-[10px] text-slate-500">{(c.consumption / 1000).toFixed(0)}k م³/يوم</div>
                  <div className="text-[10px] text-slate-600">{c.pressureBar} بار</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════ STATIONS TAB ══════════════════ */}
        {tab === 'stations' && (
          <div className="space-y-5">
            {/* Stations table */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200">محطات الضخ الرئيسية</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-800">
                      <th className="text-right px-4 py-3">المحطة</th>
                      <th className="text-center px-3 py-3">الحالة</th>
                      <th className="text-center px-3 py-3">التدفق الفعلي<br/><span className="text-slate-600">م³/س</span></th>
                      <th className="text-center px-3 py-3">التصميمي<br/><span className="text-slate-600">م³/س</span></th>
                      <th className="text-center px-3 py-3">الأداء</th>
                      <th className="text-center px-3 py-3">الضغط<br/><span className="text-slate-600">بار</span></th>
                      <th className="text-center px-3 py-3">المضخات</th>
                      <th className="text-center px-3 py-3">الطاقة<br/><span className="text-slate-600">كW</span></th>
                      <th className="text-center px-3 py-3">الكفاءة</th>
                      <th className="text-center px-3 py-3">تشغيل 30 يوم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {STATIONS.map(st => {
                      const pct = Math.round((st.flowActual / st.flowDesign) * 100);
                      return (
                        <tr key={st.id} className={`hover:bg-slate-800/40 transition-colors ${st.status === 'critical' ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white text-sm">{st.name}</div>
                            <div className="text-xs text-slate-500">{st.nameEn} · {st.zone}</div>
                            {st.lastEvent && <div className="text-[10px] text-slate-600 mt-0.5">{st.lastEvent}</div>}
                          </td>
                          <td className="px-3 py-3 text-center"><StatusPill status={st.status} /></td>
                          <td className="px-3 py-3 text-center font-mono text-cyan-400 font-bold">{st.flowActual.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center font-mono text-slate-400">{st.flowDesign.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center">
                            <div className={`text-sm font-bold ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</div>
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto mt-1">
                              <div className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </td>
                          <td className={`px-3 py-3 text-center font-mono ${st.pressureOut < st.pressureDesign * 0.9 ? 'text-amber-400' : 'text-emerald-400'}`}>{st.pressureOut}</td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {Array.from({ length: st.pumpsTotal }).map((_, i) => (
                                <div key={i} className={`w-3 h-3 rounded-full ${i < st.pumpsRunning ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                              ))}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{st.pumpsRunning}/{st.pumpsTotal}</div>
                          </td>
                          <td className={`px-3 py-3 text-center font-mono text-sm ${st.powerKW > st.powerDesign * 1.1 ? 'text-red-400' : 'text-slate-300'}`}>{st.powerKW.toLocaleString()}</td>
                          <td className={`px-3 py-3 text-center font-bold text-sm ${st.efficiency >= 90 ? 'text-emerald-400' : st.efficiency >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{st.efficiency}%</td>
                          <td className="px-3 py-3 text-center">
                            <div className={`text-sm font-bold ${st.uptime >= 95 ? 'text-emerald-400' : st.uptime >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{st.uptime}%</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tanks */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">الخزانات الرئيسية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {TANKS.map(t => <TankGauge key={t.id} tank={t} />)}
              </div>
            </div>

            {/* Station flow comparison */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">مقارنة التدفق: فعلي مقابل تصميمي (م³/ساعة)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={STATIONS.map(s => ({ name: s.nameEn, فعلي: s.flowActual, تصميمي: s.flowDesign }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="تصميمي" fill="#1e3a5f" radius={[4,4,0,0]} />
                  <Bar dataKey="فعلي"   fill="#0ea5e9" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══════════════════ NETWORK TAB ══════════════════ */}
        {tab === 'network' && (
          <div className="space-y-5">
            {/* Pressure heatmap */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">خريطة الضغوط بالمدن (بار)</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {CITIES.sort((a, b) => b.pressureBar - a.pressureBar).map(c => {
                  const ratio = c.pressureBar / c.pressureDesign;
                  const bg = ratio >= 0.9 ? 'bg-emerald-900/40 border-emerald-500/30' : ratio >= 0.75 ? 'bg-amber-900/40 border-amber-500/30' : 'bg-red-900/40 border-red-500/30';
                  const tc = ratio >= 0.9 ? 'text-emerald-300' : ratio >= 0.75 ? 'text-amber-300' : 'text-red-300';
                  return (
                    <div key={c.name} className={`rounded-xl border p-3 text-center ${bg}`}>
                      <div className="text-xs font-medium text-slate-300 mb-1">{c.name}</div>
                      <div className={`text-2xl font-bold ${tc}`}>{c.pressureBar}</div>
                      <div className="text-[10px] text-slate-500">/ {c.pressureDesign} بار</div>
                      <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${ratio >= 0.9 ? 'bg-emerald-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipelines */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200">حالة خطوط الأنابيب الرئيسية</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-800">
                      <th className="text-right px-4 py-3">الخط</th>
                      <th className="text-center px-3 py-3">القطر / الطول</th>
                      <th className="text-center px-3 py-3">التدفق الفعلي</th>
                      <th className="text-center px-3 py-3">الطاقة القصوى</th>
                      <th className="text-center px-3 py-3">تحميل الخط</th>
                      <th className="text-center px-3 py-3">ضغط (بداية/نهاية)</th>
                      <th className="text-center px-3 py-3">الحالة</th>
                      <th className="text-center px-3 py-3">تسرب محتمل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {PIPELINES.map(p => {
                      const loadPct = Math.round((p.flowActual / p.flowCapacity) * 100);
                      return (
                        <tr key={p.id} className={`hover:bg-slate-800/40 transition-colors ${p.status === 'critical' ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white text-sm">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.from} → {p.to}</div>
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-mono text-slate-400">
                            <div>{p.diameter}mm</div>
                            <div className="text-slate-600">{p.lengthKm} كم</div>
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-cyan-400 font-bold">{p.flowActual.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center font-mono text-slate-400">{p.flowCapacity.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center">
                            <div className={`text-sm font-bold ${loadPct >= 90 ? 'text-red-400' : loadPct >= 75 ? 'text-amber-400' : 'text-emerald-400'}`}>{loadPct}%</div>
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto mt-1">
                              <div className={`h-full rounded-full ${loadPct >= 90 ? 'bg-red-500' : loadPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(loadPct, 100)}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-mono">
                            <span className="text-emerald-400">{p.pressureStart}</span>
                            <span className="text-slate-600 mx-1">→</span>
                            <span className={p.pressureEnd < 2.5 ? 'text-red-400' : p.pressureEnd < 3.5 ? 'text-amber-400' : 'text-emerald-400'}>{p.pressureEnd}</span>
                          </td>
                          <td className="px-3 py-3 text-center"><StatusPill status={p.status} /></td>
                          <td className="px-3 py-3 text-center">
                            {p.leakSuspicion ? (
                              <span className="text-xs text-red-400 flex items-center justify-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />محتمل
                              </span>
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">استهلاك المدن: فعلي مقابل الطلب (م³/يوم)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={distributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={65} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} م³/يوم`]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="طلب" fill="#1e3a5f" radius={[0,4,4,0]} />
                    <Bar dataKey="فعلي" fill="#10b981" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">الضغط عند نقاط الإمداد (بار)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pressureData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 5]} unit=" bar" />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                    <ReferenceLine y={3.5} stroke="#22d3ee" strokeDasharray="4 4" label={{ value: 'تصميمي', fill: '#22d3ee', fontSize: 9, position: 'insideTopRight' }} />
                    <ReferenceLine y={2.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'حرج', fill: '#ef4444', fontSize: 9, position: 'insideBottomRight' }} />
                    <Bar dataKey="ضغط" fill="#0ea5e9" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ ANALYSIS TAB ══════════════════ */}
        {tab === 'analysis' && (
          <div className="space-y-5">
            {/* Incidents */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">الأحداث المرتبطة — تحليل الأسباب الجذرية</h3>
              <div className="space-y-3">
                {incidents.map(inc => (
                  <div key={inc.id} className={`bg-slate-900 border rounded-xl p-4 ${inc.severity === 'critical' ? 'border-red-500/40' : inc.severity === 'high' ? 'border-amber-500/40' : 'border-blue-500/40'}`}>
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${inc.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <h4 className="font-bold text-white">{inc.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${inc.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                          {inc.severity === 'critical' ? 'حرج' : 'عالي'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">المنطقة المتأثرة:</span>
                        <span className="text-slate-300 font-medium">{inc.affectedZone}</span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-500">ثقة التحليل:</span>
                        <span className={`font-bold ${inc.confidence > 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{inc.confidence}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-slate-500 text-xs mb-1.5 font-medium flex items-center gap-1"><Target className="w-3.5 h-3.5"/>السبب الجذري</div>
                        <p className="text-slate-300 text-xs leading-relaxed">{inc.rootCause}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-slate-500 text-xs mb-1.5 font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/>التأثير</div>
                        <p className="text-slate-300 text-xs leading-relaxed">{inc.impact}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-slate-500 text-xs mb-1.5 font-medium flex items-center gap-1"><Shield className="w-3.5 h-3.5"/>الإجراءات المقترحة</div>
                        <ol className="space-y-0.5">
                          {inc.actions.map((a, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                              <span className="text-cyan-500 font-bold shrink-0">{i + 1}.</span>{a}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {inc.alertIds.map(aid => {
                        const al = ALERTS.find(a => a.id === aid);
                        return al ? (
                          <span key={aid} className={`text-[10px] px-2 py-0.5 rounded-full border ${sevColor(al.severity)}`}>
                            {al.location}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictions */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">التوقعات التشغيلية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {tankPredictions.filter(p => p.prediction).map(({ tank, fillPct, prediction, severity }) => (
                  <div key={tank.id} className={`bg-slate-900 border rounded-xl p-3 ${severity === 'critical' ? 'border-red-500/40' : 'border-amber-500/40'}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${severity === 'critical' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{tank.name}</div>
                        <div className={`text-xs mt-0.5 font-bold ${severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{prediction}</div>
                        <div className="text-xs text-slate-500 mt-0.5">المستوى الحالي: {fillPct}% · صافي التدفق: {tank.inflow - tank.outflow} م³/س</div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Additional analytical insights */}
                {PIPELINES.filter(p => p.leakSuspicion).map(p => (
                  <div key={p.id} className="bg-slate-900 border border-red-500/40 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <Waves className="w-4 h-4 shrink-0 mt-0.5 text-red-400 animate-pulse" />
                      <div>
                        <div className="font-medium text-slate-200 text-sm">تسرب محتمل — {p.name}</div>
                        <div className="text-xs text-red-400 mt-0.5 font-bold">فقدان ضغط كبير: {p.pressureStart} → {p.pressureEnd} بار على مسافة {p.lengthKm} كم</div>
                        <div className="text-xs text-slate-500 mt-0.5">يُنصح بالفحص الميداني الفوري للمقطع {p.from} — {p.to}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {STATIONS.filter(st => st.efficiency < 75).map(st => (
                  <div key={st.id} className="bg-slate-900 border border-amber-500/40 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <div className="font-medium text-slate-200 text-sm">كفاءة منخفضة — {st.name}</div>
                        <div className="text-xs text-amber-400 mt-0.5 font-bold">كفاءة {st.efficiency}% مع استهلاك طاقة {((st.powerKW / st.powerDesign - 1) * 100).toFixed(0)}% فوق التصميمي</div>
                        <div className="text-xs text-slate-500 mt-0.5">فحص مضخات المحطة وضبط نقطة التشغيل</div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Load redistribution suggestion */}
                <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <BarChart2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                    <div>
                      <div className="font-medium text-slate-200 text-sm">اقتراح إعادة توزيع الأحمال</div>
                      <div className="text-xs text-blue-400 mt-0.5 font-bold">تحويل 1,200 م³/س من NEJH(s) عبر الخط الاحتياطي لمعالجة نقص ضغط طرابلس</div>
                      <div className="text-xs text-slate-500 mt-0.5">الخط P7 يعمل بـ 92% من طاقته — فتح صمام التحويل للخط البديل</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Network balance */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">التوازن المائي للشبكة</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي الإنتاج', val: `${(totalFlow * 24 / 1000).toFixed(0)}k م³/يوم`, color: 'text-cyan-400' },
                  { label: 'إجمالي الاستهلاك', val: `${(totalConsumption / 1000).toFixed(0)}k م³/يوم`, color: 'text-emerald-400' },
                  { label: 'الفرق (فاقد)', val: `${((totalFlow * 24 - totalConsumption) / 1000).toFixed(0)}k م³/يوم`, color: nrwPct > 20 ? 'text-red-400' : 'text-amber-400' },
                  { label: 'نسبة الفاقد (NRW)', val: `${nrwPct > 0 ? nrwPct : 0}%`, color: nrwPct > 25 ? 'text-red-400' : nrwPct > 15 ? 'text-amber-400' : 'text-emerald-400' },
                ].map(m => (
                  <div key={m.label} className="text-center bg-slate-800/40 rounded-xl p-3">
                    <div className="text-xs text-slate-500 mb-1">{m.label}</div>
                    <div className={`text-xl font-bold ${m.color}`}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ ALERTS TAB ══════════════════ */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'unack', 'critical', 'warning', 'info'] as const).map(f => (
                <button key={f} onClick={() => setAlertFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${alertFilter === f ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'}`}>
                  {f === 'all' ? 'الكل' : f === 'unack' ? 'غير مؤكد' : f === 'critical' ? 'حرج' : f === 'warning' ? 'تحذير' : 'معلوماتي'}
                  <span className="mr-1 opacity-70">
                    ({f === 'all' ? ALERTS.length : f === 'unack' ? ALERTS.filter(a => !a.acknowledged).length : ALERTS.filter(a => a.severity === f).length})
                  </span>
                </button>
              ))}
              <span className="text-xs text-slate-500 mr-auto">{filteredAlerts.length} تنبيه</span>
            </div>

            {/* Alert list */}
            <div className="space-y-2">
              {filteredAlerts.map(a => (
                <div key={a.id} className={`bg-slate-900 border rounded-xl p-4 ${a.acknowledged ? 'opacity-60' : ''} ${sevColor(a.severity)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${sevText(a.severity)} ${!a.acknowledged && a.severity === 'critical' ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${catColor(a.category)}`}>{a.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${a.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' : a.severity === 'warning' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                            {a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلوماتي'}
                          </span>
                          <span className="font-medium text-slate-200 text-sm">{a.location}</span>
                          {a.acknowledged && <span className="text-xs text-slate-500 flex items-center gap-1"><BellOff className="w-3 h-3"/>مؤكد</span>}
                        </div>
                        <p className="text-sm text-slate-300 mb-1">{a.message}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />{a.timestamp}
                          {a.correlatedWith && a.correlatedWith.length > 0 && (
                            <span className="text-cyan-500 flex items-center gap-1">
                              <Activity className="w-3 h-3" />مرتبط بـ {a.correlatedWith.length} تنبيه آخر
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
