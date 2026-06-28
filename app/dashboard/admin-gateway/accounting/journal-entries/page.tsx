'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, X, ChevronRight, CheckCircle, Trash2, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
const API    = '/api/v1/accounting';
const H      = { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' };

interface JournalEntry {
  id: number; entry_number: string; entry_date: string;
  description: string | null; reference_type: string | null;
  project_name: string | null; site_name: string | null;
  cost_center_name: string | null; status: 'draft' | 'posted';
  total_debit: number; total_credit: number; line_count: number;
}
interface JELine {
  id?: number; account_id: string; account_name?: string; account_code?: string;
  debit: string; credit: string; cost_center_id: string; description: string;
}
interface Account     { id: number; account_code: string; account_name: string; account_type: string; }
interface CostCenter  { id: number; cost_center_code: string; cost_center_name: string; }
interface Project     { id: number; name: string; }
interface Site        { id: number; name: string; }

const emptyLine = (): JELine => ({ account_id: '', debit: '', credit: '', cost_center_id: '', description: '' });

export default function JournalEntriesPage() {
  const { activeProjectId } = useErpContextStore();
  const [entries, setEntries]         = useState<JournalEntry[]>([]);
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [sites, setSites]             = useState<Site[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [detailEntry, setDetailEntry] = useState<any>(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // form state
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '', reference_type: '', project_id: '', site_id: '', cost_center_id: '', status: 'draft',
  });
  const [lines, setLines] = useState<JELine[]>([emptyLine(), emptyLine()]);

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (activeProjectId) params.set('project_id', String(activeProjectId));
      const [je, acc, cc] = await Promise.all([
        fetch(`${API}/journal-entries?${params}`, { headers: H }).then(r => r.json()),
        fetch(`${API}/accounts?active_only=true`, { headers: H }).then(r => r.json()),
        fetch(`${API}/cost-centers?active_only=true`, { headers: H }).then(r => r.json()),
      ]);
      setEntries(je.entries || []);
      setAccounts(acc.accounts || []);
      setCostCenters(cc.cost_centers || []);
    } finally { setLoading(false); }
  }, [statusFilter, activeProjectId]);

  useEffect(() => { load(); }, [load]);

  async function loadSites(pid: string) {
    if (!pid) { setSites([]); return; }
    const r = await fetch(`${API}/projects/${pid}/sites`, { headers: H });
    setSites(await r.json());
  }

  function openCreate() {
    setForm({ entry_date: new Date().toISOString().split('T')[0], description: '', reference_type: '',
              project_id: '', site_id: '', cost_center_id: '', status: 'draft' });
    setLines([emptyLine(), emptyLine()]);
    setSites([]); setError(''); setShowModal(true);
  }

  async function openDetail(id: number) {
    const r = await fetch(`${API}/journal-entries/${id}`, { headers: H });
    setDetailEntry(await r.json());
  }

  function updateLine(i: number, field: keyof JELine, val: string) {
    setLines(ls => ls.map((l, idx) => idx === i ? {...l, [field]: val} : l));
  }

  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i: number) { if (lines.length > 2) setLines(ls => ls.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!isBalanced) { setError(`القيد غير متوازن: مدين=${totalDebit.toFixed(3)} ≠ دائن=${totalCredit.toFixed(3)}`); return; }
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { setError('يجب أن يحتوي القيد على سطرين على الأقل'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        lines: validLines.map(l => ({
          account_id:    parseInt(l.account_id),
          debit:         parseFloat(l.debit)  || 0,
          credit:        parseFloat(l.credit) || 0,
          cost_center_id: l.cost_center_id ? parseInt(l.cost_center_id) : null,
          description:   l.description,
        })),
      };
      const r = await fetch(`${API}/journal-entries`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || 'خطأ في الحفظ'); return; }
      setShowModal(false); load();
    } finally { setSaving(false); }
  }

  async function postEntry(id: number) {
    const r = await fetch(`${API}/journal-entries/${id}/post`, { method: 'POST', headers: H });
    if (r.ok) { load(); if (detailEntry?.id === id) { const d = await fetch(`${API}/journal-entries/${id}`, { headers: H }); setDetailEntry(await d.json()); } }
  }

  async function deleteEntry(id: number) {
    if (!confirm('حذف هذا القيد؟')) return;
    await fetch(`${API}/journal-entries/${id}`, { method: 'DELETE', headers: H });
    setDetailEntry(null); load();
  }

  const postedCount = entries.filter(e => e.status === 'posted').length;
  const totalPostedDebit = entries.filter(e => e.status === 'posted').reduce((s, e) => s + Number(e.total_debit), 0);

  const REF_TYPES = ['manual', 'procurement', 'inventory', 'expense', 'payroll', 'asset', 'other'];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-amber-900/50 p-3 rounded-xl"><FileText className="w-7 h-7 text-amber-400" /></div>
          <div>
            <nav className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
              <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة الإدارة</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/dashboard/admin-gateway/accounting" className="hover:text-slate-300">المحاسبة</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-300">القيود اليومية</span>
            </nav>
            <h1 className="text-xl font-bold text-slate-100">القيود اليومية</h1>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> إضافة قيد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي القيود', value: entries.length, color: 'text-slate-100' },
          { label: 'مرحّلة', value: postedCount, color: 'text-emerald-400' },
          { label: 'مسودة', value: entries.length - postedCount, color: 'text-amber-400' },
          { label: 'إجمالي مدين مرحّل (LYD)', value: totalPostedDebit.toLocaleString('ar-LY', { maximumFractionDigits: 0 }), color: 'text-sky-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="posted">مرحّلة</option>
        </select>
      </div>

      {/* Entries Table + Detail side-by-side on large screens */}
      <div className="flex gap-5 flex-col lg:flex-row">

        {/* Table */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-slate-500 py-16">لا توجد قيود — ابدأ بإضافة قيد</div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="text-xs text-slate-500 bg-slate-800/50 border-b border-slate-800">
                    {['رقم القيد', 'التاريخ', 'البيان', 'المدين', 'الدائن', 'الحالة', ''].map(h => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}
                      onClick={() => openDetail(e.id)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-slate-300 text-xs">{e.entry_number}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{e.entry_date}</td>
                      <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{Number(e.total_debit).toFixed(3)}</td>
                      <td className="px-4 py-3 text-sky-400 font-mono text-xs">{Number(e.total_credit).toFixed(3)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'posted' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
                          {e.status === 'posted' ? 'مرحّل' : 'مسودة'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detailEntry && (
          <div className="lg:w-96 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 self-start">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">{detailEntry.entry_number}</h3>
              <button onClick={() => setDetailEntry(null)} className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>التاريخ: <span className="text-slate-300">{detailEntry.entry_date}</span></div>
              {detailEntry.project_name && <div>المشروع: <span className="text-slate-300">{detailEntry.project_name}</span></div>}
              {detailEntry.cost_center_name && <div>مركز التكلفة: <span className="text-slate-300">{detailEntry.cost_center_name}</span></div>}
              {detailEntry.description && <div>البيان: <span className="text-slate-300">{detailEntry.description}</span></div>}
            </div>

            {/* Lines */}
            <div className="space-y-1.5">
              {(detailEntry.lines || []).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between text-xs bg-slate-800/50 rounded-lg px-3 py-2">
                  <div className="text-slate-300 truncate max-w-[160px]">
                    <span className="text-slate-500 font-mono">{l.account_code}</span> {l.account_name}
                  </div>
                  <div className="flex gap-3 text-right shrink-0">
                    {Number(l.debit) > 0 && <span className="text-emerald-400 font-mono">{Number(l.debit).toFixed(3)}</span>}
                    {Number(l.credit) > 0 && <span className="text-sky-400 font-mono">{Number(l.credit).toFixed(3)}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-between text-xs border-t border-slate-700 pt-3">
              <span className="text-slate-400">الإجمالي</span>
              <div className="flex gap-4">
                <span className="text-emerald-400 font-mono">م: {(detailEntry.lines || []).reduce((s: number, l: any) => s + Number(l.debit), 0).toFixed(3)}</span>
                <span className="text-sky-400 font-mono">د: {(detailEntry.lines || []).reduce((s: number, l: any) => s + Number(l.credit), 0).toFixed(3)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {detailEntry.status === 'draft' && (
                <>
                  <button onClick={() => postEntry(detailEntry.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-2 rounded-lg transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> ترحيل
                  </button>
                  <button onClick={() => deleteEntry(detailEntry.id)}
                    className="flex items-center justify-center gap-1.5 bg-rose-900/40 hover:bg-rose-700 text-rose-400 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {detailEntry.status === 'posted' && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 py-2 px-3 bg-emerald-900/20 rounded-lg w-full">
                  <CheckCircle className="w-3.5 h-3.5" /> قيد مرحّل ومقفول
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">إضافة قيد يومي</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              {error && <div className="bg-rose-900/30 border border-rose-700/50 text-rose-300 text-sm px-3 py-2 rounded-lg">{error}</div>}

              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">تاريخ القيد *</label>
                  <input type="date" value={form.entry_date} onChange={e => setForm(f => ({...f, entry_date: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع المرجع</label>
                  <select value={form.reference_type} onChange={e => setForm(f => ({...f, reference_type: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">يدوي</option>
                    {REF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="draft">مسودة</option>
                    <option value="posted">ترحيل مباشر</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">البيان / الوصف</label>
                  <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    placeholder="وصف موجز للقيد..."
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">المشروع</label>
                  <select value={form.project_id} onChange={e => { setForm(f => ({...f, project_id: e.target.value, site_id: ''})); loadSites(e.target.value); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">— اختياري —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الموقع</label>
                  <select value={form.site_id} onChange={e => setForm(f => ({...f, site_id: e.target.value}))}
                    disabled={!form.project_id}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50">
                    <option value="">— اختياري —</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">مركز التكلفة</label>
                  <select value={form.cost_center_id} onChange={e => setForm(f => ({...f, cost_center_id: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">— اختياري —</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.cost_center_code} — {c.cost_center_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-300">سطور القيد</h3>
                  <button onClick={addLine} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> إضافة سطر
                  </button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-1.5 text-xs text-slate-500 mb-1 px-1">
                  <div className="col-span-4">الحساب *</div>
                  <div className="col-span-2">مدين</div>
                  <div className="col-span-2">دائن</div>
                  <div className="col-span-3">مركز التكلفة</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-1.5">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-4">
                        <select value={l.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500">
                          <option value="">— اختر الحساب —</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.001" value={l.debit} onChange={e => { updateLine(i, 'debit', e.target.value); if (e.target.value) updateLine(i, 'credit', ''); }}
                          placeholder="0.000"
                          className="w-full bg-slate-800 border border-slate-700 text-emerald-300 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500 text-right" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.001" value={l.credit} onChange={e => { updateLine(i, 'credit', e.target.value); if (e.target.value) updateLine(i, 'debit', ''); }}
                          placeholder="0.000"
                          className="w-full bg-slate-800 border border-slate-700 text-sky-300 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 text-right" />
                      </div>
                      <div className="col-span-3">
                        <select value={l.cost_center_id} onChange={e => updateLine(i, 'cost_center_id', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500">
                          <option value="">—</option>
                          {costCenters.map(c => <option key={c.id} value={c.id}>{c.cost_center_code}</option>)}
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        {lines.length > 2 && (
                          <button onClick={() => removeLine(i)} className="text-slate-600 hover:text-rose-400 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance indicator */}
                <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono ${isBalanced ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'bg-rose-900/20 border-rose-700/40 text-rose-300'}`}>
                  <span>
                    {isBalanced ? '✓ القيد متوازن' : '⚠ القيد غير متوازن'}
                  </span>
                  <div className="flex gap-4">
                    <span>مدين: <span className="text-emerald-400">{totalDebit.toFixed(3)}</span></span>
                    <span>دائن: <span className="text-sky-400">{totalCredit.toFixed(3)}</span></span>
                    {!isBalanced && totalDebit > 0 && <span className="text-rose-400">فرق: {Math.abs(totalDebit - totalCredit).toFixed(3)}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">إلغاء</button>
              <button onClick={save} disabled={saving || !isBalanced}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جاري الحفظ...' : 'حفظ القيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
