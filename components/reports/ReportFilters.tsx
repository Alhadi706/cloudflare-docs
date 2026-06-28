'use client';

/**
 * ReportFilters — شريط الفلاتر الموحّد لجميع التقارير
 *
 * الفلاتر المتاحة:
 *  - اختيار المشروع  (project_id)
 *  - اختيار الموقع   (site_id) — اختياري
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Filter, RefreshCw, X } from 'lucide-react';

const TENANT =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

// ── أنواع ──────────────────────────────────────────────────────────────────────

interface Project { id: number; name: string; code: string; status: string; }
interface Site    { id: number; name: string; }

export interface ReportFilterValues {
  projectId: number | null;
  siteId:    number | null;
}

interface ReportFiltersProps {
  /** القيم الحالية */
  values:    ReportFilterValues;
  /** دالة تُستدعى عند تغيير أي filter */
  onChange:  (v: ReportFilterValues) => void;
  /** إظهار اختيار الموقع */
  showSite?: boolean;
  /** المشروع المحدد يُحمّل مواقعه */
  loading?:  boolean;
}

// ── مكوّن Select صغير ─────────────────────────────────────────────────────────

function Select({
  value, onChange, disabled,
  children, placeholder = 'الكل',
}: {
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
  children:    React.ReactNode;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={[
        'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200',
        'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
        'transition-colors cursor-pointer min-w-[170px]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-600',
      ].join(' ')}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

// ── بادج الفلتر النشط ─────────────────────────────────────────────────────────

function ActiveBadge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
      {label}
      <button onClick={onClear} className="hover:text-white transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────────────────

export default function ReportFilters({
  values, onChange, showSite = false, loading = false,
}: ReportFiltersProps) {
  const [projects,      setProjects]     = useState<Project[]>([]);
  const [sites,         setSites]        = useState<Site[]>([]);
  const [loadingProj,   setLoadingProj]  = useState(false);
  const [loadingSites,  setLoadingSites] = useState(false);

  // تحميل المشاريع عند الاتّساق
  useEffect(() => {
    setLoadingProj(true);
    fetch('/api/v1/gov-reports/projects', { headers: TENANT ? { 'X-Tenant-ID': TENANT } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoadingProj(false));
  }, []);

  // تحميل المواقع عند تغيير المشروع
  useEffect(() => {
    if (!showSite || !values.projectId) { setSites([]); return; }
    setLoadingSites(true);
    fetch(`/api/v1/gov-reports/sites?project_id=${values.projectId}`, {
      headers: TENANT ? { 'X-Tenant-ID': TENANT } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(setSites)
      .catch(() => setSites([]))
      .finally(() => setLoadingSites(false));
  }, [values.projectId, showSite]);

  const setProject = useCallback((v: string) => {
    onChange({ projectId: v ? Number(v) : null, siteId: null });
  }, [onChange]);

  const setSite = useCallback((v: string) => {
    onChange({ ...values, siteId: v ? Number(v) : null });
  }, [onChange, values]);

  const clearAll = useCallback(() => {
    onChange({ projectId: null, siteId: null });
  }, [onChange]);

  const hasFilter = values.projectId != null || values.siteId != null;
  const activeProj = values.projectId != null
    ? projects.find(p => p.id === values.projectId)?.name ?? `#${values.projectId}`
    : null;
  const activeSite = values.siteId != null
    ? sites.find(s => s.id === values.siteId)?.name ?? `#${values.siteId}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">تصفية</span>
      </div>

      {/* فلتر المشروع */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-500 whitespace-nowrap">المشروع</label>
        <Select
          value={values.projectId != null ? String(values.projectId) : ''}
          onChange={setProject}
          disabled={loadingProj || loading}
          placeholder={loadingProj ? 'جاري التحميل...' : 'كل المشاريع'}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              [{p.code}] {p.name}
            </option>
          ))}
        </Select>
      </div>

      {/* فلتر الموقع (إن كان مفعّلاً) */}
      {showSite && values.projectId != null && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 whitespace-nowrap">الموقع</label>
          <Select
            value={values.siteId != null ? String(values.siteId) : ''}
            onChange={setSite}
            disabled={loadingSites || loading}
            placeholder={loadingSites ? 'جاري التحميل...' : 'كل المواقع'}
          >
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      )}

      {/* الفلاتر النشطة */}
      {hasFilter && (
        <div className="flex items-center gap-2 mr-auto">
          {activeProj && (
            <ActiveBadge label={activeProj} onClear={() => onChange({ projectId: null, siteId: null })} />
          )}
          {activeSite && (
            <ActiveBadge label={activeSite} onClear={() => onChange({ ...values, siteId: null })} />
          )}
          <button
            onClick={clearAll}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
          >
            مسح الكل
          </button>
        </div>
      )}

      {/* مؤشر التحميل */}
      {loading && (
        <RefreshCw className="w-4 h-4 text-slate-500 animate-spin mr-auto" />
      )}
    </div>
  );
}
