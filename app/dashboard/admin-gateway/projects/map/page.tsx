'use client';
/**
 * Projects Map — يعرض جميع مشاريع المؤسسة على خريطة الأصول الهندسية
 * يستخدم نفس الخريطة الفضائية وطبقات GIS الموحدة
 */
import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Layers } from 'lucide-react';

export default function ProjectsMapPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-slate-950" dir="rtl">
      {/* Breadcrumb strip */}
      <div className="shrink-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500 z-10">
        <Link href="/dashboard/admin-gateway" className="hover:text-slate-300 transition">بوابة النظام</Link>
        <ChevronLeft className="w-3 h-3" />
        <Link href="/dashboard/admin-gateway/projects/list" className="hover:text-slate-300 transition">المشاريع</Link>
        <ChevronLeft className="w-3 h-3" />
        <span className="text-slate-300 font-medium flex items-center gap-1">
          <Layers className="w-3 h-3" />
          عرض الخرائط
        </span>
        <span className="mr-auto text-[10px] text-slate-600">
          الأصول والمشاريع على الخريطة الموحدة — اضغط على أي أصل لعرض تفاصيله
        </span>
      </div>

      {/* Full map — reuse asset registry which IS the unified engineering workspace */}
      <div className="flex-1 relative">
        <iframe
          src="/dashboard/admin-gateway/assets/registry"
          className="w-full h-full border-0"
          title="خريطة المشاريع والأصول"
        />
      </div>
    </div>
  );
}
