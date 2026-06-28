'use client';

// ═══════════════════════════════════════════════════════════════════════════════
//  قسم المكونات الهندسية والطلاء
//  Route: /dashboard/admin-gateway/corrosion/coating
//  Tabs: أوامر العمل | التقارير الإدارية
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Layers } from 'lucide-react';

import { Tab } from '../types';
import { AdminReportsPanel } from '../components/AdminReportsPanel';
import WorkOrdersTab from '../components/WorkOrdersTab';
import { CorrosionPageChrome } from '../components/CorrosionPageChrome';
import { useCorrosionPageData } from '../hooks/useCorrosionPageData';

const ALLOWED_TABS: Tab[] = ['work-orders', 'admin-reports'];

export default function CorrosionCoatingPage() {
  const searchParams = useSearchParams();
  const {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    cpPipelines,
    cpPipelinesLoading,
    cpAnalysis,
    fetchCpPipelines,
  } = useCorrosionPageData();

  // Set default tab and handle deep links
  React.useEffect(() => {
    const tabParam = searchParams.get('tab') as Tab | null;
    const target = tabParam && ALLOWED_TABS.includes(tabParam) ? tabParam : 'work-orders';
    if (activeTab !== target) setActiveTab(target);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── شريط التنقل ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard/admin-gateway/corrosion" className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
            إدارة التآكل
          </Link>
          <span>/</span>
          <span className="text-amber-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            قسم المكونات الهندسية والطلاء
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
          sectionTitle="قسم المكونات الهندسية والطلاء"
          sectionSubtitle="متابعة مشاكل الطلاء والمكونات، إجراءات التصحيح، وإعداد أوامر العمل المعالجة داخلياً أو عبر الصيانة"
        />

        {/* ── أوامر العمل ── */}
        {activeTab === 'work-orders' && (
          <WorkOrdersTab
            onGoToAnalysis={() => setActiveTab('admin-reports')}
            onGoToPrediction={() => setActiveTab('admin-reports')}
            userDepartment="corrosion"
          />
        )}

        {/* ── التقارير الإدارية ── */}
        {activeTab === 'admin-reports' && (
          <AdminReportsPanel
            pipelines={cpPipelines}
            pipelinesLoading={cpPipelinesLoading}
            onGoToAnalysis={() => setActiveTab('work-orders')}
            onGoToSessions={() => setActiveTab('work-orders')}
          />
        )}

      </div>
    </div>
  );
}
