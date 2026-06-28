'use client';

/**
 * تسجيل القراءات الميدانية — صفحة الراصد
 * الراصد يختار المحطة والتاريخ والوردية، يُعبئ القراءات، ثم يُرسلها.
 * بعد الإرسال تنتقل تلقائياً للمشرف → إدارة التحكم → النظام المباشر.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Send, Save, CheckCircle2, XCircle,
  Clock, Droplets, Gauge, Zap, Wind, FlaskConical,
  ChevronDown, RefreshCw, AlertCircle, User,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Station {
  id: string;
  name_ar: string;
  name_en: string;
  zone: string;
  station_type: 'well_field' | 'pump_station' | 'reservoir' | 'main_header';
  pumps_total: number;
}

interface ReadingRow {
  id: number;
  station_id: string;
  name_ar: string;
  reading_date: string;
  shift: string;
  status: string;
  flow_m3: number | null;
  pressure_out_bar: number | null;
  tank_level_pct: number | null;
  submitted_at: string | null;
  rejection_reason: string | null;
}

const SHIFTS = [
  { value: 'daily',   label: 'يومي' },
  { value: 'morning', label: 'صباحية' },
  { value: 'evening', label: 'مسائية' },
  { value: 'night',   label: 'ليلية' },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:               { label: 'مسودة',              color: 'bg-slate-700 text-slate-300' },
  submitted:           { label: 'بانتظار المشرف',     color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  approved_supervisor: { label: 'موافقة المشرف',      color: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  approved_dept:       { label: 'مُدرجة في النظام ✓', color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  rejected:            { label: 'مرفوضة',             color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

function stationType(t: string) {
  if (t === 'well_field')   return 'حقل آبار';
  if (t === 'reservoir')    return 'خزان';
  if (t === 'pump_station') return 'محطة ضخ';
  return 'رئيسي';
}

function typeColor(t: string) {
  if (t === 'well_field')   return 'bg-emerald-500/20 text-emerald-300';
  if (t === 'reservoir')    return 'bg-blue-500/20 text-blue-300';
  if (t === 'pump_station') return 'bg-violet-500/20 text-violet-300';
  return 'bg-slate-500/20 text-slate-300';
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FieldReadingsPage() {
  const [stations, setStations]       = useState<Station[]>([]);
  const [selectedStation, setSelected] = useState<Station | null>(null);
  const [readingDate, setDate]         = useState(today());
  const [shift, setShift]              = useState('daily');
  const [employeeId, setEmployeeId]    = useState(0);
  const [empInput, setEmpInput]        = useState('');

  // Reading fields
  const [flowM3, setFlow]           = useState('');
  const [pressureIn, setPressIn]    = useState('');
  const [pressureOut, setPressOut]  = useState('');
  const [tankLevel, setTank]        = useState('');
  const [pumpsRunning, setPumps]    = useState('');
  const [powerKw, setPower]         = useState('');
  const [chlorine, setChlorine]     = useState('');
  const [turbidity, setTurbidity]   = useState('');
  const [phValue, setPh]            = useState('');
  const [notes, setNotes]           = useState('');

  const [myReadings, setMyReadings] = useState<ReadingRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{type:'ok'|'err'; msg:string}|null>(null);

  // Load stations
  useEffect(() => {
    fetch('/api/control-center/stations')
      .then(r => r.json())
      .then(d => { if (d.success) setStations(d.stations); })
      .catch(() => {});
    // Restore employee id from localStorage
    const stored = localStorage.getItem('ctrl_employee_id');
    if (stored) { setEmployeeId(Number(stored)); setEmpInput(stored); }
  }, []);

  const loadMyReadings = useCallback(async () => {
    if (!selectedStation) return;
    const params = new URLSearchParams({
      mode: 'list',
      station_id: selectedStation.id,
      limit: '10',
    });
    if (employeeId) params.set('submitted_by', String(employeeId));
    const res = await fetch(`/api/control-center/readings?${params}`);
    const d = await res.json();
    if (d.success) setMyReadings(d.readings);
  }, [selectedStation, employeeId]);

  useEffect(() => { loadMyReadings(); }, [loadMyReadings]);

  function showToast(type: 'ok'|'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function resetForm() {
    setFlow(''); setPressIn(''); setPressOut('');
    setTank(''); setPumps(''); setPower('');
    setChlorine(''); setTurbidity(''); setPh(''); setNotes('');
  }

  async function handleSubmit(asDraft: boolean) {
    if (!selectedStation) { showToast('err', 'اختر المحطة أولاً'); return; }
    if (!employeeId) { showToast('err', 'أدخل رقمك الوظيفي'); return; }

    const body = {
      action: 'submit',
      station_id: selectedStation.id,
      reading_date: readingDate,
      shift,
      submitted_by: employeeId,
      as_draft: asDraft,
      flow_m3:           flowM3       ? Number(flowM3)      : null,
      pressure_in_bar:   pressureIn   ? Number(pressureIn)  : null,
      pressure_out_bar:  pressureOut  ? Number(pressureOut) : null,
      tank_level_pct:    tankLevel    ? Number(tankLevel)   : null,
      pumps_running:     pumpsRunning ? Number(pumpsRunning): null,
      power_kw:          powerKw      ? Number(powerKw)     : null,
      chlorine_mg_l:     chlorine     ? Number(chlorine)    : null,
      turbidity_ntu:     turbidity    ? Number(turbidity)   : null,
      ph_value:          phValue      ? Number(phValue)     : null,
      notes: notes || null,
      pumps_detail: [],
      attachments: [],
    };

    asDraft ? setSaving(true) : setSubmitting(true);
    try {
      const res = await fetch('/api/control-center/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        showToast('ok', asDraft ? 'حُفظت كمسودة' : 'تم الإرسال للمشرف ✓');
        if (!asDraft) resetForm();
        await loadMyReadings();
      } else {
        showToast('err', d.detail || 'حدث خطأ');
      }
    } catch (e) {
      showToast('err', String(e));
    } finally {
      setSaving(false); setSubmitting(false);
    }
  }

  function saveEmployee() {
    const n = Number(empInput);
    if (!n) return;
    setEmployeeId(n);
    localStorage.setItem('ctrl_employee_id', String(n));
    showToast('ok', `تم حفظ الرقم الوظيفي: ${n}`);
  }

  // Group stations by zone
  const grouped = stations.reduce<Record<string, Station[]>>((acc, s) => {
    const z = s.zone || 'X';
    (acc[z] = acc[z] || []).push(s);
    return acc;
  }, {});

  const st = selectedStation;
  const isWell     = st?.station_type === 'well_field';
  const isReservoir = st?.station_type === 'reservoir';
  const isPump     = st?.station_type === 'pump_station';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href="/dashboard/control-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3">
            <ArrowRight className="w-4 h-4" /> إدارة التحكم
          </Link>
          <h1 className="text-2xl font-bold text-white">تسجيل القراءات الميدانية</h1>
          <p className="text-slate-400 text-sm mt-1">أدخل قراءات المحطة — ستُرسل تلقائياً للمشرف عند الإرسال</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === 'ok'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0"/> : <XCircle className="w-4 h-4 shrink-0"/>}
            {toast.msg}
          </div>
        )}

        {/* Employee ID */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-slate-400 shrink-0"/>
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1.5">الرقم الوظيفي للراصد</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={empInput}
                  onChange={e => setEmpInput(e.target.value)}
                  placeholder="مثال: 1042"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button onClick={saveEmployee} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors">
                  حفظ
                </button>
              </div>
            </div>
            {employeeId > 0 && (
              <div className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                #{employeeId}
              </div>
            )}
          </div>
        </div>

        {/* Station + Date + Shift */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">المحطة والوردية</h2>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">اختر المحطة</label>
            <div className="relative">
              <select
                value={selectedStation?.id || ''}
                onChange={e => {
                  const s = stations.find(x => x.id === e.target.value) || null;
                  setSelected(s);
                  resetForm();
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-cyan-500"
              >
                <option value="">— اختر المحطة —</option>
                {Object.entries(grouped).sort().map(([zone, sts]) => (
                  <optgroup key={zone} label={`منطقة ${zone}`}>
                    {sts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name_ar} ({stationType(s.station_type)})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            </div>
          </div>

          {selectedStation && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColor(selectedStation.station_type)}`}>
                {stationType(selectedStation.station_type)}
              </span>
              <span className="text-xs text-slate-500">منطقة {selectedStation.zone}</span>
              {selectedStation.pumps_total > 0 && (
                <span className="text-xs text-slate-500">· {selectedStation.pumps_total} مضخة</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">تاريخ القراءة</label>
              <input
                type="date"
                value={readingDate}
                onChange={e => setDate(e.target.value)}
                max={today()}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">الوردية</label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-cyan-500"
              >
                {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Reading Fields */}
        {selectedStation && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-slate-300">بيانات القراءة</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Flow — well_field + pump_station */}
              {(isWell || isPump) && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-400"/> التدفق (م³/يوم)
                  </label>
                  <input type="number" min="0" step="any" value={flowM3} onChange={e => setFlow(e.target.value)}
                    placeholder="مثال: 12500"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                </div>
              )}

              {/* Tank Level — reservoir */}
              {isReservoir && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400"/> منسوب الخزان (%)
                  </label>
                  <input type="number" min="0" max="100" step="any" value={tankLevel} onChange={e => setTank(e.target.value)}
                    placeholder="0 — 100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                </div>
              )}

              {/* Pressure In — pump_station */}
              {isPump && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Gauge className="w-3.5 h-3.5 text-violet-400"/> ضغط الدخول (بار)
                  </label>
                  <input type="number" min="0" step="any" value={pressureIn} onChange={e => setPressIn(e.target.value)}
                    placeholder="مثال: 4.2"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                </div>
              )}

              {/* Pressure Out — all types */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400"/> ضغط الخروج (بار)
                </label>
                <input type="number" min="0" step="any" value={pressureOut} onChange={e => setPressOut(e.target.value)}
                  placeholder="مثال: 5.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
              </div>

              {/* Pumps Running */}
              {selectedStation.pumps_total > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Wind className="w-3.5 h-3.5 text-emerald-400"/> مضخات تعمل
                    <span className="text-slate-600">/ {selectedStation.pumps_total}</span>
                  </label>
                  <input type="number" min="0" max={selectedStation.pumps_total} step="1" value={pumpsRunning} onChange={e => setPumps(e.target.value)}
                    placeholder={`0 — ${selectedStation.pumps_total}`}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                </div>
              )}

              {/* Power */}
              {(isWell || isPump) && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400"/> الطاقة (كيلوواط)
                  </label>
                  <input type="number" min="0" step="any" value={powerKw} onChange={e => setPower(e.target.value)}
                    placeholder="مثال: 250"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                </div>
              )}

              {/* Chlorine */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-teal-400"/> كلور (مغ/ل)
                </label>
                <input type="number" min="0" step="any" value={chlorine} onChange={e => setChlorine(e.target.value)}
                  placeholder="مثال: 0.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
              </div>

              {/* Turbidity + pH — reservoir */}
              {isReservoir && (
                <>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-orange-400"/> عكارة (NTU)
                    </label>
                    <input type="number" min="0" step="any" value={turbidity} onChange={e => setTurbidity(e.target.value)}
                      placeholder="مثال: 1.2"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-pink-400"/> pH
                    </label>
                    <input type="number" min="0" max="14" step="any" value={phValue} onChange={e => setPh(e.target.value)}
                      placeholder="6.5 — 8.5"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"/>
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="أي ملاحظات تشغيلية..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-cyan-500"/>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                إرسال للمشرف
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting || saving}
                className="flex items-center justify-center gap-2 px-5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                حفظ مسودة
              </button>
            </div>
          </div>
        )}

        {/* My Recent Readings */}
        {selectedStation && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">
                آخر قراءاتي — {selectedStation.name_ar}
              </h2>
              <button onClick={loadMyReadings} className="text-slate-500 hover:text-slate-300">
                <RefreshCw className="w-4 h-4"/>
              </button>
            </div>

            {myReadings.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">لا توجد قراءات مسجّلة لهذه المحطة</p>
            ) : (
              <div className="space-y-2">
                {myReadings.map(r => {
                  const s = STATUS_LABEL[r.status] || { label: r.status, color: 'bg-slate-700 text-slate-400' };
                  return (
                    <div key={r.id} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-500 shrink-0"/>
                        <div>
                          <span className="text-white">{r.reading_date}</span>
                          <span className="text-slate-500 text-xs mr-2">({SHIFTS.find(x => x.value === r.shift)?.label || r.shift})</span>
                          {r.flow_m3 != null && (
                            <span className="text-slate-400 text-xs mr-2">· {r.flow_m3.toLocaleString()} م³</span>
                          )}
                          {r.tank_level_pct != null && (
                            <span className="text-slate-400 text-xs mr-2">· {r.tank_level_pct}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === 'rejected' && r.rejection_reason && (
                          <span className="text-xs text-rose-400 max-w-[120px] truncate">{r.rejection_reason}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Workflow info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3">مسار تدفق البيانات</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'الراصد', color: 'text-slate-300', bg: 'bg-slate-700' },
              { label: '→', color: 'text-slate-600', bg: '' },
              { label: 'مراجعة المشرف', color: 'text-amber-300', bg: 'bg-amber-500/10 border border-amber-500/20' },
              { label: '→', color: 'text-slate-600', bg: '' },
              { label: 'موافقة إدارة التحكم', color: 'text-blue-300', bg: 'bg-blue-500/10 border border-blue-500/20' },
              { label: '→', color: 'text-slate-600', bg: '' },
              { label: 'النظام المباشر ✓', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
            ].map((s, i) => s.bg ? (
              <span key={i} className={`text-xs px-2 py-1 rounded-lg font-medium ${s.bg} ${s.color}`}>{s.label}</span>
            ) : (
              <span key={i} className={`text-xs ${s.color}`}>{s.label}</span>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            عند موافقة إدارة التحكم تُدرج البيانات تلقائياً في لوحة المراقبة ولا تحتاج إلى تحميل يدوي.
          </p>
        </div>

      </div>
    </div>
  );
}
