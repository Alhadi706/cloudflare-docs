'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Save, Settings2, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RoutingRule {
  id: number;
  dept: string;
  work_type: string;
  priority: string | null;
  routing_type: 'internal' | 'external';
  target_dept: string | null;
  target_team: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  dept: 'maintenance' | 'corrosion' | 'operations';
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPT_LABELS: Record<string, string> = {
  maintenance: 'إدارة الصيانة',
  corrosion:   'إدارة التآكل',
  operations:  'إدارة العمليات',
};

const WO_TYPES = [
  { value: 'preventive',  label: 'وقائية' },
  { value: 'corrective',  label: 'تصحيحية' },
  { value: 'emergency',   label: 'طارئة' },
  { value: 'inspection',  label: 'فحص / تفتيش' },
  { value: 'coating',     label: 'طلاء حماية' },
  { value: 'cp_survey',   label: 'مسح CP' },
  { value: 'predictive',  label: 'تنبؤية' },
];

const PRIORITIES = [
  { value: '',         label: 'أي أولوية (افتراضي)' },
  { value: 'critical', label: 'حرج' },
  { value: 'high',     label: 'عالي' },
  { value: 'normal',   label: 'عادي' },
  { value: 'low',      label: 'منخفض' },
];

const TARGET_DEPTS = [
  { value: 'maintenance', label: 'إدارة الصيانة' },
  { value: 'corrosion',   label: 'إدارة التآكل' },
  { value: 'operations',  label: 'إدارة العمليات' },
];

