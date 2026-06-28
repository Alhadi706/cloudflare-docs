'use client';
import React, { useState } from 'react';
import {
  useWorkOrderStore,
  type WorkOrder,
  type WOResult,
  type WOMeasurements,
} from '@/store/workOrderStore';

// ─── Status labels for display ───────────────────────────────────────────────
const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  dispatched:        { label: 'وارد جديد',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  acknowledged:      { label: 'تم الاستلام',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  in_progress:       { label: 'قيد التنفيذ',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  results_submitted: { label: 'تم إرسال التقرير', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  results_received:  { label: 'استلمته الصيانة', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  closed:            { label: 'مغلق',            color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const PRIORITY_LABEL = { critical: 'حرج', warning: 'تحذير', routine: 'روتيني' } as const;
const PRIORITY_COLOR = { critical: '#ef4444', warning: '#f59e0b', routine: '#64748b' } as const;

// ─── Results Entry Form ───────────────────────────────────────────────────────
function ResultsForm({ wo, onSubmit, onCancel }: {
  wo: WorkOrder;
  onSubmit: (result: WOResult) => void;
  onCancel: () => void;
}) {
  const [techName,     setTechName]     = useState('');
  const [actualHours,  setActualHours]  = useState(wo.estimated_hours);
  const [notes,        setNotes]        = useState('');
  const [finding,      setFinding]      = useState<WOResult['finding']>('passed');
  const [nextAction,   setNextAction]   = useState('');
  const [nextMonths,   setNextMonths]   = useState(6);
  const [checkDone,    setCheckDone]    = useState<boolean[]>(wo.checklist.map(() => false));
  // Measurements — only shown for UT-related tasks
  const isUT = wo.task_type.includes('قياس السماكة') || wo.task_type.includes('حرج');
  const [thicknessStr, setThicknessStr] = useState('');
  const [corrRate,     setCorrRate]     = useState('');
  const [coating,      setCoating]      = useState<WOMeasurements['coating_condition']>('good');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const measurements: WOMeasurements | undefined = isUT ? {
      thickness_readings: thicknessStr
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n)),
      corrosion_rate: parseFloat(corrRate) || undefined,
      coating_condition: coating,
    } : undefined;

    onSubmit({
      submitted_at: new Date().toISOString(),
      technician_name: techName || 'فني التآكل',
      actual_hours: actualHours,
      checklist_done: checkDone,
      measurements,
      finding,
      notes,
      recommended_next_action: nextAction || undefined,
      next_inspection_months: nextMonths,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-slate-900/95 backdrop-blur px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">تسجيل نتائج التنفيذ</p>
            <p className="text-base font-bold text-white mt-0.5">{wo.id} — {wo.task_type}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Technician + hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">اسم الفني المنفذ</label>
              <input
                value={techName}
                onChange={e => setTechName(e.target.value)}
                placeholder="أدخل اسم الفني"
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">الساعات الفعلية</label>
              <input
                type="number" min={0.5} step={0.5}
                value={actualHours}
                onChange={e => setActualHours(parseFloat(e.target.value))}
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">قائمة المهام — تأكيد الإنجاز</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {wo.checklist.map((item, i) => (
                <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checkDone[i]}
                    onChange={e => setCheckDone(prev => { const n = [...prev]; n[i] = e.target.checked; return n; })}
                    className="mt-0.5 accent-violet-500"
                  />
                  <span className={`text-sm ${checkDone[i] ? 'text-emerald-300 line-through' : 'text-slate-300'}`}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* UT Measurements (conditional) */}
          {isUT && (
            <div className="rounded-xl bg-slate-800/60 border border-violet-500/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">قياسات الموجات فوق الصوتية (UT)</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">قراءات السماكة (mm) — افصل بفاصلة</label>
                <input
                  value={thicknessStr}
                  onChange={e => setThicknessStr(e.target.value)}
                  placeholder="مثال: 12.4, 11.8, 10.2, 9.6"
                  className="w-full rounded-lg bg-slate-700 border border-white/10 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">معدل التآكل (mm/year)</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={corrRate}
                    onChange={e => setCorrRate(e.target.value)}
                    placeholder="0.12"
                    className="w-full rounded-lg bg-slate-700 border border-white/10 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">حالة الطلاء الواقي</label>
                  <select
                    value={coating}
                    onChange={e => setCoating(e.target.value as WOMeasurements['coating_condition'])}
                    className="w-full rounded-lg bg-slate-700 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="good">جيد</option>
                    <option value="fair">مقبول</option>
                    <option value="poor">ضعيف</option>
                    <option value="failed">فاشل</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Finding verdict */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">نتيجة الفحص الإجمالية</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['passed',          'ناجح',          'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'],
                ['needs_attention', 'يحتاج متابعة', 'border-amber-500/50   bg-amber-500/10   text-amber-300'  ],
                ['critical_finding','نتيجة حرجة',   'border-red-500/50     bg-red-500/10     text-red-300'    ],
              ] as const).map(([val, label, cls]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFinding(val)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${cls} ${finding === val ? 'ring-2 ring-offset-1 ring-offset-slate-900' : 'opacity-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظات وتوصيات الفريق</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="أي ملاحظات أو مشاهدات ميدانية..."
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Next action */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">الإجراء الموصى به</label>
              <input
                value={nextAction}
                onChange={e => setNextAction(e.target.value)}
                placeholder="مثال: إحلال فوري، إعادة طلاء..."
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">الفحص القادم (أشهر)</label>
              <input
                type="number" min={1} max={24}
                value={nextMonths}
                onChange={e => setNextMonths(parseInt(e.target.value))}
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl bg-slate-900/95 backdrop-blur border-t border-white/10 px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white">
            إلغاء
          </button>
          <button type="submit" className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-2 text-sm font-bold text-white transition-colors">
            ✅ إرسال التقرير للصيانة
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── WO Card ─────────────────────────────────────────────────────────────────
function WOCard({ wo }: { wo: WorkOrder }) {
  const acknowledge = useWorkOrderStore(s => s.acknowledgeWorkOrder);
  const start       = useWorkOrderStore(s => s.startWorkOrder);
  const submit      = useWorkOrderStore(s => s.submitResults);
  const [showForm,  setShowForm] = useState(false);

  const st = STATUS_LABEL[wo.status] ?? { label: wo.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  const pc = PRIORITY_COLOR[wo.priority];
  const pl = PRIORITY_LABEL[wo.priority];

  return (
    <>
      {showForm && (
        <ResultsForm
          wo={wo}
          onSubmit={r => { submit(wo.id, r); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 space-y-3 hover:border-violet-500/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-400">{wo.id}</p>
            <p className="text-sm font-semibold text-white mt-0.5 truncate">{wo.equipment_code} — {wo.task_type}</p>
            <p className="text-xs text-slate-500 mt-0.5">{wo.sector} · {wo.month_name} · {wo.estimated_hours}h</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ color: st.color, background: st.bg }}
            >
              {st.label}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: pc, background: `${pc}1a` }}>
              {pl}
            </span>
          </div>
        </div>

        {/* Result summary if submitted */}
        {wo.result && (
          <div className="rounded-lg bg-slate-700/50 border border-white/5 p-3 text-xs space-y-1">
            <p className="font-semibold text-slate-300">
              {wo.result.finding === 'passed' ? '✅' : wo.result.finding === 'needs_attention' ? '⚠️' : '🚨'}{' '}
              {wo.result.finding === 'passed' ? 'ناجح' : wo.result.finding === 'needs_attention' ? 'يحتاج متابعة' : 'نتيجة حرجة'}
            </p>
            {wo.result.measurements?.thickness_readings?.length && (
              <p className="text-slate-400 font-mono">
                سماكة: {wo.result.measurements.thickness_readings.join(', ')} mm
                {wo.result.measurements.corrosion_rate && ` · تآكل: ${wo.result.measurements.corrosion_rate} mm/yr`}
              </p>
            )}
            {wo.result.notes && <p className="text-slate-400">{wo.result.notes}</p>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {wo.status === 'dispatched' && (
            <button
              onClick={() => acknowledge(wo.id)}
              className="rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-colors"
            >
              📬 استلام الأمر
            </button>
          )}
          {wo.status === 'acknowledged' && (
            <button
              onClick={() => start(wo.id)}
              className="rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors"
            >
              🔧 بدء التنفيذ
            </button>
          )}
          {wo.status === 'in_progress' && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors"
            >
              📋 تسجيل النتائج وإرسال التقرير
            </button>
          )}
          {(wo.status === 'results_submitted' || wo.status === 'results_received' || wo.status === 'closed') && (
            <span className="text-xs text-slate-500 italic">التقرير أُرسل — بانتظار مراجعة الصيانة</span>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CorrosionInbox() {
  const workOrders = useWorkOrderStore(s => s.workOrders);
  const [filter, setFilter] = useState<'all' | 'new' | 'active' | 'done'>('all');

  // Only show corrosion-department WOs that have been dispatched (or later)
  const corrosionWOs = workOrders.filter(w =>
    w.department === 'corrosion' &&
    w.status !== 'draft'
  );

  const filtered = corrosionWOs.filter(w => {
    if (filter === 'new')    return w.status === 'dispatched';
    if (filter === 'active') return w.status === 'acknowledged' || w.status === 'in_progress';
    if (filter === 'done')   return ['results_submitted', 'results_received', 'closed'].includes(w.status);
    return true;
  });

  const newCount    = corrosionWOs.filter(w => w.status === 'dispatched').length;
  const activeCount = corrosionWOs.filter(w => w.status === 'acknowledged' || w.status === 'in_progress').length;
  const doneCount   = corrosionWOs.filter(w => ['results_submitted', 'results_received', 'closed'].includes(w.status)).length;

  if (corrosionWOs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
        <div className="text-5xl opacity-30">📭</div>
        <p className="text-sm">لا توجد أوامر عمل واردة من إدارة الصيانة</p>
        <p className="text-xs text-slate-600">أنشئ أوامر عمل من تبويب «الجدول الزمني» ثم اعتمدها وأرسلها</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">📥 البريد الوارد — إدارة التآكل والنزاهة</h3>
          <p className="text-xs text-slate-500 mt-0.5">أوامر العمل الواردة من إدارة الصيانة للتنفيذ الميداني</p>
        </div>
        {newCount > 0 && (
          <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-3 py-1 text-xs font-bold text-sky-300">
            {newCount} وارد جديد
          </span>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {([
          ['all',    `الكل (${corrosionWOs.length})`, '#94a3b8'],
          ['new',    `وارد جديد (${newCount})`,       '#0ea5e9'],
          ['active', `قيد التنفيذ (${activeCount})`,  '#f59e0b'],
          ['done',   `مكتمل (${doneCount})`,           '#10b981'],
        ] as const).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all text-center ${
              filter === key
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
            }`}
            style={filter === key ? { borderColor: `${color}50`, color } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Workflow diagram */}
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-3 flex items-center gap-1.5 overflow-x-auto text-xs text-slate-500 whitespace-nowrap">
        {[
          ['📬', 'استلام'],
          ['→', ''],
          ['🔧', 'تنفيذ'],
          ['→', ''],
          ['📋', 'تسجيل النتائج'],
          ['→', ''],
          ['📤', 'إرسال التقرير'],
          ['→', ''],
          ['✅', 'إغلاق بالصيانة'],
        ].map(([icon, text], i) => (
          icon === '→' ? (
            <span key={i} className="text-slate-600 mx-1">→</span>
          ) : (
            <span key={i} className="flex items-center gap-1">
              <span>{icon}</span>
              {text && <span>{text}</span>}
            </span>
          )
        ))}
      </div>

      {/* WO list */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-600 py-8">لا توجد أوامر في هذه الفئة</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(wo => <WOCard key={wo.id} wo={wo} />)}
        </div>
      )}
    </div>
  );
}
