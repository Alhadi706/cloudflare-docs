'use client';

/**
 * صفحة مراجعة وموافقة القراءات
 *
 * تبويبان:
 *   - مراجعة المشرف:       قراءات بحالة "submitted"           → يوافق أو يرفض
 *   - موافقة إدارة التحكم: قراءات بحالة "approved_supervisor"  → يوافق أو يرفض
 *
 * عند موافقة إدارة التحكم → تُدرج تلقائياً في ctrl.latest_readings → SCADA
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, XCircle, RefreshCw, Clock, ChevronDown,
  Droplets, Gauge, Zap, Wind, FlaskConical, User, MessageSquare,
  AlertCircle, BadgeCheck, Shield,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reading {
  id: number;
  station_id: string;
  name_ar: string;
  zone: string;
  station_type: string;
  reading_date: string;
  shift: string;
  status: string;
  flow_m3: number | null;
  pressure_in_bar: number | null;
  pressure_out_bar: number | null;
  tank_level_pct: number | null;
  pumps_running: number | null;
  pumps_total: number | null;
  power_kw: number | null;
  chlorine_mg_l: number | null;
  turbidity_ntu: number | null;
  ph_value: number | null;
  notes: string | null;
  submitted_by: number | null;
  submitted_at: string | null;
  supervisor_note: string | null;
}

type Tab = 'supervisor' | 'dept';

const SHIFT_LABEL: Record<string, string> = {
  daily: 'يومي', morning: 'صباحية', evening: 'مسائية', night: 'ليلية',
};

// ── Sub-component: Reading Card ────────────────────────────────────────────────

function ReadingCard({
  r, level, onApprove, onReject,
}: {
  r: Reading;
  level: Tab;
  onApprove: (id: number, note: string) => void;
  onReject:  (id: number, reason: string) => void;
}) {
  const [note, setNote]       = useState('');
  const [reason, setReason]   = useState('');
  const [showReject, setShowR] = useState(false);
  const [loading, setLoading]  = useState<'approve'|'reject'|null>(null);

  async function approve() {
    setLoading('approve');
    await onApprove(r.id, note);
    setLoading(null);
  }
  async function reject() {
    if (!reason.trim()) return;
    setLoading('reject');
    await onReject(r.id, reason);
    setLoading(null);
    setShowR(false);
  }

  const metrics: { label: string; value: string; icon: React.ReactNode }[] = [];
  if (r.flow_m3 != null)         metrics.push({ label: 'التدفق', value: `${r.flow_m3.toLocaleString()} م³`, icon: <Droplets className="w-3.5 h-3.5 text-blue-400"/> });
  if (r.tank_level_pct != null)  metrics.push({ label: 'المنسوب', value: `${r.tank_level_pct}%`, icon: <Droplets className="w-3.5 h-3.5 text-cyan-400"/> });
  if (r.pressure_in_bar != null) metrics.push({ label: 'ضغط الدخول', value: `${r.pressure_in_bar} بار`, icon: <Gauge className="w-3.5 h-3.5 text-violet-400"/> });
  if (r.pressure_out_bar != null) metrics.push({ label: 'ضغط الخروج', value: `${r.pressure_out_bar} بار`, icon: <Gauge className="w-3.5 h-3.5 text-amber-400"/> });
  if (r.pumps_running != null)   metrics.push({ label: 'مضخات', value: `${r.pumps_running}/${r.pumps_total ?? '?'}`, icon: <Wind className="w-3.5 h-3.5 text-emerald-400"/> });
  if (r.power_kw != null)        metrics.push({ label: 'الطاقة', value: `${r.power_kw} كيلوواط`, icon: <Zap className="w-3.5 h-3.5 text-yellow-400"/> });
  if (r.chlorine_mg_l != null)   metrics.push({ label: 'كلور', value: `${r.chlorine_mg_l} مغ/ل`, icon: <FlaskConical className="w-3.5 h-3.5 text-teal-400"/> });
  if (r.turbidity_ntu != null)   metrics.push({ label: 'عكارة', value: `${r.turbidity_ntu} NTU`, icon: <FlaskConical className="w-3.5 h-3.5 text-orange-400"/> });
  if (r.ph_value != null)        metrics.push({ label: 'pH', value: String(r.ph_value), icon: <FlaskConical className="w-3.5 h-3.5 text-pink-400"/> });

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{r.name_ar}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3"/> {r.reading_date}
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">{SHIFT_LABEL[r.shift] || r.shift}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-500">منطقة {r.zone}</span>
            {r.submitted_by && (
              <>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                  <User className="w-3 h-3"/> #{r.submitted_by}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg shrink-0">
          #{r.id}
        </span>
      </div>

      {/* Metrics grid */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="bg-slate-900/60 rounded-xl px-3 py-2 flex items-center gap-2">
              {m.icon}
              <div>
                <div className="text-[10px] text-slate-500">{m.label}</div>
                <div className="text-sm font-medium text-white">{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supervisor note (for dept level) */}
      {level === 'dept' && r.supervisor_note && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-300">
          <span className="font-semibold">ملاحظة المشرف:</span> {r.supervisor_note}
        </div>
      )}

      {/* Notes from راصد */}
      {r.notes && (
        <div className="flex items-start gap-2 bg-slate-900/40 rounded-xl px-3 py-2 text-xs text-slate-400">
          <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500"/>
          {r.notes}
        </div>
      )}

      {/* Approve note */}
      <div>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="ملاحظة الموافقة (اختياري)"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading === 'approve' ? <RefreshCw className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
          {level === 'supervisor' ? 'موافقة المشرف' : 'اعتماد إدارة التحكم'}
        </button>
        <button
          onClick={() => setShowR(!showReject)}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-4 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 disabled:opacity-50 text-rose-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          <XCircle className="w-4 h-4"/>
          رفض
        </button>
      </div>

      {/* Reject form */}
      {showReject && (
        <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-3 space-y-2">
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="سبب الرفض (مطلوب)"
            className="w-full bg-slate-900 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-rose-900"
          />
          <button
            onClick={reject}
            disabled={!reason.trim() || loading !== null}
            className="w-full bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
          >
            تأكيد الرفض
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReadingsApprovalPage() {
  const [activeTab, setTab]           = useState<Tab>('supervisor');
  const [supervisorList, setSuperList] = useState<Reading[]>([]);
  const [deptList, setDeptList]        = useState<Reading[]>([]);
  const [loading, setLoading]          = useState(false);
  const [approverId, setApproverId]    = useState(0);
  const [approverInput, setApproverInput] = useState('');
  const [toast, setToast]              = useState<{type:'ok'|'err'; msg:string}|null>(null);

  function showToast(type: 'ok'|'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, deptRes] = await Promise.all([
        fetch('/api/control-center/readings?mode=pending&level=supervisor'),
        fetch('/api/control-center/readings?mode=pending&level=dept'),
      ]);
      const [supData, deptData] = await Promise.all([supRes.json(), deptRes.json()]);
      if (supData.success)  setSuperList(supData.readings);
      if (deptData.success) setDeptList(deptData.readings);
    } catch (e) {
      showToast('err', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
    const stored = localStorage.getItem('ctrl_approver_id');
    if (stored) { setApproverId(Number(stored)); setApproverInput(stored); }
  }, [loadPending]);

  function saveApprover() {
    const n = Number(approverInput);
    if (!n) return;
    setApproverId(n);
    localStorage.setItem('ctrl_approver_id', String(n));
    showToast('ok', `تم حفظ الرقم الوظيفي: ${n}`);
  }

  async function handleApprove(readingId: number, note: string) {
    const level = activeTab === 'supervisor' ? 'supervisor' : 'dept';
    try {
      const res = await fetch('/api/control-center/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          reading_id: readingId,
          approver_id: approverId || 0,
          note: note || null,
          level,
        }),
      });
      const d = await res.json();
      if (d.success) {
        showToast('ok', level === 'dept'
          ? '✓ البيانات أُدرجت في النظام المباشر'
          : '✓ تمت الموافقة — انتظر موافقة إدارة التحكم');
        await loadPending();
      } else {
        showToast('err', d.detail || 'خطأ في الموافقة');
      }
    } catch (e) {
      showToast('err', String(e));
    }
  }

  async function handleReject(readingId: number, reason: string) {
    try {
      const res = await fetch('/api/control-center/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reading_id: readingId,
          approver_id: approverId || 0,
          reason,
        }),
      });
      const d = await res.json();
      if (d.success) {
        showToast('ok', 'تم الرفض — أُبلغ الراصد');
        await loadPending();
      } else {
        showToast('err', d.detail || 'خطأ في الرفض');
      }
    } catch (e) {
      showToast('err', String(e));
    }
  }

  const currentList = activeTab === 'supervisor' ? supervisorList : deptList;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href="/dashboard/control-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3">
            <ArrowRight className="w-4 h-4"/> إدارة التحكم
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">مراجعة واعتماد القراءات</h1>
              <p className="text-slate-400 text-sm mt-1">راجع قراءات الرصاد وأعتمدها لإدراجها في النظام</p>
            </div>
            <button onClick={loadPending} disabled={loading} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
            </button>
          </div>
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

        {/* Approver ID */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-slate-400 shrink-0"/>
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1.5">الرقم الوظيفي للمعتمِد</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={approverInput}
                  onChange={e => setApproverInput(e.target.value)}
                  placeholder="رقمك الوظيفي"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button onClick={saveApprover} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors">
                  حفظ
                </button>
              </div>
            </div>
            {approverId > 0 && (
              <div className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                #{approverId}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-900 rounded-2xl p-1.5">
          <button
            onClick={() => setTab('supervisor')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'supervisor'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <BadgeCheck className="w-4 h-4"/>
            مراجعة المشرف
            {supervisorList.length > 0 && (
              <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {supervisorList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('dept')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'dept'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Shield className="w-4 h-4"/>
            اعتماد إدارة التحكم
            {deptList.length > 0 && (
              <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {deptList.length}
              </span>
            )}
          </button>
        </div>

        {/* Context banner */}
        {activeTab === 'dept' && (
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>
            <span>
              الاعتماد هنا سيُدرج البيانات <strong>مباشرةً في نظام المراقبة</strong> — لوحة SCADA والتحليلات ستُحدَّث فوراً بدون أي تحميل يدوي.
            </span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin ml-2"/>
            جاري التحميل...
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-3"/>
            <p className="text-slate-400 font-medium">
              {activeTab === 'supervisor' ? 'لا توجد قراءات بانتظار مراجعتك' : 'لا توجد قراءات بانتظار اعتماد الإدارة'}
            </p>
            <p className="text-slate-600 text-sm mt-1">كل القراءات محدّثة ✓</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map(r => (
              <ReadingCard
                key={r.id}
                r={r}
                level={activeTab}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
