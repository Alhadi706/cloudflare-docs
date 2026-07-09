'use client';

import dynamic from 'next/dynamic';

const MINERVAShell = dynamic(
  () => import('./components/MINERVAShell'),
  { ssr: false, loading: () => (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="text-slate-500 text-sm">تحميل مختبر MINERVA...</div>
    </div>
  )}
);

export default function MINERVACenterPage() {
  return <MINERVAShell />;
}
