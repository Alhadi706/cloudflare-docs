'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, ExternalLink } from 'lucide-react';

interface Project {
  id: number | string;
  project_name?: string;
  name?: string;
  project_code?: string;
  code?: string;
  status?: string;
}

export default function Project360IndexPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') || '' : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;

    fetch('/api/v1/workspace/projects?limit=50', { headers, cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const list: Project[] = Array.isArray(data) ? data : (data.projects ?? data.items ?? data.results ?? []);
        setProjects(list);
      })
      .catch(() => setError('تعذر تحميل المشاريع'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6 md:p-8 space-y-6" dir="rtl">
      <header className="rounded-2xl border border-gray-700 bg-gray-950/80 p-6">
        <p className="text-xs uppercase tracking-widest text-cyan-300/80">مساحة عمل المشروع 360</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-white">دورة حياة المشروع 360°</h1>
        <p className="mt-2 text-sm text-gray-300 max-w-2xl">
          عرض شامل للمشروع يتضمن بيانات GIS والعقود والميزانيات والمراسلات والمعالم والتسليم والأصول الناتجة والجدول التشغيلي.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-5">
        <h2 className="text-sm font-semibold text-white mb-3">اختر مشروعاً</h2>

        {loading && (
          <p className="text-xs text-gray-400">جاري تحميل المشاريع...</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        {!loading && !error && projects.length === 0 && (
          <p className="text-xs text-gray-500">لا توجد مشاريع. أنشئ مشروعاً من <Link href="/dashboard/admin-gateway/projects/list" className="text-cyan-400 underline">قائمة المشاريع</Link>.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {projects.map(p => {
            const id = p.id;
            const name = p.project_name || p.name || `مشروع #${id}`;
            const code = p.project_code || p.code || '';
            return (
              <Link
                key={id}
                href={`/dashboard/project-360/${id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 hover:border-cyan-500/60 hover:bg-cyan-950/20 transition-colors group"
              >
                <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{name}</p>
                  {code && <p className="text-[11px] text-gray-500 font-mono">{code}</p>}
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-cyan-400 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

