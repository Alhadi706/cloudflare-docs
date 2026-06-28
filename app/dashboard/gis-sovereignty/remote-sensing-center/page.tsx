'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoteSensingCenterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/gis-sovereignty/satellite-intelligence-center');
  }, [router]);
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">جاري التحويل إلى مركز الاستخبارات الفضائية الموحد…</p>
      </div>
    </div>
  );
}
