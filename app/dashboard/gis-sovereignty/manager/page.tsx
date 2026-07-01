'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Brain, Map, MonitorPlay, Layers, Activity, Globe, BarChart2,
  Radio, Flame, Droplets, Building2, RefreshCw, CheckCircle2, AlertTriangle,
  Satellite, Shield, Database,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

// ── Sections data ─────────────────────────────────────────────────────────────
const sections = [
  {
    href: '/dashboard/gis-sovereignty/satellite-intelligence-center',
    label: 'مركز الاستخبارات الفضائية',
    en: 'Satellite Intelligence Center',
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20',
    icon: Brain,
    items: ['مؤشرات طيفية', 'كشف التغيرات', 'مقارنة زمنية', 'تصدير S7'],
  },
  {
    href: '/dashboard/gis-sovereignty/engineering-workspace',
    label: 'مساحة العمل الهندسية',
    en: 'Engineering Workspace',
    color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/20',
    icon: Map,
    items: ['رسم وتعديل الخرائط', 'إدارة الطبقات', 'ربط الأصول', 'استخراج البيانات'],
  },
  {
    href: '/dashboard/gis-sovereignty/command-center',
    label: 'مركز القيادة التنفيذي',
    en: 'Command Center',
    color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/20',
    icon: MonitorPlay,
    items: ['مراقبة حية', 'مؤشرات جغرافية', 'رصد التحركات'],
  },
  {
    href: '/dashboard/gis-sovereignty/erp-dashboard',
    label: 'لوحة المشاريع الجغرافية',
    en: 'ERP GIS Dashboard',
    color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/20',
    icon: Globe,
    items: ['خريطة المشاريع', 'بيانات الأصول', 'أوامر العمل'],
  },
  {
    href: '/dashboard/gis-sovereignty/maintenance-workspace',
    label: 'مساحة الصيانة الجغرافية',
    en: 'Maintenance Workspace',
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20',
    icon: Layers,
    items: ['أوامر العمل الميدانية', 'الفرق والمعدات', 'طبقات الصيانة'],
  },
  {
    href: '/dashboard/gis-sovereignty/spatial-analytics',
    label: 'مختبر التحليل المكاني',
    en: 'Spatial Analytics Lab',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: Activity,
    items: ['تحليل التضاريس', 'تحليل الملاءمة', 'المسار الأمثل', 'المخاطر المكانية'],
  },
];

// ── Monitoring links ───────────────────────────────────────────────────────────
const monitoringLinks = [
  {
    href: '/dashboard/admin-gateway/assets/reviews',
    icon: CheckCircle2,
    label: 'مراجعة واعتماد البيانات الجغرافية',
    hint: 'مراجعة الطبقات والبيانات المكانية الجديدة قبل النشر',
    color: 'emerald',
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/monitoring',
    icon: Radio,
    label: 'مراقبة gis_data الحية',
    hint: 'إحصائيات الطبقات والجداول الحية في قاعدة البيانات',
    color: 'blue',
  },
  {
    href: '/dashboard/gis-sovereignty/satellite-intelligence-center',
    icon: Brain,
    label: 'تقارير الاستخبارات الفضائية',
    hint: 'ملخص مخرجات الأقمار الاصطناعية والمشاهد المعالجة',
    color: 'indigo',
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/monitoring',
    icon: AlertTriangle,
    label: 'تنبيهات وإشارات الرصد',
    hint: 'حرائق VIIRS — تسريبات النهر الصناعي — تسريبات المدن — التعديات',
    color: 'amber',
  },
];

