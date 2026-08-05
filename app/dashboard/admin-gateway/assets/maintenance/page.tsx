'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench, Search, ChevronLeft, User, Calendar, AlertCircle,
  Plus, Clock, CheckCircle2, XCircle, RefreshCw, BarChart3, Package,
} from 'lucide-react';
import Link from 'next/link';

// ── CMMS types ──────────────────────────────────────────────────────────────
interface CmmsWO {
  id: number;
  work_order_number: string;
  asset_id?: string;
  asset_name: string;
  title: string;
  title_ar?: string;
  work_type: string;
  priority: string;
  status: string;
  scheduled_date?: string;
  start_date?: string;
  completion_date?: string;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_to?: string;
  assigned_team?: string;
  target_department?: string;
  notes?: string;
  created_at: string;
  age_hours?: number;
  sla_state?: string;
}

interface AssetSummary {
  asset_name: string;
  total: number;
  open: number;
  in_progress: number;
  completed: number;
  overdue: number;
  total_cost: number;
  last_wo_date?: string;
  health: 'good' | 'warning' | 'critical';
}

// ── Label maps ───────────────────────────────────────────────────────────────
const PRIORITY_AR: Record<string, string>  = { urgent:'عاجل', normal:'عادي', low:'منخفض', high:'عالي', critical:'حرج' };
const STATUS_AR: Record<string, string>    = { pending:'معلق', open:'مفتوح', in_progress:'جاري', completed:'مكتمل', closed:'مغلق', cancelled:'ملغي' };
const TYPE_AR: Record<string, string>      = { inspection:'فحص', preventive:'وقائي', corrective:'تصحيحي', emergency:'طارئ' };
const SLA_AR: Record<string, string>       = { on_time:'في الموعد', overdue:'متأخر', completed:'منجز' };

const PRIORITY_CL: Record<string, string>  = { urgent:'text-rose-400 bg-rose-500/10 border-rose-500/20', normal:'text-blue-400 bg-blue-500/10 border-blue-500/20', low:'text-slate-400 bg-slate-500/10 border-slate-600/20', high:'text-amber-400 bg-amber-500/10 border-amber-500/20' };
const STATUS_CL: Record<string, string>    = { pending:'text-slate-400 bg-slate-700/40', open:'text-blue-400 bg-blue-500/10', in_progress:'text-amber-400 bg-amber-500/10', completed:'text-emerald-400 bg-emerald-500/10', closed:'text-slate-400 bg-slate-700/40', cancelled:'text-rose-400 bg-rose-500/10' };
const SLA_CL: Record<string, string>       = { on_time:'text-emerald-400', overdue:'text-rose-400', completed:'text-slate-400' };

function healthOf(a: Omit<AssetSummary, 'health'>): AssetSummary['health'] {
  if (a.overdue > 0 || (a.open + a.in_progress) > 5) return 'critical';
  if ((a.open + a.in_progress) > 2) return 'warning';
  return 'good';
}

