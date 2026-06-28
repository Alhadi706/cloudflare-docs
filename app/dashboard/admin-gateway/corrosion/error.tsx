'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CorrosionError({ error, reset }: Props) {
  useEffect(() => {
    console.error('Corrosion route runtime error:', error);
  }, [error]);

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto rounded-2xl border border-rose-500/30 bg-slate-900/85 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-sm md:text-base font-bold">تعذر تحميل واجهة إدارة التآكل</h2>
          </div>
          <Link href="/dashboard/admin-gateway" className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            الرجوع للبوابة
          </Link>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-300">
            حدث خطأ أثناء تشغيل الصفحة. تم إيقاف الانهيار الكامل للحفاظ على الخريطة والهيكل العام.
          </p>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-400">
            <div className="mb-1 text-slate-500">التفاصيل:</div>
            <div className="font-mono break-all text-rose-300/90">{error?.message || 'Unknown runtime error'}</div>
            {error?.digest ? (
              <div className="mt-1 font-mono text-slate-500">digest: {error.digest}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  );
}