// ── Color utility ──────────────────────────────────────────────────────────────
const colorMap: Record<string, { icon: string; border: string; bg: string; label: string }> = {
  emerald: { icon: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', label: 'text-emerald-300' },
  blue:    { icon: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10',    label: 'text-blue-300'    },
  indigo:  { icon: 'text-indigo-400',  border: 'border-indigo-500/30',  bg: 'bg-indigo-500/10',  label: 'text-indigo-300'  },
  amber:   { icon: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   label: 'text-amber-300'   },
};

// ── Live GIS stats component ───────────────────────────────────────────────────
function GisLiveStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/system/health-stats', {
        headers: { ...getClientTenantHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json();
      const gis = (data.summary?.gis) || {};
      const gisData = (data.schemas?.gis_data) || {};
      const projects = (data.summary?.projects) || {};
      setStats({
        layers:            gis.layers         ?? gisData.layers          ?? 0,
        satelliteData:     gisData.satellite_data      ?? 0,
        sovereigntyLayers: gisData.sovereignty_layers  ?? 0,
        projects:          projects.projects   ?? 0,
        engineeringLayers: gisData.engineering_layers  ?? 0,
        liveTables:        gis.live_tables     ?? 0,
      });
      setLastSync(new Date().toLocaleTimeString('ar-SA'));
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 60000);
    return () => clearInterval(t);
  }, []);

  const cells = [
    { icon: Globe,     color: 'text-blue-400',   label: 'طبقة جغرافية',    value: stats?.layers           ?? 0 },
    { icon: Satellite, color: 'text-indigo-400',  label: 'بيانات فضائية',   value: stats?.satelliteData    ?? 0 },
    { icon: Shield,    color: 'text-emerald-400', label: 'طبقة سيادية',     value: stats?.sovereigntyLayers?? 0 },
    { icon: Database,  color: 'text-violet-400',  label: 'مشروع مربوط',     value: stats?.projects         ?? 0 },
    { icon: Map,       color: 'text-teal-400',    label: 'طبقة هندسية',     value: stats?.engineeringLayers?? 0 },
    { icon: Radio,     color: 'text-sky-400',     label: 'جدول حي',         value: stats?.liveTables       ?? 0 },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-xs text-emerald-400 font-mono font-bold">gis_data · متصل</span>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {lastSync && <span>آخر تحديث: {lastSync}</span>}
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {cells.map(({ icon: Icon, color, label, value }) => (
          <div key={label} className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800/60">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <div className="text-lg font-bold text-white">{loading ? '—' : value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GISManagerPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'monitoring' | 'correspondence'>('sections');

  const tabs = [
    { key: 'sections',       label: 'أقسام الإدارة',             activeCls: 'bg-blue-500/20 border-blue-500/40 text-blue-300'    },
    { key: 'monitoring',     label: 'المؤشرات والمراقبة',         activeCls: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
    { key: 'correspondence', label: 'المراسلات الإدارية الداخلية', activeCls: 'bg-amber-500/20 border-amber-500/40 text-amber-300'   },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link
            href="/dashboard/gis-sovereignty"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            السيادة الجغرافية (GIS)
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير إدارة GIS</h1>
              <p className="text-slate-400 text-sm mt-0.5">Geospatial Sovereignty — Department Manager</p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-2 grid grid-cols-3 gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors border ${
                activeTab === t.key ? t.activeCls : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Sections ──────────────────────────────────────── */}
        {activeTab === 'sections' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">الأقسام التابعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(({ href, label, en, color, border, bg, icon: Icon, items }) => (
                <Link key={href} href={href} className="group block">
                  <div className={`rounded-2xl border ${border} bg-slate-900 p-5 hover:bg-slate-800/70 transition-all h-full flex flex-col`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{label}</h3>
                        <p className={`text-[11px] ${color} mt-0.5 opacity-70`}>{en}</p>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-400 space-y-1 flex-1">
                      {items.map(item => (
                        <li key={item} className="flex items-center gap-1.5">
                          <span className={`w-1 h-1 rounded-full inline-block shrink-0 ${bg}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className={`${color} text-xs font-semibold flex items-center gap-1`}>
                        فتح القسم <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: Monitoring ────────────────────────────────────── */}
        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <GisLiveStats />

            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">الروابط التنفيذية والمراقبة</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monitoringLinks.map(({ href, icon: Icon, label, hint, color }) => {
                  const c = colorMap[color] ?? colorMap.blue;
                  return (
                    <Link
                      key={label}
                      href={href}
                      className={`group flex items-start gap-4 rounded-2xl border ${c.border} ${c.bg} p-4 hover:bg-slate-800/60 transition-all`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-slate-900 border ${c.border} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${c.icon}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${c.label}`}>{label}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Satellite alert summary */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">طبقات الرصد الفضائي الحية</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Flame,     color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'حرائق VIIRS', sub: 'NOAA-20 / NASA FIRMS' },
                  { icon: Droplets,  color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   label: 'تسريبات النهر', sub: 'Sentinel-1/2 NDWI' },
                  { icon: Building2, color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   label: 'تسريبات المدن', sub: 'Urban Leak Detector' },
                  { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',   label: 'التعديات', sub: 'Encroachment Monitor' },
                ].map(({ icon: Icon, color, bg, border, label, sub }) => (
                  <Link
                    key={label}
                    href="/dashboard/gis-sovereignty/satellite-intelligence-center"
                    className={`flex flex-col items-center text-center rounded-xl border ${border} ${bg} p-3 hover:opacity-80 transition-opacity`}
                  >
                    <Icon className={`w-6 h-6 ${color} mb-1.5`} />
                    <p className={`text-xs font-semibold ${color}`}>{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-3 text-center">
                لتفعيل طبقة رصد أو مراجعة التنبيهات → افتح مركز الاستخبارات الفضائية ← تبويب <strong className="text-slate-500">رصد</strong>
              </p>
            </div>
          </div>
        )}

        {/* ── Tab 3: Correspondence ────────────────────────────────── */}
        {activeTab === 'correspondence' && (
          <InternalMailTab
            department="gis_manager"
            title="نظام المراسلات الموحد — إدارة GIS والسيادة الجغرافية"
          />
        )}

      </div>
    </div>
  );
}
