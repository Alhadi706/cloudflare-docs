'use client';

/**
 * Shift Log — سجل النوبات الرقمي
 * تسليم النوبات، الأحداث البارزة، ملاحظات المشغلين، تقارير التسليم
 * HR Integration: مُشغّل النوبة يُختار من قائمة الموظفين (hr_core.employees)
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, User, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Users, RefreshCw } from 'lucide-react';

/* ─── types ─────────────────────────────────────────────────────────────────── */
type EntryType = 'event' | 'alarm' | 'action' | 'note' | 'handover';

interface ShiftEntry {
  id: string;
  time: string;
  operator: string;
  type: EntryType;
  message_ar: string;
  tag?: string;
  resolved: boolean;
}

interface ShiftRecord {
  id: string;
  shift_name: string;
  shift_label: string;
  start_time: string;
  end_time: string;
  operator_on: string;
  operator_off?: string;
  production_m3: number;
  alarms_count: number;
  notes_ar: string;
  entries: ShiftEntry[];
  is_current: boolean;
}

/* ─── mock ─────────────────────────────────────────────────────────────────── */
// Mock data removed — shift logs are now persisted in ctrl.shift_logs (PostgreSQL)

/* ─── shift type helpers ─────────────────────────────────────────────────── */
const SHIFT_META: Record<string, { name: string; label: string; start: string; end: string }> = {
  morning: { name: 'نوبة الصباح',  label: '06:00 — 14:00', start: '06:00', end: '14:00' },
  evening: { name: 'نوبة المساء',  label: '14:00 — 22:00', start: '14:00', end: '22:00' },
  night:   { name: 'نوبة الليل',   label: '22:00 — 06:00', start: '22:00', end: '06:00' },
  daily:   { name: 'وردية يومية',  label: '00:00 — 24:00', start: '00:00', end: '24:00' },
};

function dbToShiftRecord(r: Record<string, unknown>): ShiftRecord {
  const meta = SHIFT_META[r.shift_type as string] || SHIFT_META.daily;
  return {
    id:           String(r.id),
    shift_name:   meta.name,
    shift_label:  meta.label,
    start_time:   meta.start,
    end_time:     meta.end,
    operator_on:  (r.operator_on_name as string) || '—',
    operator_off: (r.operator_off_name as string) || undefined,
    production_m3: Number(r.production_m3) || 0,
    alarms_count:  Number(r.alarms_count)  || 0,
    notes_ar:      (r.notes_ar as string)  || '',
    entries:       Array.isArray(r.entries) ? (r.entries as ShiftEntry[]) : [],
    is_current:    !(r.closed as boolean),
  };
}

