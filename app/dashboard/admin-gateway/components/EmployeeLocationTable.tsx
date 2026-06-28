'use client';
/**
 * EmployeeLocationTable
 * ─────────────────────
 * جدول لربط الموظفين (بعد رفع ملف أو استيراد) بمشاريعهم ومواقعهم الجغرافية.
 * يُستدعى تلقائياً عندما تُرفع قائمة موظفين تحتوي على أسماء بدون موقع.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  MapPin, Building2, CheckCircle2, AlertCircle,
  Loader2, Save, Users, ChevronDown, X
} from 'lucide-react';
import { useErpContextStore, ErpProject, ErpSite } from '@/store/erpContextStore';
import { getUserAuthHeaders } from '@/store/useUserStore';

export interface EmployeeRow {
  id: string | number;
  full_name: string;
  position?: string;
  department?: string;
  project_id?: string | number | null;
  site_id?: number | null;
  /** أي بيانات أخرى */
  [key: string]: unknown;
}

interface EmployeeLocationTableProps {
  employees: EmployeeRow[];
  /** عند حفظ التحديثات */
  onSave: (updated: EmployeeRow[]) => Promise<void>;
  /** عند إغلاق الجدول */
  onClose?: () => void;
}

export default function EmployeeLocationTable({
  employees,
  onSave,
  onClose,
}: EmployeeLocationTableProps) {
  const {
    projects, sites,
    projectsLoading, sitesLoading,
    loadProjects, loadSites,
  } = useErpContextStore();

  // حالة كل صف
  const [rows, setRows] = useState<EmployeeRow[]>(employees);
  // مواقع لكل مشروع (cache)
  const [sitesCache, setSitesCache] = useState<Record<string, ErpSite[]>>({});
  const [sitesLoading2, setSitesLoading2] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (projects.length === 0 && !projectsLoading) loadProjects();
  }, []); // eslint-disable-line

  const fetchSitesForProject = useCallback(async (projectId: string | number) => {
    const key = String(projectId);
    if (sitesCache[key] || sitesLoading2[key]) return;
    setSitesLoading2(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/v1/workspace/projects/${projectId}/sites`, {
        headers: getUserAuthHeaders(),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.sites || []);
      setSitesCache(prev => ({ ...prev, [key]: arr }));
    } catch {
      setSitesCache(prev => ({ ...prev, [key]: [] }));
    } finally {
      setSitesLoading2(prev => ({ ...prev, [key]: false }));
    }
  }, [sitesCache, sitesLoading2]);

  const updateRow = useCallback((id: string | number, changes: Partial<EmployeeRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  }, []);

  const handleProjectChange = useCallback((empId: string | number, projectId: string | number | '') => {
    updateRow(empId, { project_id: projectId || null, site_id: null });
    if (projectId) fetchSitesForProject(projectId);
  }, [updateRow, fetchSitesForProject]);

  const handleSiteChange = useCallback((empId: string | number, siteId: number | '') => {
    updateRow(empId, { site_id: siteId || null });
  }, [updateRow]);

  /** تعيين نفس المشروع/الموقع لكل الصفوف */
  const applyToAll = useCallback((projectId: string | number, siteId?: number) => {
    setRows(prev => prev.map(r => ({
      ...r,
      project_id: projectId,
      site_id: siteId ?? null,
    })));
    if (projectId) fetchSitesForProject(projectId);
  }, [fetchSitesForProject]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [rows, onSave]);

  const completedCount = rows.filter(r => r.project_id && r.site_id).length;
  const pendingCount = rows.length - completedCount;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl" dir="rtl">
      {/* رأس */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">ربط الموظفين بالمواقع الجغرافية</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">{completedCount} مكتمل</span>
            {pendingCount > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">{pendingCount} يحتاج تحديد</span>
              </>
            )}
          </div>
          {onClose && (
            <button onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* أدوات التعبئة الجماعية */}
      <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-700/50 flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-400 flex-shrink-0">تعبئة جماعية:</span>
        <div className="flex items-center gap-2 flex-wrap">
          {/* اختيار المشروع */}
          <select
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-200 appearance-none focus:outline-none focus:border-blue-500"
            onChange={e => {
              if (e.target.value) {
                applyToAll(e.target.value);
              }
            }}
            defaultValue=""
          >
            <option value="">اختر مشروعاً للجميع...</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.project_name || p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">→ يطبق على كل الصفوف</span>
        </div>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/40">
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">الاسم</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">الوظيفة / القسم</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider min-w-[180px]">المشروع *</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider min-w-[180px]">الموقع *</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-16">حالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {rows.map(emp => {
              const projKey = String(emp.project_id || '');
              const projSites: ErpSite[] = sitesCache[projKey] || [];
              const isComplete = !!(emp.project_id && emp.site_id);

              return (
                <tr key={emp.id}
                  className={`transition-colors ${isComplete ? 'bg-emerald-500/5' : 'bg-amber-500/5 hover:bg-slate-800/30'}`}>
                  {/* الاسم */}
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-200">{emp.full_name}</div>
                  </td>
                  {/* الوظيفة */}
                  <td className="px-4 py-2.5 text-slate-400">
                    <div>{emp.position || '—'}</div>
                    {emp.department && <div className="text-[10px] text-slate-500">{String(emp.department)}</div>}
                  </td>
                  {/* المشروع */}
                  <td className="px-4 py-2.5">
                    <select
                      value={String(emp.project_id || '')}
                      onChange={e => handleProjectChange(emp.id, e.target.value)}
                      className={`w-full bg-slate-800 border rounded-lg px-2 py-1.5 text-xs text-slate-200 appearance-none focus:outline-none focus:border-blue-500 ${
                        emp.project_id ? 'border-slate-600' : 'border-amber-500/50'
                      }`}
                    >
                      <option value="">— اختر مشروعاً —</option>
                      {projectsLoading ? (
                        <option disabled>جاري التحميل...</option>
                      ) : (
                        projects.map(p => (
                          <option key={p.id} value={String(p.id)}>
                            {p.project_name || p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                  {/* الموقع */}
                  <td className="px-4 py-2.5">
                    {!emp.project_id ? (
                      <span className="text-[10px] text-slate-600">اختر مشروعاً أولاً</span>
                    ) : sitesLoading2[projKey] ? (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px]">تحميل...</span>
                      </div>
                    ) : (
                      <select
                        value={String(emp.site_id || '')}
                        onChange={e => handleSiteChange(emp.id, e.target.value ? Number(e.target.value) : '')}
                        className={`w-full bg-slate-800 border rounded-lg px-2 py-1.5 text-xs text-slate-200 appearance-none focus:outline-none focus:border-blue-500 ${
                          emp.site_id ? 'border-slate-600' : 'border-amber-500/50'
                        }`}
                      >
                        <option value="">— اختر موقعاً —</option>
                        {projSites.length === 0 ? (
                          <option disabled>لا توجد مواقع</option>
                        ) : (
                          projSites.map((s: ErpSite) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </td>
                  {/* الحالة */}
                  <td className="px-4 py-2.5 text-center">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* شريط الحفظ */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-t border-slate-700">
        <div className="text-xs text-slate-500">
          {pendingCount > 0
            ? `${pendingCount} موظف لم يُحدَّد موقعهم بعد`
            : 'جميع الموظفين مرتبطون بمواقع جغرافية'}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || completedCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            حفظ تحديد المواقع ({completedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
