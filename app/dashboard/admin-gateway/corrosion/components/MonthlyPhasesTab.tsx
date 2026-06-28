'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// المراحل الشهرية للخطة السنوية — يُعدّها قسم المراقبة بعد اعتماد المدير
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import {
  Calendar, ChevronDown, ChevronUp, Loader2,
  Plus, RefreshCw, Trash2,
} from 'lucide-react';

const API_DEPT = '/api/v1/dept-admin';
const H = {
  'x-tenant-id': 'aaaaaaaa-0000-4000-a000-000000000001',
  'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
  'Content-Type': 'application/json',
};

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

interface MonthlyPhase {
  id: string;
  planId: number;
  planTitle: string;
  month: string;
  year: string;
  from_station: string;
  to_station: string;
  team_name: string;
  notes: string;
  status: 'planned' | 'in_progress' | 'data_uploaded' | 'completed';
  created_at: string;
}

interface AnnualPlan {
  id: number;
  doc_number: string;
  title: string;
  metadata?: any;
}

const STATUS_OPTS: { value: MonthlyPhase['status']; label: string; color: string }[] = [
  { value: 'planned',       label: 'مخطط',             color: 'text-slate-400 bg-slate-800/60 border-slate-700' },
  { value: 'in_progress',   label: 'جارٍ التنفيذ',     color: 'text-amber-300 bg-amber-900/20 border-amber-500/30' },
  { value: 'data_uploaded', label: 'بيانات مرفوعة',    color: 'text-blue-300 bg-blue-900/20 border-blue-500/30' },
  { value: 'completed',     label: 'مكتملة',            color: 'text-emerald-300 bg-emerald-900/20 border-emerald-500/30' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function MonthlyPhasesTab() {
  const [approvedPlans, setApprovedPlans] = useState<AnnualPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [phasesLoading, setPhasesLoading] = useState(true);
  const [phases, setPhases] = useState<MonthlyPhase[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    planId: '', month: MONTHS[0], year: String(new Date().getFullYear()),
    from_station: '', to_station: '', team_name: '', notes: '',
  });
  const [formError, setFormError] = useState('');

  const loadApprovedPlans = async () => {
    setPlansLoading(true);
    try {
      const r = await fetch(`${API_DEPT}/corrosion/documents?doc_type=annual_plan&limit=50`, { headers: H });
      const d = r.ok ? await r.json() : { documents: [] };
      const docs: AnnualPlan[] = (d.documents ?? []).map((doc: any) => {
        let meta: any = {};
        try { meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : (doc.metadata ?? {}); } catch {}
        return { id: doc.id, doc_number: doc.doc_number, title: doc.title, metadata: meta };
      });
      setApprovedPlans(docs);
    } catch {
      setApprovedPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const loadTeamNames = async () => {
    try {
      const r = await fetch('/api/v1/corrosion/field-teams', { headers: H });
      const d = await r.json().catch(() => ({ teams: [] }));
      const names = Array.isArray(d.teams)
        ? d.teams.map((t: any) => String(t.name ?? '').trim()).filter(Boolean)
        : [];
      setTeamNames(names);
    } catch {
      setTeamNames([]);
    }
  };

  const loadPhases = async () => {
    setPhasesLoading(true);
    try {
      const r = await fetch('/api/v1/corrosion/monthly-phases', { headers: H });
      const d = await r.json().catch(() => ({ phases: [] }));
      const rows: MonthlyPhase[] = Array.isArray(d.phases)
        ? d.phases.map((p: any) => ({
            id: p.id,
            planId: Number(p.planId),
            planTitle: String(p.planTitle ?? ''),
            month: String(p.month ?? ''),
            year: String(p.year ?? ''),
            from_station: String(p.fromStation ?? ''),
            to_station: String(p.toStation ?? ''),
            team_name: String(p.teamName ?? ''),
            notes: String(p.notes ?? ''),
            status: p.status,
            created_at: String(p.createdAt ?? ''),
          }))
        : [];
      setPhases(rows);
    } catch {
      setPhases([]);
    } finally {
      setPhasesLoading(false);
    }
  };

  useEffect(() => {
    loadApprovedPlans();
    loadTeamNames();
    loadPhases();
  }, []);

  const savePhase = () => {
    savePhaseAsync();
  };

  const savePhaseAsync = async () => {
    if (!form.planId) { setFormError('اختر الخطة السنوية'); return; }
    if (!form.from_station || !form.to_station) { setFormError('حدد نطاق المحطات'); return; }
    const plan = approvedPlans.find(p => p.id === parseInt(form.planId));
    const phase: MonthlyPhase = {
      id: uid(),
      planId: parseInt(form.planId),
      planTitle: plan?.title ?? '',
      month: form.month,
      year: form.year,
      from_station: form.from_station,
      to_station: form.to_station,
      team_name: form.team_name,
      notes: form.notes,
      status: 'planned',
      created_at: new Date().toISOString(),
    };
    try {
      const r = await fetch('/api/v1/corrosion/monthly-phases', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({
          id: phase.id,
          planId: phase.planId,
          planTitle: phase.planTitle,
          month: phase.month,
          year: Number(phase.year),
          fromStation: phase.from_station,
          toStation: phase.to_station,
          teamName: phase.team_name || null,
          notes: phase.notes || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'تعذر حفظ المرحلة' }));
        setFormError(e.error ?? 'تعذر حفظ المرحلة');
        return;
      }
      setForm({ planId: '', month: MONTHS[0], year: String(new Date().getFullYear()), from_station: '', to_station: '', team_name: '', notes: '' });
      setShowForm(false);
      setFormError('');
      await loadPhases();
    } catch {
      setFormError('تعذر حفظ المرحلة');
    }
  };

  const updateStatus = async (id: string, status: MonthlyPhase['status']) => {
    try {
      await fetch(`/api/v1/corrosion/monthly-phases/${id}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ status }),
      });
      await loadPhases();
    } catch {
      // no-op
    }
  };

  const deletePhase = async (id: string) => {
    try {
      await fetch(`/api/v1/corrosion/monthly-phases/${id}`, {
        method: 'DELETE',
        headers: H,
      });
      await loadPhases();
    } catch {
      // no-op
    }
  };

  const statusInfo = (s: MonthlyPhase['status']) => STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0];

  // Group phases by plan
  const grouped = phases.reduce<Record<string, MonthlyPhase[]>>((acc, p) => {
    const key = `${p.planTitle || 'خطة غير محددة'}`;
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">المراحل الشهرية للمسح</h2>
          <p className="text-sm text-slate-400 mt-0.5">يقسّم قسم المراقبة الخطة السنوية إلى مراحل شهرية ويخصص فريقاً لكل مرحلة</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadTeamNames(); loadPhases(); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${phasesLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> مرحلة جديدة
          </button>
        </div>
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> تعريف مرحلة شهرية جديدة
          </h3>

          {formError && (
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{formError}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan selection */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">الخطة السنوية *</label>
              {plansLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري التحميل...</div>
              ) : (
                <select
                  value={form.planId}
                  onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— اختر الخطة السنوية —</option>
                  {approvedPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Month */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">الشهر *</label>
              <select
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">السنة</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* From Station */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">من المحطة *</label>
              <input
                value={form.from_station}
                onChange={e => setForm(f => ({ ...f, from_station: e.target.value }))}
                placeholder="مثال: 202"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* To Station */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">إلى المحطة *</label>
              <input
                value={form.to_station}
                onChange={e => setForm(f => ({ ...f, to_station: e.target.value }))}
                placeholder="مثال: 230"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Team */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">الفريق المُكلَّف</label>
              {teamNames.length > 0 ? (
                <select
                  value={form.team_name}
                  onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— اختر فريقاً —</option>
                  {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input
                  value={form.team_name}
                  onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
                  placeholder="اسم الفريق (أنشئ الفرق أولاً في تبويب الفرق الفنية)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              )}
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">ملاحظات</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي تفاصيل إضافية..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={savePhase}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors"
            >
              <Calendar className="w-4 h-4" /> حفظ المرحلة
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(''); }}
              className="text-slate-500 hover:text-slate-300 text-sm"
            >إلغاء</button>
          </div>
        </div>
      )}

      {/* ── Phases grouped by plan ── */}
      {phasesLoading ? (
        <div className="text-center py-16 text-slate-500 border border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="font-medium">جاري تحميل المراحل...</p>
        </div>
      ) : phases.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-slate-800 rounded-2xl">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد مراحل شهرية بعد</p>
          <p className="text-xs mt-1">تُضاف المراحل بعد اعتماد الخطة السنوية من المدير</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([planTitle, planPhases]) => (
            <div key={planTitle}>
              <h3 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> {planTitle}
              </h3>
              {/* Timeline-style view */}
              <div className="space-y-2">
                {planPhases
                  .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
                  .map((phase, idx) => {
                    const si = statusInfo(phase.status);
                    return (
                      <div key={phase.id} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                          onClick={() => setExpandedId(expandedId === phase.id ? null : phase.id)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-cyan-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">
                              {phase.month} {phase.year} — المحطات {phase.from_station} إلى {phase.to_station}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {phase.team_name ? `الفريق: ${phase.team_name}` : 'لم يُحدد فريق'}
                            </p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${si.color}`}>{si.label}</span>
                          <button
                            onClick={e => { e.stopPropagation(); deletePhase(phase.id); }}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                          {expandedId === phase.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>

                        {expandedId === phase.id && (
                          <div className="px-4 pb-4 border-t border-slate-800 pt-4">
                            {phase.notes && <p className="text-sm text-slate-400 mb-3">{phase.notes}</p>}
                            <div className="flex flex-wrap gap-2">
                              {STATUS_OPTS.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => updateStatus(phase.id, opt.value)}
                                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                    phase.status === opt.value
                                      ? opt.color + ' font-bold'
                                      : 'text-slate-500 border-slate-700 hover:border-slate-500'
                                  }`}
                                >{opt.label}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
