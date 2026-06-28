'use client';

// ═══════════════════════════════════════════════════════════════════════════════
//  قسم الدعم الفني
//  Route: /dashboard/admin-gateway/corrosion/support
//  Tabs: تحليل المسح | المقاطع | مقارنة المسوحات | خط الزمن | التنبؤ | السيناريوهات | الحسابات | التقرير
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Sparkles, GitBranch, ShieldCheck } from 'lucide-react';

import { Tab } from '../types';
import { CpAnalysisTab } from '../components/CpAnalysisTab';
import { CpCompareTab } from '../components/CpCompareTab';
import { PredictionTab } from '../components/PredictionTab';
import { SegmentsTab } from '../components/SegmentsTab';
import { ScenariosTab } from '../components/ScenariosTab';
import { ReportPanel } from '../components/ReportPanel';
import { CorrosionPageChrome } from '../components/CorrosionPageChrome';
import { AdvancedEngineeringPanel } from '../components/AdvancedEngineeringPanel';
import PredictionTimelineTab from '../components/PredictionTimelineTab';
import { useCorrosionPageData } from '../hooks/useCorrosionPageData';
import AnnualPlanTab from '../components/AnnualPlanTab';
import DualWOCreator from '../components/DualWOCreator';
import CPInstallWOCreator from '../components/CPInstallWOCreator';

const ALLOWED_TABS: Tab[] = [
  'analysis', 'segments', 'compare', 'timeline', 'prediction', 'scenarios', 'engineering', 'report', 'annual_plan',
];

