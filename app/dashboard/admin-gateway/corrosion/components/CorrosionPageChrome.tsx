import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Briefcase,
  Calculator,
  Database,
  FileText,
  Layers,
  Map,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingDown,
  User,
  Zap,
  ZapOff,
} from 'lucide-react';
import { CpAnalysis, CpPipeline, Tab } from '../types';

type Props = {
  viewMode: 'specialist' | 'manager';
  setViewMode: (mode: 'specialist' | 'manager') => void;
  cpPipelinesLoading: boolean;
  cpPipelines: CpPipeline[];
  cpAnalysis: CpAnalysis | null;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onRefresh: () => void;
  /** When provided, only these tabs are rendered in the tab bar */
  allowedTabs?: Tab[];
  /** Section title override shown in the header */
  sectionTitle?: string;
  sectionSubtitle?: string;
};

export function CorrosionPageChrome({
  viewMode,
  setViewMode,
  cpPipelinesLoading,
  cpPipelines,
  cpAnalysis,
  activeTab,
  setActiveTab,
  onRefresh,
  allowedTabs,
  sectionTitle,
  sectionSubtitle,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0"><ZapOff className="w-7 h-7 text-orange-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">{sectionTitle ?? 'إدارة التآكل'}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{sectionSubtitle ?? 'استيراد وتحليل مسوحات الحماية الكاثودية CP — مقارنة متعددة السنوات — NACE SP0169'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl border border-slate-700 p-1">
            <button type="button" onClick={() => setViewMode('specialist')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'specialist' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-300'}`}><User className="w-3.5 h-3.5" /> متخصص</button>
            <button type="button" onClick={() => setViewMode('manager')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'manager' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'}`}><Briefcase className="w-3.5 h-3.5" /> مدير</button>
          </div>
          <button type="button" onClick={onRefresh} disabled={cpPipelinesLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${cpPipelinesLoading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      {!cpPipelinesLoading && cpPipelines.length > 0 && (() => {
        const totalSessions = cpPipelines.reduce((a, p) => a + p.session_count, 0);
        const multiSurveyPipelines = cpPipelines.filter((p) => p.has_multi_survey).length;
        const pipelinesWithSessions = cpPipelines.filter((p) => p.session_count > 0).length;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ icon: <Database className="w-4 h-4 text-cyan-400" />, label: 'إجمالي الجلسات المستورَدة', value: totalSessions, border: 'border-cyan-500/30' }, { icon: <Activity className="w-4 h-4 text-blue-400" />, label: 'خطوط مُسَّحة', value: pipelinesWithSessions, border: 'border-blue-500/30' }, { icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, label: 'مناطق حرجة (آخر تحليل)', value: cpAnalysis ? cpAnalysis.stats.critical_zones : '—', border: 'border-orange-500/30' }, { icon: <TrendingDown className="w-4 h-4 text-purple-400" />, label: 'خطوط مؤهلة للتنبؤ', value: multiSurveyPipelines, border: 'border-purple-500/30' }].map((kpi, i) => (
              <div key={i} className={`bg-slate-900/50 rounded-xl border ${kpi.border} p-4`}><div className="flex items-center gap-2 mb-1">{kpi.icon}<p className="text-xs text-slate-400">{kpi.label}</p></div><p className="text-2xl font-bold text-white">{kpi.value}</p></div>
            ))}
          </div>
        );
      })()}

      {viewMode === 'manager' && !cpPipelinesLoading && cpPipelines.length > 0 && (() => {
        const totalSessions = cpPipelines.reduce((a, p) => a + p.session_count, 0);
        const multiSurvey = cpPipelines.filter((p) => p.has_multi_survey).length;
        const hasCritical = cpAnalysis && cpAnalysis.stats.critical_zones > 0;
        const overallStatus = cpAnalysis?.overall_status ?? null;
        return (
          <div className={`rounded-2xl border p-5 ${hasCritical || overallStatus === 'CRITICAL' ? 'bg-red-900/20 border-red-600/30' : overallStatus === 'WARNING' ? 'bg-amber-900/20 border-amber-600/30' : 'bg-emerald-900/20 border-emerald-600/30'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${hasCritical ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}><Briefcase className={`w-5 h-5 ${hasCritical ? 'text-red-400' : 'text-emerald-400'}`} /></div>
              <div className="flex-1">
                <h3 className={`font-bold text-base mb-1 ${hasCritical ? 'text-red-200' : 'text-emerald-200'}`}>ملخص شبكة الحماية الكاثودية</h3>
                {cpAnalysis ? <p className={`text-sm ${hasCritical ? 'text-red-300' : 'text-emerald-300'}`}>{cpAnalysis.manager_summary}</p> : <p className="text-sm text-slate-300">{totalSessions} جلسة على {cpPipelines.length} خط — {multiSurvey > 0 ? `${multiSurvey} خط مؤهل للتنبؤ` : 'لا توجد خطوط مؤهلة للتنبؤ بعد'}</p>}
                {cpAnalysis && <p className="text-xs text-slate-400 mt-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5" />{cpAnalysis.recommendation}</p>}
              </div>
              {cpAnalysis && <div className={`text-3xl font-bold px-4 py-2 rounded-xl ${hasCritical ? 'bg-red-900/30 text-red-300' : overallStatus === 'WARNING' ? 'bg-amber-900/30 text-amber-300' : 'bg-emerald-900/30 text-emerald-300'}`}>{cpAnalysis.stats.protected_pct}%<p className="text-xs font-normal text-center mt-0.5">محمية</p></div>}
            </div>
          </div>
        );
      })()}

      <div className="flex gap-1 bg-slate-900/50 rounded-xl border border-slate-800 p-1 overflow-x-auto">
        {([
          // ── مجموعة 1: البيانات والمدخلات ──
          { id: 'sessions',      label: 'جلسات المسح',       icon: <Database className="w-4 h-4" /> },
          { id: 'pipeline-map',  label: 'خريطة المسار',      icon: <Map className="w-4 h-4" /> },
          { id: 'cips',          label: 'أدوات CIPS/DCVG',   icon: <Zap className="w-4 h-4" /> },
          // ── مجموعة 2: التحليل ──
          { id: 'analysis',      label: 'تحليل المسح',       icon: <Activity className="w-4 h-4" /> },
          { id: 'segments',      label: 'المقاطع',            icon: <Layers className="w-4 h-4" /> },
          { id: 'compare',       label: 'مقارنة المسوحات',   icon: <BarChart2 className="w-4 h-4" /> },
          // ── مجموعة 3: التخطيط والتنبؤ ──
          { id: 'timeline',      label: 'خط الزمن التنبؤي',  icon: <TrendingDown className="w-4 h-4" /> },
          { id: 'prediction',    label: 'التنبؤ المتقدم',    icon: <Sparkles className="w-4 h-4" /> },
          { id: 'scenarios',     label: 'السيناريوهات',       icon: <Activity className="w-4 h-4" /> },
          { id: 'engineering',   label: 'الحسابات الهندسية', icon: <Calculator className="w-4 h-4" /> },
          // ── مجموعة 4: التقرير والإجراءات ──
          { id: 'report',        label: 'التقرير الهندسي',    icon: <FileText className="w-4 h-4" /> },
          { id: 'admin-reports', label: 'التقارير الإدارية',   icon: <Briefcase className="w-4 h-4" /> },
          { id: 'work-orders',   label: 'أوامر العمل',         icon: <FileText className="w-4 h-4" /> },
          // ── مجموعة 5: التخطيط والفرق ──
          { id: 'annual_plan',   label: 'الخطة السنوية',       icon: <FileText className="w-4 h-4" /> },
          { id: 'field_teams',   label: 'الفرق الفنية',        icon: <FileText className="w-4 h-4" /> },
          { id: 'phases',        label: 'المراحل الشهرية',     icon: <FileText className="w-4 h-4" /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[])
          .filter(t => !allowedTabs || allowedTabs.includes(t.id))
          .map((t) => (
          <button type="button" key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}
