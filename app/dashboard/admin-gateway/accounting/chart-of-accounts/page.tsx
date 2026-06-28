'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Edit2, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import ImportButton from '@/components/ImportButton';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
const API    = '/api/v1/accounting';
const H      = { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' };

const ACCOUNT_TYPES: Record<string, { label: string; color: string }> = {
  asset:     { label: 'أصول',     color: 'text-emerald-400 bg-emerald-900/30' },
  liability: { label: 'خصوم',     color: 'text-rose-400 bg-rose-900/30' },
  equity:    { label: 'حقوق ملكية', color: 'text-purple-400 bg-purple-900/30' },
  revenue:   { label: 'إيرادات',  color: 'text-sky-400 bg-sky-900/30' },
  expense:   { label: 'مصروفات', color: 'text-amber-400 bg-amber-900/30' },
};

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: number | null;
  parent_name: string | null;
  parent_code: string | null;
  level: number;
  is_active: boolean;
  notes: string | null;
}

const blank = (): Partial<Account> & { account_code: string; account_name: string; account_type: string } => ({
  account_code: '', account_name: '', account_type: 'expense',
  parent_id: undefined, is_active: true, notes: '',
});

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Account | null>(null);
  const [form, setForm]           = useState(blank());
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('account_type', typeFilter);
      if (search)     params.set('search', search);
      const r = await fetch(`${API}/accounts?${params}`, { headers: H });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(blank()); setError(''); setShowModal(true); }
  function openEdit(a: Account) {
    setEditing(a);
    setForm({ account_code: a.account_code, account_name: a.account_name, account_type: a.account_type,
              parent_id: a.parent_id ?? undefined, is_active: a.is_active, notes: a.notes ?? '' });
    setError(''); setShowModal(true);
  }

  async function save() {
    if (!form.account_name?.trim()) { setError('اسم الحساب مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const url  = editing ? `${API}/accounts/${editing.id}` : `${API}/accounts`;
      const meth = editing ? 'PUT' : 'POST';
      const r    = await fetch(url, { method: meth, headers: H, body: JSON.stringify(form) });
      const d    = await r.json();
      if (!r.ok) { setError(d.detail || 'خطأ في الحفظ'); return; }
      setShowModal(false); load();
    } finally {
      setSaving(false);
    }
  }

  // stats
  const stats = Object.fromEntries(
    Object.entries(ACCOUNT_TYPES).map(([k]) => [k, accounts.filter(a => a.account_type === k).length])
  );
  const activeCount = accounts.filter(a => a.is_active).length;

  // group by type for display
  const grouped: Record<string, Account[]> = {};
  accounts.forEach(a => { (grouped[a.account_type] = grouped[a.account_type] || []).push(a); });

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-900/50 p-3 rounded-xl">
            <BookOpen className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <nav className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
              <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة الإدارة</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/dashboard/admin-gateway/accounting" className="hover:text-slate-300">المحاسبة</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-300">دليل الحسابات</span>
            </nav>
            <h1 className="text-xl font-bold text-slate-100">دليل الحسابات (COA)</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton moduleKey="chart_of_accounts" onSuccess={load} />
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> إضافة حساب
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-100">{accounts.length}</div>
          <div className="text-xs text-slate-400 mt-1">إجمالي الحسابات</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
          <div className="text-xs text-slate-400 mt-1">نشطة</div>
        </div>
        {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
          <div key={k} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${v.color.split(' ')[0]}`}>{stats[k] || 0}</div>
            <div className="text-xs text-slate-400 mt-1">{v.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرمز..."
          className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-w-[140px]">
          <option value="">كل الأنواع</option>
          {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Accounts table grouped by type */}
      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center text-slate-500 py-16">لا توجد حسابات — ابدأ بإضافة دليل الحسابات</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(ACCOUNT_TYPES).map(([typeKey, typeMeta]) => {
            const group = grouped[typeKey];
            if (!group || (typeFilter && typeFilter !== typeKey)) return null;
            return (
              <div key={typeKey} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className={`flex items-center gap-3 px-5 py-3 border-b border-slate-800`}>
                  <span className={`text-sm font-semibold px-3 py-0.5 rounded-full ${typeMeta.color}`}>{typeMeta.label}</span>
                  <span className="text-xs text-slate-500">{group.length} حساب</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="px-4 py-2">الرمز</th>
                        <th className="px-4 py-2">اسم الحساب</th>
                        <th className="px-4 py-2">الحساب الأب</th>
                        <th className="px-4 py-2">المستوى</th>
                        <th className="px-4 py-2">الحالة</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map(a => (
                        <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-slate-300 text-xs">{a.account_code}</td>
                          <td className="px-4 py-3">
                            <span style={{ paddingRight: `${(a.level - 1) * 16}px` }} className="text-slate-200">
                              {a.level > 1 && <span className="text-slate-600 mr-1">└</span>}
                              {a.account_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {a.parent_code ? `${a.parent_code} - ${a.parent_name}` : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{a.level}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                              {a.is_active ? 'نشط' : 'معطّل'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => openEdit(a)} className="text-slate-500 hover:text-indigo-400 transition-colors p-1">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">
                {editing ? 'تعديل حساب' : 'إضافة حساب جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-rose-900/30 border border-rose-700/50 text-rose-300 text-sm px-3 py-2 rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">رمز الحساب</label>
                  <input value={form.account_code} onChange={e => setForm(f => ({...f, account_code: e.target.value}))}
                    disabled={!!editing}
                    placeholder="تلقائي إن تُرك فارغاً"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع الحساب *</label>
                  <select value={form.account_type} onChange={e => setForm(f => ({...f, account_type: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم الحساب *</label>
                <input value={form.account_name} onChange={e => setForm(f => ({...f, account_name: e.target.value}))}
                  placeholder="مثال: نقدية الصندوق، مصروفات الوقود..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>

              {!editing && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الحساب الأب (اختياري)</label>
                  <select value={form.parent_id ?? ''} onChange={e => setForm(f => ({...f, parent_id: e.target.value ? Number(e.target.value) : undefined}))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    <option value="">— بدون أب (مستوى 1) —</option>
                    {accounts.filter(a => a.account_type === form.account_type && a.is_active).map(a => (
                      <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={!!form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))}
                  className="rounded" />
                <label htmlFor="is_active" className="text-sm text-slate-300">حساب نشط</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">إلغاء</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