const HEALTH_CL = { good:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', warning:'text-amber-400 bg-amber-500/10 border-amber-500/20', critical:'text-rose-400 bg-rose-500/10 border-rose-500/20' };
const HEALTH_AR = { good:'جيد', warning:'تحذير', critical:'حرج' };

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

export default function AssetMaintenancePage() {
  const [allWOs, setAllWOs]             = useState<CmmsWO[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedAsset, setSelected]    = useState<string | null>(null);
  const [assetSearch, setAssetSearch]   = useState('');

  const fetchWOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/workspace/work-orders?limit=200');
      if (res.ok) {
        const d = await res.json();
        setAllWOs(d.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);

  // ── Build asset summaries ────────────────────────────────────────────────
  const assets: AssetSummary[] = useMemo(() => {
    const map = new Map<string, Omit<AssetSummary, 'health'>>();
    for (const wo of allWOs) {
      const name = wo.asset_name || 'غير محدد';
      if (!map.has(name)) {
        map.set(name, { asset_name: name, total:0, open:0, in_progress:0, completed:0, overdue:0, total_cost:0 });
      }
      const s = map.get(name)!;
      s.total++;
      if (['pending','open'].includes(wo.status))   s.open++;
      if (wo.status === 'in_progress')               s.in_progress++;
      if (['completed','closed'].includes(wo.status)) s.completed++;
      if (wo.sla_state === 'overdue')                s.overdue++;
      s.total_cost += (wo.actual_cost || wo.estimated_cost || 0);
      if (!s.last_wo_date || wo.created_at > s.last_wo_date) s.last_wo_date = wo.created_at;
    }
    return Array.from(map.values()).map(a => ({ ...a, health: healthOf(a) }))
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, good: 2 };
        return order[a.health] - order[b.health];
      });
  }, [allWOs]);

  const filteredAssets = assets.filter(a =>
    !assetSearch || a.asset_name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const activeAsset = selectedAsset ?? filteredAssets[0]?.asset_name ?? null;

  const assetWOs = useMemo(() =>
    allWOs.filter(wo => (wo.asset_name || 'غير محدد') === activeAsset)
      .filter(wo => !searchTerm || wo.title_ar?.includes(searchTerm) || wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) || wo.work_order_number?.includes(searchTerm))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allWOs, activeAsset, searchTerm]
  );

  const selectedSummary = assets.find(a => a.asset_name === activeAsset);

  // Global KPIs
  const gkpi = useMemo(() => ({
    total:    assets.length,
    good:     assets.filter(a => a.health === 'good').length,
    warning:  assets.filter(a => a.health === 'warning').length,
    critical: assets.filter(a => a.health === 'critical').length,
  }), [assets]);

  
  const handleSelectJob = async (job: any) => {
    try {
      console.log('Fetching results for job:', job);
      const res = await fetch('/api/gis/insar-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job?.id || job?.job_id, name: job?.name })
      });
      const data = await res.json();
      if (data.ok) {
        alert('تم جلب بيانات الهبوط والتشوه بنجاح لهذه الوظيفة!');
      }
    } catch (e) {
      console.error('Error fetching InSAR results:', e);
    }
  };

