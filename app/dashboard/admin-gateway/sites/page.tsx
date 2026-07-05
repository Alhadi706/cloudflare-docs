'use client';
/**
 * Sites Management Page — Phase 2 (Canonical Asset Architecture)
 * ════════════════════════════════════════════════════════════════
 * Route: /dashboard/admin-gateway/sites
 *
 * Lists all operational sites across all projects.
 * Allows creating new sites under a selected project.
 * Shows asset count per site (links to registry filtered by site).
 *
 * Backend: sites are sub-entities of projects
 *   GET  /api/v1/workspace/all-sites (aggregation)
 *   POST /api/v1/workspace/projects/[id]/sites (create)
 *   PATCH /api/v1/workspace/sites/[id] (update)
 */
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin, Plus, RefreshCw, Building2, Search,
  ChevronLeft, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, Package,
} from 'lucide-react';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface SiteItem {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  code: string | null;
  site_type: string;
  status: string;
}

interface Project {
  id: number;
  project_name?: string;
  name?: string;
}

const SITE_TYPE_LABELS: Record<string, string> = {
  administrative: 'إداري',
  operational:    'تشغيلي',
  field:          'ميداني',
  storage:        'مخزن',
  maintenance:    'صيانة',
  pump_station:   'محطة ضخ',
  distribution:   'توزيع',
  junction:       'تقاطع',
};

const SITE_TYPE_COLORS: Record<string, string> = {
  administrative: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  operational:    'bg-amber-500/15 text-amber-300 border-amber-500/25',
  field:          'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  storage:        'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  maintenance:    'bg-rose-500/15 text-rose-300 border-rose-500/25',
  pump_station:   'bg-violet-500/15 text-violet-300 border-violet-500/25',
  distribution:   'bg-teal-500/15 text-teal-300 border-teal-500/25',
  junction:       'bg-slate-500/15 text-slate-300 border-slate-500/25',
};

function typeColor(type: string) {
  return SITE_TYPE_COLORS[type] || SITE_TYPE_COLORS.operational;
}

export default function SitesPage() {
  const [sites, setSites]         = useState<SiteItem[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [query, setQuery]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  // Form state
  const [form, setForm] = useState({
    project_id: '' as string | number,
    name: '',
    code: '',
    site_type: 'operational',
    status: 'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = getClientTenantHeaders();
      const [sitesRes, projRes] = await Promise.all([
        fetch('/api/v1/workspace/all-sites', { headers }),
        fetch('/api/v1/workspace/projects?limit=200', { headers }),
      ]);
      if (sitesRes.ok) {
        const d = await sitesRes.json();
        setSites(d.sites || []);
      }
      if (projRes.ok) {
        const d = await projRes.json();
        const list: Project[] = Array.isArray(d) ? d : (d.projects ?? []);
        setProjects(list);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.name.trim()) {
      setSaveMsg('المشروع والاسم مطلوبان');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const headers = { ...getClientTenantHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(
        `/api/v1/workspace/projects/${form.project_id}/sites`,
        { method: 'POST', headers, body: JSON.stringify({ name: form.name.trim(), code: form.code || null, site_type: form.site_type, status: form.status }) },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d?.detail || d?.error || 'فشل الإنشاء');
      setSaveMsg('تم إنشاء الموقع بنجاح');
      setForm({ project_id: '', name: '', code: '', site_type: 'operational', status: 'active' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setSaveMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = sites.filter(s => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code ?? '').toLowerCase().includes(q) ||
      s.project_name.toLowerCase().includes(q) ||
      (SITE_TYPE_LABELS[s.site_type] ?? s.site_type).includes(q)
    );
  });

  // Group by project
  const byProject = filtered.reduce((acc, s) => {
    const key = `${s.project_id}:${s.project_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, SiteItem[]>);

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300 transition-colors">بوابة النظام</Link>
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="text-slate-300 font-medium">إدارة المواقع التشغيلية</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">المواقع التشغيلية</h1>
            <p className="text-sm text-slate-500 mt-1">
              كل موقع يحتوي مجموعة من الأصول والفرق والمشاريع — اختر موقعاً لتصفية بيانات الأصول.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              موقع جديد
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-4 space-y-3">
            <p className="text-sm font-bold text-cyan-200">إضافة موقع تشغيلي جديد</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Project selector */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">المشروع <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <select
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-cyan-500"
                    required
                  >
                    <option value="">— اختر المشروع —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.project_name || p.name || `مشروع #${p.id}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Site name */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">اسم الموقع <span className="text-rose-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: محطة حساونة"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                  required
                />
              </div>

              {/* Code */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">رمز الموقع (اختياري)</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="HASSAWNA-01"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                />
              </div>

              {/* Site type */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">نوع الموقع</label>
                <div className="relative">
                  <select
                    value={form.site_type}
                    onChange={e => setForm(f => ({ ...f, site_type: e.target.value }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(SITE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {saveMsg && (
              <p className={`text-xs ${saveMsg.includes('نجاح') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saveMsg}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {saving ? 'جاري الحفظ...' : 'إنشاء الموقع'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs hover:bg-slate-800 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-900/20 border border-rose-500/30 text-sm text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الرمز أو المشروع..."
            className="w-full bg-slate-900/60 border border-slate-800 text-slate-200 text-sm rounded-xl pr-10 pl-4 py-2.5 focus:outline-none focus:border-cyan-500/50 placeholder-slate-600"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {Object.keys(byProject).length} مشروع
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {filtered.length} موقع
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Sites grouped by project */}
        {!loading && Object.keys(byProject).length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center space-y-2">
            <MapPin className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-500">لا توجد مواقع تشغيلية بعد</p>
            <p className="text-xs text-slate-600">أنشئ موقعاً جديداً أو أضف مشاريع أولاً</p>
          </div>
        )}

        {!loading && Object.entries(byProject).map(([projectKey, projectSites]) => {
          const [, projectName] = projectKey.split(':').map((s, i) => i === 0 ? Number(s) : s);
          return (
            <div key={projectKey} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              {/* Project header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/40 border-b border-slate-800">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">{projectName}</span>
                <span className="text-[10px] text-slate-600 mr-auto">{projectSites.length} موقع</span>
              </div>

              {/* Sites grid */}
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {projectSites.map(site => (
                  <div
                    key={site.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-700/60 bg-slate-900/60 hover:border-slate-600 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{site.name}</p>
                      {site.code && (
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{site.code}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColor(site.site_type)}`}>
                          {SITE_TYPE_LABELS[site.site_type] ?? site.site_type}
                        </span>
                        {site.status === 'active' && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> نشط
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Link to assets filtered by site */}
                    <Link
                      href={`/dashboard/admin-gateway/assets/registry?site_id=${site.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="عرض أصول هذا الموقع"
                    >
                      <Package className="w-4 h-4 text-cyan-400" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
