'use client';

import React, { useState, useEffect } from 'react';
import { Satellite, Map as MapIcon, ShieldAlert, MonitorPlay, Activity, Bell, Brain, Layers, Database, Globe, Radio, CheckCircle2, RefreshCw, Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ReviewModal } from '../admin-gateway/components/ReviewModal';
import { resolveTenantContext, tenantHeaders, withTenantQuery } from '@/lib/gis/tenantContext';
import { GisWorkspaceSwitcher } from './components/GisWorkspaceSwitcher';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';
interface GisStats {
  layers: number;
  totalRows: number;
  liveTables: number;
  engineeringLayers: number;
  satelliteData: number;
  sovereigntyLayers: number;
  projects: number;
}

export default function GISHub() {
  const [pendingCount, setPendingCount] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [tenantReady, setTenantReady] = useState(false);
  const [gisStats, setGisStats] = useState<GisStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // ── جلب إحصائيات gis_data الحية من الـ API ──────────────────────────────
  const fetchGisStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/v1/system/health-stats', {
        headers: { ...getClientTenantHeaders() }
      });
      if (!res.ok) return;
      const data = await res.json();
      const schemas = data.schemas || {};
      const summary = data.summary || {};
      const gis = summary.gis || {};
      const gisData = schemas.gis_data || {};
      const projects = summary.projects || {};

      setGisStats({
        layers:             gis.layers          ?? gisData.layers          ?? 0,
        totalRows:          gis.total_rows       ?? 0,
        liveTables:         gis.live_tables      ?? 0,
        engineeringLayers:  gisData.engineering_layers  ?? 0,
        satelliteData:      gisData.satellite_data      ?? 0,
        sovereigntyLayers:  gisData.sovereignty_layers  ?? 0,
        projects:           projects.projects    ?? 0,
      });
      setLastSync(new Date().toLocaleTimeString('ar-SA'));
    } catch (err) {
      console.warn('⚠️ فشل جلب إحصائيات GIS:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const tenant = resolveTenantContext();
    if (!tenant.tenantId) {
      setTenantReady(false);
    } else {
      setTenantReady(true);
      fetch(withTenantQuery('/api/v1/review/pending/gis?limit=1', tenant), {
        headers: tenantHeaders(tenant),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.total && setPendingCount(d.total))
        .catch(() => {});
    }
    fetchGisStats();
    // تحديث كل 60 ثانية
    const interval = setInterval(fetchGisStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Primary modules — prominently displayed
  const primaryModules = [
    {
      id: 'satellite-intelligence-center',
      title: 'Satellite Intelligence Center',
      titleAr: 'مركز قيادة الاستخبارات الفضائية',
      description: 'مركز موحد للاستخبارات الفضائية: مؤشرات طيفية، مخرجات ذكاء موثوقة، مقارنة زمنية، بصمات مشاهد تفاعلية، تحديث تلقائي، وتصدير بيانات (S7)',
      icon: <Brain className="w-12 h-12 text-blue-400" />,
      color: 'border-blue-500/50 hover:border-blue-400',
      badge: 'S7 · LIVE',
      badgeColor: 'bg-blue-600 text-white',
      href: '/dashboard/gis-sovereignty/satellite-intelligence-center',
    },
    {
      id: 'engineering-workspace',
      title: 'Engineering Workspace',
      titleAr: 'مساحة العمل الهندسية',
      description: 'بيئة رسم وتعديل احترافية للخرائط، إدارة الطبقات، وتحديث قواعد البيانات المكانية',
      icon: <MapIcon className="w-12 h-12 text-emerald-500" />,
      color: 'border-emerald-500/30 hover:border-emerald-500',
      badge: null,
      href: '/dashboard/gis-sovereignty/engineering-workspace',
    },
    {
      id: 'command-center',
      title: 'Command Center',
      titleAr: 'مركز القيادة التنفيذي',
      description: 'مراقبة حية، لوحات تحكم للمؤشرات الجغرافية الحيوية، ورصد التحركات — ملخص تنفيذي',
      icon: <MonitorPlay className="w-12 h-12 text-blue-500" />,
      color: 'border-blue-500/30 hover:border-blue-500',
      badge: null,
      href: '/dashboard/gis-sovereignty/command-center',
    },
  ];

  // Secondary/Advanced modules
  const secondaryModules = [
    {
      id: 'erp-dashboard',
      title: 'ERP GIS Dashboard',
      titleAr: 'لوحة المشاريع الجغرافية',
      description: 'خريطة تفاعلية لجميع المشاريع مع بيانات الموظفين والأصول وأوامر العمل',
      icon: <MapIcon className="w-6 h-6 text-emerald-400" />,
      href: '/dashboard/gis-sovereignty/erp-dashboard',
    },
    {
      id: 'maintenance-workspace',
      title: 'Maintenance Workspace',
      titleAr: 'مساحة الصيانة الجغرافية',
      description: 'أوامر العمل والفرق والأصول ضمن طبقات تشغيل الصيانة',
      icon: <Layers className="w-6 h-6 text-amber-400" />,
      href: '/dashboard/gis-sovereignty/maintenance-workspace',
    },
    {
      id: 'spatial-analytics',
      title: 'Spatial Analytics',
      titleAr: 'التحليل المكاني',
      description: 'تحليل التضاريس والمخاطر المكانية (أداة متقدمة)',
      icon: <Activity className="w-6 h-6 text-purple-400" />,
      href: '/dashboard/gis-sovereignty/spatial-analytics',
    },
    {
      id: 'satellite-monitor',
      title: 'Satellite Raw Monitor',
      titleAr: 'مراقبة الأقمار الأولية',
      description: 'عرض خام لبيانات Sentinel/Landsat (موجود في مركز الاستخبارات الفضائية)',
      icon: <Satellite className="w-6 h-6 text-slate-400" />,
      href: '/dashboard/gis-sovereignty/satellite-monitor',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 bg-[url('/grid-bg.svg')] bg-fixed relative">
      
      {/* Back to dashboard button — top left */}
      <div className="absolute top-4 right-4 z-20">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-400 text-xs font-medium hover:text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all backdrop-blur-sm"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          الرئيسية
        </Link>
      </div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <div className="text-center mb-8 space-y-4 relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 border border-slate-700 mb-6 shadow-2xl">
          <ShieldAlert className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-5xl font-bold text-white drop-shadow-lg">
          السيادة الجغرافية
        </h1>
        <p className="text-slate-400 text-lg font-light tracking-wide uppercase">
          Geospatial Sovereignty Subsystem
        </p>
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
          <GisWorkspaceSwitcher />
          <Link
            href="/dashboard/gis-sovereignty/manager"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-sm font-semibold hover:bg-blue-600/30 hover:border-blue-400 transition-all"
          >
            <Crown className="w-4 h-4" />
            لوحة مدير الإدارة
          </Link>
        </div>
        {!tenantReady && (
          <p className="text-xs text-amber-300 mt-2">لا يوجد Tenant نشط حالياً — سيتم تعطيل استدعاءات المراجعة حتى تفعيل السياق.</p>
        )}
      </div>

      {/* ── إحصائيات gis_data الحية ──────────────────────────────── */}
      <div className="max-w-5xl w-full relative z-10 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-mono font-bold">gis_data · متصل</span>
          </div>
          <button 
            onClick={fetchGisStats}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
            {lastSync && <span>آخر تحديث: {lastSync}</span>}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* الطبقات الجغرافية */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 rounded-xl p-4 text-center transition-colors">
            <Globe className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{statsLoading ? '...' : (gisStats?.layers ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1">طبقة جغرافية</div>
          </div>

          {/* بيانات الأقمار الاصطناعية */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-4 text-center transition-colors">
            <Satellite className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{statsLoading ? '...' : (gisStats?.satelliteData ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1">بيانات فضائية</div>
          </div>

          {/* طبقات السيادة */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 text-center transition-colors">
            <ShieldAlert className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{statsLoading ? '...' : (gisStats?.sovereigntyLayers ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1">طبقة سيادية</div>
          </div>

          {/* المشاريع المربوطة */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-violet-500/40 rounded-xl p-4 text-center transition-colors">
            <Database className="w-5 h-5 text-violet-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{statsLoading ? '...' : (gisStats?.projects ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1">مشروع مربوط</div>
          </div>
        </div>

        {/* ربط الإدارات */}
        {!statsLoading && gisStats && (
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {[
              { label: 'projects_core', color: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
              { label: 'gis_data', color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
              { label: 'assets_core', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
              { label: 'hr_core', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
              { label: 'finance_core', color: 'text-teal-300 bg-teal-500/10 border-teal-500/30' },
            ].map(({ label, color }) => (
              <span key={label} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border ${color}`}>
                <CheckCircle2 className="w-3 h-3" />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full relative z-10 mb-6">
        {primaryModules.map((module) => (
          <Link
            key={module.id}
            href={module.href}
            className={`
              relative group bg-slate-900/50 backdrop-blur-sm border ${module.color}
              rounded-2xl p-7 transition-all duration-300 hover:scale-105 hover:bg-slate-800/80 hover:shadow-2xl
              flex items-start gap-5 cursor-pointer
            `}
          >
            {module.badge && (
              <span className={`absolute top-3 left-3 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${module.badgeColor}`}>
                {module.badge}
              </span>
            )}
            <div className="shrink-0 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 group-hover:scale-110 transition-transform duration-300 shadow-xl">
              {module.icon}
            </div>
            <div className="flex flex-col text-right w-full">
              <h3 className="text-xl font-bold text-slate-100 mb-0.5 group-hover:text-white transition-colors">
                {module.titleAr}
              </h3>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider mb-3 uppercase">{module.title}</span>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                {module.description}
              </p>
            </div>
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          </Link>
        ))}
      </div>

      {/* Secondary / Legacy Modules */}
      <div className="max-w-5xl w-full relative z-10">
        <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-3 text-center">
          أدوات تقنية متقدمة · Advanced Tools
        </p>
        <div className="grid grid-cols-2 gap-3">
          {secondaryModules.map((module) => (
            <Link
              key={module.id}
              href={module.href}
              className="group bg-slate-900/30 border border-slate-800/60 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-colors"
            >
              <div className="shrink-0 bg-slate-900/80 p-2 rounded-lg border border-slate-800 group-hover:border-slate-700 transition-colors">
                {module.icon}
              </div>
              <div className="text-right min-w-0">
                <p className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{module.titleAr}</p>
                <p className="text-[9px] text-slate-600 font-mono">{module.title}</p>
                <p className="text-[9px] text-slate-600 mt-0.5 leading-tight truncate">{module.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Floating review notification button */}
      {pendingCount > 0 && (
        <button
          onClick={() => setShowReview(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl shadow-red-900/50 transition-colors animate-pulse"
        >
          <Bell className="w-4 h-4" />
          مراجعة GIS ({pendingCount})
        </button>
      )}

      {/* Review modal */}
      {showReview && (
        <ReviewModal department="gis" onClose={() => { setShowReview(false); setPendingCount(0); }} />
      )}
    </div>
  );
}
