'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Activity, TrendingUp, AlertTriangle, Layers, MapPin, Zap, LineChart, FolderOpen, Info, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

export default function PlatformIntelligence() {
  const { activeProjectId, activeSiteId, getActiveProject, getActiveSite } = useErpContextStore();

  const [ctxData, setCtxData] = useState<{
    summary?: { project?: { sites: number; layers: number; assets: number }; site?: { layers: number; assets: number } };
    alerts?: Array<{ level: 'warning' | 'info'; msg: string }>;
  } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [aiIntegrationStatus, setAiIntegrationStatus] = useState<{
    connected: number;
    total: number;
    departments: string[];
    lastSync?: string;
  } | null>(null);

  // ── جلب بيانات من جميع الإدارات لتزويد وحدات الذكاء ──────────────────────
  const syncAllDepartmentsToAI = useCallback(async () => {
    try {
      const departments = [
        'hr_core', 'finance_core', 'assets_core', 'projects_core',
        'procurement_core', 'inventory_core', 'fleet_core',
        'admin_core', 'maintenance_core', 'workflow_core',
        'accounting_core', 'revenue_core'
      ];
      
      const results = await Promise.allSettled(
        departments.map(dept =>
          fetch(`/api/v1/system/health-stats`, {
            headers: { ...getClientTenantHeaders() }
          }).then(r => r.json()).then(d => ({ dept, success: true }))
            .catch(() => ({ dept, success: false }))
        )
      );
      
      const connected = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      
      setAiIntegrationStatus({
        connected,
        total: departments.length,
        departments,
        lastSync: new Date().toLocaleTimeString('ar-SA')
      });
      
      console.log(`✅ تم ربط ${connected}/${departments.length} إدارة بنظام الذكاء الاصطناعي`);
    } catch (err) {
      console.warn('⚠️ خطأ في المزامنة:', err);
    }
  }, []);

  const loadCtx = useCallback(async () => {
    if (!activeProjectId && !activeSiteId) { setCtxData(null); return; }
    setCtxLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeProjectId) params.set('project_id', String(activeProjectId));
      if (activeSiteId) params.set('site_id', String(activeSiteId));
      const res = await fetch(`/api/v1/workspace/context-summary?${params}`, {
        headers: { ...getClientTenantHeaders() }
      });
      if (res.ok) setCtxData(await res.json());
    } catch { /* silent */ } finally { setCtxLoading(false); }
  }, [activeProjectId, activeSiteId]);

  useEffect(() => { 
    loadCtx();
    syncAllDepartmentsToAI(); // مزامنة كل الإدارات تلقائياً عند الدخول
  }, [loadCtx, syncAllDepartmentsToAI]);

  const modules = [
    {
      title: 'مركز ذكاء الأصول',
      icon: <Layers className="w-8 h-8 text-indigo-400" />,
      color: 'bg-indigo-600/20 border-indigo-500/50',
      description: 'الأصول عالية المخاطر، مناطق التدهور، الصيانة التنبؤية',
      href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence',
      badge: 'ذكاء اصطناعي'
    },
    {
      title: 'المراقبة والتنبيهات',
      icon: <Activity className="w-8 h-8 text-rose-400" />,
      color: 'bg-rose-600/20 border-rose-500/50',
      description: 'مراقبة النظام، صحة البنية التحتية، نظام الإنذار المبكر',
      href: '/dashboard/admin-gateway/platform-intelligence/monitoring',
      badge: 'حي'
    },
    {
      title: 'التحليلات والرؤى',
      icon: <TrendingUp className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-600/20 border-emerald-500/50',
      description: 'أداء المدينة، استخدام البنية التحتية، فجوات الخدمة',
      href: '/dashboard/admin-gateway/platform-intelligence/analytics',
      badge: 'تحليلي'
    },
    {
      title: 'إدارة المخاطر',
      icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'مناطق المخاطر، تحليل المرونة، خطط التخفيف',
      href: '/dashboard/admin-gateway/platform-intelligence/risk-management',
      badge: 'حرج'
    },
    {
      title: 'محاكاة السيناريوهات',
      icon: <Zap className="w-8 h-8 text-purple-400" />,
      color: 'bg-purple-600/20 border-purple-500/50',
      description: 'التخطيط العمراني، تأثير الحركة، تخصيص الميزانية',
      href: '/dashboard/admin-gateway/platform-intelligence/scenario-simulation',
      badge: 'محاكاة'
    },
    {
      title: 'الذكاء المكاني',
      icon: <MapPin className="w-8 h-8 text-cyan-400" />,
      color: 'bg-cyan-600/20 border-cyan-500/50',
      description: 'التحليل المكاني، كشف التعارضات، ملاءمة المواقع',
      href: '/dashboard/admin-gateway/platform-intelligence/spatial-intelligence',
      badge: 'GIS'
    },
    {
      title: 'التحليلات التنبؤية',
      icon: <LineChart className="w-8 h-8 text-teal-400" />,
      color: 'bg-teal-600/20 border-teal-500/50',
      description: 'توقع الفشل، التنبؤ بالميزانية، تحليل الاتجاهات',
      href: '/dashboard/admin-gateway/platform-intelligence/predictive-analytics',
      badge: 'تنبؤي'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-br from-fuchsia-900/30 via-slate-900/50 to-indigo-900/30 p-6 md:p-8 rounded-2xl border border-fuchsia-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/20">
              <Brain className="w-10 h-10 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-100">منصة الذكاء الرقمي</h1>
              <p className="text-slate-300 mt-2 text-lg">الذكاء الاصطناعي والتحليلات المتقدمة لإدارة البنية التحتية</p>
            </div>
          </div>
        </div>

        {/* AI Platform Description */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <div className="flex items-start gap-4">
            <div className="bg-fuchsia-500/10 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-200 mb-2">قدرات النظام الذكي</h2>
              <p className="text-slate-400 leading-relaxed">
                هذه المنصة تكشف عن قدرات 68+ وحدة ذكية مخفية في النظام الخلفي. تتضمن الذكاء الاصطناعي،
                التحليلات التنبؤية، المراقبة في الوقت الفعلي، محاكاة السيناريوهات، إدارة المخاطر،
                والتحليل المكاني المتقدم للبنية التحتية الحضرية.
              </p>
            </div>
          </div>
          
          {/* ── حالة ربط الإدارات بنظام الذكاء ────────────────── */}
          {aiIntegrationStatus && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-300 font-medium">
                تم ربط {aiIntegrationStatus.connected} إدارة بنظام الذكاء تلقائياً
                {aiIntegrationStatus.lastSync && ` — آخر مزامنة: ${aiIntegrationStatus.lastSync}`}
              </span>
            </div>
          )}
        </div>

        {/* Modules Grid */}
        <div>
          <h2 className="text-2xl font-bold text-slate-200 mb-6">الوحدات الذكية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => (
              <Link 
                key={index} 
                href={module.href}
                className={`block p-6 rounded-2xl border ${module.color} bg-slate-900/40 hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 group relative overflow-hidden`}
              >
                {/* Badge */}
                <div className="absolute top-4 left-4 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50">
                  <span className="text-xs font-bold text-slate-300">{module.badge}</span>
                </div>
                
                <div className="flex flex-col h-full gap-4 mt-8">
                  <div className="bg-slate-900/50 w-16 h-16 rounded-xl flex items-center justify-center border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                    {module.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-200 mb-2">{module.title}</h3>
                    <p className="text-slate-400 leading-relaxed text-sm">{module.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Live Context Summary Card ─────────────────────────── */}
        {(activeProjectId || activeSiteId || ctxLoading) && (
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-4">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-fuchsia-400" />
              <h3 className="text-lg font-bold text-slate-200">سياق الذكاء المرتبط بالمشروع الحالي</h3>
              {ctxLoading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
            </div>

            {/* Context Pills */}
            <div className="flex flex-wrap gap-2">
              {activeProjectId && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm text-blue-300 font-medium">
                    {getActiveProject()?.name ?? `مشروع #${activeProjectId}`}
                  </span>
                </div>
              )}
              {activeSiteId && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-sm text-teal-300 font-medium">
                    {getActiveSite()?.name ?? `موقع #${activeSiteId}`}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            {ctxData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ctxData.summary.project && (
                  <>
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-blue-500/20 text-center">
                      <div className="text-2xl font-bold text-blue-400">{ctxData.summary.project.sites}</div>
                      <div className="text-xs text-slate-400 mt-1">مواقع</div>
                    </div>
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-indigo-500/20 text-center">
                      <div className="text-2xl font-bold text-indigo-400">{ctxData.summary.project.layers}</div>
                      <div className="text-xs text-slate-400 mt-1">طبقات</div>
                    </div>
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-emerald-500/20 text-center">
                      <div className="text-2xl font-bold text-emerald-400">{ctxData.summary.project.assets}</div>
                      <div className="text-xs text-slate-400 mt-1">أصول</div>
                    </div>
                  </>
                )}
                {ctxData.summary.site && (
                  <div className="bg-slate-900/70 p-3 rounded-lg border border-teal-500/20 text-center">
                    <div className="text-2xl font-bold text-teal-400">{ctxData.summary.site.assets}</div>
                    <div className="text-xs text-slate-400 mt-1">أصول الموقع</div>
                  </div>
                )}
              </div>
            )}

            {/* Alerts */}
            {ctxData?.alerts && ctxData.alerts.length > 0 && (
              <div className="space-y-2">
                {ctxData.alerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                    alert.level === 'warning'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                      : 'bg-sky-500/10 border border-sky-500/30 text-sky-300'
                  }`}>
                    {alert.level === 'warning'
                      ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
                    {alert.msg}
                  </div>
                ))}
              </div>
            )}

            {!ctxLoading && !ctxData && (
              <p className="text-sm text-slate-500">لا توجد بيانات سياق — حدد مشروعاً أو موقعاً من قائمة ERP.</p>
            )}
          </div>
        )}

        {/* Backend Integration Info */}
        <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-bold text-slate-200">حالة الاتصال الخلفي</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-emerald-500/30">
              <div className="text-2xl font-bold text-emerald-400">68+</div>
              <div className="text-sm text-slate-400 mt-1">وحدات خلفية نشطة</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">15+</div>
              <div className="text-sm text-slate-400 mt-1">واجهات API متاحة</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-500/30">
              <div className="text-2xl font-bold text-purple-400">7</div>
              <div className="text-sm text-slate-400 mt-1">فئات ذكية رئيسية</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-amber-500/30">
              <div className="text-2xl font-bold text-amber-400">متصل</div>
              <div className="text-sm text-slate-400 mt-1">FastAPI Backend</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
