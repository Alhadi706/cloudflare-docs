'use client';

/**
 * Alarm Management — إدارة التنبيهات
 * تصنيف الإنذارات، الاستجابة، التصعيد، والإحصاءات
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, Info, ShieldAlert, Clock, CheckCircle, User, Filter, RefreshCw, Wrench } from 'lucide-react';

/* ─── types ─────────────────────────────────────────────────────────────────── */
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type AlarmState = 'active' | 'acknowledged' | 'resolved';

interface Alarm {
  id: string;
  timestamp: string;
  source_ar: string;
  description_ar: string;
  severity: Severity;
  state: AlarmState;
  tag_id: string;
  assigned_to?: string;
  duration_min: number;
  zone_id?: string;
}

/* ─── mock ─────────────────────────────────────────────────────────────────── */
const ALARMS: Alarm[] = [
  { id: 'ALM-001', timestamp: '09:14:22', source_ar: 'محطة الرفع PS-2',     description_ar: 'ضغط الخروج أقل من الحد الأدنى (3.0 بار)',          severity: 'critical', state: 'active',       tag_id: 'TAZ-PS2-P-OUT', duration_min: 47  },
  { id: 'ALM-002', timestamp: '08:52:05', source_ar: 'حقل الحيرة',           description_ar: 'تدهور كفاءة حقل الآبار — 88.6% (حد: 90%)',          severity: 'high',     state: 'acknowledged', tag_id: 'WF-EJH-FLOW', assigned_to: 'م. خالد',    duration_min: 69  },
  { id: 'ALM-003', timestamp: '09:02:41', source_ar: 'PRV-006 توصيلة عرضية', description_ar: 'صمام التقليل في حالة عطل — يتطلب صيانة عاجلة',       severity: 'critical', state: 'active',       tag_id: 'PRV-006',       duration_min: 58  },
  { id: 'ALM-004', timestamp: '07:30:00', source_ar: 'منطقة الشويرف Z6',     description_ar: 'ضغط الشبكة أقل من الهدف (3.2 بار / هدف: 3.5 بار)',   severity: 'medium',   state: 'acknowledged', tag_id: 'Z6-PRESS', assigned_to: 'م. فاطمة', duration_min: 101 },
  { id: 'ALM-005', timestamp: '08:10:15', source_ar: 'خزان سيدي سعيد',       description_ar: 'انقطاع الاتصال — لا يوجد بيانات منذ 60 دقيقة',        severity: 'high',     state: 'active',       tag_id: 'CB-SIDSD-LVL',  duration_min: 80  },
  { id: 'ALM-006', timestamp: '06:45:00', source_ar: 'نظام SCADA',            description_ar: 'تحذير دورة اتصال — استجابة بطيئة في المجموعة 3',      severity: 'medium',   state: 'acknowledged', tag_id: 'SCADA-COMM', assigned_to: 'م. علي',    duration_min: 145 },
  { id: 'ALM-007', timestamp: '09:20:00', source_ar: 'محطة ترهونة',           description_ar: 'انحراف طفيف في منسوب الخزان (58% / هدف: 65%)',        severity: 'low',      state: 'active',       tag_id: 'CB-TARH-LVL',   duration_min: 40  },
  { id: 'ALM-008', timestamp: '05:00:00', source_ar: 'مجموعة PRV-002',        description_ar: 'انتهاء موعد الفحص الدوري — 14 يوماً مضت',            severity: 'info',     state: 'resolved',     tag_id: 'PRV-002', assigned_to: 'م. سالم',    duration_min: 255 },
  { id: 'ALM-009', timestamp: '08:35:10', source_ar: 'حقل نجح الشمالي',       description_ar: 'تباين الضغط ≥ 0.3 بار بين الخطوط الموازية',           severity: 'medium',   state: 'active',       tag_id: 'WF-NEJHN-PRSS', duration_min: 86  },
  { id: 'ALM-010', timestamp: '09:00:00', source_ar: 'نظام الطاقة',           description_ar: 'استهلاك الطاقة أعلى من المتوسط بنسبة 8%',              severity: 'info',     state: 'acknowledged', tag_id: 'ENERGY-CONS', assigned_to: 'م. نور',    duration_min: 61  },
];

