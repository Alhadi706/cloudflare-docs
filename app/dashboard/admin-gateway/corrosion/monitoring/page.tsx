'use client';

// ═══════════════════════════════════════════════════════════════════════════════
//  قسم المراقبة الدورية والصيانة
//  Route: /dashboard/admin-gateway/corrosion/monitoring
//  Tabs: جلسات المسح | خريطة المسار | أدوات CIPS/DCVG
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Activity } from 'lucide-react';

import { Tab } from '../types';
import { CorrosionSessionsTab } from '../components/CorrosionSessionsTab';
import { CorrosionPageChrome } from '../components/CorrosionPageChrome';
import CipsToolsPanel from '../components/CipsToolsPanel';
import PipelineLinearMap from '../components/PipelineLinearMap';
import { useCorrosionPageData } from '../hooks/useCorrosionPageData';
import FieldTeamsTab from '../components/FieldTeamsTab';
import MonthlyPhasesTab from '../components/MonthlyPhasesTab';

const ALLOWED_TABS: Tab[] = ['sessions', 'pipeline-map', 'cips', 'field_teams', 'phases'];

class MonitoringErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown rendering error',
    };
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-100">
        <h3 className="text-sm font-semibold mb-1">تعذر فتح قسم المراقبة</h3>
        <p className="text-xs text-rose-200/90">{this.state.message || 'حدث خطأ أثناء تحميل الصفحة'}</p>
      </div>
    );
  }
}

export default function CorrosionMonitoringPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
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
    setCpAnalysis,
    cpAnalysis,
    filteredUploads,
    fetchUploads,
    fetchCpPipelines,
    fetchUploadDetail,
  } = useCorrosionPageData();

  // Handle deep links only when a valid tab query is provided.
  // Otherwise, keep in-page tab state so user clicks are not reset.
  React.useEffect(() => {
    if (!tabParam) return;
    if (!ALLOWED_TABS.includes(tabParam)) return;
    if (activeTab !== tabParam) setActiveTab(tabParam);
  }, [tabParam, activeTab, setActiveTab]);

  const handleTabChange = React.useCallback((nextTab: Tab) => {
    setActiveTab(nextTab);

    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, setActiveTab]);

  return (
    <div className="relative z-20 pointer-events-auto min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── شريط التنقل ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard/admin-gateway/corrosion" className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
            إدارة التآكل
          </Link>
          <span>/</span>
          <span className="text-cyan-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            قسم المراقبة الدورية والصيانة
          </span>
        </div>

        <CorrosionPageChrome
          viewMode={viewMode}
          setViewMode={setViewMode}
          cpPipelinesLoading={cpPipelinesLoading}
          cpPipelines={cpPipelines}
          cpAnalysis={cpAnalysis}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onRefresh={fetchCpPipelines}
          allowedTabs={ALLOWED_TABS}
          sectionTitle="قسم المراقبة الدورية والصيانة"
          sectionSubtitle="تنفيذ كشف المسارات، متابعة العوائق، إصدار أوامر بدء المسح، ومراقبة التنفيذ الدوري"
        />

        <MonitoringErrorBoundary>
          {/* ── جلسات المسح ── */}
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
              onRefresh={() => { fetchUploads(); fetchCpPipelines(); }}
              onUploadSuccess={() => { fetchUploads(); fetchCpPipelines(); setShowUploadPanel(false); }}
              onCloseUploadDetail={() => {}}
              onAnalyzeSession={({ pipelineId, sessionId }) => {
                setSelectedPipeline(pipelineId);
                setSelectedCpSession(sessionId);
                setCpAnalysis(null);
                // Navigate to support page for analysis
              }}
              onOpenDetail={fetchUploadDetail}
            />
          )}

          {/* ── خريطة المسار ── */}
          {activeTab === 'pipeline-map' && <PipelineLinearMap />}

          {/* ── الفرق الفنية ── */}
          {activeTab === 'field_teams' && <FieldTeamsTab />}

          {/* ── المراحل الشهرية ── */}
          {activeTab === 'phases' && <MonthlyPhasesTab />}

          {/* ── أدوات CIPS/DCVG ── */}
          {activeTab === 'cips' && (
            <CipsToolsPanel
              selectedPipeline={selectedPipeline}
              pipelines={cpPipelines.map(p => ({ pipeline_id: p.pipeline_id ?? '', display_name: p.display_name }))}
              onSelectPipeline={setSelectedPipeline}
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
        </MonitoringErrorBoundary>

      </div>
    </div>
  );
}
