'use client';

// ═══════════════════════════════════════════════════════════════════════════════
//  إدارة التآكل الفنية — Technical Corrosion Management
//  Route: /dashboard/admin-gateway/corrosion/technical
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Tab } from '../types';
import { CpAnalysisTab } from '../components/CpAnalysisTab';
import { CpCompareTab } from '../components/CpCompareTab';
import { PredictionTab } from '../components/PredictionTab';
import { SegmentsTab } from '../components/SegmentsTab';
import { ScenariosTab } from '../components/ScenariosTab';
import { ReportPanel } from '../components/ReportPanel';
import { AdminReportsPanel } from '../components/AdminReportsPanel';
import WorkOrdersTab from '../components/WorkOrdersTab';
import { CorrosionSessionsTab } from '../components/CorrosionSessionsTab';
import { CorrosionPageChrome } from '../components/CorrosionPageChrome';
import { AdvancedEngineeringPanel } from '../components/AdvancedEngineeringPanel';
import PredictionTimelineTab from '../components/PredictionTimelineTab';
import CipsToolsPanel from '../components/CipsToolsPanel';
import PipelineLinearMap from '../components/PipelineLinearMap';
import { useCorrosionPageData } from '../hooks/useCorrosionPageData';

export default function CorrosionTechnicalPage() {
  const searchParams = useSearchParams();
  const {
    activeTab,
    setActiveTab,
    showUploadPanel,
    setShowUploadPanel,
    viewMode,
    setViewMode,
    uploads,
    uploadsLoading,
    selectedUpload,
    setSelectedUpload,
    uploadSearch,
    setUploadSearch,
    uploadYear,
    setUploadYear,
    uploadLocation,
    setUploadLocation,
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
    filteredUploads,
    fetchUploads,
    fetchCpPipelines,
    fetchUploadDetail,
  } = useCorrosionPageData();

  React.useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return;
    const allowedTabs: Tab[] = [
      'sessions', 'analysis', 'work-orders', 'segments', 'compare', 'prediction',
      'timeline', 'cips', 'scenarios', 'engineering', 'report', 'admin-reports', 'pipeline-map',
    ];
    if (allowedTabs.includes(tabParam as Tab) && activeTab !== (tabParam as Tab)) {
      setActiveTab(tabParam as Tab);
    }
  }, [activeTab, searchParams, setActiveTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── شريط التنقل العلوي ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link
            href="/dashboard/admin-gateway/corrosion"
            className="flex items-center gap-1.5 hover:text-orange-400 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            إدارة التآكل
          </Link>
          <span>/</span>
          <span className="text-orange-400">الواجهة الفنية</span>
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
        />

        {/* ── Sessions Tab ─────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <CorrosionSessionsTab
            uploadsLoading={uploadsLoading}
            uploads={uploads}
            filteredUploads={filteredUploads}
            cpPipelines={cpPipelines}
            selectedUpload={selectedUpload}
            viewMode={viewMode}
            showUploadPanel={showUploadPanel}
            uploadSearch={uploadSearch}
            uploadYear={uploadYear}
            uploadLocation={uploadLocation}
            onUploadSearchChange={setUploadSearch}
            onUploadYearChange={setUploadYear}
            onUploadLocationChange={setUploadLocation}
            onToggleUploadPanel={() => setShowUploadPanel(!showUploadPanel)}
            onRefresh={() => {
              fetchUploads();
              fetchCpPipelines();
            }}
            onUploadSuccess={() => {
              fetchUploads();
              fetchCpPipelines();
              setShowUploadPanel(false);
            }}
            onCloseUploadDetail={() => setSelectedUpload(null)}
            onAnalyzeSession={({ pipelineId, sessionId }) => {
              setSelectedPipeline(pipelineId);
              setSelectedCpSession(sessionId);
              setCpAnalysis(null);
              setActiveTab('analysis');
            }}
            onOpenDetail={fetchUploadDetail}
          />
        )}

        {/* ── Analysis Tab ─────────────────────────────────────────────── */}
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
            onGoToWorkOrders={() => setActiveTab('work-orders')}
          />
        )}

        {/* ── Work Orders Tab ─────────────────────────────────────────── */}
        {activeTab === 'work-orders' && (
          <WorkOrdersTab
            onGoToAnalysis={() => setActiveTab('analysis')}
            onGoToPrediction={() => setActiveTab('prediction')}
            userDepartment="corrosion"
          />
        )}

        {/* ── Segments Tab ─────────────────────────────────────────────── */}
        {activeTab === 'segments' && (
          <SegmentsTab
            analysis={cpAnalysis}
            analysisLoading={cpAnalysisLoading}
            viewMode={viewMode}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {/* ── Compare Tab ──────────────────────────────────────────────── */}
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

        {/* ── Prediction Tab ───────────────────────────────────────────── */}
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
            onGoToSessions={() => setActiveTab('sessions')}
            onRefresh={fetchCpPipelines}
            onGoToWorkOrders={() => setActiveTab('work-orders')}
          />
        )}

        {/* ── Timeline Tab ─────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <PredictionTimelineTab
            selectedPipeline={selectedPipeline}
            pipelines={cpPipelines}
            onSelectPipeline={(pid) => { setSelectedPipeline(pid); }}
          />
        )}

        {/* ── CIPS Tools Tab ───────────────────────────────────────────── */}
        {activeTab === 'cips' && (
          <CipsToolsPanel
            selectedPipeline={selectedPipeline}
            pipelines={cpPipelines.map(p => ({ pipeline_id: p.pipeline_id ?? '', display_name: p.display_name }))}
            onSelectPipeline={(pid) => { setSelectedPipeline(pid); }}
            txtSessions={
              cpPipelines
                .find(p => (p.pipeline_id ?? '') === selectedPipeline)
                ?.sessions.filter(s => s.file_name?.toLowerCase().endsWith('.txt'))
                .map(s => ({
                  session_id: s.session_id,
                  file_name: s.file_name,
                  survey_date: s.survey_date ?? null,
                  total_points: s.total_points,
                  start_distance: s.start_distance ?? null,
                  end_distance: s.end_distance ?? null,
                }))
              ?? []
            }
            gpsSessions={
              cpPipelines
                .find(p => (p.pipeline_id ?? '') === selectedPipeline)
                ?.sessions.filter(s => s.file_name?.toLowerCase().endsWith('.svy'))
                .map(s => ({
                  session_id: s.session_id,
                  file_name: s.file_name,
                  survey_date: s.survey_date ?? null,
                  total_points: s.total_points,
                }))
              ?? []
            }
            onSessionReparsed={fetchCpPipelines}
          />
        )}

        {/* ── Scenarios Tab ────────────────────────────────────────────── */}
        {activeTab === 'scenarios' && (
          <ScenariosTab
            analysis={cpAnalysis}
            pipelines={cpPipelines}
            viewMode={viewMode}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {activeTab === 'report' && (
          <ReportPanel
            analysis={cpAnalysis}
            onGoToAnalysis={() => setActiveTab('analysis')}
          />
        )}

        {/* ── Admin Reports Tab ─────────────────────────────────────── */}
        {activeTab === 'admin-reports' && (
          <AdminReportsPanel
            pipelines={cpPipelines}
            pipelinesLoading={cpPipelinesLoading}
            onGoToAnalysis={() => setActiveTab('analysis')}
            onGoToSessions={() => setActiveTab('sessions')}
          />
        )}

        {/* ── Advanced Engineering Module ───────────────────────────── */}
        {activeTab === 'engineering' && (
          <AdvancedEngineeringPanel />
        )}

        {/* ── Pipeline Map Tab ───────────────────────────────────── */}
        {activeTab === 'pipeline-map' && (
          <PipelineLinearMap />
        )}

      </div>
    </div>
  );
}
