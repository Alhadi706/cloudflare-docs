'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /dashboard/corrosion — top-level dept hub for CORR
 * The full corrosion module lives at /dashboard/admin-gateway/corrosion.
 * This page is the canonical DEPT_DASHBOARD entry point for CORR dept members.
 */
export default function CorrosionHubPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin-gateway/corrosion');
  }, [router]);
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
      <p className="text-slate-400 text-sm">جاري التحميل...</p>
    </div>
  );
}
