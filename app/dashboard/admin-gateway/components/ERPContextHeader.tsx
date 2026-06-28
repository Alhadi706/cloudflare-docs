'use client';
/**
 * ERPContextHeader
 * ─────────────────
 * شريط السياق العلوي الظاهر في كل صفحات Admin Gateway.
 * يُظهر المشروع + الموقع المحدد ويسمح بتغييرهما.
 * المصدر: workspace.projects + workspace.project_sites
 */
import React, { useEffect } from 'react';
import { Building2, MapPin, ChevronDown, X, Loader2 } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';
import { useRouter } from 'next/navigation';

const SITE_TYPE_LABELS: Record<string, string> = {
  administrative: 'إداري',
  operational:    'تشغيلي',
  field:          'ميداني',
  storage:        'مخزن',
  maintenance:    'صيانة',
};

export default function ERPContextHeader() {
  const {
    projects, sites,
    activeProjectId, activeSiteId,
    projectsLoading, sitesLoading,
    loadProjects, setActiveProject, setActiveSite,
    getActiveProject, getActiveSite,
  } = useErpContextStore();

  const router = useRouter();

  // تحميل المشاريع عند أول تركيب
  useEffect(() => {
    if (projects.length === 0 && !projectsLoading) {
      loadProjects();
    }
  }, []);

  // اختيار المشروع الأول تلقائياً إذا لم يكن هناك مشروع محدد
  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && activeProjectId === null) {
      setActiveProject(String(projects[0].id));
    }
  }, [projects, projectsLoading, activeProjectId]);

  const activeProject = getActiveProject();
  const activeSite    = getActiveSite();

  const projectName = activeProject
    ? (activeProject.project_name || activeProject.name || `مشروع #${activeProject.id}`)
    : null;

  const siteName = activeSite
    ? `${activeSite.name}${activeSite.site_type ? ' — ' + (SITE_TYPE_LABELS[activeSite.site_type] || activeSite.site_type) : ''}`
    : null;

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 flex-wrap" dir="rtl">
      {/* شارة البوابة */}
      <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-semibold uppercase tracking-wider flex-shrink-0">
        <Building2 className="w-3.5 h-3.5" />
        <span>سياق ERP</span>
      </div>

      <div className="h-4 w-px bg-gray-700 flex-shrink-0" />

      {/* اختيار المشروع */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs text-gray-500">المشروع:</span>
        {projectsLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
        ) : projects.length === 0 ? (
          <button
            onClick={() => router.push('/dashboard/admin-gateway/projects/list')}
            className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
          >
            لا يوجد مشروع — أنشئ مشروعاً أولاً ←
          </button>
        ) : (
          <div className="relative">
            <select
              value={activeProjectId !== null ? String(activeProjectId) : ''}
              onChange={e => {
                const val = e.target.value;
                setActiveProject(val ? val : null);
              }}
              className="appearance-none bg-gray-800 border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-0.5 pl-6 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">— اختر مشروعاً —</option>
              {projects.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.project_name || p.name || `#${p.id}`}
                  {p.project_code ? ` (${p.project_code})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* اختيار الموقع — يظهر فقط إذا كان مشروع محدد */}
      {activeProjectId && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-gray-500">الموقع:</span>
          {sitesLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
          ) : (
            <div className="relative">
              <select
                value={activeSiteId !== null ? String(activeSiteId) : ''}
                onChange={e => {
                  const val = e.target.value;
                  setActiveSite(val ? Number(val) : null);
                }}
                className="appearance-none bg-gray-800 border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-0.5 pl-6 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">— كل المواقع —</option>
                {sites.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                    {s.site_type ? ` (${SITE_TYPE_LABELS[s.site_type] || s.site_type})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      )}

      {/* شارة السياق النشط */}
      {activeProjectId && (
        <div className="flex items-center gap-2 mr-auto">
          <div className="flex items-center gap-1.5 bg-indigo-900/40 border border-indigo-700/40 rounded px-2 py-0.5">
            <Building2 className="w-3 h-3 text-indigo-400" />
            <span className="text-xs text-indigo-300 font-medium max-w-[160px] truncate">
              {projectName}
            </span>
            {activeSiteId && (
              <>
                <span className="text-gray-600">›</span>
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium max-w-[120px] truncate">
                  {siteName}
                </span>
              </>
            )}
            <button
              onClick={() => setActiveProject(null)}
              className="text-gray-500 hover:text-red-400 transition-colors mr-1"
              title="مسح السياق"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
