'use client';

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Server, Database, Users, Briefcase, Package, DollarSign, RefreshCw } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

interface HealthService { status: string; records: number }
interface HealthData {
  status: string;
  db_connected: boolean;
  services: { hr?: HealthService; projects?: HealthService; assets?: HealthService };
  uptime_pct: number;
  response_time_ms: number;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  module: string;
  message: string;
  created_at: string;
}

interface WorkOrderStat { status: string; cnt: number }
interface MetricsData {
  work_orders: WorkOrderStat[];
  budget_utilization_pct: number;
  budget_total: number;
  budget_used: number;
}

interface SchemaSummary {
  hr: { employees: number; positions: number; grades: number; total_rows: number; live_tables: number };
  finance: { budgets: number; expenses: number; total_rows: number; live_tables: number };
  admin: { incoming_letters: number; outgoing_letters: number; total_rows: number };
  projects: { projects: number; total_rows: number };
  inventory: { warehouses: number; items: number; total_rows: number };
  procurement: { suppliers: number; orders: number; total_rows: number };
  workspace: { projects: number; employees: number; total_rows: number };
  assets: { assets: number; total_rows: number };
}

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'alerts' | 'stats'>('health');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [schemaSummary, setSchemaSummary] = useState<SchemaSummary | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [healthRes, alertsRes, metricsRes, statsRes] = await Promise.all([
        fetch('/api/v1/hr-structure/monitoring/health', { headers: getTenantHeaders() }),
        fetch('/api/v1/hr-structure/alerts/early-warning?limit=50', { headers: getTenantHeaders() }),
        fetch('/api/v1/hr-structure/monitoring/metrics/stats', { headers: getTenantHeaders() }),
        fetch('/api/v1/system/health-stats', { headers: getTenantHeaders() }),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (alertsRes.ok) { const d = await alertsRes.json(); setAlerts(d.alerts || []); }
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (statsRes.ok) { const d = await statsRes.json(); setSchemaSummary(d.summary); }
    } catch (err) {
      console.error('Monitoring fetch error:', err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'text-red-400 border-red-500/50 bg-red-500/10';
    if (severity === 'warning') return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
    return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
  };

  const getSeverityLabel = (severity: string) => {
    if (severity === 'critical') return 'حرج';
    if (severity === 'warning') return 'تحذير';
    return 'معلومة';
  };

  const getStatusColor = (status: string) =>
    status === 'healthy' || status === 'ok' ? 'text-emerald-400' :
    status === 'degraded' ? 'text-yellow-400' : 'text-red-400';

  const getStatusLabel = (status: string) =>
    status === 'healthy' || status === 'ok' ? 'سليم' :
    status === 'degraded' ? 'متدهور' : 'حرج';

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-rose-900/30 to-slate-900/50 p-6 rounded-2xl border border-rose-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-rose-500/50">
              <Activity className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المراقبة والتنبيهات</h1>
              <p className="text-slate-300 mt-1 text-sm">آخر تحديث: {lastRefresh.toLocaleTimeString('ar-LY')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <div className={`px-4 py-2 rounded-lg border font-bold text-sm ${health.status === 'healthy' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/50' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50'}`}>
                {getStatusLabel(health.status)}
              </div>
            )}
            <button onClick={fetchAll} disabled={loading} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-50">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-5 rounded-xl border border-red-500/30">
            <div className="flex items-center justify-between">
              <div><div className="text-3xl font-bold text-red-400">{criticalCount}</div><div className="text-slate-400 mt-1 text-sm">تنبيهات حرجة</div></div>
              <AlertTriangle className="w-9 h-9 text-red-400/40" />
            </div>
          </div>
          <div className="bg-slate-900/50 p-5 rounded-xl border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div><div className="text-3xl font-bold text-yellow-400">{warningCount}</div><div className="text-slate-400 mt-1 text-sm">تحذيرات</div></div>
              <AlertTriangle className="w-9 h-9 text-yellow-400/40" />
            </div>
          </div>
          <div className="bg-slate-900/50 p-5 rounded-xl border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div><div className="text-3xl font-bold text-emerald-400">{health?.uptime_pct?.toFixed(1) ?? '--'}%</div><div className="text-slate-400 mt-1 text-sm">وقت التشغيل</div></div>
              <CheckCircle className="w-9 h-9 text-emerald-400/40" />
            </div>
          </div>
          <div className="bg-slate-900/50 p-5 rounded-xl border border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div><div className="text-3xl font-bold text-indigo-400">{health?.response_time_ms ?? '--'}</div><div className="text-slate-400 mt-1 text-sm">زمن الاستجابة (ms)</div></div>
              <Clock className="w-9 h-9 text-indigo-400/40" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          {[{key:'health',label:'صحة النظام'},{key:'alerts',label:'التنبيهات النشطة'},{key:'stats',label:'إحصائيات البيانات'}].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all text-sm ${activeTab === tab.key ? 'bg-slate-800 text-rose-400 border border-rose-500/50' : 'text-slate-400 hover:text-slate-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* HEALTH TAB */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            {health && (
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 mb-5">
                  <Server className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl font-bold text-slate-200">حالة الخدمات</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-sm text-slate-400 mb-2">قاعدة البيانات</div>
                    <div className={`text-lg font-bold ${health.db_connected ? 'text-emerald-400' : 'text-red-400'}`}>
                      {health.db_connected ? '✓ متصلة' : '✕ منقطعة'}
                    </div>
                  </div>
                  {Object.entries(health.services || {}).map(([name, svc]) => (
                    <div key={name} className="bg-slate-800/50 p-4 rounded-lg text-center">
                      <div className="text-sm text-slate-400 mb-2">{name === 'hr' ? 'الموارد البشرية' : name === 'projects' ? 'المشاريع' : name === 'assets' ? 'الأصول' : name}</div>
                      <div className={`text-lg font-bold ${getStatusColor(svc.status)}`}>{getStatusLabel(svc.status)}</div>
                      <div className="text-xs text-slate-500 mt-1">{svc.records?.toLocaleString()} سجل</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {metrics && (
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 mb-5">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-xl font-bold text-slate-200">مقاييس التشغيل</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-5 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-slate-400">استخدام الميزانية</span>
                      <span className="text-2xl font-bold text-indigo-400">{metrics.budget_utilization_pct?.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div className={`h-full transition-all ${metrics.budget_utilization_pct > 80 ? 'bg-red-500' : metrics.budget_utilization_pct > 60 ? 'bg-yellow-500' : 'bg-indigo-500'}`} style={{width:`${Math.min(metrics.budget_utilization_pct,100)}%`}} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                      <span>مُنفَّق: {(metrics.budget_used/1_000_000).toFixed(2)} م.د</span>
                      <span>إجمالي: {(metrics.budget_total/1_000_000).toFixed(2)} م.د</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-5 rounded-lg">
                    <div className="text-sm text-slate-400 mb-3">أوامر العمل</div>
                    <div className="space-y-2">
                      {metrics.work_orders?.map(wo => (
                        <div key={wo.status} className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">{wo.status === 'scheduled' ? 'مجدولة' : wo.status === 'in_progress' ? 'جارية' : wo.status === 'completed' ? 'مكتملة' : wo.status}</span>
                          <span className={`text-lg font-bold ${wo.status === 'completed' ? 'text-emerald-400' : wo.status === 'in_progress' ? 'text-yellow-400' : 'text-indigo-400'}`}>{wo.cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length > 0 ? alerts.map((alert, i) => (
              <div key={i} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-rose-500/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="bg-slate-800 p-2 rounded-lg mt-0.5">
                      <AlertTriangle className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-200 font-medium">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{alert.module}</span>
                        <span>•</span>
                        <span>{new Date(alert.created_at).toLocaleString('ar-LY')}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold shrink-0 ${getSeverityColor(alert.severity)}`}>{getSeverityLabel(alert.severity)}</span>
                </div>
              </div>
            )) : (
              <div className="text-center py-16 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد تنبيهات نشطة</p>
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && schemaSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* HR */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-slate-200">الموارد البشرية</h3>
                <span className="text-xs text-slate-500 mr-auto">{schemaSummary.hr.live_tables} جدول · {schemaSummary.hr.total_rows.toLocaleString()} سجل</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{label:'موظف',value:schemaSummary.hr.employees},{label:'وظيفة',value:schemaSummary.hr.positions},{label:'درجة',value:schemaSummary.hr.grades}].map(item => (
                  <div key={item.label} className="bg-slate-800/50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-400">{item.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Finance */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-200">المالية</h3>
                <span className="text-xs text-slate-500 mr-auto">{schemaSummary.finance.live_tables} جدول · {schemaSummary.finance.total_rows.toLocaleString()} سجل</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{label:'ميزانية',value:schemaSummary.finance.budgets},{label:'مصروف',value:schemaSummary.finance.expenses}].map(item => (
                  <div key={item.label} className="bg-slate-800/50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-emerald-400">{item.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Projects */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <Briefcase className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-slate-200">المشاريع</h3>
                <span className="text-xs text-slate-500 mr-auto">{schemaSummary.projects.total_rows.toLocaleString()} سجل</span>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                <div className="text-3xl font-bold text-purple-400">{schemaSummary.projects.projects}</div>
                <div className="text-xs text-slate-400 mt-1">مشروع</div>
              </div>
            </div>
            {/* Procurement + Inventory */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-bold text-slate-200">المشتريات والمخزون</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{label:'مورد',value:schemaSummary.procurement.suppliers,color:'text-orange-400'},{label:'طلب شراء',value:schemaSummary.procurement.orders,color:'text-orange-400'},{label:'مستودع',value:schemaSummary.inventory.warehouses,color:'text-amber-400'},{label:'صنف',value:schemaSummary.inventory.items,color:'text-amber-400'}].map(item => (
                  <div key={item.label} className="bg-slate-800/50 p-3 rounded-lg text-center">
                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Admin */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-slate-200">المراسلات</h3>
                <span className="text-xs text-slate-500 mr-auto">{schemaSummary.admin.total_rows.toLocaleString()} سجل</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{label:'وارد',value:schemaSummary.admin.incoming_letters},{label:'صادر',value:schemaSummary.admin.outgoing_letters}].map(item => (
                  <div key={item.label} className="bg-slate-800/50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-cyan-400">{item.value}</div>
                    <div className="text-xs text-slate-400 mt-1">خطاب {item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Assets */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-bold text-slate-200">الأصول</h3>
                <span className="text-xs text-slate-500 mr-auto">{schemaSummary.assets.total_rows.toLocaleString()} سجل</span>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                <div className="text-3xl font-bold text-rose-400">{schemaSummary.assets.assets}</div>
                <div className="text-xs text-slate-400 mt-1">أصل مسجل</div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'stats' && !schemaSummary && (
          <div className="text-center py-16 text-slate-400">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>جاري تحميل الإحصائيات...</p>
          </div>
        )}
      </div>
    </div>
  );
}