export default function CorrosionSupportPage() {
  const searchParams = useSearchParams();
  const [showDualWO, setShowDualWO] = React.useState(false);
  const [showCPInstall, setShowCPInstall] = React.useState(false);
  const {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    cpPipelines,
    cpPipelinesLoading,
    selectedPipeline,
    setSelectedPipeline,
    selectedCpSession,
    setSelectedCpSession,
    cpAnalysis,
    setCpAnalysis,
    cpAnalysisLoading,
    segmentSize,
    setSegmentSize,
    compareSessionA,
    setCompareSessionA,
    compareSessionB,
    setCompareSessionB,
    compareSessionC,
    setCompareSessionC,
    compareSessionD,
    setCompareSessionD,
    cpCompareData,
    setCpCompareData,
    cpCompareLoading,
    fetchCpPipelines,
  } = useCorrosionPageData();

  // Set default tab and handle deep links
  React.useEffect(() => {
    const tabParam = searchParams.get('tab') as Tab | null;
    const target = tabParam && ALLOWED_TABS.includes(tabParam) ? tabParam : 'analysis';
    if (activeTab !== target) setActiveTab(target);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── شريط التنقل ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard/admin-gateway/corrosion" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
            إدارة التآكل
          </Link>
          <span>/</span>
          <span className="text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            قسم الدعم الفني
          </span>
        </div>

        <CorrosionPageChrome
          viewMode={viewMode}
          setViewMode={setViewMode}
          cpPipelinesLoading={cpPipelinesLoading}
          cpPipelines={cpPipelines}
          cpAnalysis={cpAnalysis}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRefresh={fetchCpPipelines}
          allowedTabs={ALLOWED_TABS}
          sectionTitle="قسم الدعم الفني"
          sectionSubtitle="تحليل البيانات، إعداد التقرير الفني، توليد التقارير المتابعة، والتنسيق مع الصيانة بعد التحليل"
        />

        {/* ── تحليل المسح ── */}
        {activeTab === 'analysis' && (
          <CpAnalysisTab
            pipelines={cpPipelines}
            pipelinesLoading={cpPipelinesLoading}
            selectedPipeline={selectedPipeline}
            onSelectPipeline={(pid) => { setSelectedPipeline(pid); setSelectedCpSession(null); setCpAnalysis(null); }}
            selectedSession={selectedCpSession}
            onSelectSession={setSelectedCpSession}
            analysis={cpAnalysis}
            analysisLoading={cpAnalysisLoading}
            segmentSize={segmentSize}
            onSegmentSizeChange={setSegmentSize}
            viewMode={viewMode}
            onRefresh={fetchCpPipelines}
            onOpenSegments={() => setActiveTab('segments')}
            onGoToWorkOrders={() => setActiveTab('report')}
          />
        )}

        {/* ── المقاطع ── */}
        {activeTab === 'segments' && (
          <SegmentsTab
            analysis={cpAnalysis}
            analysisLoading={cpAnalysisLoading}
            viewMode={viewMode}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {/* ── مقارنة المسوحات ── */}
        {activeTab === 'compare' && (
          <CpCompareTab
            pipelines={cpPipelines}
            pipelinesLoading={cpPipelinesLoading}
            selectedPipeline={selectedPipeline}
            onSelectPipeline={(pid) => { setSelectedPipeline(pid); setCompareSessionA(null); setCompareSessionB(null); setCompareSessionC(null); setCompareSessionD(null); setCpCompareData(null); }}
            segmentSize={segmentSize}
            onSegmentSizeChange={setSegmentSize}
            compareSessionA={compareSessionA}
            compareSessionB={compareSessionB}
            compareSessionC={compareSessionC}
            compareSessionD={compareSessionD}
            onCompareSessionAChange={setCompareSessionA}
            onCompareSessionBChange={setCompareSessionB}
            onCompareSessionCChange={setCompareSessionC}
            onCompareSessionDChange={setCompareSessionD}
            compareData={cpCompareData}
            compareLoading={cpCompareLoading}
            onRefresh={fetchCpPipelines}
          />
        )}

        {/* ── خط الزمن التنبؤي ── */}
        {activeTab === 'timeline' && (
          <PredictionTimelineTab
            selectedPipeline={selectedPipeline}
            pipelines={cpPipelines}
            onSelectPipeline={setSelectedPipeline}
          />
        )}

        {/* ── التنبؤ المتقدم ── */}
        {activeTab === 'prediction' && (
          <PredictionTab
            pipelines={cpPipelines}
            pipelinesLoading={cpPipelinesLoading}
            selectedPipeline={selectedPipeline}
            onSelectPipeline={(pid) => { setSelectedPipeline(pid); setCompareSessionA(null); setCompareSessionB(null); setCpCompareData(null); }}
            segmentSize={segmentSize}
            onSegmentSizeChange={setSegmentSize}
            compareSessionA={compareSessionA}
            compareSessionB={compareSessionB}
            onCompareSessionAChange={setCompareSessionA}
            onCompareSessionBChange={setCompareSessionB}
            compareData={cpCompareData}
            compareLoading={cpCompareLoading}
            viewMode={viewMode}
            onGoToSessions={() => setActiveTab('analysis')}
            onRefresh={fetchCpPipelines}
            onGoToWorkOrders={() => setActiveTab('report')}
          />
        )}

        {/* ── السيناريوهات ── */}
        {activeTab === 'scenarios' && (
          <ScenariosTab
            analysis={cpAnalysis}
            pipelines={cpPipelines}
            viewMode={viewMode}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {/* ── الحسابات الهندسية ── */}
        {activeTab === 'engineering' && <AdvancedEngineeringPanel />}

        {/* ── التقرير الهندسي ── */}
        {activeTab === 'report' && (
          <ReportPanel
            analysis={cpAnalysis}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {/* ── الخطة السنوية ── */}
        {activeTab === 'annual_plan' && <AnnualPlanTab />}

        {/* ── أوامر CP / مزدوجة ── */}
        {activeTab === 'analysis' && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowCPInstall(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-600/20 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              إصدار أمر تركيب حماية كاثودية
            </button>
            <button
              onClick={() => setShowDualWO(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/10 border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-600/20 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              إنشاء أمر مزدوج (فك + طلاء)
            </button>
          </div>
        )}

        {showDualWO && (
          <DualWOCreator
            onClose={() => setShowDualWO(false)}
            onSuccess={() => setShowDualWO(false)}
          />
        )}

        {showCPInstall && (
          <CPInstallWOCreator
            onClose={() => setShowCPInstall(false)}
            onSuccess={() => setShowCPInstall(false)}
          />
        )}

      </div>
    </div>
  );
}
