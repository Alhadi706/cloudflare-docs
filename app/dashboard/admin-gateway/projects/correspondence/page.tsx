'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

export default function ProjectsCorrespondencePage() {
  return (
    <div className="min-h-full w-full bg-slate-950 text-slate-100 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div>
          <Link
            href="/dashboard/admin-gateway/projects"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-0.5"
          >
            <ArrowRight className="w-4 h-4" />
            إدارة المشاريع
          </Link>
          <h1 className="text-lg font-bold text-white">نظام المراسلات الموحد</h1>
          <p className="text-slate-400 text-xs mt-0.5">الوارد · الصادر · التعميمات — إدارة المشاريع</p>
        </div>
      </div>

      {/* Full InternalMailTab — wired to projects_manager mailbox */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <InternalMailTab
          department="projects_manager"
          title="مراسلات إدارة المشاريع"
        />
      </div>
    </div>
  );
}
