'use client';

import React from 'react';

export function SvyAnalysisPanel({ svyData }: { svyData?: any[] }) {
  const count = Array.isArray(svyData) ? svyData.length : 0;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
      <p className="font-semibold text-slate-100">لوحة تحليل SVY</p>
      <p className="mt-2 text-slate-400">تم استرجاع الواجهة التاريخية بدون ملف التحليل الأصلي. عدد السجلات الحالية: {count}</p>
    </div>
  );
}