/* ─── config ─────────────────────────────────────────────────────────────────── */
const SEVERITY_CFG: Record<Severity, { label: string; text: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { label: 'حرج',     text: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/25',   icon: ShieldAlert },
  high:     { label: 'مرتفع',   text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25', icon: AlertTriangle },
  medium:   { label: 'متوسط',   text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  icon: AlertTriangle },
  low:      { label: 'منخفض',   text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   icon: Info },
  info:     { label: 'معلومات', text: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/25',  icon: Info },
};

const STATE_CFG: Record<AlarmState, { label: string; text: string }> = {
  active:       { label: 'نشط',        text: 'text-rose-400' },
  acknowledged: { label: 'قيد المعالجة', text: 'text-amber-400' },
  resolved:     { label: 'محلول',      text: 'text-emerald-400' },
};

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function AlarmManagementPage() {
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterState, setFilterState] = useState<AlarmState | 'all'>('all');
  const [alarms, setAlarms] = useState<Alarm[]>(ALARMS);
  const [source, setSource] = useState<'mock' | 'live'>('mock');
  const [loading, setLoading] = useState(false);
  const [createWoId, setCreateWoId] = useState<string | null>(null);

  // Load real alarms from API
  const loadAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/control-center/alarms');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.alarms && data.alarms.length > 0) {
          // Map DB alarms to UI format
          const mapped: Alarm[] = data.alarms.map((a: Record<string, unknown>) => ({
            id: `DB-${a.id}`,
            _db_id: a.id as number,
            timestamp: new Date(a.created_at as string).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            source_ar: (a.station_name_ar as string) || (a.station_id as string) || 'غير محدد',
            description_ar: (a.description_ar as string) || `${a.alarm_type} — ${a.value_at_alarm} ${a.unit || ''}`,
            severity: a.severity as Severity,
            state: a.state as AlarmState,
            tag_id: `${a.alarm_type}-${a.station_id}`,
            assigned_to: undefined,
            duration_min: Math.round((Date.now() - new Date(a.created_at as string).getTime()) / 60000),
            zone_id: a.zone as string | undefined,
            work_order_id: a.work_order_id as number | undefined,
          }));
          setAlarms(mapped);
          setSource('live');
          setLoading(false);
          return;
        }
      }
    } catch { /* fallback */ }
    // No real data → use mock
    setAlarms(ALARMS);
    setSource('mock');
    setLoading(false);
  }, []);

  useEffect(() => { loadAlarms(); }, [loadAlarms]);

  const acknowledgeAlarm = async (alarm: Alarm & { _db_id?: number }) => {
    if (alarm._db_id) {
      try {
        await fetch(`/api/control-center/alarms/${alarm._db_id}/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: 0 }),
        });
        await loadAlarms();
        return;
      } catch { /* fall through to local update */ }
    }
    setAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, state: 'acknowledged' } : a));
  };

  const resolveAlarm = async (alarm: Alarm & { _db_id?: number }) => {
    if (alarm._db_id) {
      try {
        await fetch(`/api/control-center/alarms/${alarm._db_id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: 0 }),
        });
        await loadAlarms();
        return;
      } catch { /* fall through */ }
    }
    setAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, state: 'resolved' } : a));
  };

  const createWorkOrder = async (alarm: Alarm & { _db_id?: number; work_order_id?: number }) => {
    if (!alarm._db_id || alarm.work_order_id) return;
    setCreateWoId(alarm.id);
    try {
      const res = await fetch(`/api/control-center/alarms/${alarm._db_id}/create-work-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: 0, priority: alarm.severity === 'critical' ? 'urgent' : 'high' }),
      });
      if (res.ok) await loadAlarms();
    } catch { /* ignore */ }
    setCreateWoId(null);
  };

  const counts = {
    critical: alarms.filter(a => a.severity === 'critical' && a.state !== 'resolved').length,
    high:     alarms.filter(a => a.severity === 'high'     && a.state !== 'resolved').length,
    active:   alarms.filter(a => a.state === 'active').length,
    resolved: alarms.filter(a => a.state === 'resolved').length,
  };

  const filtered = alarms
    .filter(a => filterSeverity === 'all' || a.severity === filterSeverity)
    .filter(a => filterState === 'all' || a.state === filterState)
    .sort((a, b) => {
      const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">إدارة التنبيهات</h1>
            <p className="text-xs text-slate-500">مركز الإنذار المبكر — تصنيف، إسناد، وتصعيد الإنذارات</p>
          </div>
          <div className="mr-auto flex items-center gap-2">
            {source === 'live' ? (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">بيانات حقيقية</span>
            ) : (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">بيانات تجريبية</span>
            )}
            <button onClick={loadAlarms} disabled={loading} className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {counts.critical > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {counts.critical} تنبيه حرج نشط
              </span>
            )}
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'تنبيهات حرجة', value: counts.critical, color: 'text-rose-400',   icon: ShieldAlert },
            { label: 'تنبيهات مرتفعة', value: counts.high,   color: 'text-orange-400', icon: AlertTriangle },
            { label: 'نشطة (كل الأنواع)', value: counts.active,  color: 'text-amber-400',  icon: Bell },
            { label: 'محلولة اليوم',  value: counts.resolved, color: 'text-emerald-400', icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">{label}</span>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 mx-1" />
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  filterSeverity === s
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s === 'all' ? 'الكل' : SEVERITY_CFG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
            {(['all', 'active', 'acknowledged', 'resolved'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterState(s)}
                className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  filterState === s
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s === 'all' ? 'كل الحالات' : STATE_CFG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Alarm list ── */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">لا توجد تنبيهات تطابق المرشح المحدد</div>
          )}
          {(filtered as (Alarm & { _db_id?: number; work_order_id?: number })[]).map((alarm) => {
            const sv = SEVERITY_CFG[alarm.severity];
            const st = STATE_CFG[alarm.state];
            const Icon = sv.icon;
            return (
              <div key={alarm.id} className={`border ${sv.border} rounded-xl p-4 ${sv.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${sv.text} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sv.bg} ${sv.text}`}>{sv.label}</span>
                      <span className={`text-[10px] font-medium ${st.text}`}>● {st.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{alarm.id}</span>
                      <span className="text-[10px] text-slate-500">{alarm.source_ar}</span>
                    </div>
                    <p className="text-sm text-slate-200 font-medium">{alarm.description_ar}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{alarm.timestamp}</span>
                      <span>{alarm.duration_min} دقيقة</span>
                      <span className="font-mono text-slate-600">{alarm.tag_id}</span>
                      {alarm.assigned_to && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <User className="w-3 h-3" />{alarm.assigned_to}
                        </span>
                      )}
                      {alarm.work_order_id && (
                        <span className="text-emerald-400">✓ أمر عمل #{alarm.work_order_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {alarm.state === 'active' && (
                      <button onClick={() => acknowledgeAlarm(alarm)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-medium transition-colors">
                        قيد المعالجة
                      </button>
                    )}
                    {alarm.state !== 'resolved' && (
                      <button onClick={() => resolveAlarm(alarm)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-medium transition-colors">
                        محلول
                      </button>
                    )}
                    {alarm._db_id && !alarm.work_order_id && (alarm.severity === 'critical' || alarm.severity === 'high') && (
                      <button
                        onClick={() => createWorkOrder(alarm)}
                        disabled={createWoId === alarm.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-[10px] font-medium transition-colors disabled:opacity-50"
                      >
                        <Wrench className="w-3 h-3" />
                        {createWoId === alarm.id ? '...' : 'أمر عمل'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
