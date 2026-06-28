'use client';
/**
 * WorkOrderDispatchModal — مشترك لجميع إدارات أوامر العمل
 * ──────────────────────────────────────────────────────────────
 * يُستخدم في:
 *  - إدارة الصيانة  (MaintenanceSchedule)
 *  - CMMS أوامر العمل (work-orders/page)
 *  - إدارة التآكل  (WorkOrdersTab)
 * ──────────────────────────────────────────────────────────────
 */
import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, Send } from 'lucide-react';

// ── Public Types ───────────────────────────────────────────────────────────────
export interface DispatchableWO {
  id: number | string;
  title?: string;
  title_ar?: string;
  work_type?: string;    // 'preventive'|'corrective'|'emergency'|'inspection'|'predictive'|'maintenance'|'replacement'
  priority?: string;     // 'critical'|'urgent'|'high'|'normal'|'low'|'warning'|'routine'
  status?: string;
  department?: string;
  estimated_hours?: number;
}

export type DispatchChannel = 'whatsapp' | 'cmms' | 'docs' | 'all';

export interface DispatchConfig {
  internalTeams: string[];      // فرق عمل داخل الإدارة
  externalDepts: string[];      // إدارات خارجية
  reports: string[];            // المستندات المُرفقة
  channel: DispatchChannel;     // قناة الإرسال
}

// ── Static Data ────────────────────────────────────────────────────────────────
const INTERNAL_TEAMS: Record<string, { id: string; label: string; icon: string }[]> = {
  maintenance: [
    { id: 'team_field',      label: 'فريق الميدان',             icon: '⛏️' },
    { id: 'team_welding',    label: 'فريق اللحام والتركيب',     icon: '🔥' },
    { id: 'team_inspection', label: 'فريق الفحص والتفتيش',      icon: '🔍' },
    { id: 'team_emergency',  label: 'فريق الطوارئ والإغاثة',    icon: '🚨' },
    { id: 'team_planning',   label: 'فريق التخطيط والجدولة',    icon: '📋' },
  ],
  corrosion: [
    { id: 'corrosion_manager',               label: 'مدير إدارة التآكل (اعتماد ومتابعة)',         icon: '👔' },
    { id: 'corrosion_admin_office',          label: 'الإدارة الإدارية للتآكل (استلام وتوجيه)',     icon: '🗂️' },
    { id: 'corrosion_monitoring_maintenance',label: 'قسم المراقبة الدورية والصيانة',              icon: '🛰️' },
    { id: 'corrosion_technical_support',     label: 'قسم الدعم الفني',                             icon: '🧪' },
    { id: 'corrosion_components_coating',    label: 'قسم المكونات الهندسية والطلاء',               icon: '🛠️' },
    { id: 'team_ut',                          label: 'فريق قياسات UT/السماكة',                     icon: '📏' },
    { id: 'team_cp',                          label: 'فريق الحماية الكاثودية',                     icon: '⚡' },
    { id: 'team_nde',                         label: 'فريق الفحص غير المدمر NDE',                  icon: '🔬' },
    { id: 'team_integrity',                   label: 'فريق النزاهة والتحليل',                       icon: '🛡️' },
  ],
  operations: [
    { id: 'team_pumping',    label: 'فريق الضخ والتشغيل',       icon: '💧' },
    { id: 'team_control',    label: 'فريق غرفة التحكم',          icon: '🖥️' },
    { id: 'team_safety',     label: 'فريق السلامة والطوارئ',     icon: '🦺' },
  ],
};

const EXTERNAL_DEPTS = [
  { id: 'maintenance_dept',  label: 'إدارة الصيانة',          icon: '🔧', ctx: 'maintenance'  },
  { id: 'corrosion_dept',    label: 'إدارة التآكل والنزاهة',  icon: '⚗️', ctx: 'corrosion'    },
  { id: 'operations_dept',   label: 'إدارة التشغيل',           icon: '⚙️', ctx: 'operations'   },
  { id: 'asset_management',  label: 'إدارة الأصول',            icon: '🏗️', ctx: ''             },
  { id: 'general_manager',   label: 'المدير العام',             icon: '👔', ctx: '', required: true },
] as const;

