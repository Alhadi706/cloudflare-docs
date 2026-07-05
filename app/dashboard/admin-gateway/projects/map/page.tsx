'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight, Map, MapPin, Layers, Search, Filter, RefreshCw,
  Briefcase, CheckCircle, Clock, AlertCircle,
} from 'lucide-react';

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

interface ProjectSite {
  id: number;
  name: string;
  project_name?: string;
  latitude: number;
  longitude: number;
  status: string;
  site_type?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  completed: 'text-blue-400',
  suspended: 'text-amber-400',
  cancelled: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  completed: 'مكتمل',
  suspended: 'موقوف',
  cancelled: 'ملغي',
};

export default function ProjectsMapPage() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProjectSite | null>(null);

  useEffect(() => {
    fetch('/api/v1/dept-admin/projects/sites/all', { headers: getHeaders() })
      .then((r) => r.json())
      .then((d) => setSites(Array.isArray(d.data) ? d.data : []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sites.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.project_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <Link
              href="/dashboard/admin-gateway/projects"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              إدارة المشاريع
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">عرض الخرائط والمواقع</h1>
            <p className="text-slate-400 text-xs mt-0.5">Projects Map View — Field Sites & Locations</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin-gateway/projects/sites"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 transition-colors"
            >
              <Layers className="w-4 h-4" />
              إدارة المواقع
            </Link>
            <Link
              href="/dashboard/gis-sovereignty/engineering-workspace"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            >
              <Map className="w-4 h-4" />
              GIS كامل
            </Link>
          </div>
        </div>

        {/* Map placeholder + site list */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Map area */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">خريطة مواقع المشاريع</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-400">{sites.length} موقع</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <iframe
                src="/dashboard/admin-gateway/projects/sites"
                className="w-full h-full border-0 opacity-0 absolute inset-0 pointer-events-none"
                title="projects-sites"
              />
              {/* Visual map embed using GIS iframe */}
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-slate-950">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Map className="w-10 h-10 text-cyan-400/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-slate-300 text-sm font-medium">عرض المواقع الجغرافية</p>
                  <p className="text-slate-500 text-xs mt-1 max-w-xs">لعرض الخريطة التفاعلية الكاملة استخدم منصة GIS المتكاملة</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Link
                    href="/dashboard/gis-sovereignty/engineering-workspace"
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Map className="w-4 h-4" />
                    فتح GIS التفاعلي
                  </Link>
                  <Link
                    href="/dashboard/admin-gateway/projects/sites"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    إدارة المواقع
                  </Link>
                </div>
                {/* Sites summary chips */}
                <div className="flex gap-3 mt-2">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => {
                    const count = sites.filter((s) => s.status === k).length;
                    if (count === 0) return null;
                    return (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className={`font-bold text-sm ${STATUS_COLORS[k]}`}>{count}</span>
                        <span>{v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Sites list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">المواقع الميدانية</span>
              </div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 text-xs">جاري التحميل...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <MapPin className="w-8 h-8 text-slate-700" />
                  <p className="text-slate-500 text-xs">لا توجد مواقع</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filtered.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => setSelected(site === selected ? null : site)}
                      className={`w-full text-right px-4 py-3 hover:bg-slate-800/60 transition-all
                        ${selected?.id === site.id ? 'bg-slate-800/80' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{site.name}</p>
                          {site.project_name && (
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Briefcase className="w-3 h-3" />
                              {site.project_name}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {site.latitude?.toFixed(4)}, {site.longitude?.toFixed(4)}
                          </p>
                        </div>
                        <span className={`text-[10px] font-medium ${STATUS_COLORS[site.status] || 'text-slate-400'}`}>
                          {STATUS_LABELS[site.status] || site.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom path */}
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium shrink-0">عرض الطبقات:</span>
            <span className="rounded-full border border-cyan-700/50 bg-cyan-900/20 px-2.5 py-0.5 text-cyan-300">مواقع المشاريع</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-purple-700/50 bg-purple-900/20 px-2.5 py-0.5 text-purple-300">حدود المشاريع</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-0.5 text-emerald-300">خطوط الأنابيب</span>
          </div>
        </div>
      </div>
    </div>
  );
}