/* ─── config ─────────────────────────────────────────────────────────────────── */
const ENTRY_CFG: Record<EntryType, { label: string; color: string; icon: React.ElementType }> = {
  event:    { label: 'حدث',    color: 'text-slate-400',  icon: Info },
  alarm:    { label: 'تنبيه',  color: 'text-rose-400',   icon: AlertTriangle },
  action:   { label: 'إجراء',  color: 'text-cyan-400',   icon: CheckCircle },
  note:     { label: 'ملاحظة', color: 'text-amber-400',  icon: Info },
  handover: { label: 'تسليم',  color: 'text-emerald-400', icon: User },
};

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function ShiftLogPage() {
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);

  // HR integration — employee list from hr_core
  const [employees, setEmployees] = useState<{ id: number; full_name_ar: string; position_name_ar?: string }[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [handoverOperator, setHandoverOperator] = useState('');
  const [empError, setEmpError] = useState(false);

  useEffect(() => {
    async function loadEmployees() {
      setLoadingEmp(true);
      try {
        const res = await fetch('/api/control-center/employees');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setEmployees(data.employees);
            return;
          }
        }
        setEmpError(true);
      } catch { setEmpError(true); }
      finally { setLoadingEmp(false); }
    }
    loadEmployees();
  }, []);

  // Load shift logs from DB
  useEffect(() => {
    async function loadShifts() {
      setLoadingShifts(true);
      try {
        const res = await fetch('/api/control-center/shift-log?days=7');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.logs)) {
            const mapped = (data.logs as Record<string, unknown>[]).map(dbToShiftRecord);
            setShifts(mapped);
            const current = mapped.find(s => s.is_current);
            if (current) { setOpenShiftId(current.id); setExpandedShift(current.id); }
          }
        }
      } catch { /* ignore */ }
      finally { setLoadingShifts(false); }
    }
    loadShifts();
  }, []);

  const addNote = async (shiftId: string) => {
    if (!newNote.trim()) return;
    const operatorName = selectedOperator
      ? (employees.find(e => e.id === +selectedOperator)?.full_name_ar || selectedOperator)
      : 'المستخدم الحالي';

    // Optimistic local update
    const tempEntry: ShiftEntry = {
      id: `NOTE-${Date.now()}`,
      time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
      operator: operatorName,
      type: 'note',
      message_ar: newNote.trim(),
      resolved: true,
    };
    setShifts(prev => prev.map(s =>
      s.id === shiftId ? { ...s, entries: [...s.entries, tempEntry] } : s
    ));
    setNewNote('');

    // Persist to DB
    try {
      await fetch(`/api/control-center/shift-log/${shiftId}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          operator: operatorName,
          message_ar: tempEntry.message_ar,
          resolved: true,
        }),
      });
    } catch { /* optimistic update already shown */ }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">سجل النوبات الرقمي</h1>
            <p className="text-xs text-slate-500">تسليم النوبات، الأحداث البارزة، وملاحظات مشغلي غرفة التحكم</p>
          </div>
          {loadingShifts && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin mr-auto" />}
          {!loadingShifts && !openShiftId && (
            <button
              onClick={async () => {
                const operatorId  = selectedOperator ? +selectedOperator : undefined;
                const operatorName = operatorId ? (employees.find(e => e.id === operatorId)?.full_name_ar || '') : undefined;
                const res = await fetch('/api/control-center/shift-log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ shift_type: 'morning', operator_on_id: operatorId, operator_on_name: operatorName }),
                });
                const data = await res.json();
                if (data.success) {
                  const mapped = dbToShiftRecord(data.log);
                  setShifts(prev => [mapped, ...prev]);
                  setOpenShiftId(mapped.id);
                  setExpandedShift(mapped.id);
                }
              }}
              className="mr-auto px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs transition-colors"
            >
              + فتح نوبة جديدة
            </button>
          )}
        </div>

        {/* ── HR Panel: مُشغّلو النوبة (من قائمة الموظفين) ── */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              مُشغّل النوبة الحالية
            </p>
            {loadingEmp && <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
            {empError && <span className="text-[10px] text-amber-400">تعذّر تحميل الموظفين — تُستخدم الأسماء الافتراضية</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">مستلم النوبة (المشغّل الحالي)</label>
              {employees.length > 0 ? (
                <select
                  value={selectedOperator}
                  onChange={e => setSelectedOperator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name_ar} {emp.position_name_ar ? `(${emp.position_name_ar})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={selectedOperator}
                  onChange={e => setSelectedOperator(e.target.value)}
                  placeholder="اكتب اسم المشغّل..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">مُسلِّم النوبة (نوبة سابقة)</label>
              {employees.length > 0 ? (
                <select
                  value={handoverOperator}
                  onChange={e => setHandoverOperator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name_ar} {emp.position_name_ar ? `(${emp.position_name_ar})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={handoverOperator}
                  onChange={e => setHandoverOperator(e.target.value)}
                  placeholder="اكتب اسم المُسلِّم..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              )}
            </div>
          </div>
          {employees.length > 0 && (
            <p className="text-[10px] text-slate-600 mt-2">
              {employees.length} موظف نشط من الشؤون الإدارية
            </p>
          )}
        </div>

        {/* ── Shift list ── */}
        <div className="space-y-4">
          {!loadingShifts && shifts.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              لا توجد نوبات مسجّلة خلال الأسبوع الماضي — افتح نوبة جديدة للبدء
            </div>
          )}
          {shifts.map((shift) => {
            const isExpanded = expandedShift === shift.id;
            return (
              <div key={shift.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">

                {/* Shift header */}
                <button
                  onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                  className="w-full text-right p-4 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${shift.is_current ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-100">{shift.shift_name}</p>
                          <span className="text-xs text-slate-500">{shift.shift_label}</span>
                          {shift.is_current && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">نشطة</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {shift.operator_on}
                          </span>
                          <span>{(shift.production_m3 / 1000).toFixed(0)}k م³</span>
                          {shift.alarms_count > 0 && (
                            <span className="text-amber-400">{shift.alarms_count} تنبيه</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-800">

                    {/* Notes */}
                    <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800">
                      <p className="text-xs text-slate-500 mb-1">ملخص النوبة</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{shift.notes_ar}</p>
                    </div>

                    {/* Entries timeline */}
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                        سجل الأحداث ({shift.entries.length})
                      </p>
                      {shift.entries.map((entry, i) => {
                        const ec = ENTRY_CFG[entry.type];
                        const Icon = ec.icon;
                        return (
                          <div key={entry.id} className="flex gap-3">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0`}>
                                <Icon className={`w-3 h-3 ${ec.color}`} />
                              </div>
                              {i < shift.entries.length - 1 && (
                                <div className="w-px flex-1 bg-slate-800 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {entry.time}
                                </span>
                                <span className={`text-[10px] font-bold ${ec.color}`}>{ec.label}</span>
                                <span className="text-[10px] text-slate-500">{entry.operator}</span>
                                {entry.tag && (
                                  <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                                    {entry.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed">{entry.message_ar}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add note (current shift only) */}
                    {shift.is_current && (
                      <div className="px-4 pb-4">
                        <div className="flex gap-2 mt-2">
                          <input
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addNote(shift.id)}
                            placeholder="أضف ملاحظة أو حدث..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => addNote(shift.id)}
                            disabled={!newNote.trim()}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            إضافة
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Handover summary block ── */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            إرشادات تسليم النوبة (IEC / AWWA)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            {[
              'مراجعة جميع التنبيهات النشطة وغير المعالجة',
              'تأكيد قراءات الضغط الحالية في كل منطقة',
              'مراجعة حالة صمامات PRV والمحطات',
              'إبلاغ خليفة النوبة بأي أعمال جارية أو مجدولة',
              'توثيق القيم الحالية للمستودعات والخزانات',
              'التحقق من أوامر العمل المفتوحة مع الصيانة',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