const DISPATCH_DOCS = [
  { id: 'wo_list',           label: 'قائمة أوامر العمل المعتمدة',     always: true  },
  { id: 'materials_req',     label: 'طلب المواد والمعدات المطلوبة',   always: false },
  { id: 'schedule',          label: 'الجدول الزمني التفصيلي',          always: false },
  { id: 'alerts_critical',   label: 'إنذارات فورية للأصول الحرجة',   always: false },
  { id: 'corrosion_report',  label: 'تقرير قياسات التآكل والسماكة',   always: false },
  { id: 'inspection_report', label: 'تقرير الفحص الميداني',            always: false },
] as const;

const CHANNELS: { id: DispatchChannel; icon: string; label: string; sub: string }[] = [
  { id: 'whatsapp', icon: '💬', label: 'واتساب',          sub: 'إشعار فوري' },
  { id: 'cmms',     icon: '🏭', label: 'CMMS',            sub: 'workspace.work_orders' },
  { id: 'docs',     icon: '📂', label: 'بوابة الوثائق',   sub: 'صندوق وارد الإدارة' },
  { id: 'all',      icon: '⚡', label: 'الكل معاً',        sub: 'موصى به' },
];

// ── WO Classification ──────────────────────────────────────────────────────────
type WOCategory = 'periodic' | 'corrective' | 'critical' | 'manual';

function classifyWO(wo: DispatchableWO): WOCategory {
  const p = wo.priority || '';
  const t = wo.work_type || '';
  if (['critical', 'urgent', 'emergency'].includes(p) || t === 'emergency') return 'critical';
  if (['preventive', 'periodic', 'quarterly', 'monthly', 'annual', 'biannual', 'semi_annual'].includes(t)) return 'periodic';
  if (['corrective', 'replacement', 'repair'].includes(t)) return 'corrective';
  return 'manual';
}

