'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Wrench, ChevronLeft, RefreshCw, Printer, FolderOpen, MapPin, AlertCircle } from 'lucide-react';
import { getClientTenantId } from '@/lib/getClientTenantId';

const BASE = '/api/v1/gov-reports';

interface Project { id: number; name: string; code: string; }
interface Site { id: number; name: string; }
interface FuelByType { fuel_type: string; total_liters: number; total_cost: number; }
interface ProjectBreak {
  project_name: string;
  project_id: number;
  vehicles: number;
  equipment: number;
  fuel_cost: number;
  po_amount: number;
  inventory_issued: number;
}

interface OpsData {
  generated_at: string;
  fleet_status?: {
    active_vehicles: number;
    maintenance_vehicles: number;
    out_of_service_vehicles: number;
    total_vehicles: number;
    active_equipment: number;
    maintenance_equipment: number;
    total_equipment: number;
  };
  fuel_summary?: {
    total_liters: number;
    total_fuel_cost: number;
  };
  fuel_by_type?: FuelByType[];
  inventory?: {
    issue_count?: number;
    total_issued_value?: number;
    receipt_count?: number;
    total_received_value?: number;
  };
  purchase_orders?: { pending_count?: number; issue_count?: number; };
  approvals?: { pending_count?: number; approved_count?: number; rejected_count?: number; };
  projects_breakdown?: ProjectBreak[];
}

function fmt(n: number | undefined | null) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('ar-LY', { maximumFractionDigits: 2 });
}

export default function OperationsReportPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [projId, setProjId] = useState<string>('');
  const [siteId, setSiteId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchFilters = useCallback(async () => {
    const tenant = getClientTenantId();
    const [pr, sr] = await Promise.all([
      fetch(`${BASE}/projects`, { headers: { 'X-Tenant-ID': tenant } }),
      fetch(`${BASE}/sites`, { headers: { 'X-Tenant-ID': tenant } }),
    ]);
    if (pr.ok) setProjects(await pr.json());
    if (sr.ok) setSites(await sr.json());
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const tenant = getClientTenantId();
      const params = new URLSearchParams();
      if (projId) params.set('project_id', projId);
      if (siteId) params.set('site_id', siteId);
      const q = params.toString() ? `?${params}` : '';
      const r = await fetch(`${BASE}/operations${q}`, { headers: { 'X-Tenant-ID': tenant } });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail ?? JSON.stringify(json));
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projId, siteId]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 print:bg-white print:p-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400 print:hidden">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/reports" className="hover:text-slate-200">التقارير</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">العمليات</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="bg-rose-600/20 p-4 rounded-xl border border-rose-500/50 print:hidden">
            <Wrench className="w-8 h-8 text-rose-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-100 print:text-black">تقرير العمليات الميدانية</h1>
            {data && <p className="text-xs text-slate-400 mt-1">تاريخ الإنشاء: {new Date(data.generated_at).toLocaleString('ar-LY')}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <select className="bg-transparent text-slate-200 text-sm outline-none" value={projId} onChange={e => { setProjId(e.target.value); setSiteId(''); }}>
                <option value="">كل المشاريع</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <select className="bg-transparent text-slate-200 text-sm outline-none" value={siteId} onChange={e => setSiteId(e.target.value)}>
                <option value="">كل المواقع</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => window.print()} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition">
              <Printer className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{err}
          </div>
        )}

        {!data && loading && <div className="text-center py-20 text-slate-500">جاري تحميل البيانات…</div>}

        {data && (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">ملخص سريع</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-slate-800 border-slate-700 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">إجمالي المركبات</div>
                  <div className="text-xl font-bold text-slate-100">{data.fleet_status?.total_vehicles ?? 0}</div>
                </div>
                <div className="rounded-xl border bg-slate-800 border-slate-700 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">إجمالي المعدات</div>
                  <div className="text-xl font-bold text-slate-100">{data.fleet_status?.total_equipment ?? 0}</div>
                </div>
                <div className="rounded-xl border bg-rose-600/20 border-rose-500/30 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">إجمالي تكلفة الوقود</div>
                  <div className="text-xl font-bold text-rose-300">{fmt(data.fuel_summary?.total_fuel_cost)}</div>
                </div>
                <div className="rounded-xl border bg-amber-600/20 border-amber-500/30 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">قيمة المصروف من المخزون</div>
                  <div className="text-xl font-bold text-amber-300">{fmt(data.inventory?.total_issued_value)}</div>
                </div>
              </div>
            </section>

            {(data.fuel_by_type?.length ?? 0) > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">الوقود حسب النوع</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/60">
                      <tr className="text-slate-400 text-right">
                        <th className="px-4 py-3">نوع الوقود</th>
                        <th className="px-4 py-3">الكمية (لتر)</th>
                        <th className="px-4 py-3">التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.fuel_by_type?.map((r, i) => (
                        <tr key={i} className="text-slate-300 hover:bg-slate-900/30">
                          <td className="px-4 py-3">{r.fuel_type ?? '—'}</td>
                          <td className="px-4 py-3">{fmt(r.total_liters)}</td>
                          <td className="px-4 py-3">{fmt(r.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
