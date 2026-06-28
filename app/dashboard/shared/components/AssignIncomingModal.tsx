'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface IncomingWO {
  id: number;
  work_order_number?: string;
  title: string;
  title_ar?: string;
  work_type?: string;
  priority?: string;
  status?: string;
  source_dept?: string;
  target_department?: string;
  notes?: string;
}

interface RoutingRule {
  id: number;
  target_team: string;
  description: string | null;
  routing_type: string;
}

interface Props {
  workOrder: IncomingWO;
  dept: 'maintenance' | 'corrosion' | 'operations';
  onConfirm: (woId: number, assignedTeam: string, notes: string) => Promise<void>;
  onClose: () => void;
}

// ─── Labels ───────────────────────────────────────────────────────────────────
const DEPT_LABELS: Record<string, string> = {
  maintenance: 'إدارة الصيانة',
  corrosion:   'إدارة التآكل',
  operations:  'إدارة العمليات',
};

const TYPE_AR: Record<string, string> = {
  preventive: 'وقائية',
  corrective: 'تصحيحية',
  emergency:  'طارئة',
  inspection: 'فحص / تفتيش',
  coating:    'طلاء حماية',
  cp_survey:  'مسح CP',
  predictive: 'تنبؤية',
};

const PRIORITY_AR: Record<string, { label: string; cls: string }> = {
  emergency:{ label: 'طارئة',   cls: 'bg-red-900/40 border-red-500/30 text-red-300' },
  critical: { label: 'حرج',     cls: 'bg-rose-900/40 border-rose-500/30 text-rose-300' },
  urgent:   { label: 'عاجل',    cls: 'bg-orange-900/40 border-orange-500/30 text-orange-300' },
  high:     { label: 'عالي',    cls: 'bg-orange-900/40 border-orange-500/30 text-orange-300' },
  corrective:{ label: 'تصحيحية', cls: 'bg-amber-900/40 border-amber-500/30 text-amber-300' },
  periodic: { label: 'دورية',   cls: 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300' },
  normal:   { label: 'عادي',    cls: 'bg-slate-700 border-slate-600 text-slate-300' },
  low:      { label: 'منخفض',   cls: 'bg-slate-800 border-slate-700 text-slate-400' },
};

const CORROSION_PRESET_TEAMS = [
  'مدير إدارة التآكل',
  'الإدارة الإدارية للتآكل',
  'قسم المراقبة الدورية والصيانة',
  'قسم الدعم الفني',
  'قسم المكونات الهندسية والطلاء',
  'فريق UT/السماكة',
  'فريق الحماية الكاثودية',
  'فريق NDE',
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AssignIncomingModal({ workOrder, dept, onConfirm, onClose }: Props) {
  const [suggestion, setSuggestion] = useState<RoutingRule | null>(null);
  const [allRules, setAllRules] = useState<RoutingRule[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [customTeam, setCustomTeam] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);

  // ── Fetch rules + suggestion ───────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      setLoadingRules(true);
      try {
        // All active rules for this dept
        const rulesRes = await fetch(`/api/v1/workflow/routing-rules?dept=${dept}`);
        const rulesData = await rulesRes.json();
        if (rulesData.success) {
          const active = rulesData.data.filter((r: RoutingRule & { is_active: boolean }) => r.is_active);
          setAllRules(active);
        }

        // Suggestion for this specific WO
        const workType = workOrder.work_type || 'inspection';
        const priority = workOrder.priority || '';
        const suggestRes = await fetch(
          `/api/v1/workflow/routing-rules/suggest?dept=${dept}&work_type=${workType}&priority=${priority}`
        );
        const suggestData = await suggestRes.json();
        if (suggestData.suggestion) {
          setSuggestion(suggestData.suggestion);
          setSelectedTeam(suggestData.suggestion.target_team);
        }
      } catch { /* ignore */ }
      setLoadingRules(false);
    };
    loadData();
  }, [dept, workOrder.work_type, workOrder.priority]);

  const finalTeam = useCustom ? customTeam.trim() : selectedTeam;

  const handleConfirm = async () => {
    if (!finalTeam) return;
    setSaving(true);
    try {
      await onConfirm(workOrder.id, finalTeam, notes);
    } finally {
      setSaving(false);
    }
  };

  const priority = String(workOrder.priority || 'normal').toLowerCase();
  const priorityInfo = PRIORITY_AR[priority] ?? PRIORITY_AR['normal'];
  const workflowClass =
    priority === 'emergency' || priority === 'critical' || priority === 'urgent'
      ? 'مسار عاجل'
      : ['corrective'].includes(priority) || workOrder.work_type === 'corrective'
        ? 'مسار تصحيحي'
        : ['periodic', 'preventive'].includes(priority) || workOrder.work_type === 'preventive'
          ? 'مسار دوري'
          : 'مسار تشغيلي';

  // ── Unique teams from rules for quick select ───────────────────────────────
  const quickTeams = Array.from(
    new Set([
      ...allRules.map(r => r.target_team),
      ...(dept === 'corrosion' ? CORROSION_PRESET_TEAMS : []),
    ])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="font-bold text-slate-100 text-base">توزيع أمر وارد على فرقة</h2>
              <p className="text-xs text-slate-400">
                وارد من: {DEPT_LABELS[workOrder.source_dept ?? ''] ?? workOrder.source_dept ?? '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* WO Summary card */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-100 text-sm leading-snug flex-1">
                {workOrder.title_ar || workOrder.title}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${priorityInfo.cls}`}>
                {priorityInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{workOrder.work_order_number ?? `#${workOrder.id}`}</span>
              <span>·</span>
              <span>{TYPE_AR[workOrder.work_type ?? ''] ?? workOrder.work_type ?? '—'}</span>
              <span>·</span>
              <span className="text-indigo-300">{workflowClass}</span>
            </div>
          </div>

          {/* Auto-suggestion */}
          {!loadingRules && suggestion && (
            <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="text-emerald-300 font-medium">اقتراح تلقائي: </span>
                <span className="text-emerald-200">{suggestion.target_team}</span>
                {suggestion.description && (
                  <span className="text-emerald-400/70"> — {suggestion.description}</span>
                )}
              </div>
            </div>
          )}

          {!loadingRules && !suggestion && allRules.length === 0 && (
            <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">لا توجد قواعد توزيع مُعرَّفة — أدخل الفرقة يدوياً أو أضف قواعد من إعدادات التوزيع</p>
            </div>
          )}

          {/* Team selection */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">اختر الفرقة المنفِّذة *</label>

            {/* Quick select buttons from rules */}
            {quickTeams.length > 0 && !useCustom && (
              <div className="flex flex-wrap gap-2">
                {quickTeams.map(team => (
                  <button
                    key={team}
                    onClick={() => setSelectedTeam(team)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedTeam === team
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500/50'
                    }`}>
                    {team}
                  </button>
                ))}
              </div>
            )}

            {/* Custom input toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setUseCustom(v => !v); setCustomTeam(''); }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  useCustom
                    ? 'bg-indigo-700/40 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
                }`}>
                {useCustom ? 'استخدم الاقتراحات' : '+ فرقة أخرى (يدوي)'}
              </button>
            </div>

            {useCustom && (
              <input
                value={customTeam}
                onChange={e => setCustomTeam(e.target.value)}
                placeholder="اكتب اسم الفرقة..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="تعليمات خاصة للفرقة أو سبب التوزيع..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm resize-none placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>

          {/* Selected team summary */}
          {finalTeam && (
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>سيُوزَّع الأمر على: <strong>{finalTeam}</strong></span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/40 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!finalTeam || saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors">
            <Users className="w-4 h-4" />
            {saving ? 'جاري التوزيع...' : 'توزيع على الفرقة'}
          </button>
        </div>
      </div>
    </div>
  );
}