return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="max-w-screen-xl mx-auto space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة النظام</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance/technical" className="hover:text-slate-300">الواجهة الفنية</Link>
          <ChevronLeft className="w-3 h-3" />
          <span className="text-slate-200">تاريخ صيانة الأصول</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/30">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">تاريخ صيانة الأصول</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                سجل أوامر العمل لكل أصل من نظام{' '}
                <Link href="/dashboard/admin-gateway/maintenance/work-orders" className="text-cyan-400 hover:underline">CMMS</Link>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchWOs} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/dashboard/admin-gateway/maintenance/work-orders"
              className="px-3 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs flex items-center gap-1 hover:bg-cyan-600/30 transition-colors">
              <Plus className="w-3.5 h-3.5" /> أمر عمل جديد
            </Link>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الأصول', val: gkpi.total, cl: 'text-slate-300', icon: Package },
            { label: 'حالة جيدة', val: gkpi.good, cl: 'text-emerald-400', icon: CheckCircle2 },
            { label: 'تحذير', val: gkpi.warning, cl: 'text-amber-400', icon: AlertCircle },
            { label: 'حرج / عاجل', val: gkpi.critical, cl: 'text-rose-400', icon: XCircle },
          ].map(({ label, val, cl, icon: Icon }) => (
            <div key={label} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex items-center gap-2">
              <Icon className={`w-4 h-4 shrink-0 ${cl}`} />
              <div>
                <div className={`text-lg font-bold ${cl}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-500" />
            <p>جاري تحميل بيانات CMMS...</p>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            {/* ── Asset list ────────────────────────────── */}
            <div className="w-64 shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={assetSearch} onChange={e => setAssetSearch(e.target.value)}
                  placeholder="بحث عن أصل..."
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 pr-8 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
              <div className="space-y-1 max-h-[65vh] overflow-y-auto pr-1">
                {filteredAssets.map(a => (
                  <button key={a.asset_name} onClick={() => setSelected(a.asset_name)}
                    className={`w-full text-right px-3 py-2.5 rounded-xl border text-xs transition-all ${
                      activeAsset === a.asset_name
                        ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{a.asset_name}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] ${HEALTH_CL[a.health]}`}>
                        {HEALTH_AR[a.health]}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1 text-slate-600">
                      <span>{a.total} أمر</span>
                      {a.overdue > 0 && <span className="text-rose-500">{a.overdue} متأخر</span>}
                    </div>
                  </button>
                ))}
                {filteredAssets.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">لا توجد أصول</p>
                )}
              </div>
            </div>

            {/* ── Asset detail ──────────────────────────── */}
            <div className="flex-1 space-y-3 min-w-0">
              {activeAsset && selectedSummary ? (
                <>
                  {/* Asset header + mini KPIs */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-800 p-2 rounded-lg">
                          <Wrench className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white">{activeAsset}</h2>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${HEALTH_CL[selectedSummary.health]}`}>
                            {HEALTH_AR[selectedSummary.health]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { label: 'إجمالي',     val: selectedSummary.total,        cl: 'text-slate-300' },
                        { label: 'مفتوح',      val: selectedSummary.open,         cl: 'text-blue-400' },
                        { label: 'جاري',       val: selectedSummary.in_progress,  cl: 'text-amber-400' },
                        { label: 'مكتمل',      val: selectedSummary.completed,    cl: 'text-emerald-400' },
                        { label: 'إجمالي التكلفة', val: `${selectedSummary.total_cost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} د.ل`, cl: 'text-violet-400' },
                      ].map(({ label, val, cl }) => (
                        <div key={label} className="bg-slate-800/40 rounded-lg p-2 text-center">
                          <div className={`text-lg font-bold ${cl}`}>{val}</div>
                          <div className="text-xs text-slate-500">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WO History Table */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        سجل أوامر العمل
                      </h3>
                      <div className="relative">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          placeholder="بحث..."
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 pr-8 text-xs text-slate-300 placeholder-slate-600 focus:outline-none w-36" />
                      </div>
                    </div>
                    {assetWOs.length === 0 ? (
                      <div className="p-10 text-center text-slate-500 text-sm">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                        <p>لا توجد أوامر عمل لهذا الأصل</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-800/50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5 text-right font-medium">رقم الأمر</th>
                              <th className="px-3 py-2.5 text-right font-medium">العنوان</th>
                              <th className="px-3 py-2.5 text-right font-medium">النوع</th>
                              <th className="px-3 py-2.5 text-right font-medium">الأولوية</th>
                              <th className="px-3 py-2.5 text-right font-medium">الحالة</th>
                              <th className="px-3 py-2.5 text-right font-medium">SLA</th>
                              <th className="px-3 py-2.5 text-right font-medium">المكلف</th>
                              <th className="px-3 py-2.5 text-right font-medium">الموعد</th>
                              <th className="px-3 py-2.5 text-right font-medium">التكلفة (د.ل)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {assetWOs.map(wo => (
                              <tr key={wo.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-3 py-2.5 font-mono text-slate-400">{wo.work_order_number}</td>
                                <td className="px-3 py-2.5 text-slate-200 max-w-[180px] truncate">
                                  {wo.title_ar || wo.title}
                                </td>
                                <td className="px-3 py-2.5 text-slate-400">
                                  {TYPE_AR[wo.work_type] || wo.work_type}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-1.5 py-0.5 rounded-full border ${PRIORITY_CL[wo.priority] || 'text-slate-400 bg-slate-700/30 border-slate-700'}`}>
                                    {PRIORITY_AR[wo.priority] || wo.priority}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-1.5 py-0.5 rounded-full ${STATUS_CL[wo.status] || 'text-slate-400 bg-slate-700/30'}`}>
                                    {STATUS_AR[wo.status] || wo.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  {wo.sla_state ? (
                                    <span className={SLA_CL[wo.sla_state] || 'text-slate-400'}>
                                      {SLA_AR[wo.sla_state] || wo.sla_state}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-400">
                                  {wo.assigned_to ? (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />{wo.assigned_to}
                                    </span>
                                  ) : wo.assigned_team || '—'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-400">
                                  {wo.scheduled_date
                                    ? new Date(wo.scheduled_date).toLocaleDateString('ar-SA')
                                    : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-300">
                                  {(wo.actual_cost ?? wo.estimated_cost) != null
                                    ? (wo.actual_cost ?? wo.estimated_cost)!.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-16 text-center text-slate-500">
                  <Wrench className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                  <p>اختر أصلاً من القائمة</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
