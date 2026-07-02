'use client';
/**
 * Project Detail Page — Phase 5
 * ════════════════════════════════════════════════════════════════
 * Route: /dashboard/admin-gateway/projects/[id]
 *
 * The canonical Project 360 workspace, integrated into the Projects
 * department flow. Reached by clicking any project in:
 *   /dashboard/admin-gateway/projects/list
 *
 * Reuses Project360Client from its original location (no duplication).
 * Dark theme consistent with the platform.
 * Old /dashboard/project-360/[id] bookmarks redirect here (Phase 1 + update).
 */

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Project360Client from '@/app/dashboard/project-360/components/Project360Client';

export default function ProjectDetailPage() {
  const params    = useParams<{ id: string }>();
  const projectId = String(params?.id || '').trim();

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100" dir="rtl">

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-1.5 px-4 py-2.5 bg-[#080d1a]/95 backdrop-blur-sm border-b border-slate-800/50 text-xs text-slate-500">
        <Link href="/dashboard/admin-gateway/projects" className="hover:text-slate-300 transition-colors">
          المشاريع
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/dashboard/admin-gateway/projects/list" className="hover:text-slate-300 transition-colors">
          قائمة المشاريع
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-300 font-medium">عرض المشروع 360°</span>
      </div>

      {/* ── Project360Client — reuses existing component ────────────────── */}
      {projectId ? (
        <Project360Client projectId={projectId} />
      ) : (
        <div className="p-6 text-rose-400 text-sm">
          معرّف المشروع مفقود. <Link href="/dashboard/admin-gateway/projects/list" className="underline">العودة للقائمة</Link>
        </div>
      )}

    </div>
  );
}