const CATEGORY_META: Record<WOCategory, { label: string; color: string; bg: string }> = {
  periodic:   { label: '🔁 دورية',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  corrective: { label: '🔧 تصحيحية',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  critical:   { label: '🔴 حرجة',     color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
  manual:     { label: '✍️ يدوية',    color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
};

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  workOrders: DispatchableWO[];
  context: 'maintenance' | 'corrosion' | 'operations';
  onConfirm: (config: DispatchConfig) => void;
  onClose: () => void;
}

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

export default function WorkOrderDispatchModal({ workOrders, context, onConfirm, onClose }: Props) {
  const categories = useMemo(() => {
    const counts: Record<WOCategory, number> = { periodic: 0, corrective: 0, critical: 0, manual: 0 };
    workOrders.forEach(wo => counts[classifyWO(wo)]++);
    return counts;
  }, [workOrders]);

  const hasCritical  = categories.critical > 0;
  const hasCorrosion = workOrders.some(w => w.department === 'corrosion');

  // ── Default selections ─────────────────────────────────────────────────────
  const defaultInternalTeams = useMemo<string[]>(() => {
    const teams: string[] = [];
    if (hasCritical)           teams.push('team_emergency');
    if (categories.periodic > 0) {
      if (context === 'maintenance') teams.push('team_field', 'team_planning');
      if (context === 'corrosion')   teams.push('corrosion_admin_office', 'corrosion_monitoring_maintenance', 'team_ut');
      if (context === 'operations')  teams.push('team_pumping', 'team_control');
    }
    if (context === 'corrosion' && categories.corrective > 0) {
      teams.push('corrosion_components_coating', 'corrosion_technical_support');
    }
    if (context === 'corrosion' && categories.manual > 0) {
      teams.push('corrosion_technical_support');
    }
    if (context === 'corrosion' && hasCritical) {
      teams.push('corrosion_manager', 'corrosion_admin_office', 'corrosion_technical_support');
    }
    return [...new Set(teams)];
  }, [categories, hasCritical, context]);

  const defaultExternal = useMemo<string[]>(() => {
    const depts: string[] = ['general_manager'];
    if (hasCorrosion && context !== 'corrosion') depts.push('corrosion_dept');
    if (context === 'corrosion' && (hasCritical || categories.corrective > 0)) depts.push('maintenance_dept');
    if (context !== 'operations') depts.push('operations_dept');
    return depts;
  }, [categories.corrective, hasCorrosion, hasCritical, context]);

  const defaultReports = useMemo<string[]>(() => {
    const docs: string[] = ['wo_list', 'materials_req'];
    if (hasCritical) docs.push('alerts_critical');
    if (hasCorrosion || context === 'corrosion') docs.push('corrosion_report');
    return docs;
  }, [hasCritical, hasCorrosion, context]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [internalTeams, setInternalTeams] = useState<string[]>(defaultInternalTeams);
  const [externalDepts, setExternalDepts] = useState<string[]>(defaultExternal);
  const [reports,       setReports]       = useState<string[]>(defaultReports);
  const [channel,       setChannel]       = useState<DispatchChannel>('all');

  const visibleExternal = EXTERNAL_DEPTS.filter(d => d.ctx !== context);
  const internalList    = INTERNAL_TEAMS[context] || [];

  const canConfirm = internalTeams.length > 0 || externalDepts.length > 0;

  const ctxLabel: Record<string, string> = {
    maintenance: 'إدارة الصيانة',
    corrosion:   'إدارة التآكل',
    operations:  'إدارة التشغيل',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-slate-900 z-10 border-b border-white/5 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">مرحلة الاعتماد والإرسال — ISO 55001</p>
              <h3 className="text-base font-bold text-white">اعتماد وإرسال أوامر العمل</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{ctxLabel[context]} · {workOrders.length} أمر عمل</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none mt-1 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Work Order Type Breakdown ── */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(categories) as [WOCategory, number][]).map(([cat, cnt]) => {
              const m = CATEGORY_META[cat];
              return (
                <div key={cat} className="rounded-xl border px-2 py-2.5 text-center"
                  style={{ borderColor: m.color + '30', background: m.bg }}>
                  <p className="text-lg font-black font-mono" style={{ color: m.color }}>{cnt}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{m.label}</p>
                </div>
              );
            })}
          </div>

          {context === 'corrosion' && (
            <div className="rounded-xl border border-violet-500/25 bg-violet-900/10 p-3 space-y-2">
              <p className="text-xs font-bold text-violet-200">هيكل إدارة التآكل المعتمد للتوجيه</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>1) الإدارة الإدارية: استلام، تصنيف، إعادة توزيع</div>
                <div>2) قسم المراقبة الدورية والصيانة: كشف/متابعة ميدانية</div>
                <div>3) قسم الدعم الفني: تحليل وتقرير وتوصيات</div>
                <div>4) قسم المكونات الهندسية والطلاء: إجراءات التصحيح والمعالجة</div>
              </div>
            </div>
          )}

          {/* ── Internal Teams ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-bold text-white">👥 فرق العمل الداخلية</span>
              <span className="text-[9px] text-slate-500 border border-white/5 rounded px-1.5 py-0.5">
                داخل {ctxLabel[context]}
              </span>
            </div>
            <div className="space-y-1.5">
              {internalList.map(t => (
                <label key={t.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer transition-all ${
                  internalTeams.includes(t.id)
                    ? 'border-sky-500/40 bg-sky-500/8 text-slate-200'
                    : 'border-white/5 bg-white/2 text-slate-400 hover:border-white/15'
                }`}>
                  <input type="checkbox" checked={internalTeams.includes(t.id)}
                    onChange={() => setInternalTeams(s => toggle(s, t.id))}
                    className="accent-sky-500 w-4 h-4 flex-shrink-0" />
                  <span className="text-base leading-none">{t.icon}</span>
                  <span className="text-sm">{t.label}</span>
                  <span className="text-[9px] text-sky-400 border border-sky-500/20 rounded px-1 mr-auto">داخلي</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── External Departments ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-bold text-white">📨 الإدارات الخارجية</span>
              <span className="text-[9px] text-slate-500 border border-white/5 rounded px-1.5 py-0.5">
                إحالة للإدارات الأخرى
              </span>
            </div>
            <div className="space-y-1.5">
              {visibleExternal.map(d => (
                <label key={d.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer transition-all ${
                  externalDepts.includes(d.id)
                    ? 'border-cyan-500/40 bg-cyan-500/8 text-slate-200'
                    : 'border-white/5 bg-white/2 text-slate-400 hover:border-white/15'
                }`}>
                  <input type="checkbox" checked={externalDepts.includes(d.id)}
                    onChange={() => !('required' in d && d.required) && setExternalDepts(s => toggle(s, d.id))}
                    className="accent-cyan-500 w-4 h-4 flex-shrink-0"
                    disabled={'required' in d && d.required} />
                  <span className="text-base leading-none">{d.icon}</span>
                  <span className="text-sm">{d.label}</span>
                  {'required' in d && d.required && (
                    <span className="text-[9px] text-slate-500 border border-white/5 rounded px-1 mr-auto">إلزامي</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* ── Documents ── */}
          <div>
            <p className="text-xs font-bold text-white mb-2.5">📄 المستندات المُرفقة</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DISPATCH_DOCS.map(doc => (
                <label key={doc.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border cursor-pointer transition-all text-[11px] ${
                  reports.includes(doc.id)
                    ? 'border-emerald-500/30 bg-emerald-500/6 text-slate-200'
                    : 'border-white/5 bg-white/2 text-slate-500 hover:border-white/15'
                }`}>
                  <input type="checkbox" checked={reports.includes(doc.id)}
                    onChange={() => setReports(s => toggle(s, doc.id))}
                    className="accent-emerald-500 w-3.5 h-3.5 flex-shrink-0" />
                  <span className="leading-tight">{doc.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Channel ── */}
          <div>
            <p className="text-xs font-bold text-white mb-2.5">⚡ قناة الإرسال</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CHANNELS.map(ch => (
                <button key={ch.id} onClick={() => setChannel(ch.id)}
                  className={`rounded-xl px-2 py-2.5 text-center border transition-all ${
                    channel === ch.id
                      ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                      : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/20'
                  }`}>
                  <p className="text-xl mb-0.5">{ch.icon}</p>
                  <p className="text-[10px] font-bold leading-tight">{ch.label}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{ch.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="rounded-xl bg-slate-800/50 border border-white/5 px-4 py-3 text-[11px] text-slate-400 space-y-1">
            <p>
              <span className="text-white font-bold">{internalTeams.length}</span> فريق داخلي ·{' '}
              <span className="text-white font-bold">{externalDepts.length}</span> إدارة خارجية ·{' '}
              <span className="text-white font-bold">{reports.length}</span> مستند مُرفق
            </p>
            <p className="text-[10px] text-slate-600">
              {channel === 'whatsapp' && 'سيُرسَل إشعار واتساب فوري للمستلمين المختارين'}
              {channel === 'cmms'     && 'ستُنشأ/تُحدَّث الأوامر في قاعدة CMMS المركزية'}
              {channel === 'docs'     && 'ستُنشأ وثيقة في بوابة الوثائق وصندوق وارد الإدارة'}
              {channel === 'all'      && 'سيُرسَل عبر الثلاث قنوات — أقصى تغطية وتتبع'}
            </p>
          </div>

          {/* ── Confirm ── */}
          <button
            onClick={() => onConfirm({ internalTeams, externalDepts, reports, channel })}
            disabled={!canConfirm}
            className="w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
            تأكيد الاعتماد والإرسال — {workOrders.length} أمر عمل
            <Send className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-slate-600 text-center -mt-2">
            بالموافقة تُعتمد جميع الأوامر المحددة وتُرسَل للجهات المختارة
          </p>

        </div>
      </div>
    </div>
  );
}
