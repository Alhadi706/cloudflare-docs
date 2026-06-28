'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Map, Shield, DollarSign, CheckCircle, XCircle,
  ChevronDown, ChevronUp, RefreshCw, Loader2, AlertTriangle,
  Tag, Clock, FileText, MapPin, Users, Banknote, Zap, BarChart2
} from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' };

type Dept = 'gis' | 'admin' | 'finance';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssetItem {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  source_type: string;
  review_level: string;
  gis_approved: boolean;
  admin_approved: boolean;
  fin_approved: boolean;
  created_at: string;
  change_request_notes: string | null;
  properties: Record<string, unknown>;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const DEPT_CONFIG: Record<Dept, { label: string; labelAr: string; color: string; border: string; bg: string; icon: React.ReactNode }> = {
  gis: {
    label: 'GIS',
    labelAr: 'مراجعة جغرافية',
    color: 'text-teal-400',
    border: 'border-teal-500/50',
    bg: 'bg-teal-600/20',
    icon: <Map className="w-5 h-5" />,
  },
  admin: {
    label: 'Admin',
    labelAr: 'مراجعة إدارية',
    color: 'text-blue-400',
    border: 'border-blue-500/50',
    bg: 'bg-blue-600/20',
    icon: <Shield className="w-5 h-5" />,
  },
  finance: {
    label: 'Finance',
    labelAr: 'مراجعة مالية',
    color: 'text-amber-400',
    border: 'border-amber-500/50',
    bg: 'bg-amber-600/20',
    icon: <DollarSign className="w-5 h-5" />,
  },
};

const CATEGORY_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  location_only:  { label: 'موقع فقط',      color: 'bg-teal-900/40 text-teal-300 border-teal-700',    icon: <MapPin className="w-3 h-3" /> },
  admin_only:     { label: 'إداري فقط',      color: 'bg-blue-900/40 text-blue-300 border-blue-700',    icon: <Users className="w-3 h-3" /> },
  finance_only:   { label: 'مالي فقط',       color: 'bg-amber-900/40 text-amber-300 border-amber-700', icon: <Banknote className="w-3 h-3" /> },
  admin_finance:  { label: 'إداري + مالي',   color: 'bg-purple-900/40 text-purple-300 border-purple-700', icon: <FileText className="w-3 h-3" /> },
  gis_admin:      { label: 'جغرافي + إداري', color: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',    icon: <MapPin className="w-3 h-3" /> },
  full:           { label: 'شامل',           color: 'bg-indigo-900/40 text-indigo-300 border-indigo-700', icon: <Tag className="w-3 h-3" /> },
};

const SOURCE_LABELS: Record<string, string> = {
  file_upload: 'رفع ملف', map_drawing: 'رسم خريطة',
  admin_manual_entry: 'إدخال إداري', finance_manual_entry: 'إدخال مالي',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CFG[category] ?? { label: category, color: 'bg-slate-700 text-slate-300 border-slate-600', icon: <Tag className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function Pipeline({ item }: { item: AssetItem }) {
  const steps = [
    { label: 'GIS',  done: item.gis_approved },
    { label: 'Admin', done: item.admin_approved },
    { label: 'مالي', done: item.fin_approved },
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <div className={`w-4 h-px ${s.done ? 'bg-green-600' : 'bg-slate-700'}`} />}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.done ? 'bg-green-900/50 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Asset Card ─────────────────────────────────────────────────────────────────

function AssetCard({ item, dept, onDone }: { item: AssetItem; dept: Dept; onDone: (id: string) => void }) {
  const [expanded, setExpanded]     = useState(false);
  const [notes, setNotes]           = useState('');
  const [rejectReason, setReject]   = useState('');
  const [mode, setMode]             = useState<'idle' | 'reject'>('idle');
  const [loading, setLoading]       = useState<'approve' | 'reject' | null>(null);
  const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  const category = (item.properties?._data_category as string) ?? 'full';

  async function approve() {
    setLoading('approve');
    try {
      const res = await fetch(`/api/v1/review/approve/${item.asset_id}`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ department: dept, notes: notes || null, tenant_id: getTenantId() || '', reviewer_id: 'admin_user' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'خطأ');
      setResult({ ok: true, msg: data.message ?? '✅ تمت الموافقة' });
      setTimeout(() => onDone(item.asset_id), 900);
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'فشل' });
    } finally { setLoading(null); }
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    setLoading('reject');
    try {
      const res = await fetch(`/api/v1/review/reject/${item.asset_id}`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ department: dept, reason: rejectReason, tenant_id: getTenantId() || '', reviewer_id: 'admin_user' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'خطأ');
      setResult({ ok: true, msg: data.message ?? '🚫 رُفض' });
      setTimeout(() => onDone(item.asset_id), 900);
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'فشل' });
    } finally { setLoading(null); }
  }

  return (
    <div className={`bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden transition-all ${result ? 'opacity-60 scale-[0.99]' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-200 truncate">{item.asset_name || '—'}</span>
            <CategoryBadge category={category} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.created_at).toLocaleDateString('ar')}</span>
            <span>{SOURCE_LABELS[item.source_type] ?? item.source_type}</span>
            <span className="text-slate-600">{item.asset_type}</span>
          </div>
          <div className="mt-1.5"><Pipeline item={item} /></div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-slate-500 hover:text-slate-300 p-1 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-800">
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(item.properties ?? {}).filter(([k]) => !k.startsWith('_')).slice(0, 12).map(([k, v]) => (
              <div key={k} className="bg-slate-800/60 rounded px-2 py-1">
                <span className="text-slate-500">{k}: </span>
                <span className="text-slate-300">{String(v)}</span>
              </div>
            ))}
          </div>
          {item.change_request_notes && (
            <div className="mt-2 p-2 bg-amber-900/20 border border-amber-700/50 rounded text-xs text-amber-300">
              <AlertTriangle className="w-3 h-3 inline ml-1" />{item.change_request_notes}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={`px-4 py-2 text-sm font-medium ${result.ok ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
          {result.msg}
        </div>
      )}

      {!result && (
        <div className="px-4 pb-4">
          {mode === 'idle' && (
            <div className="flex items-center gap-2">
              <input type="text" placeholder="ملاحظة (اختياري)" value={notes} onChange={e => setNotes(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
              <button onClick={approve} disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-green-700/30 hover:bg-green-700/50 text-green-300 border border-green-700/50 transition-colors disabled:opacity-50">
                {loading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}موافقة
              </button>
              <button onClick={() => setMode('reject')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/50 transition-colors">
                <XCircle className="w-4 h-4" />رفض
              </button>
            </div>
          )}
          {mode === 'reject' && (
            <div className="flex items-center gap-2">
              <input type="text" placeholder="سبب الرفض (مطلوب)" value={rejectReason} onChange={e => setReject(e.target.value)} autoFocus
                className="flex-1 bg-slate-800 border border-red-800/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-600" />
              <button onClick={reject} disabled={!rejectReason.trim() || !!loading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-red-700/40 hover:bg-red-700/60 text-red-300 border border-red-700/50 transition-colors disabled:opacity-40">
                {loading === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}تأكيد
              </button>
              <button onClick={() => { setMode('idle'); setReject(''); }} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-300">إلغاء</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dept Queue Panel ───────────────────────────────────────────────────────────

function DeptPanel({ dept }: { dept: Dept }) {
  const [items, setItems]   = useState<AssetItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const cfg = DEPT_CONFIG[dept];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/review/pending/${dept}?tenant_id=${encodeURIComponent(getTenantId() || '')}&limit=50`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const data = await res.json();
      setItems(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch { setItems([]); setTotal(0); }
    finally { setLoading(false); }
  }, [dept]);

  useEffect(() => { load(); }, [load]);

  function removeItem(id: string) {
    setItems(prev => prev.filter(x => x.asset_id !== id));
    setTotal(prev => Math.max(0, prev - 1));
  }

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border ${cfg.border}`}>
        <div className={`flex items-center gap-2 font-semibold ${cfg.color}`}>
          {cfg.icon}<span>{cfg.labelAr}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 ${total > 0 ? cfg.color : 'text-slate-500'}`}>{total}</span>
        </div>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 p-1" title="تحديث">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin ml-2" />جار التحميل…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
          <CheckCircle className="w-8 h-8 text-green-700/50" />
          <span className="text-sm">لا توجد بنود معلقة</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => <AssetCard key={item.asset_id} item={item} dept={dept} onDone={removeItem} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const DEPTS: Dept[] = ['gis', 'admin', 'finance'];

export default function ReviewDashboard() {
  const [activeTab, setActiveTab] = useState<Dept>('gis');
  const [counts, setCounts] = useState<Record<Dept, number>>({ gis: 0, admin: 0, finance: 0 });
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<{ auto_approved: number; requires_review: number } | null>(null);

  async function fetchCounts() {
    const results = await Promise.all(
      DEPTS.map(d =>
        fetch(`/api/v1/review/pending/${d}?tenant_id=${encodeURIComponent(getTenantId() || '')}&limit=1`, { headers: { 'X-Tenant-ID': getTenantId() || '' } })
          .then(r => r.json()).then(j => ({ d, total: j.total ?? 0 })).catch(() => ({ d, total: 0 }))
      )
    );
    const map = { gis: 0, admin: 0, finance: 0 } as Record<Dept, number>;
    results.forEach(r => { map[r.d as Dept] = r.total; });
    setCounts(map);
    const first = DEPTS.find(d => map[d] > 0);
    if (first) setActiveTab(first);
  }

  useEffect(() => { fetchCounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runBatchMatch() {
    setBatchLoading(true); setBatchResult(null);
    try {
      const res = await fetch(`/api/v1/review/auto-match/batch/pending?tenant_id=${getTenantId() || ''}&limit=100`, {
        method: 'POST', headers: { 'X-Tenant-ID': getTenantId() || '' },
      });
      const data = await res.json();
      setBatchResult({ auto_approved: data.auto_approved ?? 0, requires_review: data.requires_review ?? 0 });
      await fetchCounts();
    } finally { setBatchLoading(false); }
  }

  const totalPending = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-3 rounded-xl"><CheckCircle className="w-8 h-8 text-teal-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">طوابير المراجعة الدائرية</h1>
              <p className="text-slate-400 text-sm mt-1">كل قسم يرى فقط ما يخصه — تحريك ذكي حسب تصنيف البيانات</p>
            </div>
          </div>
          <button onClick={runBatchMatch} disabled={batchLoading || totalPending === 0}
            className="flex items-center gap-2 bg-indigo-700/40 hover:bg-indigo-700/70 text-indigo-300 border border-indigo-600/50 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-40">
            <Zap className="w-4 h-4" />
            {batchLoading ? 'جارٍ المعالجة…' : 'مطابقة تلقائية'}
          </button>
        </div>

        {/* Batch result */}
        {batchResult && (
          <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl p-4 flex gap-6 text-sm">
            <span className="text-green-400 font-medium">✓ {batchResult.auto_approved} اعتمدوا تلقائيًا</span>
            <span className="text-yellow-400">⏳ {batchResult.requires_review} يحتاجون مراجعة</span>
          </div>
        )}

        {/* Flow diagram */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">تدفق سير الموافقة حسب تصنيف البيانات</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" dir="ltr">
            {[
              { l: 'استيراد', c: 'bg-slate-700 text-slate-300' },
              { l: 'GIS ←', c: 'bg-teal-900/50 text-teal-300 border border-teal-700/50' },
              { l: 'Admin ←', c: 'bg-blue-900/50 text-blue-300 border border-blue-700/50' },
              { l: 'Finance ←', c: 'bg-amber-900/50 text-amber-300 border border-amber-700/50' },
              { l: '✓ معتمد', c: 'bg-green-900/50 text-green-300 border border-green-700/50' },
            ].map((s, i, a) => (
              <span key={i} className="flex items-center gap-1">
                <span className={`px-2 py-1 rounded-full font-medium ${s.c}`}>{s.l}</span>
                {i < a.length - 1 && <span className="text-slate-600">→</span>}
              </span>
            ))}
            <span className="text-slate-600 text-xs mr-2">(المسار يتغير حسب فئة البيانات)</span>
          </div>
        </div>

        {/* Category legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_CFG).map(([k, v]) => (
            <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${v.color}`}>
              {v.icon}{v.label}
            </span>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800">
          {DEPTS.map(d => {
            const cfg = DEPT_CONFIG[d];
            const active = activeTab === d;
            return (
              <button key={d} onClick={() => setActiveTab(d)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? `bg-slate-800 ${cfg.color} shadow-md` : 'text-slate-500 hover:text-slate-300'}`}>
                {cfg.icon}<span>{cfg.labelAr}</span>
                {counts[d] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-700' : 'bg-slate-800'} ${cfg.color}`}>{counts[d]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active queue */}
        <DeptPanel key={activeTab} dept={activeTab} />
      </div>
    </div>
  );
}