// ─── Blank rule form ──────────────────────────────────────────────────────────
const BLANK: Omit<RoutingRule, 'id'> = {
  dept: '',
  work_type: 'inspection',
  priority: null,
  routing_type: 'internal',
  target_dept: null,
  target_team: '',
  description: null,
  is_active: true,
  sort_order: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RoutingRulesModal({ dept, onClose }: Props) {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | 'new' | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ ...BLANK, dept });
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/workflow/routing-rules?dept=${dept}`);
      const data = await res.json();
      if (data.success) setRules(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [dept]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── Toggle active ──────────────────────────────────────────────────────────
  const toggleActive = async (rule: RoutingRule) => {
    setSaving(rule.id);
    try {
      const res = await fetch(`/api/v1/workflow/routing-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
        showToast(rule.is_active ? '⏸ تم تعطيل القاعدة' : '✅ تم تفعيل القاعدة');
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  // ── Delete rule ───────────────────────────────────────────────────────────
  const deleteRule = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/v1/workflow/routing-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
        showToast('🗑 تم حذف القاعدة');
      }
    } catch { /* ignore */ }
    setDeleting(null);
  };

  // ── Add new rule ──────────────────────────────────────────────────────────
  const addRule = async () => {
    if (!newRule.target_team.trim()) {
      showToast('⚠️ أدخل اسم الفرقة المنفِّذة');
      return;
    }
    setSaving('new');
    try {
      const res = await fetch('/api/v1/workflow/routing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRule,
          priority: newRule.priority || null,
          target_dept: newRule.routing_type === 'external' ? newRule.target_dept : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => [...prev, data.data]);
        setNewRule({ ...BLANK, dept });
        setShowAddForm(false);
        showToast('✅ تمت إضافة القاعدة');
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const routingTypeColors = {
    internal: 'bg-indigo-900/40 border-indigo-500/30 text-indigo-300',
    external: 'bg-amber-900/40 border-amber-500/30 text-amber-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="font-bold text-slate-100 text-base">قواعد توزيع أوامر العمل</h2>
              <p className="text-xs text-slate-400">{DEPT_LABELS[dept]} — تحديد الفرق المنفِّذة تلقائياً حسب نوع الأمر</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {loading && (
            <div className="text-center py-12 text-slate-500 text-sm">جاري التحميل...</div>
          )}

          {!loading && rules.length === 0 && !showAddForm && (
            <div className="text-center py-12 text-slate-500 text-sm">
              لا توجد قواعد توزيع بعد — أضف قاعدة جديدة أدناه
            </div>
          )}

          {/* Rules list */}
          {rules.map(rule => (
            <div key={rule.id}
              className={`rounded-xl border p-4 transition-opacity ${rule.is_active ? 'opacity-100' : 'opacity-50'} ${routingTypeColors[rule.routing_type]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* WO type badge */}
                    <span className="px-2 py-0.5 bg-slate-800 rounded-full border border-slate-600 text-slate-300">
                      {WO_TYPES.find(t => t.value === rule.work_type)?.label ?? rule.work_type}
                    </span>
                    {rule.priority && (
                      <span className="px-2 py-0.5 bg-rose-900/40 rounded-full border border-rose-500/30 text-rose-300">
                        {PRIORITIES.find(p => p.value === rule.priority)?.label ?? rule.priority}
                      </span>
                    )}
                    {/* routing badge */}
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${
                      rule.routing_type === 'internal'
                        ? 'bg-indigo-900/60 border-indigo-500/40 text-indigo-200'
                        : 'bg-amber-900/60 border-amber-500/40 text-amber-200'
                    }`}>
                      {rule.routing_type === 'internal' ? 'داخلي' : `خارجي → ${DEPT_LABELS[rule.target_dept ?? ''] ?? rule.target_dept}`}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-100 text-sm truncate">
                    الفرقة: {rule.target_team}
                  </p>
                  {rule.description && (
                    <p className="text-xs text-slate-400 truncate">{rule.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(rule)}
                    disabled={saving === rule.id}
                    title={rule.is_active ? 'تعطيل' : 'تفعيل'}
                    className={`w-10 h-6 rounded-full transition-colors relative ${rule.is_active ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${rule.is_active ? 'right-0.5' : 'right-4'}`} />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteRule(rule.id)}
                    disabled={deleting === rule.id}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add new rule form */}
          {showAddForm && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">قاعدة جديدة</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Work type */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع أمر العمل *</label>
                  <select value={newRule.work_type}
                    onChange={e => setNewRule(p => ({ ...p, work_type: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm">
                    {WO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {/* Priority */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">تُطبَّق عند الأولوية</label>
                  <select value={newRule.priority ?? ''}
                    onChange={e => setNewRule(p => ({ ...p, priority: e.target.value || null }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                {/* Routing type */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع التوجيه *</label>
                  <select value={newRule.routing_type}
                    onChange={e => setNewRule(p => ({ ...p, routing_type: e.target.value as 'internal' | 'external' }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm">
                    <option value="internal">داخلي (فرق الإدارة نفسها)</option>
                    <option value="external">خارجي (إدارة أخرى)</option>
                  </select>
                </div>
                {/* Target dept — only when external */}
                {newRule.routing_type === 'external' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">الإدارة المستهدفة *</label>
                    <select value={newRule.target_dept ?? ''}
                      onChange={e => setNewRule(p => ({ ...p, target_dept: e.target.value || null }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm">
                      <option value="">— اختر —</option>
                      {TARGET_DEPTS.filter(d => d.value !== dept).map(d =>
                        <option key={d.value} value={d.value}>{d.label}</option>
                      )}
                    </select>
                  </div>
                )}
                {/* Target team */}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">الفرقة المنفِّذة *</label>
                  <input
                    value={newRule.target_team}
                    onChange={e => setNewRule(p => ({ ...p, target_team: e.target.value }))}
                    placeholder="مثال: فرقة UT، فرقة الصيانة الوقائية"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-500" />
                </div>
                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">وصف (اختياري)</label>
                  <input
                    value={newRule.description ?? ''}
                    onChange={e => setNewRule(p => ({ ...p, description: e.target.value || null }))}
                    placeholder="ملاحظة توضيحية لهذه القاعدة"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-500" />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  إلغاء
                </button>
                <button onClick={addRule} disabled={saving === 'new'}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {saving === 'new' ? 'جاري الحفظ...' : 'حفظ القاعدة'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/40 flex items-center justify-between">
          <button
            onClick={() => { setShowAddForm(v => !v); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-700/60 hover:bg-indigo-600/80 text-indigo-200 text-sm rounded-xl border border-indigo-500/30 transition-colors">
            {showAddForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'إخفاء النموذج' : 'إضافة قاعدة جديدة'}
          </button>
          <button onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-xl transition-colors">
            إغلاق
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 border border-slate-600 text-slate-200 px-5 py-3 rounded-xl text-sm shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
