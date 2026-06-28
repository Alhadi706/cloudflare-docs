'use client';

import { AlertTriangle } from 'lucide-react';

export default function GisRouteError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 text-slate-200 p-8">
      <div className="max-w-lg text-center border border-slate-700 rounded-xl p-6 bg-slate-900/80">
        <AlertTriangle className="w-9 h-9 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">حدث خطأ في وحدة السيادة الجغرافية</h2>
        <p className="text-sm text-slate-400 mb-4">تم تفعيل شاشة حماية الأعطال. يمكنك إعادة المحاولة دون فقدان الجلسة.</p>
        <button onClick={reset} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
